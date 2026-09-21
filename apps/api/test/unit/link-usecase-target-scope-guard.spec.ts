/**
 * T040/006-assets-processes, User Story 3 — a structural guard that
 * GENERALIZES the F-46 fix rather than re-proving only the two reported
 * instances.
 *
 * F-46 (`docs/deferred-findings.md`, `control-link.usecase.ts`'s own
 * header) closed the ADR-020 part 4 gap for `LinkControlUseCase`
 * (Risco→Controle) and left it open for its two identical siblings in the
 * same directory, `LinkAssetUseCase`/`LinkProcessUseCase`
 * (Risco→Ativo/Risco→Processo) — the exact defect this fase's spec
 * measures under "Contexto medido". A regression test written only for
 * those two named use cases would repeat that exact mistake on the NEXT
 * link use case someone adds anywhere in the platform: AGENTS.md requires a
 * security fix's regression test to "generalize to every call site sharing
 * the vulnerable pattern, not only the reported instance".
 *
 * ## S-12 (audit `A5-F04`) — the directory list itself was the gap
 *
 * This guard originally scanned only `modules/risk/application/links/` and
 * `modules/controls/application/links/` — a hand-maintained, fixed list.
 * `modules/incidents/application/links/` and
 * `modules/problems/application/links/` were added later (phase
 * `008-incidents-problems`) with their own, correct
 * `isOrgUnitWithinScope`/`hasPermission` checks, but this file was never
 * updated to scan them: a regression in either directory would have gone
 * completely unguarded, which is exactly the "quase aconteceu de novo"
 * near-miss `specs/006-assets-processes/STATE.md` §2.3 (ADR-020 part 5)
 * already warned this class of guard is prone to.
 *
 * The fix generalizes the DISCOVERY itself, not just the list: every
 * `modules/<name>/application/links/` directory that exists on disk is scanned
 * (`discoverLinkDirectories`, below) — so the guard also covers whatever
 * link-bearing module is added next, without anyone remembering to edit
 * this file again. The one documented exception is
 * `MODULES_WITH_EQUIVALENT_SCOPE_CHECK`, immediately below the directory
 * discovery — a narrow, reviewed carve-out, not a silent gap.
 *
 * ## Proven to fail against the pre-fix code
 *
 * Run against the code as it stood immediately before T034/T035 (verified
 * manually: `asset-link.usecase.ts`/`process-link.usecase.ts` resolved the
 * target through `AssetRegistryPort`/`ProcessRegistryPort` — a shape with
 * no `orgUnitId` at all — and never called `isOrgUnitWithinScope`), this
 * guard fails, listing `LinkAssetUseCase`/`LinkProcessUseCase` by name. It
 * passes once T034/T035 land. This is the same proof
 * `controls-risk-module-boundary.spec.ts` uses for its own boundary rule —
 * a plain-text scan, not a NestJS container or a database — fast and
 * exhaustive over every file in each module's link directory.
 *
 * Proven again for S-12 specifically: with the pre-fix (risk/controls-only)
 * directory list restored, temporarily deleting the
 * `isOrgUnitWithinScope(...)` call from
 * `modules/incidents/application/links/link-incident-asset.usecase.ts`
 * left this suite fully green — the exact vacuity the audit reported. With
 * the fix below (glob discovery), the same deletion fails
 * `'every file declaring a Link*UseCase class also calls
 * isOrgUnitWithinScope'`, naming `LinkIncidentAssetUseCase`. See F2-report.md
 * for the recorded before/after output.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '../../src');
const MODULES_ROOT = path.join(SRC_ROOT, 'modules');

/**
 * Modules whose `application/links/` directory intentionally does not call
 * the shared `isOrgUnitWithinScope` predicate (`grc/shared/domain/
 * org-scope.ts`) BY NAME, because the target's scope check is more involved
 * than a plain org-unit id and is implemented as a documented, equivalent
 * local predicate instead:
 *
 *   - `compliance`: `LinkRequirementToControlUseCase`
 *     (`link-requirement-control.usecase.ts`) links against a `Control`,
 *     whose `orgUnitId` is nullable (a global control is visible only to a
 *     `GLOBAL`-scope caller) — a case `isOrgUnitWithinScope(scope,
 *     orgUnitId: string)` was never designed to accept (it takes a
 *     non-null id). The file's own header documents this explicitly and
 *     its local `isControlWithinScope` performs the equivalent check
 *     (`scope.kind === 'GLOBAL' || (control.orgUnitId !== null &&
 *     scope.unitIds.has(control.orgUnitId))`) inline.
 *
 * This is a real, reviewed difference in call convention, not a security
 * gap — the check itself is present and correct — so it is out of THIS
 * guard's enforcement (and out of F2's S-12 scope: consolidating it onto
 * the shared predicate is a compliance-module cleanup, not a security
 * fix). Excluding it here is what keeps the assertion below meaningful
 * rather than either vacuous (only two directories) or permanently red for
 * a reason nobody re-reads. `hasPermission` (ADR-020 part 5) is NOT
 * exempted for this module — `LinkRequirementToControlUseCase` already
 * calls it, like every other file this guard scans.
 */
