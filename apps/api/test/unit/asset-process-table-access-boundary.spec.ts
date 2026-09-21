/**
 * T041/006-assets-processes, User Story 3 (SC-005, FR-021) — a structural,
 * automated proof that no module OTHER than `modules/assets`/
 * `modules/processes` reads the `assets`/`processes` tables directly.
 *
 * Before this fase, TWO call sites violated this: `modules/controls/
 * infrastructure/reference-registry-lookup.repository.ts` and `modules/
 * risk/infrastructure/prisma-registry.repository.ts` (`findById`, for
 * both tables, plus `list` for both). T036 replaced every one of them with
 * `AssetDirectoryPort`/`ProcessDirectoryPort` (`shared/grc-ports/`) —
 * Constitution Principle I: "acesso entre domínios DEVE ocorrer através de
 * interfaces explícitas e declaradas; alcançar diretamente o modelo
 * interno ou as tabelas de outro domínio é proibido."
 *
 * Modeled on `controls-risk-module-boundary.spec.ts`'s scan approach (see
 * that file's own header for the general shape this one does not repeat):
 * a plain-text scan, not a NestJS container or a database — fast and
 * exhaustive over every `.ts` file in `src/`. Comment-only mentions (this
 * file's own header included, and several already-shipped doc comments
 * explaining WHY a file no longer does this) are stripped before matching,
 * so documenting the boundary in prose can never trip this guard — only an
 * actual `prisma.client.asset`/`prisma.client.process` property access can.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const ALLOWED_ROOTS = [
  path.join(SRC_ROOT, 'modules', 'assets'),
  path.join(SRC_ROOT, 'modules', 'processes'),
];

const FORBIDDEN_ACCESS = [
  { label: 'prisma.client.asset', pattern: /prisma\s*\.\s*client\s*\.\s*asset\b/g },
  { label: 'prisma.client.process', pattern: /prisma\s*\.\s*client\s*\.\s*process\b/g },
] as const;

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

function isUnderAnyAllowedRoot(file: string): boolean {
  return ALLOWED_ROOTS.some((root) => {
    const relative = path.relative(root, file);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  });
}

/** Strips `//` line comments and block/doc comments (`/star ... star/`)
 * before scanning — a file that only ever MENTIONS
 * `prisma.client.asset`/`prisma.client.process` in prose (explaining why
 * it no longer reads them, e.g. this file's own header) must never trip
 * this guard; only a real property access in executable code can. Good
 * enough for this codebase's own style (no such literal ever appears
 * inside a string literal or template literal in `src/**`), the same
 * "precise about the one thing this test needs" trade-off
 * `contract-coverage.spec.ts`'s own line-scanner header describes. */
function stripComments(contents: string): string {
  return contents
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

interface Violation {
  readonly file: string;
  readonly access: string;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const file of listTsFiles(SRC_ROOT)) {
    if (isUnderAnyAllowedRoot(file)) {
      continue;
    }
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    for (const { label, pattern } of FORBIDDEN_ACCESS) {
      pattern.lastIndex = 0;
      if (pattern.test(code)) {
        violations.push({ file: path.relative(SRC_ROOT, file), access: label });
      }
    }
  }
  return violations;
}

describe('No module outside modules/assets and modules/processes reads those tables directly (T041, SC-005, FR-021)', () => {
  it('the allowed roots themselves exist and contain files — guards the guard against a silently-empty scan', () => {
    for (const root of ALLOWED_ROOTS) {
      expect(listTsFiles(root).length).toBeGreaterThan(0);
    }
  });

  it('no `.ts` file outside modules/assets or modules/processes accesses prisma.client.asset or prisma.client.process', () => {
    const violations = findViolations();
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
