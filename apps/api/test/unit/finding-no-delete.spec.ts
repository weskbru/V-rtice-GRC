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
    expect(deleteRouteCount).toBe(2);
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
