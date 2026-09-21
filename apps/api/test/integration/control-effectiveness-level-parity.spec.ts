/**
 * T016/004-compliance-management — proves the two deliberately-duplicated
 * closed vocabularies never drift apart (research.md D-9):
 * `ControlEffectivenessLevel` (`shared/grc-ports/control-effectiveness.port.ts`,
 * T014) and `ControlEffectiveness`
 * (`modules/controls/domain/control-effectiveness.service.ts`). Same
 * pattern as `control-effectiveness-parity.spec.ts` (Fase 2, T016 of
 * 003-controls-management) — that test confronts the domain calculator
 * against its SQL twin over real data; this one confronts two RUNTIME
 * value sets (a type is erased at compile time, so a "did the two enums
 * drift" question can only be answered by comparing actual arrays).
 *
 * Also exercises `PrismaControlEffectivenessAdapter.getEffectivenessBatch`
 * (T015) end to end against real seeded data — a batch of controls with
 * distinct assessment histories, confirming the port's own output values
 * are drawn from exactly the parity-checked vocabulary and agree with the
 * same domain calculator `ControlRepository` already uses.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import {
  CONTROL_EFFECTIVENESS_VALUES,
  calculateControlEffectiveness,
} from '../../src/modules/controls/domain/control-effectiveness.service';
import { PrismaControlEffectivenessAdapter } from '../../src/modules/controls/infrastructure/control-effectiveness.adapter';
import { CONTROL_EFFECTIVENESS_LEVELS } from '../../src/shared/grc-ports/control-effectiveness.port';

import { uniqueTestMarker } from './support/env';
import { createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('ControlEffectivenessLevel (port) and ControlEffectiveness (domain) never drift (T014/T016)', () => {
  it('the two runtime vocabularies contain exactly the same values', () => {
    const portValues = new Set(CONTROL_EFFECTIVENESS_LEVELS);
    const domainValues = new Set(CONTROL_EFFECTIVENESS_VALUES);

    expect(portValues.size).toBe(CONTROL_EFFECTIVENESS_LEVELS.length);
    expect(domainValues.size).toBe(CONTROL_EFFECTIVENESS_VALUES.length);
    expect([...portValues].sort()).toEqual([...domainValues].sort());
  });

  describe('PrismaControlEffectivenessAdapter agrees with the domain calculator over real data', () => {
    let ctx: IntegrationTestContext;
    let adapter: PrismaControlEffectivenessAdapter;
    let assessorId: string;
    let attesterId: string;
    const referenceDate = new Date(Date.UTC(2026, 8, 7));

    beforeAll(async () => {
      ctx = await buildIntegrationTestingModule({});
      adapter = new PrismaControlEffectivenessAdapter(ctx.prisma);
      const assessor = await createUserFixture(ctx.prisma, {
        email: `${uniqueTestMarker('effectiveness-batch-assessor')}@example.test`,
      });
      const attester = await createUserFixture(ctx.prisma, {
        email: `${uniqueTestMarker('effectiveness-batch-attester')}@example.test`,
      });
      assessorId = assessor.id;
      attesterId = attester.id;
    });

    afterAll(async () => {
      await ctx.close();
    });

    it('resolves NOT_ASSESSED for a control with no attested assessment, EFFECTIVE for one that has one, in a single batch call', async () => {
      const unassessedControl = await ctx.prisma.client.control.create({
        data: { code: uniqueTestMarker('effectiveness-batch-unassessed'), name: 'Unassessed' },
      });
      const assessedControl = await ctx.prisma.client.control.create({
        data: { code: uniqueTestMarker('effectiveness-batch-assessed'), name: 'Assessed' },
      });
      await ctx.prisma.client.controlAssessment.create({
        data: {
          controlId: assessedControl.id,
          assessedOn: referenceDate,
          assessorUserId: assessorId,
          result: 'EFFECTIVE',
          conclusion: 'Fixture conclusion.',
          attestedAt: referenceDate,
          attestedByUserId: attesterId,
        },
      });

      const batch = await adapter.getEffectivenessBatch(
        [unassessedControl.id, assessedControl.id],
        referenceDate,
      );

      expect(batch.get(unassessedControl.id)).toBe('NOT_ASSESSED');
      expect(batch.get(assessedControl.id)).toBe('EFFECTIVE');

      // Every value the port produced is drawn from the parity-checked
      // vocabulary, and agrees with the SAME domain calculator directly.
      for (const value of batch.values()) {
        expect(CONTROL_EFFECTIVENESS_LEVELS).toContain(value);
      }
      expect(calculateControlEffectiveness([], null, referenceDate)).toBe(
        batch.get(unassessedControl.id),
      );
    });

    it('an empty id array short-circuits to an empty map without a round-trip', async () => {
      const batch = await adapter.getEffectivenessBatch([], referenceDate);
      expect(batch.size).toBe(0);
    });
  });
});
