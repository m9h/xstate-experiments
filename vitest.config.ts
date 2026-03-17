import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: [
      'packages/*/src/**/*.test.ts',
      'examples/*/__tests__/*.test.ts',
      // Also match when vitest is run from a subdirectory
      'src/**/*.test.ts',
      '__tests__/*.test.ts',
    ],
  },
});
