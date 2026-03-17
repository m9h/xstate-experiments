import { fromCallback, type AnyEventObject } from 'xstate';

/**
 * Keyboard input actor. Listens for keydown events and forwards them
 * to the parent as KEYPRESS events.
 *
 * Input: { validKeys?: string[] } — if provided, only these keys are forwarded
 */
export const keyboardInput = fromCallback<AnyEventObject, { validKeys?: string[] }>(
  ({ sendBack, input }) => {
    const handler = (e: KeyboardEvent) => {
      if (!input?.validKeys || input.validKeys.includes(e.key)) {
        sendBack({
          type: 'KEYPRESS',
          key: e.key,
          code: e.code,
          timestamp: performance.now(),
        });
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }
);

/**
 * Mouse click input actor. Listens for click events on a target element
 * and forwards them as CLICK events.
 *
 * Input: { selector?: string } — CSS selector for the target element (defaults to document)
 */
export const mouseInput = fromCallback<AnyEventObject, { selector?: string }>(
  ({ sendBack, input }) => {
    const target = input?.selector
      ? document.querySelector(input.selector) ?? document
      : document;

    const handler = (e: Event) => {
      const me = e as MouseEvent;
      sendBack({
        type: 'CLICK',
        x: me.clientX,
        y: me.clientY,
        timestamp: performance.now(),
        target: (me.target as HTMLElement)?.dataset,
      });
    };

    target.addEventListener('click', handler);
    return () => target.removeEventListener('click', handler);
  }
);
