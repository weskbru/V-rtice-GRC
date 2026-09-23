import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FEATURE_ROOT = path.resolve(__dirname);
const ROUTES_ROOT = path.resolve(__dirname, '..', '..', 'app', '(app)', 'audits');

const ALLOWED = new Set([path.resolve(FEATURE_ROOT, 'date.ts')]);

const BARE_DATE_FORMATTING = /new\s+Date\s*\([^)]*\)\s*\.\s*toLocale(?:Date|Time)?String\s*\(/;

const UTC_DATE_ONLY_DERIVATION =
  /\.\s*toISOString\s*\(\s*\)\s*\.\s*(?:slice\s*\(\s*0\s*,\s*10\s*\)|split\s*\(\s*['"]T['"]\s*\))/;

function listSourceFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function offendingFiles(): readonly string[] {
  return [...listSourceFiles(FEATURE_ROOT), ...listSourceFiles(ROUTES_ROOT)]
    .filter((file) => !ALLOWED.has(file))
    .filter((file) => {
      const source = readFileSync(file, 'utf8');
      return BARE_DATE_FORMATTING.test(source) || UTC_DATE_ONLY_DERIVATION.test(source);
    })
    .map((file) => path.relative(path.resolve(__dirname, '..', '..', '..'), file));
}

describe('Audit Engagements renders every date through features/audit-engagements/date.ts', () => {
  it('no component or route formats or derives a date outside date.ts', () => {
    expect(offendingFiles()).toEqual([]);
  });

  it('actually scans this feature and its routes — the guard is not vacuously true', () => {
    expect(listSourceFiles(FEATURE_ROOT).length).toBeGreaterThan(5);
    expect(listSourceFiles(ROUTES_ROOT).length).toBeGreaterThan(0);
  });

  it('recognises the expression the original defect was written with', () => {
    expect(
      BARE_DATE_FORMATTING.test("new Date(engagement.periodStart).toLocaleDateString('pt-BR')"),
    ).toBe(true);
    expect(BARE_DATE_FORMATTING.test('formatDateOnly(engagement.periodStart)')).toBe(false);
  });

  it('recognises the UTC date-only derivation the identification-date default was written with', () => {
    expect(UTC_DATE_ONLY_DERIVATION.test('new Date().toISOString().slice(0, 10)')).toBe(true);
    expect(UTC_DATE_ONLY_DERIVATION.test("new Date().toISOString().split('T')[0]")).toBe(true);
    expect(UTC_DATE_ONLY_DERIVATION.test('new Date().toISOString()')).toBe(false);
  });
});
