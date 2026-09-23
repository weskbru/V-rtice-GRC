import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const MODULES_ROOT = path.join(SRC_ROOT, 'modules');

const MODULES_WITH_EQUIVALENT_SCOPE_CHECK: ReadonlySet<string> = new Set(['compliance']);

function exportedClassNames(contents: string): string[] {
  const pattern = /^export class (\w+)/gm;
  return [...contents.matchAll(pattern)].map((match) => match[1]!);
}

function isLinkCreationUseCaseName(className: string): boolean {
  return /^Link\w*UseCase$/.test(className);
}

interface LinkDirectory {
  readonly moduleName: string;
  readonly dir: string;
}

function discoverLinkDirectories(): readonly LinkDirectory[] {
  return fs
    .readdirSync(MODULES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      moduleName: entry.name,
      dir: path.join(MODULES_ROOT, entry.name, 'application', 'links'),
    }))
    .filter(({ dir }) => fs.existsSync(dir));
}

interface ScannedFile {
  readonly moduleName: string;
  readonly relativePath: string;
  readonly linkUseCaseClasses: readonly string[];
  readonly callsIsOrgUnitWithinScope: boolean;
  readonly callsHasPermission: boolean;
}

function scanLinksDirectory(entry: LinkDirectory): ScannedFile[] {
  return fs
    .readdirSync(entry.dir, { withFileTypes: true })
    .filter((file) => file.isFile() && file.name.endsWith('.ts'))
    .map((file) => {
      const fullPath = path.join(entry.dir, file.name);
      const contents = fs.readFileSync(fullPath, 'utf8');
      return {
        moduleName: entry.moduleName,
        relativePath: path.relative(SRC_ROOT, fullPath),
        linkUseCaseClasses: exportedClassNames(contents).filter(isLinkCreationUseCaseName),
        callsIsOrgUnitWithinScope: contents.includes('isOrgUnitWithinScope('),
        callsHasPermission: contents.includes('hasPermission('),
      };
    });
}

describe('Every link-creation use case under modules/*/application/links checks the target organizational scope (T040/S-12, ADR-020 part 4, generalizing F-46)', () => {
  const scanned = discoverLinkDirectories().flatMap(scanLinksDirectory);

  it('the discovery itself is not vacuous — it scans at least the directories known today (risk, controls, incidents, problems, compliance) and finds every link-creation use case in them', () => {
    const scannedModules = new Set(scanned.map((file) => file.moduleName));
    for (const expectedModule of ['risk', 'controls', 'incidents', 'problems', 'compliance']) {
      expect(scannedModules.has(expectedModule)).toBe(true);
    }

    const totalLinkUseCases = scanned.reduce(
      (sum, file) => sum + file.linkUseCaseClasses.length,
      0,
    );
    expect(totalLinkUseCases).toBeGreaterThanOrEqual(11);
  });

  it('every file declaring a Link*UseCase class also calls isOrgUnitWithinScope — a target outside scope must be checked before any write', () => {
    const offenders = scanned
      .filter(
        (file) =>
          file.linkUseCaseClasses.length > 0 &&
          !file.callsIsOrgUnitWithinScope &&
          !MODULES_WITH_EQUIVALENT_SCOPE_CHECK.has(file.moduleName),
      )
      .map((file) => `${file.relativePath} (${file.linkUseCaseClasses.join(', ')})`);

    expect(offenders).toEqual([]);
  });

  it('every file declaring a Link*UseCase class also checks a permission on the REFERENCED side — ADR-020 part 5', () => {
    const offenders = scanned
      .filter((file) => file.linkUseCaseClasses.length > 0 && !file.callsHasPermission)
      .map((file) => `${file.relativePath} (${file.linkUseCaseClasses.join(', ')})`);

    expect(offenders).toEqual([]);
  });
});
