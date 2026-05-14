export interface TimedResult<T> {
  result: T;
  executionTimeMs: number;
}

export function nowMs(): number {
  return performance.now();
}

export function measureExecution<T>(callback: () => T): TimedResult<T> {
  const start = nowMs();
  const result = callback();
  const end = nowMs();

  return {
    result,
    executionTimeMs: end - start
  };
}