const MODULES_WITH_EQUIVALENT_SCOPE_CHECK: ReadonlySet<string> = new Set(['compliance']);

/** Every exported class name declared in `contents`, in appearance order. */
function exportedClassNames(contents: string): string[] {
  const pattern = /^export class (\w+)/gm;
  return [...contents.matchAll(pattern)].map((match) => match[1]!);
}

/** `true` for a class name that is the CREATION side of a cross-module
 * link (`LinkXUseCase`, `LinkXToYUseCase`) — never the `Unlink*` sibling,
 * which this fase's own use cases deliberately do not scope-check (see
 * `control-link.usecase.ts`'s and `asset-link.usecase.ts`'s own headers for
 * why unlink does not repeat this check). */
function isLinkCreationUseCaseName(className: string): boolean {
  return /^Link\w*UseCase$/.test(className);
}

interface LinkDirectory {
  readonly moduleName: string;
  readonly dir: string;
}

/**
 * Discovers every `modules/<name>/application/links/` directory that
 * exists on disk — no fixed list to fall out of date the next time a
 * module gains link use cases (S-12/A5-F04: the previous, hand-maintained
 * two-directory list is exactly what let
 * `modules/incidents/application/links/` and
 * `modules/problems/application/links/` go unscanned).
 */
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
    // risk (3) + controls (2) + incidents (3) + problems (2) + compliance (1)
    // as of this fix — see F2-report.md for the exact count measured.
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

  /**
   * ADR-020 **part 5**, generalized the same way part 4 is above.
   *
   * This assertion exists because the part-5 half was, for a few hours,
   * about to repeat F-46's exact mistake a second time inside this very
   * feature. Risco→Ativo and Risco→Processo received their `asset:view`/
   * `process:view` check, and Controle→Ativo and Controle→Processo were
   * deferred to a follow-up finding on the reasoning that "that pair
   * already had part 4" — which is precisely the reasoning that closed
   * Risco→Controle and left its two siblings open. `data-model.md` §10
   * lists `control:edit` + `asset:view` for those pairs explicitly, with
   * the second flagged as missing, so the deferral also contradicted this
   * feature's own design document.
   *
   * A guard covering only part 4 would have stayed green through all of
   * that. This one would not. No module exception here: every file this
   * guard scans (including `compliance`) already calls `hasPermission`.
   */
  it('every file declaring a Link*UseCase class also checks a permission on the REFERENCED side — ADR-020 part 5', () => {
    const offenders = scanned
      .filter((file) => file.linkUseCaseClasses.length > 0 && !file.callsHasPermission)
      .map((file) => `${file.relativePath} (${file.linkUseCaseClasses.join(', ')})`);

    expect(offenders).toEqual([]);
  });
});
