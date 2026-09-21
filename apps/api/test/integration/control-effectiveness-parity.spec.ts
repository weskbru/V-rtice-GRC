/**
 * T016/003-controls-management — confronts `calculateControlEffectiveness`
 * (`modules/controls/domain/control-effectiveness.service.ts`, T013)
 * against `controlEffectivenessExpression`
 * (`modules/controls/infrastructure/control-effectiveness-query.ts`, T015)
 * over the SAME real, seeded data. Without this test the two are "two
 * rules that merely start out equal" (data-model.md §3's own words) — a
 * future edit to one could drift from the other silently, since nothing
 * else in the codebase would notice.
 *
 * Real PostgreSQL, no NestJS application context beyond the shared
 * `PrismaService` the integration harness already provides — this is a
 * pure data/SQL confrontation, not a use-case test.
 */
import { Prisma, type ControlAssessmentResult, type ControlFrequency } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { calculateControlEffectiveness } from '../../src/modules/controls/domain/control-effectiveness.service';
import { controlEffectivenessExpression } from '../../src/modules/controls/infrastructure/control-effectiveness-query';

import { uniqueTestMarker } from './support/env';
import { createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

const REFERENCE_DATE = new Date(Date.UTC(2026, 8, 7)); // 2026-09-07
const REFERENCE_DATE_PARAM = '2026-09-07';

function daysBefore(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
}

interface AssessmentSeed {
  readonly assessedOn: Date;
  readonly createdAt: Date;
  readonly result: ControlAssessmentResult;
  readonly attested: boolean;
}

interface CaseDefinition {
  readonly label: string;
  readonly frequency: ControlFrequency | null;
  readonly assessments: readonly AssessmentSeed[];
}

describe('Control effectiveness: domain calculator vs SQL expression agree over the same data (T013/T015/T016)', () => {
  let ctx: IntegrationTestContext;
  let assessorId: string;
  let attesterId: string;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({});
    const assessor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('effectiveness-parity-assessor')}@example.test`,
    });
    const attester = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('effectiveness-parity-attester')}@example.test`,
    });
    assessorId = assessor.id;
    attesterId = attester.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const cases: readonly CaseDefinition[] = [
    { label: 'no assessments at all -> NOT_ASSESSED', frequency: null, assessments: [] },
    {
      label: 'only unattested assessments -> NOT_ASSESSED',
      frequency: 'MONTHLY',
      assessments: [
        {
          assessedOn: REFERENCE_DATE,
          createdAt: REFERENCE_DATE,
          result: 'EFFECTIVE',
          attested: false,
        },
      ],
    },
    {
      label: 'null frequency, very old attested assessment -> latest result, never EXPIRED',
      frequency: null,
      assessments: [
        {
          assessedOn: daysBefore(REFERENCE_DATE, 5000),
          createdAt: daysBefore(REFERENCE_DATE, 5000),
          result: 'PARTIALLY_EFFECTIVE',
          attested: true,
        },
      ],
    },
    {
      label: 'WEEKLY frequency, assessment within window -> latest result',
      frequency: 'WEEKLY',
      assessments: [
        {
          assessedOn: daysBefore(REFERENCE_DATE, 3),
          createdAt: daysBefore(REFERENCE_DATE, 3),
          result: 'EFFECTIVE',
          attested: true,
        },
      ],
    },
    {
      label: 'MONTHLY frequency, 60 days ago -> EXPIRED (quickstart.md §3)',
      frequency: 'MONTHLY',
      assessments: [
        {
          assessedOn: daysBefore(REFERENCE_DATE, 60),
          createdAt: daysBefore(REFERENCE_DATE, 60),
          result: 'EFFECTIVE',
          attested: true,
        },
      ],
    },
    {
      label:
        'ANNUAL frequency, mixed history — older attested INEFFECTIVE, newer unattested EFFECTIVE ignored',
      frequency: 'ANNUAL',
      assessments: [
        {
          assessedOn: daysBefore(REFERENCE_DATE, 30),
          createdAt: daysBefore(REFERENCE_DATE, 30),
          result: 'INEFFECTIVE',
          attested: true,
        },
        {
          assessedOn: REFERENCE_DATE,
          createdAt: REFERENCE_DATE,
          result: 'EFFECTIVE',
          attested: false,
        },
      ],
    },
    {
      label: 'same-day tie broken by createdAt DESC',
      frequency: null,
      assessments: [
        {
          assessedOn: REFERENCE_DATE,
          createdAt: daysBefore(REFERENCE_DATE, 1),
          result: 'INEFFECTIVE',
          attested: true,
        },
        {
          assessedOn: REFERENCE_DATE,
          createdAt: REFERENCE_DATE,
          result: 'PARTIALLY_EFFECTIVE',
          attested: true,
        },
      ],
    },
  ];

  it.each(cases.map((c, index) => [index, c] as const))(
    'case %i (%s): SQL expression and domain calculator agree',
    async (_index, testCase) => {
      const control = await ctx.prisma.client.control.create({
        data: {
          code: uniqueTestMarker('effectiveness-parity-control'),
          name: `Effectiveness parity fixture — ${testCase.label}`,
          frequency: testCase.frequency,
        },
      });

      for (const seed of testCase.assessments) {
        await ctx.prisma.client.controlAssessment.create({
          data: {
            controlId: control.id,
            assessedOn: seed.assessedOn,
            assessorUserId: assessorId,
            result: seed.result,
            conclusion: 'Fixture conclusion.',
            createdAt: seed.createdAt,
            attestedAt: seed.attested ? seed.createdAt : null,
            attestedByUserId: seed.attested ? attesterId : null,
          },
        });
      }

      // --- SQL side ------------------------------------------------------
      const sqlRows = await ctx.prisma.client.$queryRaw<{ effectiveness: string }[]>(Prisma.sql`
        SELECT ${controlEffectivenessExpression(
          Prisma.sql`c.id`,
          Prisma.sql`c.frequency`,
          REFERENCE_DATE_PARAM,
        )} AS effectiveness
        FROM controls c
        WHERE c.id = ${control.id}::uuid
      `);
      const sqlEffectiveness = sqlRows[0]?.effectiveness;

      // --- Domain side -----------------------------------------------------
      const rows = await ctx.prisma.client.controlAssessment.findMany({
        where: { controlId: control.id },
        select: { assessedOn: true, createdAt: true, result: true, attestedAt: true },
      });
      const domainEffectiveness = calculateControlEffectiveness(
        rows,
        testCase.frequency,
        REFERENCE_DATE,
      );

      expect(sqlEffectiveness, `case "${testCase.label}"`).toBe(domainEffectiveness);
    },
  );
});
