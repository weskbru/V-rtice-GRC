import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function repoRoot(): string {
  let current = __dirname;
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Could not locate the repository root (no pnpm-workspace.yaml above this test).');
}

const WEB_SRC = path.join(repoRoot(), 'apps', 'web', 'src');

const PRESENTATION_DIR = 'features/admin/components/roles';

const EXPORTED_SYMBOLS = ['isPrivilegedRole', 'PRIVILEGED_PERMISSION_IDENTIFIERS'];

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

function readSources(directory: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...readSources(absolute));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    files.push({
      relativePath: path.relative(WEB_SRC, absolute).split(path.sep).join('/'),
      content: readFileSync(absolute, 'utf8'),
    });
  }
  return files;
}

const SOURCES = readSources(WEB_SRC);

describe('ADR-021 — the privilege classification is reachable only from the roles screen', () => {
  it('sweeps a non-empty set of web sources, including the modules that decide what to show', () => {
    expect(SOURCES.length).toBeGreaterThan(200);
    const paths = SOURCES.map((file) => file.relativePath);
    expect(paths).toContain('lib/permissions.ts');
    expect(paths).toContain('lib/auth-context.tsx');
    expect(paths).toContain('lib/server-session.ts');
    expect(paths).toContain(`${PRESENTATION_DIR}/role-privilege.ts`);
  });

  it('is referenced by no module outside the roles presentation folder', () => {
    const offenders: string[] = [];
    for (const file of SOURCES) {
      if (file.relativePath.startsWith(`${PRESENTATION_DIR}/`)) continue;
      for (const symbol of EXPORTED_SYMBOLS) {
        if (file.content.includes(symbol)) {
          offenders.push(`${file.relativePath} references "${symbol}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is referenced inside that folder by production code, so the rule above is not guarding a dead export', () => {
    const consumers = SOURCES.filter(
      (file) =>
        file.relativePath.startsWith(`${PRESENTATION_DIR}/`) &&
        !file.relativePath.endsWith('role-privilege.ts') &&
        !/\.test\.tsx?$/.test(file.relativePath) &&
        /import\s*\{[^}]*isPrivilegedRole[^}]*\}\s*from\s*'\.\/role-privilege'/.test(file.content),
    ).map((file) => file.relativePath);

    expect(consumers.sort()).toEqual([
      `${PRESENTATION_DIR}/role-card.tsx`,
      `${PRESENTATION_DIR}/role-detail-panel.tsx`,
    ]);
  });
});
