/**
 * In-process mutual exclusion per key: `run(key, fn)` waits for every earlier `run` with the same
 * key to settle before calling `fn`. Different keys never wait for each other.
 *
 * The catalog importer uses it around "find the row, else create it", which is a race when two
 * requests import the same album at once (several users searching the same thing). It only
 * serializes work inside one API process; across processes the unique constraints plus the
 * importer's "conflict -> re-read the winner" path keep the data consistent.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    try {
      await previous;
      return await fn();
    } finally {
      release();
      // Last holder for this key: drop the entry so the map does not grow without bound.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }

  /** Keys with a holder or waiters (tests). */
  get size(): number {
    return this.tails.size;
  }
}
