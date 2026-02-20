import type { AssertionResult, Trace } from "./proto/types.js";
import {
  STATUS_PASS,
  STATUS_SOFT_FAIL,
  STATUS_HARD_FAIL,
} from "./proto/constants.js";

export class AgentResult {
  readonly trace: Trace;
  readonly assertionResults: readonly AssertionResult[];
  readonly totalCost: number;
  readonly totalDurationMs: number;

  constructor(
    trace: Trace,
    assertionResults: readonly AssertionResult[] = [],
    totalCost = 0.0,
    totalDurationMs = 0,
  ) {
    this.trace = trace;
    this.assertionResults = assertionResults;
    this.totalCost = totalCost;
    this.totalDurationMs = totalDurationMs;
  }

  get passed(): boolean {
    return this.assertionResults.every((r) => r.status === STATUS_PASS);
  }

  get failedAssertions(): readonly AssertionResult[] {
    return this.assertionResults.filter((r) => r.status !== STATUS_PASS);
  }

  get hardFailures(): readonly AssertionResult[] {
    return this.assertionResults.filter((r) => r.status === STATUS_HARD_FAIL);
  }

  get softFailures(): readonly AssertionResult[] {
    return this.assertionResults.filter((r) => r.status === STATUS_SOFT_FAIL);
  }

  get passCount(): number {
    return this.assertionResults.filter((r) => r.status === STATUS_PASS).length;
  }

  get failCount(): number {
    return this.assertionResults.length - this.passCount;
  }
}
