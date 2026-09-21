/**
 * T051/002-shared-grc-foundation, US2 — resolves `Action.originLabel`
 * (contracts/grc-foundation.openapi.yaml, an OPTIONAL display field) via
 * `ActionOriginResolverPort`'s registered accessor for the action's own
 * `originType`, tolerating a `NotFoundDomainError` by simply omitting the
 * label — see `action-origin-resolver.port.ts#ActionOriginAccessor
 * .resolveViewableOrigin`'s own doc comment for why. Shared by
 * `GetActionUseCase`/`ListActionUseCase` rather than duplicated.
 */
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
