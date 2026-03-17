import { setup, assign, type AnyEventObject } from 'xstate';

// ── Config & types ──────────────────────────────────────────────────

export interface InstructionsConfig {
  /** Array of HTML strings, one per instruction page */
  pages: string[];
  /** Whether the participant can navigate backward. Default true. */
  allowBackward?: boolean;
  /** Whether to display "Page X of Y" indicators. Default true. */
  showPageNumbers?: boolean;
  /** Key to advance to the next page. Default 'ArrowRight'. */
  nextKey?: string;
  /** Key to go back to the previous page. Default 'ArrowLeft'. */
  prevKey?: string;
}

export interface InstructionsContext {
  pages: string[];
  currentPage: number;
  totalPages: number;
  allowBackward: boolean;
  showPageNumbers: boolean;
  nextKey: string;
  prevKey: string;
  /** The HTML content of the currently visible page */
  currentContent: string;
  /** Tracks time spent on each page: [pageIndex] = ms[] */
  pageViewTimes: Record<number, number[]>;
  /** Timestamp when current page was entered */
  pageEnteredAt: number | null;
  /** Total time from first page shown to completion */
  startTime: number | null;
  rt: number | null;
}

export interface InstructionsOutput {
  /** Total ms from first page to final advance */
  rt: number | null;
  /** Per-page view durations (each page may be visited multiple times) */
  pageViewTimes: Record<number, number[]>;
  totalPages: number;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a multi-page instruction display machine.
 *
 * Statechart:
 *   showing -> done
 *
 * The `showing` state responds to NEXT and PREV events to page
 * through the instruction screens. PREV is only processed when
 * allowBackward is true and the participant is not on the first page.
 * NEXT on the last page transitions to `done`.
 *
 * Also accepts KEYPRESS events and maps them to NEXT/PREV based on
 * the configured keys.
 */
export function createInstructionsMachine(config: InstructionsConfig) {
  const {
    pages,
    allowBackward = true,
    showPageNumbers = true,
    nextKey = 'ArrowRight',
    prevKey = 'ArrowLeft',
  } = config;

  return setup({
    types: {} as {
      context: InstructionsContext;
      events:
        | { type: 'NEXT' }
        | { type: 'PREV' }
        | { type: 'KEYPRESS'; key: string; timestamp: number }
        | AnyEventObject;
      output: InstructionsOutput;
    },
    actions: {
      recordStartTime: assign({
        startTime: () => performance.now(),
        pageEnteredAt: () => performance.now(),
      }),
      goToNextPage: assign(({ context }) => {
        const now = performance.now();
        const viewDuration = context.pageEnteredAt !== null
          ? now - context.pageEnteredAt
          : 0;
        const currentPageTimes = context.pageViewTimes[context.currentPage] ?? [];
        const nextPageIndex = context.currentPage + 1;
        return {
          pageViewTimes: {
            ...context.pageViewTimes,
            [context.currentPage]: [...currentPageTimes, viewDuration],
          },
          currentPage: nextPageIndex,
          currentContent: context.pages[nextPageIndex],
          pageEnteredAt: now,
        };
      }),
      goToPrevPage: assign(({ context }) => {
        const now = performance.now();
        const viewDuration = context.pageEnteredAt !== null
          ? now - context.pageEnteredAt
          : 0;
        const currentPageTimes = context.pageViewTimes[context.currentPage] ?? [];
        const prevPageIndex = context.currentPage - 1;
        return {
          pageViewTimes: {
            ...context.pageViewTimes,
            [context.currentPage]: [...currentPageTimes, viewDuration],
          },
          currentPage: prevPageIndex,
          currentContent: context.pages[prevPageIndex],
          pageEnteredAt: now,
        };
      }),
      recordFinalPageTime: assign(({ context }) => {
        const now = performance.now();
        const viewDuration = context.pageEnteredAt !== null
          ? now - context.pageEnteredAt
          : 0;
        const currentPageTimes = context.pageViewTimes[context.currentPage] ?? [];
        return {
          pageViewTimes: {
            ...context.pageViewTimes,
            [context.currentPage]: [...currentPageTimes, viewDuration],
          },
          rt: context.startTime !== null ? now - context.startTime : null,
        };
      }),
    },
    guards: {
      canGoNext: ({ context }) => context.currentPage < context.totalPages - 1,
      isLastPage: ({ context }) => context.currentPage === context.totalPages - 1,
      canGoBack: ({ context }) =>
        context.allowBackward && context.currentPage > 0,
      isNextKeyAndCanAdvance: ({ context, event }) => {
        const e = event as { type: 'KEYPRESS'; key: string };
        return e.key === context.nextKey && context.currentPage < context.totalPages - 1;
      },
      isNextKeyAndLastPage: ({ context, event }) => {
        const e = event as { type: 'KEYPRESS'; key: string };
        return e.key === context.nextKey && context.currentPage === context.totalPages - 1;
      },
      isPrevKeyAndCanGoBack: ({ context, event }) => {
        const e = event as { type: 'KEYPRESS'; key: string };
        return e.key === context.prevKey && context.allowBackward && context.currentPage > 0;
      },
    },
  }).createMachine({
    id: 'instructions',
    initial: 'showing',
    context: {
      pages,
      currentPage: 0,
      totalPages: pages.length,
      allowBackward,
      showPageNumbers,
      nextKey,
      prevKey,
      currentContent: pages[0] ?? '',
      pageViewTimes: {},
      pageEnteredAt: null,
      startTime: null,
      rt: null,
    },
    states: {
      showing: {
        entry: 'recordStartTime',
        on: {
          // ── Direct NEXT / PREV button events ──
          NEXT: [
            {
              guard: 'canGoNext',
              actions: 'goToNextPage',
            },
            {
              guard: 'isLastPage',
              target: 'done',
              actions: 'recordFinalPageTime',
            },
          ],
          PREV: {
            guard: 'canGoBack',
            actions: 'goToPrevPage',
          },

          // ── Keyboard-driven navigation ──
          KEYPRESS: [
            {
              guard: 'isNextKeyAndCanAdvance',
              actions: 'goToNextPage',
            },
            {
              guard: 'isNextKeyAndLastPage',
              target: 'done',
              actions: 'recordFinalPageTime',
            },
            {
              guard: 'isPrevKeyAndCanGoBack',
              actions: 'goToPrevPage',
            },
          ],
        },
      },

      done: { type: 'final' as const },
    },

    output: ({ context }) => ({
      rt: context.rt,
      pageViewTimes: context.pageViewTimes,
      totalPages: context.totalPages,
    }),
  });
}
