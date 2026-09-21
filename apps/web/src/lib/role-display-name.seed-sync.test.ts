import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

/**
 * PharosGRC — the pt-BR role map and the seed must name the same twelve roles
 * (ADR-022, CLAUDE.md §11.1).
 *
 * ## The failure this exists to make loud
 *
 * `common.roleDisplayNames` is keyed by the role's stored `Role.name`, and
 * `roleDisplayName` falls back to that raw name for anything it does not
 * recognise — which is exactly right for a role somebody created through the
 * admin screens, and exactly wrong after a seed rename. Rename
 * `Audit Lead` in `platform.seed.ts` and nothing breaks: no type error, no
 * runtime error, no failing test. The screen simply goes back to English for
 * that one role, and stays that way until a human notices.
 *
 * This repository has already shipped that failure once.
 * `profile.identity.roleLabels` (`lib/messages/profile.ts`, live on the Perfil
 * screen since 001) named SIX of the twelve seeded roles; the other six
 * rendered in English there from the day they were seeded until the catalogues
 * were unified, and no gate saw it. A map keyed by a value that lives in
 * another workspace needs a guard that can see both sides — which is why this
 * test reads the seed from disk.
 *
 * ## Why reading `apps/api` from an `apps/web` test is the right shape
 *
 * It is a file read, not an import: no module graph, no build coupling, no
 * dependency added to either workspace (CLAUDE.md §2). A guard that could only
 * see `apps/web` could not detect a divergence whose other half is in
 * `apps/api` — it would be the kind of green-but-empty gate
 * `specs/006-assets-processes/STATE.md` §2.4 records.
 *
 * The seed itself is NEVER modified by this phase. `Role.name` is `@unique`
 * and is the key `upsertSystemRoles` upserts on; these twelve strings are
 * database identifiers and stay in English.
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

const SEED_FILE = path.join(repoRoot(), 'apps', 'api', 'prisma', 'seed', 'platform.seed.ts');

/**
 * The `name` of every entry of `SYSTEM_ROLE_DEFINITIONS`, read out of the seed
 * source.
 *
 * Scoped to that array on purpose: the same file later seeds development
 * fixtures that also carry a `name:` (an org unit, a control, a process, an
 * asset), and sweeping the whole file would mix them in.
 */
function seededRoleNames(): string[] {
  const lines = readFileSync(SEED_FILE, 'utf8').split(/\r?\n/);

  const start = lines.findIndex((line) => line.includes('SYSTEM_ROLE_DEFINITIONS'));
  if (start === -1) {
    throw new Error(`SYSTEM_ROLE_DEFINITIONS not found in ${SEED_FILE}.`);
  }
  const end = lines.findIndex((line, index) => index > start && line.trimEnd() === '];');
  if (end === -1) {
    throw new Error(`The SYSTEM_ROLE_DEFINITIONS array in ${SEED_FILE} is not terminated by "];".`);
  }

  const names: string[] = [];
  for (const line of lines.slice(start, end)) {
    // A `name:` property at the definition's own indentation, with a
    // single-quoted literal. A commented-out line is skipped, so prose
    // mentioning a role never counts as a definition.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    const match = /^name:\s*'([^']+)',?$/.exec(trimmed);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}

describe('the pt-BR role map is in step with the seed', () => {
  const fromSeed = seededRoleNames();

  it('extracts the seeded roles, and only those — the guard is not vacuous', () => {
    // If the extractor silently found nothing (file moved, array renamed,
    // formatting changed), every set comparison below would trivially pass
    // against an empty list. It must not.
    expect(fromSeed).toHaveLength(12);
    expect(fromSeed).toContain('Platform Administrator');
    expect(fromSeed).toContain('Problem Manager');
    // The dev fixtures further down the same file must NOT be picked up.
    expect(fromSeed.some((name) => name.includes('fixture'))).toBe(false);
    expect(new Set(fromSeed).size).toBe(fromSeed.length);
  });

  it('has a pt-BR name for every role the seed creates', () => {
    const missing = fromSeed.filter((name) => !Object.hasOwn(common.roleDisplayNames, name));

    expect(missing).toEqual([]);
  });

  it('has no entry for a role the seed does not create', () => {
    const stale = Object.keys(common.roleDisplayNames).filter((name) => !fromSeed.includes(name));

    expect(stale).toEqual([]);
  });
});
