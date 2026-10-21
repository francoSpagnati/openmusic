/** Minimal logger shape shared by Fastify's logger and `console`-based scripts. */
export interface TaskLogger {
  warn(obj: unknown, msg?: string): void;
}

/**
 * Bounded in-process queue for work that must not delay a response (dominant colors and
 * MusicBrainz enrichment after a search). Tasks with the same key are coalesced while pending.
 * Failures are logged, never thrown.
 */
export class BackgroundQueue {
  private readonly pending = new Map<string, () => Promise<unknown>>();
  private readonly order: string[] = [];
  private running = 0;
  private closed = false;
  private idleWaiters: Array<() => void> = [];

  constructor(
    private readonly logger: TaskLogger,
    private readonly concurrency = 2,
    private readonly maxPending = 200
  ) {}

  /** Queues `task` unless a task with the same key is already waiting. */
  enqueue(key: string, task: () => Promise<unknown>): void {
    if (this.closed || this.pending.has(key) || this.pending.size >= this.maxPending) return;
    this.pending.set(key, task);
    this.order.push(key);
    this.pump();
  }

  /** Resolves when nothing is queued or running (tests and scripts wait on it). */
  idle(): Promise<void> {
    if (this.running === 0 && this.order.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  /** Stops accepting tasks and waits for the running ones. */
  async close(): Promise<void> {
    this.closed = true;
    this.order.splice(0);
    this.pending.clear();
    await this.idle();
  }

  private pump(): void {
    while (this.running < this.concurrency && this.order.length > 0) {
      const key = this.order.shift();
      if (key === undefined) break;
      const task = this.pending.get(key);
      this.pending.delete(key);
      if (!task) continue;
      this.running++;
      task()
        .catch((err: unknown) => this.logger.warn({ err, task: key }, 'Background task failed'))
        .finally(() => {
          this.running--;
          this.pump();
          if (this.running === 0 && this.order.length === 0) {
            for (const resolve of this.idleWaiters.splice(0)) resolve();
          }
        });
    }
  }
}
