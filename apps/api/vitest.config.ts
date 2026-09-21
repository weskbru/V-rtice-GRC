import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// 2026-09-11 (007-implementation-remediation, Front G): `include` narrowed
// from `test/**/*.spec.ts` to `test/unit/**/*.spec.ts`. The bare
// `test/**/*.spec.ts` glob also matched `test/integration/**` and
// `test/contract/**` — so the root `"test"` script (`vitest run`, this
// config's own consumer) silently picked up integration/contract spec
// files too, against whichever `DATABASE_URL` happened to be set, with
// NEITHER of those suites' own `globalSetup` (migration + reset) ever
// running. This file's own header has always claimed "unit tests — pure
// domain, no I/O, no database"; the glob is now what makes that claim true
// rather than aspirational. `test:unit` (`vitest run test/unit`) already
// worked correctly via its positional filter regardless of this `include`
// — this change makes the bare `test` script agree with it instead of
// silently doing something larger and untested.
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
