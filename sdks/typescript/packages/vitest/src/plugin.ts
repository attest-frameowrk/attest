import { EngineManager, AttestClient } from "@attest-ai/core";

let engineManager: EngineManager | undefined;
let attestClient: AttestClient | undefined;

export interface AttestGlobalSetupOptions {
  enginePath?: string;
  logLevel?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __attest_engine__: EngineManager | undefined;
  // eslint-disable-next-line no-var
  var __attest_client__: AttestClient | undefined;
  // eslint-disable-next-line no-var
  var __attest_session_cost__: number;
  // eslint-disable-next-line no-var
  var __attest_session_soft_failures__: number;
}

export function attestGlobalSetup(options?: AttestGlobalSetupOptions) {
  return {
    async setup() {
      engineManager = new EngineManager({
        enginePath: options?.enginePath,
        logLevel: options?.logLevel ?? "warn",
      });

      await engineManager.start();
      attestClient = new AttestClient(engineManager);

      globalThis.__attest_engine__ = engineManager;
      globalThis.__attest_client__ = attestClient;
      globalThis.__attest_session_cost__ = 0;
      globalThis.__attest_session_soft_failures__ = 0;
    },

    async teardown() {
      if (engineManager) {
        await engineManager.stop();
        engineManager = undefined;
        attestClient = undefined;
      }

      globalThis.__attest_engine__ = undefined;
      globalThis.__attest_client__ = undefined;
    },
  };
}
