import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    root: './',
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    include: ['test/unit/**/*.spec.ts', 'src/**/*.spec.ts'],
  },
});
