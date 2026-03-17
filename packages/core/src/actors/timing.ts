import { fromCallback, type AnyEventObject } from 'xstate';

/**
 * Creates a timing monitor actor that watches for frame drops.
 * Runs a rAF loop and reports when frames take longer than threshold.
 *
 * Sends TIMING.FRAME_DROP events to parent when frames are dropped.
 */
export const timingMonitor = fromCallback<AnyEventObject, { threshold?: number }>(
  ({ sendBack, input }) => {
    const threshold = input?.threshold ?? 20; // ms (60fps = 16.67ms)
    let lastFrame = performance.now();
    let rafId: number;

    function tick() {
      const now = performance.now();
      const delta = now - lastFrame;
      if (delta > threshold) {
        const dropped = Math.floor(delta / 16.67) - 1;
        sendBack({
          type: 'TIMING.FRAME_DROP',
          droppedFrames: dropped,
          timestamp: now,
        });
      }
      lastFrame = now;
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }
);

/** High-resolution timestamp. Wrapper for testability/mocking. */
export function now(): number {
  return performance.now();
}

/** Schedule a callback on the next animation frame. Returns cancel function. */
export function onNextFrame(callback: (timestamp: number) => void): () => void {
  const id = requestAnimationFrame(callback);
  return () => cancelAnimationFrame(id);
}
