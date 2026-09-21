import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * PharosGRC — ADR-021's boundary, on the client side: the privilege
 * classification may be read by the roles screen and by nothing else.
 *
 * ## What `role-privilege.test.ts` already proves, and what it cannot
 *
 * The sibling file proves the predicate is a pure function of three exact
 * identifiers. That is the DEFINITION half of ADR-021's second guard. It
 * says nothing about who may call it — and the violation ADR-021 describes
 * is precisely a call site, not a definition: "a partir do momento em que
 * uma decisão de autorização consulta 'este papel é privilegiado?', a
 * plataforma passa a ter dois eixos de autorização".
 *
 * On the server there is nothing to reach (a sweep proves it:
 * `apps/api/test/unit/role-privilege-classification-boundary.spec.ts`). On
 * the client the predicate is right there, one import away from
 * `lib/permissions.ts`, `lib/auth-context.tsx`, `lib/server-session.ts` and
 * `middleware.ts` — the four places where the browser decides what to show
 * and where to route. This file makes that import fail a test.
 *
 * ## Why a reference sweep rather than a behavioural assertion
 *
 * There is no behaviour to assert on this side: the classification's only
 * effect is a badge and a paragraph, both already covered by
 * `role-privilege-badge.test.tsx` ("is presentation only: it exposes no
 * control, no input and no interactive role"). The risk is not that the
 * label misbehaves — it is that it acquires a second reader. A reference
 * sweep is the only shape that sees a new reader the moment it appears,
 * before it has done anything measurable.
 *
 * It is scoped by DIRECTORY rather than by file name so that a future
 * `role-privilege-*.tsx` in the same presentation folder needs no edit here,
 * while an import from anywhere else fails by name.
 */

/** Repo root, found by the workspace manifest rather than by counting `..` segments. */
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

/** The only directory allowed to read the classification: the roles screen itself. */
const PRESENTATION_DIR = 'features/admin/components/roles';

/** Every spelling by which the classification can be reached from another module. */
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
    // A sweep that read nothing would pass the assertions below vacuously,
    // and naming these four pins that the sweep really does cover the places
    // a violation would live.
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
    /*
     * A failure names the file. The one that would matter most is
     * `lib/permissions.ts` — `usePermissions` is what every screen asks
     * "may I show this?", and a classification consulted there would be a
     * second axis of gating derived from a label, which ADR-021 forbids by
     * name. `lib/server-session.ts` and `middleware.ts` are the routing
     * equivalents.
     */
    expect(offenders).toEqual([]);
  });

  it('is referenced inside that folder by production code, so the rule above is not guarding a dead export', () => {
    const consumers = SOURCES.filter(
      (file) =>
        file.relativePath.startsWith(`${PRESENTATION_DIR}/`) &&
        !file.relativePath.endsWith('role-privilege.ts') &&
        !/\.test\.tsx?$/.test(file.relativePath) &&
        // An IMPORT, not a mention: `role-privilege-badge.tsx` names the
        // predicate in its own doc comment while deliberately not calling it.
        /import\s*\{[^}]*isPrivilegedRole[^}]*\}\s*from\s*'\.\/role-privilege'/.test(file.content),
    ).map((file) => file.relativePath);

    // CLAUDE.md §19.10 — a boundary around something nothing calls is a
    // rule about nothing. These are the two real readers.
    expect(consumers.sort()).toEqual([
      `${PRESENTATION_DIR}/role-card.tsx`,
      `${PRESENTATION_DIR}/role-detail-panel.tsx`,
    ]);
  });
});
