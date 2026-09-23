import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FEATURE_ROOT = path.resolve(__dirname);
const ROUTES_ROOT = path.resolve(__dirname, '..', '..', 'app', '(app)', 'assets');

const ALLOWED = new Set([path.resolve(FEATURE_ROOT, 'date.ts')]);

const BARE_DATE_FORMATTING = /new\s+Date\s*\([^)]*\)\s*\.\s*toLocale(?:Date|Time)?String\s*\(/;

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
    .filter((file) => BARE_DATE_FORMATTING.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(path.resolve(__dirname, '..', '..', '..'), file));
}

describe('Asset Management renders every date through features/assets/date.ts', () => {
  it('no component or route formats a date outside date.ts', () => {
    expect(offendingFiles()).toEqual([]);
  });

  it('actually scans this feature and its routes — the guard is not vacuously true', () => {
    expect(listSourceFiles(FEATURE_ROOT).length).toBeGreaterThan(5);
    expect(listSourceFiles(ROUTES_ROOT).length).toBeGreaterThan(0);
  });

  it('recognises the expression the original defect (audit-engagements) was written with', () => {
    expect(
      BARE_DATE_FORMATTING.test("new Date(engagement.periodStart).toLocaleDateString('pt-BR')"),
    ).toBe(true);
    expect(BARE_DATE_FORMATTING.test('formatTimestampDate(asset.updatedAt)')).toBe(false);
  });
});
