/**
 * T022/005-audit-findings — proves `grc/finding` never imports
 * `modules/risk` or `modules/controls` directly: every dependency it will
 * have on either (`FindingControlLink`/`FindingRiskLink`, Fase 5, owned by
 * the `grc/finding` workstream, out of this task's own scope) must cross
 * `shared/grc-ports/*` (`ControlDirectoryPort`, already reused unchanged;
 * `RiskDirectoryPort`, new — T012) — the first case registered in
 * research.md D-4 of a GRC-KERNEL module (`grc/**`), not a business
 * module, consuming a `shared/grc-ports/` port. Same filesystem-scan
 * method as `audit-engagements-module-boundary.spec.ts`/
 * `compliance-controls-risk-module-boundary.spec.ts` — this file does not
 * edit `grc/finding` itself, only reads it.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const FINDING_MODULE_ROOT = path.join(SRC_ROOT, 'grc', 'finding');
const RISK_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'risk');
const CONTROLS_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'controls');

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

describe('grc/finding <-> modules/risk / modules/controls boundary (research.md D-4)', () => {
  it('the fixture directories themselves exist and contain files — guards the guard against a silently-empty scan', () => {
    expect(listTsFiles(FINDING_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(RISK_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(CONTROLS_MODULE_ROOT).length).toBeGreaterThan(0);
  });

  it('no file under grc/finding imports anything from modules/risk directly', () => {
    const violations = violatingImports(FINDING_MODULE_ROOT, RISK_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under grc/finding imports anything from modules/controls directly', () => {
    const violations = violatingImports(FINDING_MODULE_ROOT, CONTROLS_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
