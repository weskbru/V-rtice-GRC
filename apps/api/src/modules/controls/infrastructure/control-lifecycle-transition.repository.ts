import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlLifecycleTransitionRepositoryPort } from '../domain/ports/control-lifecycle-transition-repository.port';

import type {
  ControlLifecycleTransitionRecord,
  CreateControlLifecycleTransitionInput,
} from '../domain/ports/control-lifecycle-transition-repository.port';
import type { Prisma } from '@prisma/client';

const TRANSITION_INCLUDE = {
  performedByUser: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ControlLifecycleTransitionInclude;

type TransitionWithRelations = Prisma.ControlLifecycleTransitionGetPayload<{
  include: typeof TRANSITION_INCLUDE;
}>;

@Injectable()
export class ControlLifecycleTransitionRepository implements ControlLifecycleTransitionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateControlLifecycleTransitionInput,
  ): Promise<ControlLifecycleTransitionRecord> {
    const created = await this.prisma.client.controlLifecycleTransition.create({
      data: {
        controlId: input.controlId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        performedByUserId: input.performedByUserId,
        performedAt: new Date(),
        justification: input.justification,
      },
      include: TRANSITION_INCLUDE,
    });

    return toRecord(created);
  }
}

function toRecord(row: TransitionWithRelations): ControlLifecycleTransitionRecord {
  return {
    id: row.id,
    controlId: row.controlId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    performedBy: {
      id: row.performedByUser.id,
      fullName: row.performedByUser.fullName,
      email: row.performedByUser.email,
    },
    performedAt: row.performedAt,
    justification: row.justification,
  };
}
