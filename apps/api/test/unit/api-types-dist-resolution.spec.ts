/**
 * T030 (007-implementation-remediation, FR-016, SC-004, F-19) — proves
 * `@pharos/api-types` resolves through its own BUILT artifact (`dist/`)
 * under ordinary Node/bundler module resolution, not only through the
 * TypeScript monorepo path alias every current consumer uses.
 *
 * ## The gap this closes
 *
 * `tsconfig.base.json` and `apps/web/tsconfig.json` both declare:
 *
 * ```json
 * "@pharos/api-types": ["packages/api-types/src/index.ts"]
 * ```
 *
 * That `paths` alias is a TypeScript-COMPILER-only mechanism — it rewrites
 * where `tsc` (and any tool that reads `tsconfig.json`'s `paths`, e.g.
 * `next build`) resolves the specifier to, but it has ZERO effect on plain
 * Node `require`/`import` resolution, which never reads `tsconfig.json` at
 * all. Every existing consumer of `@pharos/api-types`
 * (`apps/web/src/lib/api-client.ts`, `permissions.ts`,
 * `features/{evidence,findings,actions}/types.ts`, ...) is type-checked and
 * bundled through that alias, straight to `src/index.ts` — meaning nobody
 * has ever exercised whether `packages/api-types`'s `package.json`
 * (`"main"`/`"exports"` -> `./dist/index.js`) and its `dist/` build output
 * are even correct. `dist/` could be stale, broken, or entirely absent, and
 * every existing test/build in this repository would stay green.
 *
 * This test uses `require.resolve`, a Node runtime API that reads
 * `node_modules` and `package.json` exactly like a real external consumer
 * (or a bundler's default resolver) would — it does not, and cannot, consult
 * `tsconfig.json`'s `paths` in any way. `apps/api` newly depends on
 * `@pharos/api-types` (`workspace:*`, this front's own package.json change)
 * SOLELY so this proof has a real `node_modules/@pharos/api-types` symlink
 * to resolve through, created by the workspace's normal `pnpm install` —
 * the same mechanism a real external installer would produce from the
 * published package.
 *
 * apps/api's `vitest.config.ts` carries no `vite-tsconfig-paths`-style
 * plugin (verified directly — grepped every `*.config.ts` and
 * `package.json` under `apps/api`), so this suite's own module resolution
 * is exactly Node's own, not TypeScript's — this proof is not accidentally
 * laundered back through the alias by the test runner itself.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// `__filename`, not `import.meta.url`: apps/api's `tsconfig.json` targets
// `"module": "commonjs"` (matches its own `"type": "commonjs"` in
// package.json), under which `import.meta` is a compile error — this file
// runs as CommonJS like every other file in this project, `createRequire`
// accepts a plain path just as well as a `file://` URL.
const require = createRequire(__filename);

/**
 * Coordinator correction, 007-implementation-remediation — this test
 * failed for real on a clean CI checkout (the `test-unit` job never built
 * `@pharos/api-types` before running it) and died with a bare
 * `Cannot find module '.../dist/index.js'`, which names a path but tells
 * the reader nothing about WHY it is missing or what to do about it — the
 * least legible failure in the suite, for the one test that exists to
 * prove this package is actually consumable. Every call site below goes
 * through this wrapper instead of `require.resolve` directly, so the
 * failure names the real cause and the exact command to fix it, on a
 * contributor's own machine as much as in CI.
 */
function resolveApiTypesEntry(): string {
  try {
    return require.resolve('@pharos/api-types');
  } catch (error) {
    const isModuleNotFound =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND';
    if (!isModuleNotFound) {
      throw error;
    }
    throw new Error(
      '@pharos/api-types has no built dist/ artifact yet, so Node module resolution ' +
        "(this test's own point) cannot find it — the TypeScript path alias every other " +
        'consumer uses does not help here, and does not exist at runtime either. ' +
        'Run `pnpm --filter @pharos/api-types run build` (or `pnpm run build` from the ' +
        'repo root) and re-run this test.\n' +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

describe('T030/FR-016/SC-004 — @pharos/api-types resolves through dist/, not the tsconfig alias', () => {
  it("require.resolve lands on the package's BUILT dist/ artifact", () => {
    const resolvedPath = resolveApiTypesEntry();
    const normalized = resolvedPath.split(path.sep).join('/');

    expect(normalized).toMatch(/packages\/api-types\/dist\/index\.js$/);
    // The negative half of the same claim: this must NOT be the TypeScript
    // source the tsconfig alias points every other consumer at.
    expect(normalized).not.toMatch(/packages\/api-types\/src\//);
  });

  it('the resolved dist/index.js is real, on disk, and not empty', async () => {
    const resolvedPath = resolveApiTypesEntry();
    const fs = await import('node:fs/promises');
    const contents = await fs.readFile(resolvedPath, 'utf-8');
    expect(contents.length).toBeGreaterThan(0);
  });

  // `@pharos/api-types`'s own `exports` map deliberately does not expose a
  // `./package.json` subpath (a minimal, types-only package has no reason
  // to) — so the package directory below is derived from the ALREADY
  // Node-resolved entry point (`dist/index.js`, two directories up),
  // exactly as any real consumer's own tooling would have to, rather than
  // by resolving a path this package does not publish.
  function resolvePackageDir(): string {
    const entryPath = resolveApiTypesEntry();
    return path.dirname(path.dirname(entryPath));
  }

  it('the package.json "exports"/"main"/"types" fields actually point at files that exist', async () => {
    const packageDir = resolvePackageDir();
    const fs = await import('node:fs/promises');
    const packageJson = JSON.parse(
      await fs.readFile(path.join(packageDir, 'package.json'), 'utf-8'),
    ) as {
      readonly main: string;
      readonly types: string;
      readonly exports: { readonly '.': { readonly types: string; readonly default: string } };
    };

    for (const relativePath of [
      packageJson.main,
      packageJson.types,
      packageJson.exports['.'].types,
      packageJson.exports['.'].default,
    ]) {
      const absolutePath = path.resolve(packageDir, relativePath);
      await expect(fs.access(absolutePath)).resolves.toBeUndefined();
    }
  });

  it('every one of the ten generated namespace files exists in dist/generated', async () => {
    const packageDir = resolvePackageDir();
    const fs = await import('node:fs/promises');

    const NAMESPACES = [
      'auth',
      'admin',
      'platform',
      'risks',
      'grcfoundation',
      'controls',
      'compliance',
      'audit',
      'assets',
      'processes',
    ];

    for (const namespace of NAMESPACES) {
      const jsPath = path.join(packageDir, 'dist', 'generated', `${namespace}.js`);
      const dtsPath = path.join(packageDir, 'dist', 'generated', `${namespace}.d.ts`);
      await expect(fs.access(jsPath), `missing ${jsPath}`).resolves.toBeUndefined();
      await expect(fs.access(dtsPath), `missing ${dtsPath}`).resolves.toBeUndefined();
    }
  });
});
