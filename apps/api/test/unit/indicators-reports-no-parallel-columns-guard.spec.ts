import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

interface PhaseTable {
  readonly modelName: string;
  readonly tableName: string;
}

const PHASE_TABLES: readonly PhaseTable[] = [
  { modelName: 'IndicatorDefinition', tableName: 'indicator_definitions' },
  { modelName: 'IndicatorMeasurement', tableName: 'indicator_measurements' },
  { modelName: 'ReportDefinition', tableName: 'report_definitions' },
];

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
    const suspectPattern =
      /^(Indicator|Report)(Definition|Measurement)?(Task|Attachment|File|Approval|SignOff)/i;
    const suspects = Prisma.dmmf.datamodel.models
      .map((m) => m.name)
      .filter((name) => suspectPattern.test(name));

    expect(suspects, `Unexpected junction-shaped model(s): ${suspects.join(', ')}`).toEqual([]);
  });
});
