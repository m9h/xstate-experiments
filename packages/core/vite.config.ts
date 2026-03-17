import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['xstate'],
    },
  },
  plugins: [
    dts({ rollupTypes: true, exclude: ['**/__tests__/**', '**/*.test.ts'] }),
  ],
  test: {
    globals: true,
  },
});
