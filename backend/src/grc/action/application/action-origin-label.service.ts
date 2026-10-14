import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { getActionOriginAccessor } from '../../shared/domain/ports/action-origin-resolver.port';

import type { ActionOriginType } from '@prisma/client';

@Injectable()
export class ActionOriginLabelService {
  async resolveLabel(
    actorUserId: string,
    originType: ActionOriginType,
    originId: string,
  ): Promise<string | undefined> {
    try {
      const origin = await getActionOriginAccessor(originType).resolveViewableOrigin(
        actorUserId,
        originId,
      );
      return origin.label;
    } catch (error) {
      if (error instanceof NotFoundDomainError) {
        return undefined;
      }
      throw error;
    }
  }
}
