import type { MethodologyVersionWithActiveFlag } from '../../application/methodology-query.usecase';
import type { MethodologyVersionRecord } from '../../domain/ports/risk-methodology-repository.port';

export interface MethodologyVersionResponse {
  readonly id: string;
  readonly methodologyName: string;
  readonly versionNumber: number;
  readonly probabilityScale: MethodologyVersionRecord['probabilityScale'];
  readonly impactScale: MethodologyVersionRecord['impactScale'];
  readonly matrix: MethodologyVersionRecord['matrix'];
  readonly levelBands: MethodologyVersionRecord['levelBands'];
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly createdBy: { readonly id: string; readonly fullName: string; readonly email: string };
}

export function toMethodologyVersionResponse(
  input: MethodologyVersionWithActiveFlag,
): MethodologyVersionResponse {
  const { version, isActive } = input;
  return {
    id: version.id,
    methodologyName: version.methodologyName,
    versionNumber: version.versionNumber,
    probabilityScale: version.probabilityScale,
    impactScale: version.impactScale,
    matrix: version.matrix,
    levelBands: version.levelBands,
    effectiveFrom: version.effectiveFrom.toISOString(),
    isActive,
    createdBy: version.createdBy,
  };
}
