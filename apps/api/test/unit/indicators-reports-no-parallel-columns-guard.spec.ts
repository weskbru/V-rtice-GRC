/**
 * T069/009-indicators-reports — structural guard for SC-005: none of this
 * phase's three tables (`IndicatorDefinition`/`IndicatorMeasurement`/
 * `ReportDefinition`, mapped to `indicator_definitions`/
 * `indicator_measurements`/`report_definitions`) may declare a column that
 * is a task, a file/attachment, or an approval OF ITS OWN, running in
 * parallel to what the shared GRC kernel already provides for exactly this
 * purpose: `Action` (with `ActionOriginType`), `Evidence`/
 * `AttachableEntityType` (`core/files`), and `ApprovableEntityType`
 * (CLAUDE.md §19.4/§19.6). `data-model.md` states, for each of the three
 * models, that it deliberately does NOT model these — this guard is the
 * automated proof that the schema still agrees, not a one-time reading.
 *
 * ## Why read the generated Prisma CLIENT's DMMF, not the `.prisma` text
 *
 * Same choice `action-model-convergence-guard.spec.ts` already made, for
 * the same reason: `Prisma.dmmf.datamodel` is the schema as Prisma itself
 * parsed it — model names, field names, field kinds — with no risk of this
 * guard's own regular expression disagreeing with the real Prisma grammar
 * (block comments, multi-line attributes, `///` doc comments interleaved
 * with fields). No database connection and no NestJS container are
 * involved; this is metadata already sitting in `node_modules/.prisma`
 * after `prisma generate`, so the test is as fast and as pure as any other
 * file in this directory.
 *
 * ## How this guard refuses to go quietly vacuous
 *
 * A schema-reading guard that stops matching anything still reports
 * green — that is exactly the failure mode CLAUDE.md §19.10 and this
 * project's own history (seven repeats of the same pattern, per the task
 * brief) warn about. Two independent defenses against it here:
 *
 *   1. `PHASE_MODEL_NAMES` is asserted to resolve to EXACTLY three DMMF
 *      models, by name AND by `dbName` (the `@@map`) — not "at least
 *      three", not "some models exist". If a rename, a typo, or a broken
 *      DMMF import silently produced zero matches, this assertion is what
 *      turns that into a failing test instead of three vacuously-true
 *      loops below.
 *   2. The field census per model (next section) is an EXACT set
 *      comparison (`toEqual` against a `Set`), not a `.some()`/`.includes()`
 *      check for forbidden keywords. A keyword list can always miss a
 *      spelling nobody anticipated (`taskDueAt`, `assigneeId`,
 *      `attachmentUrl`, `signOffByUserId`, ...); an exact census cannot —
 *      ANY field this guard was not told about, whatever its name, fails
 *      the test and is printed by name.
 *
 * ## Exact definition of a violation
 *
 * A column is a violation of SC-005 if it represents, on
 * `IndicatorDefinition`, `IndicatorMeasurement` or `ReportDefinition`
 * itself:
 *
 *   - a task/work-item of the model's own (a title+assignee+due-date+status
 *     shape, or any subset of it, that is NOT a relation to `Action`) —
 *     `Action`/`ActionOriginType` is the only sanctioned mechanism;
 *   - a file/attachment/document of the model's own — `AttachableEntityType`
 *     (`core/files`) is the only sanctioned mechanism;
 *   - an approval/sign-off of the model's own — `ApprovableEntityType` is
 *     the only sanctioned mechanism;
 *   - a join/junction table of the model's own standing in for any of the
 *     above (this guard's model-name census in the first test already
 *     covers this: a fourth, junction-shaped model appearing anywhere in
 *     the schema for this phase would not be one of the three named
 *     models and would not be silently ignored, because the census target
 *     is "exactly these three names", not "at least these three").
 *
 * Explicitly NOT a violation, because they are foreign keys to `User` for
 * accountability, or a closed-enum array — never a task/file/approval
 * system of their own:
 *
 *   - `ownerUserId`, `createdByUserId`, `computedByUserId` (plain
 *     "who did/owns this" references, the same shape every other
 *     domain-object table in this codebase already carries);
 *   - `metricKeys` on `ReportDefinition` — an array of the closed
 *     `IndicatorMetricKey` enum, decided in `data-model.md` §1/§6 to be
 *     deliberately NOT a join table, because an enum value is not a
 *     database row for a junction table to reference.
 *
 * ## Mutation experiment — run once, by hand, before this file was accepted
 *
 * Other agents were concurrently generating the SHARED
 * `apps/api/node_modules`-resolved Prisma client while this guard was
 * written (confirmed by multiple leftover
 * `query_engine-windows.dll.node.tmp*` files already present from their
 * own `prisma generate` runs), so the experiment ran `prisma generate`
 * against an ISOLATED copy of the schema with a scratch `output` path
 * instead of the real one — proving the census logic against a real,
 * freshly generated DMMF without racing the shared client every other
 * agent in this session was actively using, and without ever writing to
 * `apps/api/prisma/schema.prisma` for longer than it took to `git
 * checkout` it back:
 *
 *   1. `apps/api/prisma/schema.prisma` was copied to a scratch file; the
 *      copy's `generator client` block gained `output = "<scratch dir>/
 *      generated-client"`, and its `IndicatorDefinition` model gained,
 *      directly under `metricKey`:
 *
 *        attachmentFileName String? @map("attachment_file_name")
 *
 *   2. `prisma generate --schema <scratch copy>` built a standalone
 *      client at that scratch path (no database connection, no
 *      migration, nothing written under the repository).
 *   3. A standalone script replicating this file's exact-census check
 *      loaded that scratch client's `Prisma.dmmf` and ran the same
 *      `unexpected = actualFieldNames.filter(name => !allowed.has(name))`
 *      logic this file's own test below runs. Literal output obtained:
 *
 *        FAIL (expected): IndicatorDefinition has unexpected field(s): attachmentFileName — a
 *        parallel task/file/approval column would show up here, unannounced
 *        exit=1
 *
 *      naming both the table (`IndicatorDefinition`) and the planted
 *      column (`attachmentFileName`), exactly as this file's own
 *      "carries no field outside its known, closed set" assertion would
 *      report for any of the three phase tables. (`attachmentFileName`
 *      also independently matches the `/attachment/i` /
 *      `/\bfile(Name|Url|Path|Id)\b/i` entries in
 *      `FORBIDDEN_FIELD_PATTERNS` below, so the second, semantic check in
 *      this file would have caught the same planted column even had the
 *      allow-list been mistakenly pre-updated to include it.)
 *   4. The scratch schema copy and generated client were deleted; the
 *      REAL `apps/api/prisma/schema.prisma` was never left modified —
 *      the one temporary edit made directly to it, before this isolated
 *      approach was chosen, was reverted with `git checkout --` before
 *      any `prisma generate` ran against it, and `git status --porcelain
 *      apps/api/prisma/schema.prisma` / `git diff --stat` both confirmed
 *      an empty result before this test file's final version was
 *      written. The shared client every other concurrent agent was using
 *      was at no point regenerated or touched by this experiment.
 */
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

