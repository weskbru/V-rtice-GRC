/**
 * PharosGRC — structural guard for the Audit Engagements feature's date
 * rendering (005-audit-findings, T081).
 *
 * `features/audit-engagements/date.ts` states the rule in its own module
 * doc comment: every date this module renders goes through one of its
 * helpers, "never a bare `new Date(...).toLocaleDateString()` at a call
 * site". This test is that sentence, enforced.
 *
 * ## The defect this exists because of
 *
 * `(app)/audits/[auditId]/audit-engagement-detail-view.tsx` rendered the
 * engagement's period in its `EntityHeader` metadata with
 * `new Date(engagement.periodStart).toLocaleDateString('pt-BR')`.
 * `periodStart`/`periodEnd` are `format: date` in
 * `contracts/audit.openapi.yaml` — date-ONLY, no time, no zone — and
 * `new Date('2026-01-01')` parses as UTC midnight, which in any timezone
 * behind UTC renders as the PREVIOUS day. The header therefore read
 * "Período: 31/12/2025 a 30/03/2026" for an engagement created as
 * 2026-01-01 → 2026-03-31, while `AuditEngagementOverview` a few hundred
 * pixels below — which correctly used `formatDateOnly` — read
 * "01/01/2026 a 31/03/2026". Two different dates for the same field on the
 * same screen.
 *
 * Every unit test passed, typecheck passed, lint passed. It was found by
 * looking at the rendered page (CLAUDE.md §18.1), which is the whole
 * reason that gate exists.
 *
 * The pattern was not invented here — it was copied from
 * `(app)/controls/[id]/control-detail-view.tsx`, where the very same
 * expression is CORRECT because `createdAt`/`retiredAt` are `date-time`
 * fields. That is exactly why the guard is structural rather than a fix to
 * one line: the expression is not wrong in itself, it is wrong on a
 * date-only field, and the only durable defence is routing every date in
 * this module through the helpers that know which is which.
 *
 * ## Scope
 *
 * The GUARD is deliberately scoped to this feature's own directories — a
 * future module inherits the rule by adding its own copy, the same way it
 * inherits the Design System.
 *
 * The FIXES went wider, and deliberately so. The `toISOString().slice(0,
 * 10)` default was found in three files: this module's own
 * `engagement-finding-create-dialog.tsx`, plus the pre-existing
 * `features/findings/components/finding-create-dialog.tsx` (which this
 * module's own dialog was copied from) and
 * `features/evidence/components/evidence-create-dialog.tsx` — the dialog
 * FR-010's evidence requirement now routes users straight into. AGENTS.md
 * requires a fix to "generalize to every call site sharing the vulnerable
 * pattern, not only the reported instance", so all three were corrected
 * rather than only the one inside this feature's boundary. The two outside
 * it are reported explicitly as out-of-scope fixes rather than folded in
 * silently.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FEATURE_ROOT = path.resolve(__dirname);
const ROUTES_ROOT = path.resolve(__dirname, '..', '..', 'app', '(app)', 'audits');

/**
 * The helper module itself is the ONE place these calls are allowed — it is
 * what every other file is required to delegate to.
 */
const ALLOWED = new Set([path.resolve(FEATURE_ROOT, 'date.ts')]);

/** `new Date(<anything>).toLocaleDateString(...)` / `.toLocaleString(...)`. */
const BARE_DATE_FORMATTING = /new\s+Date\s*\([^)]*\)\s*\.\s*toLocale(?:Date|Time)?String\s*\(/;

/**
 * `new Date().toISOString().slice(0, 10)` / `.split('T')[0]` — deriving a
 * `YYYY-MM-DD` calendar date from the UTC instant.
 *
 * The second half of the same defect. `EngagementFindingCreateDialog`
 * defaulted "Data de identificação" this way, so on the rendered screen at
 * 20:41 BRT (UTC-3) it pre-filled 09/09/2026 — TOMORROW — on 08/09/2026.
 * Any timezone behind UTC gets a default date that has not happened yet
 * for the whole evening, every day.
 */
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

  // Non-vacuity: a guard that scans an empty file list would pass forever
  // while protecting nothing — the same third assertion the API-side
  // structural guards in this repository carry.
  it('actually scans this feature and its routes — the guard is not vacuously true', () => {
    expect(listSourceFiles(FEATURE_ROOT).length).toBeGreaterThan(5);
    expect(listSourceFiles(ROUTES_ROOT).length).toBeGreaterThan(0);
  });

  // The regex must match the exact expression the defect used, or the
  // guard above would be green against the very code it exists to reject.
  it('recognises the expression the original defect was written with', () => {
    expect(
      BARE_DATE_FORMATTING.test("new Date(engagement.periodStart).toLocaleDateString('pt-BR')"),
    ).toBe(true);
    expect(BARE_DATE_FORMATTING.test('formatDateOnly(engagement.periodStart)')).toBe(false);
  });

  it('recognises the UTC date-only derivation the identification-date default was written with', () => {
    expect(UTC_DATE_ONLY_DERIVATION.test('new Date().toISOString().slice(0, 10)')).toBe(true);
    expect(UTC_DATE_ONLY_DERIVATION.test("new Date().toISOString().split('T')[0]")).toBe(true);
    // A full `date-time` sent to the API is legitimate and must NOT trip.
    expect(UTC_DATE_ONLY_DERIVATION.test('new Date().toISOString()')).toBe(false);
  });
});
