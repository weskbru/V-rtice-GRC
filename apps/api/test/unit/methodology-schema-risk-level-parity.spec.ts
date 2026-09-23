import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  RISK_LEVEL_VALUES,
  type RiskLevelValue,
} from '../../src/modules/risk/domain/methodology.schema';

describe('methodology.schema.ts RiskLevelValue parity with Prisma RiskLevel', () => {
  it('RISK_LEVEL_VALUES contains exactly the same members, in the same order, as the Prisma schema enum', () => {
    const prismaRiskLevel = Prisma.dmmf.datamodel.enums.find(
      (candidate) => candidate.name === 'RiskLevel',
    );
    expect(prismaRiskLevel, 'schema.prisma must declare an enum named RiskLevel').toBeDefined();

    const prismaValues = prismaRiskLevel!.values.map((value) => value.name);
    expect(RISK_LEVEL_VALUES).toEqual(prismaValues);
  });

  it('every RiskLevelValue literal is assignable from a real RISK_LEVEL_VALUES member (type-level cross-check)', () => {
    const sample: RiskLevelValue = RISK_LEVEL_VALUES[0]!;
    expect(RISK_LEVEL_VALUES).toContain(sample);
  });
});
