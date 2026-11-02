import type { BenchmarkId } from '../types/benchmark';

/** Readable input samples, never executed by the browser or the demo adapter. */
export const samplePrograms: Record<BenchmarkId, string> = {
  duplicates: `# Sample: duplicate detection
# Try editing this code. Execution is not enabled yet.

def find_duplicates(values):
    seen = set()
    duplicates = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return sorted(duplicates)


values = [3, 1, 3, 2, 1]
print(find_duplicates(values))
`,
  fibonacci: `# Sample: Fibonacci with memoization
# Try editing this code. Execution is not enabled yet.

from functools import cache


def fibonacci(n):
    @cache
    def calculate(value):
        if value < 2:
            return value
        return calculate(value - 1) + calculate(value - 2)

    return calculate(n)


print(fibonacci(20))
`,
};
