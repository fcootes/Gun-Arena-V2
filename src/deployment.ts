import { initialization } from './performance';

/** Painting is a real event-loop boundary, not a progress bar around a long task. */
export function yieldForPaint(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { if (frame) cancelAnimationFrame(frame); if (timer !== undefined) clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new DOMException('Deployment canceled', 'AbortError')); };
    const finish = () => { signal.removeEventListener('abort', cancel); if (signal.aborted) cancel(); else resolve(); };
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    if (typeof document !== 'undefined' && !document.hidden)
      frame = requestAnimationFrame(() => { timer = setTimeout(finish, 0); });
    else timer = setTimeout(finish, 0);
  });
}
export class DeploymentPipeline {
  private controller = new AbortController();
  constructor(private progress: (stage: string) => void) {}
  cancel() { this.controller.abort(); }
  get canceled() { return this.controller.signal.aborted; }
  async stage<T>(name: string, action: () => T | Promise<T>): Promise<T> {
    this.controller.signal.throwIfAborted();
    this.progress(name);
    await yieldForPaint(this.controller.signal);
    this.controller.signal.throwIfAborted();
    const start = performance.now();
    try {
      const result = await action();
      this.controller.signal.throwIfAborted();
      return result;
    } finally { initialization.record(name, performance.now() - start); }
  }
}
