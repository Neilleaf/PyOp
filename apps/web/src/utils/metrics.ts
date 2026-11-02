/** Null means a ratio cannot be represented meaningfully (including zero denominators). */
export function calculateSpeedup(originalNs: number, optimizedNs: number): number | null {
  if (
    !Number.isFinite(originalNs) ||
    !Number.isFinite(optimizedNs) ||
    originalNs <= 0 ||
    optimizedNs <= 0
  )
    return null;
  const ratio = originalNs / optimizedNs;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function formatDuration(ns: number): string {
  if (!Number.isFinite(ns) || ns < 0) return 'Unavailable';
  if (ns === 0) return '0 ns';
  if (ns < 0.01) return '<0.01 ns';
  const [divisor, unit] =
    ns >= 1e9 ? [1e9, 's'] : ns >= 1e6 ? [1e6, 'ms'] : ns >= 1e3 ? [1e3, 'µs'] : [1, 'ns'];
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(ns / divisor)} ${unit}`;
}

export function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) return 'Unavailable';
  if (ratio < 0.01) return '<0.01×';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(ratio)}×`;
}
