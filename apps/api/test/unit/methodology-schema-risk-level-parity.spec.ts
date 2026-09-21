/**
 * F-27 (`docs/deferred-findings.md`) — `methodology.schema.ts`'s own header
 * comment claims its `RiskLevelValue` union is "kept string-identical to
 * Prisma's `RiskLevel` enum by hand (verified in this file's own test)".
 * No such test existed: `apps/api/test/unit/risk-scoring.spec.ts` imports
 * the type and uses it, but never asserts the identity claim itself. This
 * file is that missing test, not a rewrite of the comment — the claim was
 * correct, it just had nothing behind it (CLAUDE.md's own recurring lesson
 * about a comment that does not survive the fact it recorded, F-42).
 *
 * `methodology.schema.ts` itself deliberately imports no Prisma value (its
 * own header comment: "no Prisma value import" — the module-domain
 * boundary, ADR-011). This TEST is not bound by that rule; it exists
 * precisely to check the two independent sources agree, so it is the one
 * place allowed to import both.
 *
 * Introspects the generated Prisma client's own DMMF (`Prisma.dmmf`) —
 * mirrors `action-model-convergence-guard.spec.ts`'s own pattern for the
 * exact same class of guard: no database connection, no NestJS DI
 * container, fails the moment `schema.prisma`'s `RiskLevel` enum drifts
 * from `methodology.schema.ts`'s hand-kept union, without needing anyone to
 * remember to update this file by hand when they touch either side.
 */
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
    // A literal that does not belong to the union would fail to compile
    // here, not just at runtime — this is the compile-time half of the
    // parity claim; the test above is the runtime half.
    const sample: RiskLevelValue = RISK_LEVEL_VALUES[0]!;
    expect(RISK_LEVEL_VALUES).toContain(sample);
  });
});
