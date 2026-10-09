import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

function repoRoot(): string {
  let current = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Could not locate the repository root (no pnpm-workspace.yaml above this test).');
}

const SEED_FILE = path.join(repoRoot(), 'backend', 'seeds', 'platform.seed.ts');

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
    expect(fromSeed).toHaveLength(12);
    expect(fromSeed).toContain('Platform Administrator');
    expect(fromSeed).toContain('Problem Manager');
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
