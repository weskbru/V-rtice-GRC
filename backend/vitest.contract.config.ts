import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    root: './',
    environment: 'node',
    globals: false,
    passWithNoTests: false,
    include: ['test/contract/**/*.spec.ts'],
    globalSetup: ['test/integration/support/global-setup.ts'],
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
