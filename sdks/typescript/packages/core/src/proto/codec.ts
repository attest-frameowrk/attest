import type { ErrorData, RPCResponse } from "./types.js";
import { ProtocolError } from "./errors.js";

/**
 * Encode a JSON-RPC 2.0 request as an NDJSON line.
 */
export function encodeRequest(
  id: number,
  method: string,
  params: Record<string, unknown>,
): string {
  const msg = {
    jsonrpc: "2.0" as const,
    id,
    method,
    params,
  };
  return JSON.stringify(msg) + "\n";
}

/**
 * Decode a JSON-RPC 2.0 response from an NDJSON line.
 * Throws ProtocolError if the response contains an error.
 * Throws Error for malformed JSON or invalid responses.
 */
export function decodeResponse(line: string): RPCResponse {
  const text = line.trim();
  if (!text) {
    throw new Error("empty response line");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`malformed JSON response: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`expected JSON object, got ${Array.isArray(data) ? "array" : typeof data}`);
  }

  const obj = data as Record<string, unknown>;

  if (obj.jsonrpc !== "2.0") {
    throw new Error(`invalid jsonrpc version: ${String(obj.jsonrpc)}`);
  }

  if (obj.error != null) {
    const err = obj.error as Record<string, unknown>;
    let errorData: ErrorData | undefined;

    if (err.data != null) {
      const raw = err.data as Record<string, unknown>;
      errorData = {
        error_type: (raw.error_type as string) ?? "",
        retryable: (raw.retryable as boolean) ?? false,
        detail: (raw.detail as string) ?? "",
      };
    }

    throw new ProtocolError(
      (err.code as number) ?? -1,
      (err.message as string) ?? "unknown error",
      errorData,
    );
  }

  return obj as unknown as RPCResponse;
}

/**
 * Extract the result field from a decoded response.
 */
export function extractResult(response: RPCResponse): unknown {
  if (response.result === undefined) {
    throw new Error("response missing 'result' field");
  }
  return response.result;
}

/**
 * Extract the request ID from a decoded response.
 */
export function extractId(response: RPCResponse): number {
  if (response.id === undefined) {
    throw new Error("response missing 'id' field");
  }
  return Number(response.id);
}
