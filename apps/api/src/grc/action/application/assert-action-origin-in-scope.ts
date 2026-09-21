/**
 * Assurance fix (confirmed breach) — shared by `GetActionUseCase`,
 * `UpdateActionUseCase` and `TransitionActionUseCase`. `Action.orgUnitId`
 * is stamped once at creation from the origin's organizational unit
 * (`CreateActionUseCase`) and never revisited, so it goes stale the moment
 * the origin (e.g. a `Risk`) is later reassigned to a different unit via
 * its own `PATCH` — the three routes above were still trusting that stale
 * snapshot for their own scope decision (`ActionScopedRepository`'s
 * `orgUnitId` predicate), so a custodian who lost scope over the origin
 * kept full read/write access to the derived `Action`, while the origin's
 * new custodian was 404'd on it.
 *
 * This re-checks the origin's CURRENT organizational unit LIVE, on every
 * request, via `ActionOriginResolverPort#resolveOriginScope` — the same
 * "never persisted, always re-resolved" answer
 * `EvidenceLinkVisibilityService` already gives for a link's subject —
 * and re-keys any refusal to the ACTION's own id (never the origin's),
 * mirroring `core/files/application/attachment-access.ts`'s documented
 * reasoning: the caller here supplied the ACTION's id, never the origin's,
 * so a 404 naming the origin would both disclose a UUID the caller never
 * supplied and make "action does not exist" distinguishable from "action
 * exists but its origin fell out of scope" (FR-030).
 */
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { getActionOriginAccessor } from '../../shared/domain/ports/action-origin-resolver.port';

import type { ActionOriginAccess } from '../../shared/domain/ports/action-origin-resolver.port';
import type { ActionOriginType } from '@prisma/client';

/** Returns the origin's CURRENT organizational unit — never `Action`'s own
 * (possibly stale) `orgUnit` — so the caller can act/audit against the
 * live value. Throws `NotFoundDomainError(USER_MESSAGES.action.entityLabel,
 * actionId)` when the actor's scope no longer covers the origin's current
 * unit or the origin no longer exists. */
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