/** The three tables this phase (`009-indicators-reports`) introduces —
 * named by their Prisma model name AND by their `@@map` table name, so a
 * model rename that forgot to update one of the two is itself visible
 * here rather than silently matching by whichever name still lined up. */
interface PhaseTable {
  readonly modelName: string;
  readonly tableName: string;
}

const PHASE_TABLES: readonly PhaseTable[] = [
  { modelName: 'IndicatorDefinition', tableName: 'indicator_definitions' },
  { modelName: 'IndicatorMeasurement', tableName: 'indicator_measurements' },
  { modelName: 'ReportDefinition', tableName: 'report_definitions' },
];

/** The exact, closed set of field names each model is allowed to carry —
 * every scalar column plus every relation field DMMF reports for it
 * today. Extend a list here ONLY alongside an explicit, reviewed decision
 * that the new field is not a task/file/approval column of the model's
 * own (see this file's header) — never as a silent side effect of adding
 * an unrelated field, which is exactly the accident this census exists to
 * surface. */
const ALLOWED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  IndicatorDefinition: [
    'id',
    'code',
    'metricKey',
    'name',
    'description',
    'ownerUserId',
    'thresholdComparator',
    'thresholdValue',
    'isActive',
    'createdByUserId',
    'createdAt',
    'updatedAt',
    'owner',
    'createdBy',
  ],
  IndicatorMeasurement: [
    'id',
    'metricKey',
    'value',
    'valueByBucket',
    'breached',
    'computedAt',
    'computedByUserId',
    'computedByUser',
  ],
  ReportDefinition: [
    'id',
    'code',
    'name',
    'description',
    'metricKeys',
    'isActive',
    'createdByUserId',
    'createdAt',
    'updatedAt',
    'createdBy',
  ],
};

