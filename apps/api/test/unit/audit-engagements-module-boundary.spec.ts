/**
 * T021/005-audit-findings (FR-017, SC-008) — a static, filesystem-level
 * proof that `modules/audit-engagements` never imports `modules/risk`,
 * `modules/controls` or `modules/compliance`, and none of those three
 * imports it back. Same method as
 * `compliance-controls-risk-module-boundary.spec.ts`: a plain text scan of
 * import specifiers, with relative ones RESOLVED to an absolute path
 * before being classified — complementing (not replacing)
 * `eslint-plugin-boundaries`.
 *
 * Every dependency `modules/audit-engagements` has on Risk/Controls/
 * Compliance crosses `shared/grc-ports/` (`RiskDirectoryPort`,
 * `ControlDirectoryPort`, `FrameworkVersionDirectoryPort`,
 * `RequirementDirectoryPort`) — never a direct import, in either
 * direction (research.md D-11).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const AUDIT_ENGAGEMENTS_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'audit-engagements');
const RISK_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'risk');
const CONTROLS_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'controls');
const COMPLIANCE_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'compliance');

function listTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractSpecifiers(contents: string): string[] {
  const pattern = /(?:import|export)(?:[^'";]*from)?\s*['"]([^'"]+)['"]/g;
  const specifiers: string[] = [];
  for (const match of contents.matchAll(pattern)) {
    const specifier = match[1];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function resolvedImportTargets(file: string): string[] {
  const contents = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  return extractSpecifiers(contents)
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => path.resolve(dir, specifier));
}

function isUnder(target: string, moduleRoot: string): boolean {
  const relative = path.relative(moduleRoot, target);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function violatingImports(fromRoot: string, intoRoot: string): { file: string; target: string }[] {
  const violations: { file: string; target: string }[] = [];
  for (const file of listTsFiles(fromRoot)) {
    for (const target of resolvedImportTargets(file)) {
      if (isUnder(target, intoRoot)) {
        violations.push({
          file: path.relative(SRC_ROOT, file),
          target: path.relative(SRC_ROOT, target),
        });
      }
    }
  }
  return violations;
}

describe('modules/audit-engagements <-> modules/risk / modules/controls / modules/compliance boundary (FR-017, SC-008)', () => {
  it('the fixture directories themselves exist and contain files — guards the guard against a silently-empty scan', () => {
    expect(listTsFiles(AUDIT_ENGAGEMENTS_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(RISK_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(CONTROLS_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(COMPLIANCE_MODULE_ROOT).length).toBeGreaterThan(0);
  });

  it('no file under modules/audit-engagements imports anything from modules/risk', () => {
    const violations = violatingImports(AUDIT_ENGAGEMENTS_MODULE_ROOT, RISK_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/risk imports anything from modules/audit-engagements', () => {
    const violations = violatingImports(RISK_MODULE_ROOT, AUDIT_ENGAGEMENTS_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/audit-engagements imports anything from modules/controls', () => {
    const violations = violatingImports(AUDIT_ENGAGEMENTS_MODULE_ROOT, CONTROLS_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/controls imports anything from modules/audit-engagements', () => {
    const violations = violatingImports(CONTROLS_MODULE_ROOT, AUDIT_ENGAGEMENTS_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/audit-engagements imports anything from modules/compliance', () => {
    const violations = violatingImports(AUDIT_ENGAGEMENTS_MODULE_ROOT, COMPLIANCE_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/compliance imports anything from modules/audit-engagements', () => {
    const violations = violatingImports(COMPLIANCE_MODULE_ROOT, AUDIT_ENGAGEMENTS_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
