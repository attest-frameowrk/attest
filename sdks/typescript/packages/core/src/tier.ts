export const TIER_1 = 1 as const;
export const TIER_2 = 2 as const;
export const TIER_3 = 3 as const;

export function tier(level: number): <T extends (...args: never[]) => unknown>(fn: T) => T {
  return <T extends (...args: never[]) => unknown>(fn: T): T => {
    (fn as Record<string, unknown>)._attest_tier = level;
    return fn;
  };
}
