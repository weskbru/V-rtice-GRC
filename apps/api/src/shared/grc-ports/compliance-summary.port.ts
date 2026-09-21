/**
 * 009-indicators-reports, T021 (research.md D-4, D-8) — the boundary port
 * between `modules/indicators` and `modules/compliance` for
 * `COMPLIANCE_PERCENTAGE`. `Compliance` is a business-module domain
 * (ADR-016), so this is a module-to-module boundary — the same reasoning
 * `control-directory.port.ts` documents in full.
 *
 * ## The ONE key with no `ScopeFilter` parameter anywhere (research.md D-8)
 *
 * `Requirement`/`FrameworkVersion` carry no organizational-unit column at
 * all — a framework applies to the whole organization, never to one unit
 * (data-model.md §8 of `009-indicators-reports`). This method therefore
 * takes NO scope parameter, mirroring
 * `OrganizationWideIndicatorMetricProvider.computeValue()`'s own
 * zero-argument shape (`modules/indicators/domain/indicator-metric-provider.ts`)
 * — a compile-time fact, not a parameter this port's single implementation
 * chooses to ignore.
 *
 * ## Aggregated across every PUBLISHED `FrameworkVersion`, using the SAME
 * calculator `GetFrameworkVersionComplianceSummaryUseCase` already uses
 *
 * A `FrameworkVersion` can only be added to `GET
 * /indicators/{metricKey}/current` scope-free — there is no `frameworkId`/
 * `versionId` parameter on that route (contracts/indicators.openapi.yaml).
 * `COMPLIANCE_PERCENTAGE` is therefore an ORGANIZATION-WIDE rollup across
 * every `PUBLISHED` `FrameworkVersion`, not one version's own summary — see
 * `modules/compliance/infrastructure/organization-compliance-summary.adapter.ts`'s
 * own header for exactly how it reuses `calculateRequirementComplianceState`
 * (the SAME single calculator, `domain/requirement-compliance.service.ts`)
 * rather than a second counting rule.
 *
 * ## `RequirementComplianceState` type import — the one import this file
 * now has
 *
 * `@prisma/client`'s generated `RequirementComplianceState` enum is a
 * TYPE-ONLY import (`import type`), erased at compile time — it does not
 * make this file depend on `core/**`, `grc/**` or `modules/**` any more
 * than `control-effectiveness.port.ts`'s own `ControlEffectivenessLevel`
 * literal union would if it borrowed the same generated type instead of
 * hand-declaring one; `shared/**`'s boundary restriction is about runtime
 * module dependencies (`eslint-plugin-boundaries`), not about referencing a
 * generated, platform-wide Prisma type.
 */
import type { RequirementComplianceState } from '@prisma/client';

export interface ComplianceStateBreakdown {
  /** Every requirement of a `PUBLISHED` `FrameworkVersion` — the same
   * population `getOrganizationWideCompliancePercentage` draws its
   * denominator/numerator from, before the `NOT_APPLICABLE` exclusion that
   * method applies. */
  readonly requirementCount: number;
  /** Zero-filled for every `RequirementComplianceState` value. Sums to
   * exactly `requirementCount` — each requirement contributes to exactly
   * one bucket. */
  readonly byState: Readonly<Record<RequirementComplianceState, number>>;
}

export abstract class ComplianceSummaryPort {
  /** `undefined` when there is nothing to measure yet — zero `PUBLISHED`
   * `FrameworkVersion`s, or zero non-`NOT_APPLICABLE` requirements among
   * them (spec.md's own edge case: "o valor atual é null/indisponível,
   * nunca 0 nem 100"). Never `0`/`100` as a stand-in for "no data". */
  abstract getOrganizationWideCompliancePercentage(): Promise<number | undefined>;

  /**
   * `GET /dashboard/summary`'s `breakdowns.compliance` — the per-state
   * distribution of the SAME requirement population/calculation
   * `getOrganizationWideCompliancePercentage` uses
   * (`calculateRequirementComplianceState`, CLAUDE.md §19.7's "um único
   * calculador"), never a second pass over the data with different
   * inclusion rules. Unlike the percentage method, this never returns
   * `undefined` — zero requirements is a genuine, representable
   * `{ requirementCount: 0, byState: <all zero> }`, not "no data".
   */
  abstract getStateBreakdown(): Promise<ComplianceStateBreakdown>;
}
