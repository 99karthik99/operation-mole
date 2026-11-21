/** Returns a function that runs async tasks with at most `concurrency` in flight. */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    active--;
    queue.shift()?.();
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      next();
    }
  };
}
