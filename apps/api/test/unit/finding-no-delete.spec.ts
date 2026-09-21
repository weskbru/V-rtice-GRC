/**
 * T059/005-audit-findings — FR-012/SC-005: no operation under
 * `grc/finding/presentation` ever deletes a `Finding` row. Structural grep
 * over the presentation layer's own source, the same filesystem-scan
 * method `audit-engagements-module-boundary.spec.ts`/
 * `finding-grc-ports-boundary.spec.ts` already use — this test does not
 * edit `grc/finding`, only reads it.
 *
 * Scoped to `grc/finding` (this module's own ownership boundary) — the
 * companion assertion over `modules/audit-engagements`'s own presentation
 * layer and over `contracts/audit.openapi.yaml` belongs to whichever task
 * owns that module (T059's own text names both surfaces; this file proves
 * the half `grc/finding` is responsible for).
 *
 * The only `@Delete` routes anywhere under `grc/finding/presentation` are
 * `unlinkControl`/`unlinkRisk` (`finding-relationship.controller.ts`) —
 * both WITHDRAW a link (`unlinkedAt` stamped) rather than deleting a row,
 * and neither touches the `findings` table at all.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const PRESENTATION_ROOT = path.resolve(__dirname, '../../src/grc/finding/presentation');
const INFRASTRUCTURE_ROOT = path.resolve(__dirname, '../../src/grc/finding/infrastructure');

function listTsFiles(dir: string): string[] {
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

describe('grc/finding — no operation ever deletes a Finding row (FR-012, SC-005)', () => {
  it('the fixture directories themselves exist and contain files — guards the guard against a silently-empty scan', () => {
    expect(listTsFiles(PRESENTATION_ROOT).length).toBeGreaterThan(0);
    expect(listTsFiles(INFRASTRUCTURE_ROOT).length).toBeGreaterThan(0);
  });

  it('every @Delete route under grc/finding/presentation is a link withdrawal, never a Finding delete', () => {
    const deleteRouteFiles = listTsFiles(PRESENTATION_ROOT).filter((file) =>
      fs.readFileSync(file, 'utf8').includes('@Delete('),
    );
    expect(deleteRouteFiles).toEqual([
      path.join(PRESENTATION_ROOT, 'finding-relationship.controller.ts'),
    ]);

    const contents = fs.readFileSync(
      path.join(PRESENTATION_ROOT, 'finding-relationship.controller.ts'),
      'utf8',
    );
    const deleteRouteCount = (contents.match(/@Delete\(/g) ?? []).length;
    expect(deleteRouteCount).toBe(2); // controls/:linkId, risks/:linkId — never /findings/:findingId
  });

  it('no file under grc/finding/infrastructure calls a Prisma delete method against the finding table', () => {
    const offenders = listTsFiles(INFRASTRUCTURE_ROOT).filter((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return /\.finding\.delete(Many)?\(/.test(contents);
    });
    expect(offenders).toEqual([]);
  });

  it('no file under grc/finding/domain/ports declares a delete-shaped method for Finding itself', () => {
    const portsRoot = path.resolve(__dirname, '../../src/grc/finding/domain/ports');
    const offenders = listTsFiles(portsRoot).filter((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return /abstract\s+delete\s*\(/i.test(contents);
    });
    expect(offenders).toEqual([]);
  });
});
