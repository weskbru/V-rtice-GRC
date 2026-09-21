/**
 * T015/004-compliance-management — the sole implementation of
 * `ControlEffectivenessPort` (`shared/grc-ports/control-effectiveness.port.ts`,
 * research.md D-9). `modules/controls` OWNS `controls`/`control_assessments`,
 * so this adapter is the one place in the platform allowed to query them on
 * behalf of another module — the same principle
 * `PrismaControlDirectoryAdapter` already establishes for identity/scope.
 *
 * ## One batched query, one call to the SAME calculator per control
 *
 * `WHERE control_id = ANY($1) AND attested_at IS NOT NULL` (research.md
 * D-9's own words) resolves every attested assessment for every requested
 * control in a single round-trip; rows are grouped in memory by
 * `controlId`, and `calculateControlEffectiveness`
 * (`domain/control-effectiveness.service.ts`, the SAME single calculator
 * `ControlRepository`/`control-effectiveness-query.ts` already use) is
 * invoked once per control — never a second, hand-rolled rule. A control
 * with zero attested assessments is not a distinct code path: an absent
 * key in the grouped map simply means `calculateControlEffectiveness([],
 * ...)`, which already returns `'NOT_ASSESSED'` (FR-013) with no special
 * casing needed here.
 *
 * `frequency` is read from `controls` in the SAME batched query's sibling
 * `findMany` (one extra round-trip, not N) — the calculator needs it to
 * decide `EXPIRED` (FR-014).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlEffectivenessPort } from '../../../shared/grc-ports/control-effectiveness.port';
import { calculateControlEffectiveness } from '../domain/control-effectiveness.service';

import type { ControlEffectivenessLevel } from '../../../shared/grc-ports/control-effectiveness.port';
import type { ControlAssessmentForEffectiveness } from '../domain/control-effectiveness.service';

@Injectable()
export class PrismaControlEffectivenessAdapter implements ControlEffectivenessPort {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectivenessBatch(
    controlIds: readonly string[],
    referenceDate: Date,
  ): Promise<ReadonlyMap<string, ControlEffectivenessLevel>> {
    if (controlIds.length === 0) {
      return new Map();
    }

    const ids = Array.from(controlIds);

    const [controls, assessments] = await Promise.all([
      this.prisma.client.control.findMany({
        where: { id: { in: ids } },
        select: { id: true, frequency: true },
      }),
      this.prisma.client.controlAssessment.findMany({
        where: { controlId: { in: ids }, attestedAt: { not: null } },
        select: {
          controlId: true,
          assessedOn: true,
          createdAt: true,
          result: true,
          attestedAt: true,
        },
      }),
    ]);

    const assessmentsByControlId = new Map<string, ControlAssessmentForEffectiveness[]>();
    for (const assessment of assessments) {
      const bucket = assessmentsByControlId.get(assessment.controlId) ?? [];
      bucket.push({
        assessedOn: assessment.assessedOn,
        createdAt: assessment.createdAt,
        result: assessment.result,
        attestedAt: assessment.attestedAt,
      });
      assessmentsByControlId.set(assessment.controlId, bucket);
    }

    const result = new Map<string, ControlEffectivenessLevel>();
    for (const control of controls) {
      const controlAssessments = assessmentsByControlId.get(control.id) ?? [];
      result.set(
        control.id,
        calculateControlEffectiveness(controlAssessments, control.frequency, referenceDate),
      );
    }
    return result;
  }
}
