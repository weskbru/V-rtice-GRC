/**
 * PharosGRC — structural guard for the Asset Management feature's date
 * rendering (006-assets-processes, T046/T051).
 *
 * `features/assets/date.ts` states the rule in its own module doc comment:
 * every date this module renders goes through one of its helpers, never a
 * bare `new Date(...).toLocaleDateString()`/`.toLocaleString()` at a call
 * site. This test is that sentence, enforced — copied from
 * `features/audit-engagements/date-call-sites.test.ts`, which exists
 * because exactly this pattern once printed two different dates for the
 * same field on one screen (see that file's own doc comment for the full
 * defect history).
 *
 * ## Scope
 *
 * The GUARD is deliberately scoped to this feature's own directories and
 * its routes — a future module inherits the rule by adding its own copy,
 * the same way it inherits the Design System.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FEATURE_ROOT = path.resolve(__dirname);
const ROUTES_ROOT = path.resolve(__dirname, '..', '..', 'app', '(app)', 'assets');

/** The helper module itself is the ONE place these calls are allowed. */
const ALLOWED = new Set([path.resolve(FEATURE_ROOT, 'date.ts')]);

/** `new Date(<anything>).toLocaleDateString(...)` / `.toLocaleString(...)`. */
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
      // Test files are excluded: this file itself necessarily contains the
      // offending expression as a string literal, in the assertion below
      // that proves the pattern is recognised at all.
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

  // Non-vacuity: a guard that scans an empty file list would pass forever
  // while protecting nothing.
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
