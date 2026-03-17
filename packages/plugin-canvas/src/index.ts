import { setup, assign, type AnyEventObject } from 'xstate';

// ── Config & types ──────────────────────────────────────────────────

export interface CanvasTrialConfig {
  /** [width, height] of the canvas element in pixels */
  canvasSize: [number, number];
  /** ms to display the stimulus. null = wait for response. Default null. */
  stimulusDuration?: number | null;
  /** Whether a response ends the trial immediately. Default true. */
  responsePendsOnEnd?: boolean;
  /** Duration of the fixation cross in ms. Default 500. */
  fixationDuration?: number;
  /** Background color of the canvas. Default '#ffffff'. */
  backgroundColor?: string;
  /** Trial-level timeout in ms. null = no limit. Default null. */
  trialDuration?: number | null;
}

export interface CanvasTrialContext {
  canvasWidth: number;
  canvasHeight: number;
  stimulusDuration: number | null;
  responsePendsOnEnd: boolean;
  fixationDuration: number;
  backgroundColor: string;
  trialDuration: number | null;
  /** Accumulates render frame identifiers emitted by the machine */
  renderPhase: 'idle' | 'fixation' | 'stimulus' | 'blank';
  response: CanvasResponseData | null;
  rt: number | null;
  stimulusOnsetTime: number | null;
  trialStartTime: number | null;
}

export interface CanvasResponseData {
  /** Type of input that generated the response */
  type: 'click' | 'key';
  /** For click: canvas-relative coordinates */
  x?: number;
  y?: number;
  /** For key: the key pressed */
  key?: string;
  /** High-resolution timestamp of the event */
  timestamp: number;
}

export interface CanvasTrialOutput {
  canvasSize: [number, number];
  response: CanvasResponseData | null;
  rt: number | null;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a canvas-based trial machine.
 *
 * Statechart:
 *   fixation -> stimulus -> response -> done
 *
 * The machine emits render-phase context updates so the view layer knows
 * what to draw. Accepts CANVAS_CLICK and KEYPRESS events as responses.
 *
 * When responsePendsOnEnd is true (default), the first valid response
 * triggers an immediate transition to `done`. When false, the trial waits
 * for its trialDuration timeout.
 */
export function createCanvasTrialMachine(config: CanvasTrialConfig) {
  const {
    canvasSize,
    stimulusDuration = null,
    responsePendsOnEnd = true,
    fixationDuration = 500,
    backgroundColor = '#ffffff',
    trialDuration = null,
  } = config;

  return setup({
    types: {} as {
      context: CanvasTrialContext;
      events:
        | { type: 'CANVAS_CLICK'; x: number; y: number; timestamp: number }
        | { type: 'KEYPRESS'; key: string; timestamp: number }
        | AnyEventObject;
      output: CanvasTrialOutput;
    },
    actions: {
      recordTrialStart: assign({
        trialStartTime: () => performance.now(),
      }),
      setRenderFixation: assign({
        renderPhase: () => 'fixation' as const,
      }),
      setRenderStimulus: assign({
        renderPhase: () => 'stimulus' as const,
        stimulusOnsetTime: () => performance.now(),
      }),
      setRenderBlank: assign({
        renderPhase: () => 'blank' as const,
      }),
      recordClickResponse: assign(({ context, event }) => {
        const e = event as { type: 'CANVAS_CLICK'; x: number; y: number; timestamp: number };
        const rt = context.stimulusOnsetTime !== null
          ? e.timestamp - context.stimulusOnsetTime
          : null;
        return {
          response: { type: 'click' as const, x: e.x, y: e.y, timestamp: e.timestamp },
          rt,
        };
      }),
      recordKeyResponse: assign(({ context, event }) => {
        const e = event as { type: 'KEYPRESS'; key: string; timestamp: number };
        const rt = context.stimulusOnsetTime !== null
          ? e.timestamp - context.stimulusOnsetTime
          : null;
        return {
          response: { type: 'key' as const, key: e.key, timestamp: e.timestamp },
          rt,
        };
      }),
    },
    guards: {
      responsePends: () => responsePendsOnEnd,
      noResponsePends: () => !responsePendsOnEnd,
    },
    delays: {
      fixationDelay: () => fixationDuration,
      stimulusTimeout: () => stimulusDuration ?? 0,
      trialTimeout: () => trialDuration ?? 0,
    },
  }).createMachine({
    id: 'canvasTrial',
    initial: 'fixation',
    context: {
      canvasWidth: canvasSize[0],
      canvasHeight: canvasSize[1],
      stimulusDuration,
      responsePendsOnEnd,
      fixationDuration,
      backgroundColor,
      trialDuration,
      renderPhase: 'idle',
      response: null,
      rt: null,
      stimulusOnsetTime: null,
      trialStartTime: null,
    },
    states: {
      fixation: {
        entry: ['recordTrialStart', 'setRenderFixation'],
        after: { fixationDelay: 'stimulus' },
      },

      stimulus: {
        entry: 'setRenderStimulus',
        on: {
          CANVAS_CLICK: [
            {
              guard: 'responsePends',
              actions: 'recordClickResponse',
              target: 'done',
            },
            {
              guard: 'noResponsePends',
              actions: 'recordClickResponse',
              target: 'response',
            },
          ],
          KEYPRESS: [
            {
              guard: 'responsePends',
              actions: 'recordKeyResponse',
              target: 'done',
            },
            {
              guard: 'noResponsePends',
              actions: 'recordKeyResponse',
              target: 'response',
            },
          ],
        },
        after: {
          // If stimulus has a finite duration, advance to response-waiting phase
          ...(stimulusDuration !== null
            ? { stimulusTimeout: 'response' }
            : {}),
        },
      },

      response: {
        entry: 'setRenderBlank',
        on: {
          CANVAS_CLICK: {
            actions: 'recordClickResponse',
            target: 'done',
          },
          KEYPRESS: {
            actions: 'recordKeyResponse',
            target: 'done',
          },
        },
        after: {
          // If trial has a total duration limit, timeout to done
          ...(trialDuration !== null
            ? { trialTimeout: 'done' }
            : {}),
        },
      },

      done: { type: 'final' as const },
    },

    output: ({ context }) => ({
      canvasSize: [context.canvasWidth, context.canvasHeight] as [number, number],
      response: context.response,
      rt: context.rt,
    }),
  });
}
