/**
 * 009-indicators-reports, Fase 3 (T030/T031) — resolves an
 * `IndicatorDefinition.ownerUserId` into the `UserRef` shape
 * `contracts/indicators.openapi.yaml`'s `IndicatorDefinition.owner` schema
 * declares. `IndicatorDefinitionRecord` itself stays flat (`ownerUserId:
 * string`, `indicator-definition.entity.ts`'s own header: "the presentation
 * layer's mapper reshapes into its DTO") — deliberately NOT a nested
 * Prisma `include` join at the repository layer, unlike
 * `IncidentRepositoryPort`'s own `owner`, because `test/unit/
 * indicator-calculation-service.spec.ts` (T029, already shipped) constructs
 * `IndicatorDefinitionRecord` literals against the flat shape; changing it
 * now would break that already-passing test for a change entirely outside
 * this task's scope. `CreateIndicatorDefinitionUseCase`,
 * `ListIndicatorDefinitionsUseCase` and `GetIndicatorCurrentValueUseCase`
 * each call this one function instead of re-deriving the same lookup.
 *
 * Never returns `undefined`: `ownerUserId` is `onDelete: Restrict`
 * (schema.prisma), so a persisted `IndicatorDefinition` can never outlive
 * its owner user — a miss here means the FK constraint itself was
 * bypassed, not a legitimate "owner not found" case a caller should see as
 * data. Thrown, not silently defaulted, mirroring
 * `IndicatorCalculationService`'s own "unreachable, thrown" convention for
 * its provider-registration invariant.
 */
import type { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

export interface IndicatorOwnerRef {
  readonly id: string;
  readonly fullName: string;
}

async function resolveIndicatorUserRef(
  referenceData: IndicatorReferenceDataPort,
  userId: string,
  fieldLabel: string,
): Promise<IndicatorOwnerRef> {
  const user = await referenceData.findUser(userId);
  if (!user) {
    throw new Error(
      `Indicator record references ${fieldLabel} ${userId}, but no such user exists. ` +
        `${fieldLabel} is onDelete: Restrict, so this is unreachable in correct data.`,
    );
  }
  return { id: user.id, fullName: user.fullName };
}

export async function resolveIndicatorOwnerRef(
  referenceData: IndicatorReferenceDataPort,
  ownerUserId: string,
): Promise<IndicatorOwnerRef> {
  return resolveIndicatorUserRef(referenceData, ownerUserId, 'ownerUserId');
}

/** 009-indicators-reports, Fase 4 (T035/T036) — same resolution, for
 * `IndicatorMeasurement.computedByUserId` (schema.prisma: also
 * `onDelete: Restrict`, same non-nullable FK-integrity argument as
 * `ownerUserId` above). Shares the private lookup instead of duplicating
 * it — only the field being resolved differs. */
export async function resolveIndicatorComputedByRef(
  referenceData: IndicatorReferenceDataPort,
  computedByUserId: string,
): Promise<IndicatorOwnerRef> {
  return resolveIndicatorUserRef(referenceData, computedByUserId, 'computedByUserId');
}
