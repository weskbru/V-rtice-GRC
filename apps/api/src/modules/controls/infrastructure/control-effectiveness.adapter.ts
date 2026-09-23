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
