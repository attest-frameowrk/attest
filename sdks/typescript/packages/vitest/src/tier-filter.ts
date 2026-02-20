interface TestItem {
  name: string;
  fn?: (...args: unknown[]) => unknown;
}

export function filterByTier<T extends TestItem>(items: T[], maxTier: number): T[] {
  return items.filter((item) => {
    const fn = item.fn;
    if (fn === undefined) return true;
    const tier = (fn as unknown as Record<string, unknown>)._attest_tier;
    if (tier === undefined) return true;
    return Number(tier) <= maxTier;
  });
}
