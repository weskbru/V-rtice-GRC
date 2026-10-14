import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const require = createRequire(__filename);

function resolveApiTypesEntry(): string {
  try {
    return require.resolve('@vertice/api-types');
  } catch (error) {
    const isModuleNotFound =
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND';
    if (!isModuleNotFound) {
      throw error;
    }
    throw new Error(
      '@vertice/api-types has no built dist/ artifact yet, so Node module resolution ' +
        "(this test's own point) cannot find it — the TypeScript path alias every other " +
        'consumer uses does not help here, and does not exist at runtime either. ' +
        'Run `pnpm --filter @vertice/api-types run build` (or `pnpm run build` from the ' +
        'repo root) and re-run this test.\n' +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

describe('T030/FR-016/SC-004 — @vertice/api-types resolves through dist/, not the tsconfig alias', () => {
  it("require.resolve lands on the package's BUILT dist/ artifact", () => {
    const resolvedPath = resolveApiTypesEntry();
    const normalized = resolvedPath.split(path.sep).join('/');

    expect(normalized).toMatch(/packages\/api-types\/dist\/index\.js$/);
    expect(normalized).not.toMatch(/packages\/api-types\/src\//);
  });

  it('the resolved dist/index.js is real, on disk, and not empty', async () => {
    const resolvedPath = resolveApiTypesEntry();
    const fs = await import('node:fs/promises');
    const contents = await fs.readFile(resolvedPath, 'utf-8');
    expect(contents.length).toBeGreaterThan(0);
  });

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
