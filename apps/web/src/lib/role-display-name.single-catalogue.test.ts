import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

/**
 * PharosGRC — there is exactly ONE map from a role's stored `Role.name` to a
 * pt-BR label (ADR-022 as amended 2026-09-14, CLAUDE.md §19.7).
 *
 * ## The defect this exists to make impossible
 *
 * The product shipped TWO of these maps for fourteen phases:
 *
 *   - `profile.identity.roleLabels` (`lib/messages/profile.ts`), on the Perfil
 *     screen since 001, naming SIX of the twelve seeded roles;
 *   - `admin.roles.displayNames`, added by ADR-022, naming all twelve.
 *
 * So the same platform printed "Gestor de Riscos" on one screen and
 * "Compliance Manager" on the other, for six of the twelve roles, and nothing
 * anywhere went red. Both lookups fell back to the raw `Role.name`, and a
 * fallback never fails — which is exactly why a type, a unit test on the
 * resolver, and even the seed-sync guard could all be green while half the
 * roles rendered in English.
 *
 * ## Why the guard has to read the source tree
 *
 * Neither the compiler nor any behavioural test can see a SECOND map: it is a
 * new object literal in a new file, valid TypeScript, with its own lookup.
 * The only thing that distinguishes it is its shape in the source — an object
 * keyed by a seeded role name. So this guard reads every production file under
 * `apps/web/src` and fails if any of them, other than the one canonical
 * catalogue, keys an object by one of those twelve names.
 *
 * The check is deliberately structural and deliberately narrow: a role name in
 * a comment, in prose, in a type union (`features/admin/types.ts` lists all
 * twelve as a closed union, and must) or as a VALUE is not an offence. Only a
 * KEY with a string value is, because that is what a second catalogue looks
 * like.
 */

const WEB_SRC = path.resolve(__dirname, '..');

/** The canonical catalogue's own file — the one place these keys belong. */
const CANONICAL = path.join(WEB_SRC, 'lib', 'messages', 'common.ts');

/** The twelve seeded `Role.name` values, taken from the catalogue whose exhaustiveness `role-display-name.seed-sync.test.ts` proves against the seed itself. */
const SEEDED_NAMES = new Set(Object.keys(common.roleDisplayNames));

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly key: string;
}

/** Every `.ts`/`.tsx` file under `apps/web/src` that is not a test. */
function productionFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__snapshots__') continue;
      found.push(...productionFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) continue;
    found.push(full);
  }
  return found;
}

/**
 * A property KEY — quoted (`'Audit Lead':`) or bare (`Auditor:`) — whose value
 * is a string literal. A union member (`| 'Audit Lead'`), an argument, a
 * comparison and a comment all fail to match, which is the point.
 */
const STRING_KEYED_ENTRY = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*['"`]/;

function offencesIn(file: string): Offence[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const offences: Offence[] = [];
  let insideBlockComment = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (insideBlockComment) {
      if (trimmed.includes('*/')) insideBlockComment = false;
      return;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) insideBlockComment = true;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    const match = STRING_KEYED_ENTRY.exec(trimmed);
    const key = match?.[1] ?? match?.[2] ?? match?.[3];
    if (key && SEEDED_NAMES.has(key)) {
      offences.push({ file: path.relative(WEB_SRC, file), line: index + 1, key });
    }
  });

  return offences;
}

describe('exactly one catalogue maps a role name to a pt-BR label', () => {
  const files = productionFiles(WEB_SRC).filter((file) => file !== CANONICAL);

  it('sweeps the whole production tree, and knows the twelve names — the guard is not vacuous', () => {
    expect(SEEDED_NAMES.size).toBe(12);
    expect(SEEDED_NAMES.has('Compliance Manager')).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(200);
    // The one file that is excluded must actually exist, or the exclusion is
    // silently sweeping nothing away and the detector below proves nothing.
    expect(files).not.toContain(CANONICAL);
    expect(productionFiles(WEB_SRC)).toContain(CANONICAL);
  });

  it('detects the catalogue shape when it looks at the real catalogue', () => {
    // Run the detector against `common.ts` itself: it must find all twelve.
    // If this went to zero — regex drifted, comment handling swallowed the
    // block, formatting changed — the sweep below would be green against a
    // tree full of second catalogues.
    const canonical = offencesIn(CANONICAL);

    expect(canonical).toHaveLength(12);
    expect(canonical.map((offence) => offence.key)).toContain('Platform Administrator');
  });

  it('leaves the closed union, and any other non-key use, alone', () => {
    // `features/admin/types.ts` names all twelve as union members. That is
    // the compile-time exhaustiveness check the catalogue depends on, not a
    // second catalogue, and the detector must not confuse the two.
    expect(STRING_KEYED_ENTRY.test("| 'Audit Lead'")).toBe(false);
    expect(STRING_KEYED_ENTRY.test("roleDisplayName('Audit Lead')")).toBe(false);
    expect(STRING_KEYED_ENTRY.test("name === 'Audit Lead'")).toBe(false);
    // ...and must not miss either spelling of a key.
    expect(STRING_KEYED_ENTRY.test("'Audit Lead': 'Líder de Auditoria',")).toBe(true);
    expect(STRING_KEYED_ENTRY.test("Auditor: 'Auditor',")).toBe(true);
  });

  it('finds no second map anywhere else in apps/web/src', () => {
    const offences = files.flatMap(offencesIn);

    expect(
      offences.map((offence) => `${offence.file}:${offence.line} — key "${offence.key}"`),
    ).toEqual([]);
  });
});
