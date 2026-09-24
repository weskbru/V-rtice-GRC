import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { getActionOriginAccessor } from '../../shared/domain/ports/action-origin-resolver.port';

import type { ActionOriginAccess } from '../../shared/domain/ports/action-origin-resolver.port';
import type { ActionOriginType } from '@prisma/client';

export async function assertActionOriginInScope(
  actorUserId: string,
  actionId: string,
  originType: ActionOriginType,
  originId: string,
): Promise<ActionOriginAccess> {
  try {
    return await getActionOriginAccessor(originType).resolveOriginScope(actorUserId, originId);
  } catch (error) {
    if (error instanceof NotFoundDomainError) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, actionId);
    }
    throw error;
  }
}
