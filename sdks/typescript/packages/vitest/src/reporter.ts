interface ReporterContext {
  printInfo: (message: string) => void;
}

export class AttestCostReporter {
  onFinished(_files: unknown, _errors: unknown, context?: ReporterContext): void {
    const cost = globalThis.__attest_session_cost__ ?? 0;
    const softFailures = globalThis.__attest_session_soft_failures__ ?? 0;

    const lines = [
      "",
      "=".repeat(50),
      "  Attest Cost Report",
      "=".repeat(50),
      `  Total LLM cost this session: $${cost.toFixed(6)} USD`,
      `  Soft failures recorded:       ${softFailures}`,
      "=".repeat(50),
      "",
    ];

    const output = lines.join("\n");

    if (context?.printInfo) {
      context.printInfo(output);
    } else {
      process.stdout.write(output);
    }
  }
}
