/**
 * 007-implementation-remediation, Frente A, D-1 — rewritten to protect the
 * FINAL, converged state, not the coexistence window this guard used to
 * permit (Assurance fix, Fix 9). `RiskTreatmentAction` no longer carries
 * `title`/`responsibleUserId`/`dueOn`/`status`/`completedAt` — it is now a
 * pure link row (`riskId`/`treatmentDecisionId`/`actionId`); `Action`
 * (`grc/action`) is the ONLY model allowed to carry the full work-item
 * signature. The mirror use cases this guard used to reference
 * (`MirrorActionStatusFromOriginUseCase`/`MirrorActionFieldsFromOriginUseCase`)
 * are DELETED, not merely unreferenced.
 *
 * The original guard's enum-parity check (`ActionStatus` vs.
 * `TreatmentActionStatus`) is REMOVED, not merely updated — coordinator
 * review, 2026-09-11: `TreatmentActionStatus` no longer backs any column
 * (`status` was dropped from `risk_treatment_actions` in the SAME
 * migration that also `DROP TYPE`s the enum itself, since dropping a whole
 * Postgres enum type — unlike removing one value — is safe and
 * unrestricted). An assertion comparing two enums when one of them backs
 * nothing would be an assertion that can no longer fail — exactly the
 * shape this project keeps paying for (F-27's own class of defect). What
 * survives from the original guard, and why it still matters:
 *
 *   No Prisma model outside `Action` itself carries the full
 *   `{title, responsibleUserId, dueOn, status, completedAt}` signature —
 *   the guard against a SECOND authority reappearing, now with a
 *   one-member allowlist instead of two.
 *
 * Introspects the generated Prisma client's own DMMF (`Prisma.dmmf`) for
 * the first two checks below — no database connection, no NestJS DI
 * container, pure schema metadata — so this runs as a plain, fast unit
 * test and fails the moment `schema.prisma` drifts, without needing anyone
 * to remember to update this file by hand when they touch that one.
 *
 * ## What this test would MISS — stated honestly
 *
 * A model using DIFFERENT column names for the same five concepts (e.g.
 * `dueDate` instead of `dueOn`, or `ownerUserId` instead of
 * `responsibleUserId`) would not match this signature at all and would
 * slip past the field-signature guard undetected. A field-NAME signature
 * is a cheap, real guard against the most plausible accident (copying
 * `Action`'s own shape verbatim, field names included) — not a semantic
 * proof that no second "action-shaped" table exists under any possible
 * naming.
 */
import fs from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

/** Every Prisma model CURRENTLY allowed to carry the full
 * `{title, responsibleUserId, dueOn, status, completedAt}` signature —
 * ONLY `Action` (`grc/action`) after the convergence (D-1).
 * `RiskTreatmentAction` is deliberately absent: it is now a pure link row
 * and reproducing this signature on it again would be reintroducing the
 * exact defect this migration removed. Extend this list ONLY alongside an
 * explicit, reviewed architectural decision to add a SECOND authority —
 * never as a silent side effect of adding a field to an unrelated model. */
const ALLOWED_ACTION_SHAPED_MODELS: readonly string[] = ['Action'];

const ACTION_SIGNATURE_FIELDS: readonly string[] = [
  'title',
  'responsibleUserId',
  'dueOn',
  'status',
  'completedAt',
];

function actionShapedModelNames(): readonly string[] {
  return Prisma.dmmf.datamodel.models
    .filter((model) =>
      ACTION_SIGNATURE_FIELDS.every((field) => model.fields.some((f) => f.name === field)),
    )
    .map((model) => model.name);
}

function enumValues(enumName: string): readonly string[] {
  const found = Prisma.dmmf.datamodel.enums.find((candidate) => candidate.name === enumName);
  if (!found) {
    throw new Error(`Enum "${enumName}" was not found in the generated Prisma client's DMMF.`);
  }
  return found.values.map((value) => value.name);
}

