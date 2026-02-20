import type { Interface as ReadlineInterface } from "node:readline";
import type {
  Assertion,
  EvaluateBatchResult,
  Trace,
  AssertionResult,
} from "./proto/types.js";
import { ProtocolError } from "./proto/errors.js";
import {
  decodeResponse,
  encodeRequest,
  extractId,
  extractResult,
} from "./proto/codec.js";
import type { EngineManager } from "./engine-manager.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export class AttestClient {
  private readonly engine: EngineManager;
  private requestId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private writeChain: Promise<void> = Promise.resolve();
  private readerActive = false;
  private lineHandler: ((line: string) => void) | null = null;

  constructor(engine: EngineManager) {
    this.engine = engine;
  }

  startReader(): void {
    if (this.readerActive) return;

    const rl = this.engine.readlineInterface;
    if (rl === null) {
      throw new Error("Engine readline interface not available. Call engine.start() first.");
    }

    this.readerActive = true;
    this.lineHandler = (line: string) => this.handleLine(line);
    rl.on("line", this.lineHandler);

    rl.on("close", () => {
      this.failAll(new Error("Engine closed stdout."));
      this.readerActive = false;
    });
  }

  stopReader(): void {
    if (!this.readerActive) return;

    const rl = this.engine.readlineInterface;
    if (rl !== null && this.lineHandler !== null) {
      rl.removeListener("line", this.lineHandler);
    }

    this.lineHandler = null;
    this.readerActive = false;
  }

  private handleLine(line: string): void {
    let reqId: number;

    try {
      const response = decodeResponse(line);
      reqId = extractId(response);

      const pending = this.pending.get(reqId);
      if (pending === undefined) return;
      this.pending.delete(reqId);

      try {
        const result = extractResult(response);
        pending.resolve(result);
      } catch (err) {
        pending.reject(err);
      }
    } catch (err) {
      if (err instanceof ProtocolError) {
        // Try to extract id from raw JSON for error routing
        try {
          const raw = JSON.parse(line.trim()) as Record<string, unknown>;
          reqId = Number(raw.id ?? -1);
        } catch {
          reqId = -1;
        }
        const pending = this.pending.get(reqId);
        if (pending !== undefined) {
          this.pending.delete(reqId);
          pending.reject(err);
        }
      }
      // Malformed responses are silently discarded (logged in production)
    }
  }

  private failAll(err: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(err);
    }
    this.pending.clear();
  }

  async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.readerActive) {
      // Delegate to engine sequential mode
      return this.engine.sendRequest(method, params);
    }

    const cp = this.engine.childProcess;
    if (cp === null || cp.stdin === null) {
      throw new Error("Engine process not started.");
    }

    return new Promise<unknown>((resolve, reject) => {
      // Serialize writes through promise chain
      this.writeChain = this.writeChain.then(() => {
        this.requestId += 1;
        const reqId = this.requestId;
        this.pending.set(reqId, { resolve, reject });

        const requestStr = encodeRequest(reqId, method, params);
        cp.stdin!.write(requestStr, (err: Error | null | undefined) => {
          if (err) {
            this.pending.delete(reqId);
            reject(err);
          }
        });
      });
    });
  }

  async evaluateBatch(
    trace: Trace,
    assertions: readonly Assertion[],
  ): Promise<EvaluateBatchResult> {
    const params = {
      trace,
      assertions: [...assertions],
    };
    const raw = await this.sendRequest("evaluate_batch", params as Record<string, unknown>);
    return raw as EvaluateBatchResult;
  }

  async submitPluginResult(
    traceId: string,
    pluginName: string,
    assertionId: string,
    status: string,
    score: number,
    explanation: string,
  ): Promise<boolean> {
    const result: AssertionResult = {
      assertion_id: assertionId,
      status,
      score,
      explanation,
      cost: 0.0,
      duration_ms: 0,
    };
    const params = {
      trace_id: traceId,
      plugin_name: pluginName,
      assertion_id: assertionId,
      result,
    };
    const raw = await this.sendRequest("submit_plugin_result", params as Record<string, unknown>);
    return Boolean((raw as Record<string, unknown>)?.accepted ?? false);
  }
}
