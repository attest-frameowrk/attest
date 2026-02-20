import {
  type ExpectChain,
  type Assertion,
  type Trace,
  type EvaluateBatchResult,
  AgentResult,
  AttestClient,
  EngineManager,
  STATUS_SOFT_FAIL,
} from "@attest-ai/core";

export class AttestEngineFixture {
  private manager: EngineManager | undefined;
  private _client: AttestClient | undefined;

  constructor(options?: { enginePath?: string; logLevel?: string }) {
    this.manager = new EngineManager({
      enginePath: options?.enginePath,
      logLevel: options?.logLevel ?? "warn",
    });
  }

  async start(): Promise<void> {
    if (this.manager === undefined) {
      throw new Error("AttestEngineFixture already stopped.");
    }
    await this.manager.start();
    this._client = new AttestClient(this.manager);
  }

  async stop(): Promise<void> {
    if (this.manager) {
      await this.manager.stop();
      this.manager = undefined;
      this._client = undefined;
    }
  }

  get client(): AttestClient {
    if (this._client === undefined) {
      throw new Error("Engine not started. Call start() first.");
    }
    return this._client;
  }

  async evaluate(
    chain: ExpectChain,
    options?: { budget?: number },
  ): Promise<AgentResult> {
    const result = await this.client.evaluateBatch(chain.trace, chain.assertions);

    globalThis.__attest_session_cost__ =
      (globalThis.__attest_session_cost__ ?? 0) + (result.total_cost ?? 0);

    const softFailCount = (result.results ?? []).filter(
      (r) => r.status === STATUS_SOFT_FAIL,
    ).length;
    globalThis.__attest_session_soft_failures__ =
      (globalThis.__attest_session_soft_failures__ ?? 0) + softFailCount;

    const agentResult = new AgentResult(
      chain.trace,
      result.results ?? [],
      result.total_cost ?? 0,
      result.total_duration_ms ?? 0,
    );

    if (
      options?.budget !== undefined &&
      globalThis.__attest_session_cost__ > options.budget
    ) {
      throw new Error(
        `Attest budget exceeded: cost $${globalThis.__attest_session_cost__.toFixed(6)}` +
        ` > budget $${options.budget.toFixed(6)}`,
      );
    }

    return agentResult;
  }
}

export function useAttest(): AttestEngineFixture {
  const client = globalThis.__attest_client__;
  const engine = globalThis.__attest_engine__;

  if (client === undefined || engine === undefined) {
    throw new Error(
      "Attest engine not available. Configure attestGlobalSetup() in vitest.config.ts globalSetup.",
    );
  }

  // Return a fixture wrapper around the existing global engine
  const fixture = new AttestEngineFixture();
  // Override the internal state to use the global instance
  Object.defineProperty(fixture, "client", { get: () => client });
  return fixture;
}

export async function evaluate(
  chain: ExpectChain,
  options?: { budget?: number },
): Promise<AgentResult> {
  const fixture = useAttest();
  return fixture.evaluate(chain, options);
}
