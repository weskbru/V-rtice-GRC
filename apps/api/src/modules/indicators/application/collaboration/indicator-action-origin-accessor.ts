/**
 * 009-indicators-reports, Fase 6 (T043) — `modules/indicators`'s own
 * registration against `ActionOriginResolverPort`'s registry
 * (`grc/shared/domain/ports/action-origin-resolver.port.ts`) for
 * `ActionOriginType.INDICATOR` (spec.md FR-020, research.md D-5). Mirrors
 * `IncidentActionOriginAccessor`/`ProblemActionOriginAccessor`'s shape
 * (see either file's header for the full two-check rationale this file
 * does not repeat), with the org-wide difference FR-021 requires.
 *
 * `Action.originId` for `INDICATOR` is the `IndicatorDefinition`'s OWN
 * id — "criar uma ação corretiva a partir de um indicador" means picking
 * an existing, configured indicator (owner, threshold — data-model.md
 * §1), never a bare catalog metric key, which has no id of its own to be
 * an origin.
 *
 * `resolveEditableOrigin` is checked against `indicator:edit` — stricter
 * than `resolveViewableOrigin` (`indicator:view`) — the same "edit vs.
 * view" split `ControlAssessmentActionOriginAccessor`/
 * `IncidentActionOriginAccessor` already use, since Indicators has no
 * dedicated "treat"-shaped permission the way Risk does.
 *
 * ## Org-wide, not scope-checked (research.md D-8, spec.md FR-021)
 *
 * `IndicatorDefinition` carries no `orgUnitId` (data-model.md §1): it is a
 * shared, organization-wide catalog row, visible to any caller holding
 * `indicator:view`/`indicator:edit` regardless of organizational unit —
 * "a mesma característica 'organização inteira' de FR-004" (FR-021).
 * `resolveOriginScope`/`listOriginIdsInScope` reflect this LITERALLY:
 *
 *   - `resolveOriginScope` checks existence only, never containment —
 *     there is no unit for the origin to have fallen out of the actor's
 *     scope OF. `assertActionOriginInScope`'s single-row re-check
 *     therefore never refuses an `INDICATOR`-origin `Action` for scope
 *     reasons, no matter which unit(s) the caller's own `ScopeFilter`
 *     grants.
 *   - `listOriginIdsInScope` returns EVERY `IndicatorDefinition` id,
 *     unconditionally, ignoring its own `scope` parameter entirely —
 *     `IndicatorDefinitionRepositoryPort.listAllIds()`'s own doc comment
 *     explains why "every id" and "every id currently in scope" are the
 *     same set for a table with no unit column.
 *
 * This is a decision, not an omission — do not "fix" it later by
 * inferring a unit from some other table (CLAUDE.md §19.3 forbids
 * exactly that shape of inference: research.md D-8 already rejected
 * inferring Compliance's own "effective unit" through a linked `Control`
 * for the identical reason).
 *
 * ## `Action.orgUnitId` still needs a real, valid value (research.md D-8)
 *
 * `Action.orgUnitId` (data-model.md §4 of `002-shared-grc-foundation`) is
 * NOT NULL, FK'd to `organizational_units` — `createAction` still needs
 * SOME real unit to stamp on the resulting row, even though it plays no
 * role in access control for this origin type (that is `indicator:view`/
 * `indicator:edit` alone, checked above, plus the org-wide scope rule).
 * Absent a unit on the origin itself, this accessor uses the CURRENT
 * `primaryOrgUnitId` of the definition's OWN `ownerUserId` — the same
 * "owner" research.md D-7's breach-notification recipient already is —
 * re-resolved on every call via
 * `IndicatorReferenceDataPort#findUserOrgUnitId`, never cached on the
 * `Action` itself. This is purely a storage/display necessity for a
 * column every `Action` row must carry; a coordinator revisiting this
 * choice should read this file's header before changing it, not
 * rediscover the constraint from a failing `NOT NULL` write.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError, ValidationDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IndicatorDefinitionRepositoryPort } from '../../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../../domain/ports/indicator-reference-data.port';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

@Injectable()
export class IndicatorActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly indicatorDefinitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly indicatorReferenceData: IndicatorReferenceDataPort,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /** Registered for `ActionOriginType.INDICATOR` — `createAction`'s own
   * gate (FR-031). */
  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'indicator:edit');
  }

  /** Registered for `ActionOriginType.INDICATOR` — the read-side
   * counterpart used only to populate `Action.originLabel`. */
  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'indicator:view');
  }

  /** Registered for `ActionOriginType.INDICATOR` — the assurance-fix
   * SCOPE-ONLY re-check (no permission gate — see
   * `action-origin-resolver.port.ts#resolveOriginScope`'s own doc comment
   * for why). FR-021: `IndicatorDefinition` has no unit to fall out of
   * scope of, so this checks EXISTENCE only, never containment — this
   * class's own header explains why that is the literal, intended
   * reading of "toda IndicatorDefinition [é] visível a qualquer chamador
   * com indicator:view" applied to this method. */
  async resolveOriginScope(_actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveExisting(originId);
  }

  /** Registered for `ActionOriginType.INDICATOR` — the bulk, SCOPE-ONLY
   * listing `ListActionUseCase` uses to filter a page of actions by their
   * origin's CURRENT unit. FR-021: EVERY `IndicatorDefinition` id is
   * unconditionally in scope, so `scope` is deliberately never consulted
   * — see `IndicatorDefinitionRepositoryPort.listAllIds()`'s own doc
   * comment. */
  async listOriginIdsInScope(_scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.indicatorDefinitionRepository.listAllIds();
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'indicator:edit' | 'indicator:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, originId);
    }
    return this.resolveExisting(originId);
  }

  private async resolveExisting(originId: string): Promise<ActionOriginAccess> {
    const definition = await this.indicatorDefinitionRepository.findById(originId);
    if (!definition) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, originId);
    }

    // This class's own header, "`Action.orgUnitId` still needs a real,
    // valid value" — the definition's OWNER's current unit, re-resolved
    // live, never a value stamped once and reused.
    const organizationalUnitId = await this.indicatorReferenceData.findUserOrgUnitId(
      definition.ownerUserId,
    );
    if (!organizationalUnitId) {
      throw new ValidationDomainError(USER_MESSAGES.indicators.ownerHasNoOrgUnitForAction);
    }

    return {
      organizationalUnitId,
      label: `${definition.code} — ${definition.name}`,
    };
  }
}
