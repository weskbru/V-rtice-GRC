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

export async function resolveIndicatorComputedByRef(
  referenceData: IndicatorReferenceDataPort,
  computedByUserId: string,
): Promise<IndicatorOwnerRef> {
  return resolveIndicatorUserRef(referenceData, computedByUserId, 'computedByUserId');
}
