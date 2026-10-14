import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

const WEB_SRC = path.resolve(__dirname, '..');

const CANONICAL = path.join(WEB_SRC, 'lib', 'messages', 'common.ts');

const SEEDED_NAMES = new Set(Object.keys(common.roleDisplayNames));

interface Offence {
  readonly file: string;
  readonly line: number;
  readonly key: string;
}

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
    expect(files).not.toContain(CANONICAL);
    expect(productionFiles(WEB_SRC)).toContain(CANONICAL);
  });

  it('detects the catalogue shape when it looks at the real catalogue', () => {
    const canonical = offencesIn(CANONICAL);

    expect(canonical).toHaveLength(12);
    expect(canonical.map((offence) => offence.key)).toContain('Platform Administrator');
  });

  it('leaves the closed union, and any other non-key use, alone', () => {
    expect(STRING_KEYED_ENTRY.test("| 'Audit Lead'")).toBe(false);
    expect(STRING_KEYED_ENTRY.test("roleDisplayName('Audit Lead')")).toBe(false);
    expect(STRING_KEYED_ENTRY.test("name === 'Audit Lead'")).toBe(false);
    expect(STRING_KEYED_ENTRY.test("'Audit Lead': 'Líder de Auditoria',")).toBe(true);
    expect(STRING_KEYED_ENTRY.test("Auditor: 'Auditor',")).toBe(true);
  });

  it('finds no second map anywhere else in frontend/src', () => {
    const offences = files.flatMap(offencesIn);

    expect(
      offences.map((offence) => `${offence.file}:${offence.line} — key "${offence.key}"`),
    ).toEqual([]);
  });
});
