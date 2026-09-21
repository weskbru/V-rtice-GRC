/**
 * T037-T040/004-compliance-management, User Story 2 — exhaustive unit
 * coverage of `classifyMappingMigrationTarget`
 * (`domain/requirement-control-mapping-migration.entity.ts`, research.md
 * D-6). Pure function: no I/O, no database — the DB-backed re-runnability/
 * one-audit-event guarantees are covered separately by
 * `test/integration/mapping-migration.spec.ts`.
 */
import { describe, expect, it } from 'vitest';

import { classifyMappingMigrationTarget } from '../../src/modules/compliance/domain/requirement-control-mapping-migration.entity';

describe('classifyMappingMigrationTarget (T036, research.md D-6)', () => {
  it('returns SKIPPED_ALREADY_MAPPED when the target already has an active link, even if named in correspondences (FR-014)', () => {
    expect(classifyMappingMigrationTarget(true, ['source-1'])).toBe('SKIPPED_ALREADY_MAPPED');
  });

  it('returns SKIPPED_ALREADY_MAPPED when the target already has an active link and is NOT named in correspondences', () => {
    expect(classifyMappingMigrationTarget(true, undefined)).toBe('SKIPPED_ALREADY_MAPPED');
  });

  it('returns COPIED when the target has no active link and is named with at least one source', () => {
    expect(classifyMappingMigrationTarget(false, ['source-1', 'source-2'])).toBe('COPIED');
  });

  it('returns PENDING_DECISION when the target has no active link and is absent from correspondences (FR-013) — never silently unmapped', () => {
    expect(classifyMappingMigrationTarget(false, undefined)).toBe('PENDING_DECISION');
  });

  it('returns PENDING_DECISION, never COPIED, for an empty sourceRequirementIds array — never inferred/assumed correspondence', () => {
    expect(classifyMappingMigrationTarget(false, [])).toBe('PENDING_DECISION');
  });

  it('never infers a correspondence from matching externalRef/text — this function only ever sees ids the caller decided, so a coincidental external-code match that was never listed in correspondences cannot reach this function as a source at all, and an absent target is PENDING_DECISION regardless of any coincidence upstream', () => {
    // Simulates two requirements sharing an externalRef in different
    // versions: the caller (`ExecuteMappingMigrationUseCase`) never
    // includes an inferred pairing, so this function only ever receives
    // `undefined` for that target.
    expect(classifyMappingMigrationTarget(false, undefined)).toBe('PENDING_DECISION');
  });
});
