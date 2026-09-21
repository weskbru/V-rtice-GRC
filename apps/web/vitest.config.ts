import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for apps/web component tests (T049, extended for
 * T070–T078). jsdom environment + Testing Library, for presentational
 * components that don't need a real browser (Radix portal/pointer-capture-
 * heavy primitives are covered by Playwright instead — see
 * playwright.config.ts).
 *
 * `resolve.alias` mirrors the `@/*` path mapping in `tsconfig.json` — Vite
 * does not read `tsconfig.json`'s `paths` on its own, and shell/lib source
 * under test (`src/components/shell/**`, `src/lib/**`) uses that alias
 * throughout, matching the rest of apps/web.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
