import type { ErrorData } from "./types.js";

export class ProtocolError extends Error {
  readonly code: number;
  readonly errorMessage: string;
  readonly data: ErrorData | undefined;

  constructor(code: number, message: string, data?: ErrorData) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.errorMessage = message;
    this.data = data;
  }
}
