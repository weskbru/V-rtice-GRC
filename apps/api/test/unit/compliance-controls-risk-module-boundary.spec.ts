/**
 * T017/004-compliance-management (SC-007, FR-024) — a static,
 * filesystem-level proof that `modules/compliance` never imports
 * `modules/controls` or `modules/risk`, and neither imports it back,
 * complementing (not replacing) `eslint-plugin-boundaries`
 * (`apps/api/eslint.config.mjs`). Every dependency Compliance has on
 * Controls crosses `shared/grc-ports/` (`ControlDirectoryPort`,
 * `ControlEffectivenessPort`) — never a direct import, in either
 * direction (research.md D-9).
 *
 * Same method as `controls-risk-module-boundary.spec.ts`
 * (003-controls-management, T012): a plain text scan of import specifiers,
 * with relative ones RESOLVED to an absolute path before being classified.
 * Extended to three pairwise checks (compliance<->controls,
 * compliance<->risk) rather than the original's two, since this module
 * introduces a third business module into the same boundary graph.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const RISK_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'risk');
const CONTROLS_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'controls');
const COMPLIANCE_MODULE_ROOT = path.join(SRC_ROOT, 'modules', 'compliance');

/** Recursively lists every `.ts` file under `dir` (test files included —
 * a cross-module import inside a test file living under `src/modules/**`
 * would be exactly as real a boundary violation as one in application
 * code). */
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

/** Every import/export specifier string literal in `contents` — covers
 * `import ... from '...'`, side-effect `import '...'` and `export ...
 * from '...'`, which is every ES module import shape this codebase uses
 * (no dynamic `import()`/CommonJS `require` in `src/modules/**`). */
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

/** Resolves every RELATIVE specifier in `file` to an absolute path
 * (extension-less — good enough to test whether it falls under a given
 * module's directory tree, which is all this test needs). Non-relative
 * specifiers (package imports, e.g. `@nestjs/common`, `@prisma/client`)
 * cannot resolve into `src/modules/**` at all and are skipped. */
function resolvedImportTargets(file: string): string[] {
  const contents = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  return extractSpecifiers(contents)
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => path.resolve(dir, specifier));
}

/** True when `target` (an absolute, extension-less resolved path) falls
 * inside `moduleRoot`'s directory tree. */
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

describe('modules/compliance <-> modules/controls / modules/risk boundary (SC-007, FR-024)', () => {
  it('the fixture directories themselves exist and contain files — guards the guard against a silently-empty scan', () => {
    expect(listTsFiles(COMPLIANCE_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(CONTROLS_MODULE_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(RISK_MODULE_ROOT).length).toBeGreaterThan(0);
  });

  it('no file under modules/compliance imports anything from modules/controls', () => {
    const violations = violatingImports(COMPLIANCE_MODULE_ROOT, CONTROLS_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/controls imports anything from modules/compliance', () => {
    const violations = violatingImports(CONTROLS_MODULE_ROOT, COMPLIANCE_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/compliance imports anything from modules/risk', () => {
    const violations = violatingImports(COMPLIANCE_MODULE_ROOT, RISK_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('no file under modules/risk imports anything from modules/compliance', () => {
    const violations = violatingImports(RISK_MODULE_ROOT, COMPLIANCE_MODULE_ROOT);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