/** Recursively lists every `.ts` file under `dir`, excluding `.spec.ts`
 * files and `dist`/`node_modules` — used below to statically scan
 * `apps/api/src` for `registerActionOriginResolver(...)` call sites
 * without needing a NestJS application context (registering an accessor
 * for real requires one; discovering that registration was AT LEAST
 * attempted does not). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function listSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Every `ActionOriginType` value name a `registerActionOriginResolver`
 * call site anywhere in `apps/api/src` names as its first argument
 * (single- or double-quoted string literal). Does not evaluate/import the
 * files — a plain text scan, so it has no dependency on module load order
 * or DI wiring. */
function registeredActionOriginTypeLiterals(): readonly string[] {
  const srcDir = path.resolve(__dirname, '../../src');
  const pattern = /registerActionOriginResolver\(\s*['"]([A-Z_]+)['"]/g;
  const found: string[] = [];

  for (const file of listSourceFiles(srcDir)) {
    // Comments stripped first: a doc comment that helpfully quotes the
    // registration call would otherwise be counted as a second call site
    // (this guard has already produced exactly that false duplicate).
    const contents = stripComments(fs.readFileSync(file, 'utf8'));
    for (const match of contents.matchAll(pattern)) {
      const literal = match[1];
      if (literal) {
        found.push(literal);
      }
    }
  }
  return found;
}

describe('Action / RiskTreatmentAction convergence guard (Fix 9)', () => {
  // The enum-parity check that used to live here (`ActionStatus` vs.
  // `TreatmentActionStatus`) is REMOVED, not weakened — see this file's own
  // header, 2026-09-11: `TreatmentActionStatus` was dropped from the schema
  // entirely in the same migration that dropped the column it backed.

  it('no Prisma model outside the explicit allowlist carries the full Action signature', () => {
    const found = actionShapedModelNames();
    expect(new Set(found)).toEqual(new Set(ALLOWED_ACTION_SHAPED_MODELS));
  });

  it('the allowlist itself still matches reality — both named models genuinely carry every signature field', () => {
    // Guards the guard: if a future edit renames or removes one of these
    // fields on `Action`/`RiskTreatmentAction` themselves, this makes that
    // visible here rather than the test above silently reporting an
    // empty-but-still-equal intersection.
    for (const modelName of ALLOWED_ACTION_SHAPED_MODELS) {
      const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === modelName);
      expect(model, `Model "${modelName}" was not found in the DMMF`).toBeDefined();
      for (const field of ACTION_SIGNATURE_FIELDS) {
        expect(
          model?.fields.some((f) => f.name === field),
          `Model "${modelName}" no longer has a "${field}" field`,
        ).toBe(true);
      }
    }
  });

  it('ActionOriginType members correspond 1:1 with a registerActionOriginResolver call site, each exactly once', () => {
    const originTypeValues = enumValues('ActionOriginType');
    const registeredLiterals = registeredActionOriginTypeLiterals();

    // Every enum member has AT LEAST one registration call site — a
    // member with zero would throw `ActionOriginTypeNotRegisteredError`
    // the first time any code tries to create/get/list an `Action` of
    // that type (see `action-origin-resolver.port.ts`'s own registry),
    // which is exactly the "missing bootstrap registration" case that
    // port's own doc comments call out.
    for (const originType of originTypeValues) {
      const count = registeredLiterals.filter((literal) => literal === originType).length;
      expect(
        count,
        `ActionOriginType "${originType}" has ${count} registration call sites, expected exactly 1`,
      ).toBe(1);
    }

    // No registration call site names a value OUTSIDE the enum — a stray
    // registration for a since-removed origin type, or a typo in the
    // string literal, would otherwise never register the accessor for the
    // enum member the caller actually meant.
    for (const literal of registeredLiterals) {
      expect(
        originTypeValues,
        `Registered literal "${literal}" is not a member of ActionOriginType`,
      ).toContain(literal);
    }
  });
});
