import { setup, assign, fromPromise } from 'xstate';

export interface TrialResult {
  trialIndex: number;
  [key: string]: unknown;
}

interface DataCollectorContext {
  buffer: TrialResult[];
  flushedCount: number;
  flushEndpoint: string | null;
  autoFlushThreshold: number;
  allData: TrialResult[];
}

/**
 * Data collection actor that buffers trial results and can flush to a backend.
 *
 * Events:
 *   RECORD_TRIAL — add a trial result to the buffer
 *   FLUSH — trigger manual flush to endpoint
 *   EXPORT — get all collected data
 *   STOP — transition to done
 */
export const dataCollectorMachine = setup({
  types: {} as {
    context: DataCollectorContext;
    events:
      | { type: 'RECORD_TRIAL'; data: TrialResult }
      | { type: 'FLUSH' }
      | { type: 'EXPORT' }
      | { type: 'STOP' };
  },
  actors: {
    flushToEndpoint: fromPromise(
      async ({ input }: { input: { endpoint: string; data: TrialResult[] } }) => {
        const response = await fetch(input.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trials: input.data }),
        });
        if (!response.ok) {
          throw new Error(`Flush failed: ${response.status}`);
        }
        return response.json();
      }
    ),
  },
  actions: {
    bufferTrial: assign(({ context, event }) => {
      const e = event as { type: 'RECORD_TRIAL'; data: TrialResult };
      return {
        buffer: [...context.buffer, e.data],
        allData: [...context.allData, e.data],
      };
    }),
    clearBuffer: assign({
      buffer: () => [] as TrialResult[],
      flushedCount: ({ context }) => context.flushedCount + context.buffer.length,
    }),
    logExport: ({ context }) => {
      console.log('[data-collector] Export:', context.allData);
    },
  },
  guards: {
    shouldAutoFlush: ({ context }) =>
      context.flushEndpoint !== null &&
      context.buffer.length >= context.autoFlushThreshold,
    hasEndpoint: ({ context }) => context.flushEndpoint !== null,
  },
}).createMachine({
  id: 'dataCollector',
  initial: 'idle',
  context: {
    buffer: [],
    flushedCount: 0,
    flushEndpoint: null,
    autoFlushThreshold: 10,
    allData: [],
  },
  states: {
    idle: {
      on: {
        RECORD_TRIAL: [
          {
            target: 'flushing',
            guard: 'shouldAutoFlush',
            actions: 'bufferTrial',
          },
          {
            target: 'idle',
            actions: 'bufferTrial',
          },
        ],
        FLUSH: [
          { target: 'flushing', guard: 'hasEndpoint' },
          { target: 'idle' },
        ],
        EXPORT: {
          target: 'idle',
          actions: 'logExport',
        },
        STOP: 'done',
      },
    },
    flushing: {
      invoke: {
        src: 'flushToEndpoint',
        input: ({ context }) => ({
          endpoint: context.flushEndpoint!,
          data: context.buffer,
        }),
        onDone: {
          target: 'idle',
          actions: 'clearBuffer',
        },
        onError: {
          target: 'idle',
          // Keep buffer on error — will retry on next flush
        },
      },
    },
    done: { type: 'final' },
  },
});