/** Field-name fragments that, on their own, name a task/file/approval
 * concept — a second, independent detector from the exact census above.
 * Where the census guards against ANY drift (including a rename that
 * keeps the field count identical), this list documents WHY the census
 * matters in terms a reader can recognize without cross-referencing the
 * allow-list: these are the shapes `Action`/`Evidence`+
 * `AttachableEntityType`/`ApprovableEntityType` already exist to prevent
 * from being reinvented per-table (CLAUDE.md §19.4/§19.6). Matching is
 * case-insensitive and applied to the RAW field name DMMF reports, never
 * to a lower-cased substring of an unrelated word — `ownerUserId` and
 * `computedByUserId` do not match any pattern below, by design (see the
 * header's "explicitly NOT a violation" section). */
const FORBIDDEN_FIELD_PATTERNS: readonly RegExp[] = [
  /task/i,
  /assignee/i,
  /\bdue(On|Date|At)\b/i,
  /\bresponsible/i,
  /attachment/i,
  /\bfile(Name|Url|Path|Id)\b/i,
  /\bdocument(Name|Url|Path|Id)\b/i,
  /approv/i,
  /sign[-_]?off/i,
];

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];

function findModel(modelName: string): DmmfModel {
  const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === modelName);
  if (!model) {
    throw new Error(
      `Prisma model "${modelName}" was not found in the generated client's DMMF — ` +
        'run "pnpm --filter @pharos/api exec prisma generate" if the schema changed.',
    );
  }
  return model;
}

describe('Indicators/Reports — no parallel task/file/approval column guard (T069, SC-005)', () => {
  it('resolves to exactly the three phase tables — by model name and by @@map, not "at least" three', () => {
    // Guards this file's own scan against going vacuous: if a rename made
    // zero (or four) models match, every loop below would either run over
    // nothing (silently "passing") or over an unintended extra model. This
    // assertion is what turns that into a visible failure.
    const modelNames = PHASE_TABLES.map((t) => t.modelName);
    const foundModels = Prisma.dmmf.datamodel.models.filter((m) => modelNames.includes(m.name));

    expect(foundModels).toHaveLength(3);
    expect(new Set(foundModels.map((m) => m.name))).toEqual(new Set(modelNames));
    expect(new Set(foundModels.map((m) => m.dbName))).toEqual(
      new Set(PHASE_TABLES.map((t) => t.tableName)),
    );
  });

  for (const { modelName } of PHASE_TABLES) {
    describe(modelName, () => {
      it('carries no field outside its known, closed set — a planted column fails here by name', () => {
        const model = findModel(modelName);
        const actualFieldNames = model.fields.map((f) => f.name);
        const allowed = new Set(ALLOWED_FIELDS[modelName]);

        const unexpected = actualFieldNames.filter((name) => !allowed.has(name));
        expect(
          unexpected,
          `${modelName} has unexpected field(s): ${unexpected.join(', ')} — a parallel ` +
            'task/file/approval column would show up here, unannounced',
        ).toEqual([]);
      });

      it('still carries every field this guard expects — the allow-list itself has not gone stale', () => {
        // Guards the guard: without this, a future edit that DROPS a field
        // from the model would leave the test above vacuously passing
        // (fewer actual fields is still a subset of "allowed").
        const model = findModel(modelName);
        const actualFieldNames = new Set(model.fields.map((f) => f.name));
        const allowed = ALLOWED_FIELDS[modelName]!;

        const missing = allowed.filter((name) => !actualFieldNames.has(name));
        expect(missing, `${modelName} is missing expected field(s): ${missing.join(', ')}`).toEqual(
          [],
        );
      });

      it('has no field name matching a task/file/approval pattern of its own', () => {
        const model = findModel(modelName);
        for (const field of model.fields) {
          for (const pattern of FORBIDDEN_FIELD_PATTERNS) {
            expect(
              pattern.test(field.name),
              `${modelName}.${field.name} matches forbidden pattern ${pattern} — looks like ` +
                'a parallel task/file/approval column instead of Action/Evidence/' +
                'AttachableEntityType/ApprovableEntityType',
            ).toBe(false);
          }
        }
      });
    });
  }

  it('no fourth, junction-shaped model exists for any of these three tables', () => {
    // §19.3 forbids a bespoke join table for a phase-owned concept. The
    // three known models are exhaustively covered above; this asserts
    // there is no OTHER model in the schema whose name suggests it exists
    // only to link one of these three tables to a task/file/approval
    // concept (e.g. "IndicatorDefinitionTask", "ReportDefinitionApproval").
    const suspectPattern =
      /^(Indicator|Report)(Definition|Measurement)?(Task|Attachment|File|Approval|SignOff)/i;
    const suspects = Prisma.dmmf.datamodel.models
      .map((m) => m.name)
      .filter((name) => suspectPattern.test(name));

    expect(suspects, `Unexpected junction-shaped model(s): ${suspects.join(', ')}`).toEqual([]);
  });
});
