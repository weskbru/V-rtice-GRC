/**
 * Unit tests for T030's field allow-list (no I/O, no NestJS container).
 */
import { AuditEntityType } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  __resetAuditFieldAllowlistRegistryForTests,
  applyAuditFieldAllowlist,
  registerAuditFieldAllowlist,
} from '../../src/core/audit/domain/audit-field-allowlist';
import { registerCoreEntityAuditAllowlists } from '../../src/core/audit/domain/core-entity-audit-allowlists';
import {
  AuditFieldAllowlistNotRegisteredError,
  InvalidAuditFieldAllowlistError,
} from '../../src/core/audit/domain/errors';
import { registerCommentsAuditAllowlist } from '../../src/core/comments/domain/comments-audit-allowlist';
import { registerFilesAuditAllowlist } from '../../src/core/files/domain/files-audit-allowlist';
import { registerGrcAuditAllowlists } from '../../src/grc/shared/domain/grc-audit-allowlist';
import { registerAssetAuditAllowlists } from '../../src/modules/assets/domain/asset-audit-allowlist';
import { registerAuditEngagementAuditAllowlists } from '../../src/modules/audit-engagements/domain/audit-engagement-audit-allowlist';
import { registerComplianceAuditAllowlists } from '../../src/modules/compliance/domain/compliance-audit-allowlist';
import { registerControlAssessmentAuditAllowlists } from '../../src/modules/controls/control-assessment-audit-allowlist';
import { registerControlAuditAllowlists } from '../../src/modules/controls/domain/control-audit-allowlist';
import { registerIncidentAuditAllowlists } from '../../src/modules/incidents/domain/incident-audit-allowlist';
import { registerIndicatorAuditAllowlists } from '../../src/modules/indicators/domain/indicator-audit-allowlist';
import { registerProblemAuditAllowlists } from '../../src/modules/problems/domain/problem-audit-allowlist';
import { registerProcessAuditAllowlists } from '../../src/modules/processes/domain/process-audit-allowlist';
import { registerReportAuditAllowlists } from '../../src/modules/reports/domain/report-audit-allowlist';
import { registerRiskAuditAllowlists } from '../../src/modules/risk/domain/risk-audit-allowlist';

describe('audit field allow-list (T030, FR-035)', () => {
  beforeEach(() => {
    __resetAuditFieldAllowlistRegistryForTests();
  });

  afterEach(() => {
    __resetAuditFieldAllowlistRegistryForTests();
  });

  it('drops fields that are not on the allow-list, never passing them through', () => {
    registerAuditFieldAllowlist(AuditEntityType.USER, ['email', 'fullName']);

    const result = applyAuditFieldAllowlist(AuditEntityType.USER, {
      email: 'a@example.com',
      fullName: 'Ada Lovelace',
      internalNotes: 'not allow-listed',
    });

    expect(result).toEqual({ email: 'a@example.com', fullName: 'Ada Lovelace' });
    expect(result).not.toHaveProperty('internalNotes');
  });

  it('returns undefined for null/undefined input', () => {
    registerAuditFieldAllowlist(AuditEntityType.USER, ['email']);

    expect(applyAuditFieldAllowlist(AuditEntityType.USER, null)).toBeUndefined();
    expect(applyAuditFieldAllowlist(AuditEntityType.USER, undefined)).toBeUndefined();
  });

  it('returns undefined when every field is filtered out (no noise objects)', () => {
    registerAuditFieldAllowlist(AuditEntityType.USER, ['email']);

    const result = applyAuditFieldAllowlist(AuditEntityType.USER, { somethingElse: 1 });
    expect(result).toBeUndefined();
  });

  it('throws for an entity type with no registered allow-list, rather than passing everything through', () => {
    expect(() => applyAuditFieldAllowlist(AuditEntityType.ROLE, { name: 'Admin' })).toThrow(
      AuditFieldAllowlistNotRegisteredError,
    );
  });

  it('refuses to register a secret-shaped field name — password hash', () => {
    expect(() =>
      registerAuditFieldAllowlist(AuditEntityType.LOCAL_CREDENTIAL, [
        'passwordChangedAt',
        'passwordHash',
      ]),
    ).toThrow(InvalidAuditFieldAllowlistError);

    // The whole registration must fail, not just the offending field —
    // otherwise a caller could believe LOCAL_CREDENTIAL was registered
    // ("passwordChangedAt at least got through") when it silently was not.
    expect(() =>
      applyAuditFieldAllowlist(AuditEntityType.LOCAL_CREDENTIAL, { passwordChangedAt: new Date() }),
    ).toThrow(AuditFieldAllowlistNotRegisteredError);
  });

  it('refuses to register a secret-shaped field name — session token hash', () => {
    expect(() =>
      registerAuditFieldAllowlist(AuditEntityType.SESSION, ['tokenHash', 'expiresAt']),
    ).toThrow(InvalidAuditFieldAllowlistError);
  });

  it('refuses to register the same entity type twice', () => {
    registerAuditFieldAllowlist(AuditEntityType.USER, ['email']);
    expect(() => registerAuditFieldAllowlist(AuditEntityType.USER, ['fullName'])).toThrow(
      InvalidAuditFieldAllowlistError,
    );
  });

  it('a future module registers its own entity type independently, without touching an existing registration', () => {
    // Simulates the extensibility ADR-011 requires: one "module" (here,
    // Core identity) registers USER first; a second, unrelated "module"
    // (here, standing in for a future business module) registers ROLE
    // later, from a separate call site, with no knowledge of and no edit
    // to the USER registration above.
    registerAuditFieldAllowlist(AuditEntityType.USER, ['email']);
    registerAuditFieldAllowlist(AuditEntityType.ROLE, ['name']);

    expect(applyAuditFieldAllowlist(AuditEntityType.USER, { email: 'a@example.com' })).toEqual({
      email: 'a@example.com',
    });
    expect(applyAuditFieldAllowlist(AuditEntityType.ROLE, { name: 'Admin' })).toEqual({
      name: 'Admin',
    });
  });

  describe('registerCoreEntityAuditAllowlists (default Core registrations)', () => {
    it('registers every AuditEntityType value that exists today, none of them exposing a secret field', () => {
      registerCoreEntityAuditAllowlists();
      // `RISK` (T083/US2) is registered by `RiskModule` itself
      // (`modules/risk/domain/risk-audit-allowlist.ts`), never by
      // `registerCoreEntityAuditAllowlists` — it is a business entity type,
      // not a Core one (ADR-011: each module registers its own). Called
      // here too so this test's own invariant ("every `AuditEntityType`
      // value that exists today has SOME safe registration") still holds
      // now that a second registrant exists, matching how the real
      // application composes both `AuditModule` and `RiskModule` at
      // startup.
      registerRiskAuditAllowlists();
      // T191/US9 — same reasoning as `registerRiskAuditAllowlists()` above:
      // `ATTACHMENT`/`COMMENT` are registered by `FilesModule`/
      // `CommentsModule` themselves, not by `registerCoreEntityAuditAllowlists`.
      registerFilesAuditAllowlist();
      registerCommentsAuditAllowlist();
      // T014/002-shared-grc-foundation — same reasoning again: `EVIDENCE`/
      // `EVIDENCE_LINK`/`ACTION`/`FINDING` are registered by the GRC kernel
      // itself (`grc/shared/domain/grc-audit-allowlist.ts`), not by
      // `registerCoreEntityAuditAllowlists`.
      registerGrcAuditAllowlists();
      // T020/003-controls-management, User Story 1 — same reasoning again:
      // `CONTROL`/`CONTROL_LIFECYCLE_TRANSITION` are registered by the
      // Controls Management module itself
      // (`modules/controls/domain/control-audit-allowlist.ts`), not by
      // `registerCoreEntityAuditAllowlists`.
      registerControlAuditAllowlists();
      // T036/003-controls-management, User Story 2/3 — same reasoning
      // again: `CONTROL_ASSESSMENT`/`CONTROL_PROCESS_LINK`/
      // `CONTROL_ASSET_LINK` are registered by the Controls Management
      // module itself (`modules/controls/control-assessment-audit-allowlist.ts`),
      // not by `registerCoreEntityAuditAllowlists`.
      registerControlAssessmentAuditAllowlists();
      // 004-compliance-management, Fase 2 — same reasoning again:
      // `FRAMEWORK`/`FRAMEWORK_VERSION`/`REQUIREMENT`/
      // `REQUIREMENT_CONTROL_LINK`/`REQUIREMENT_CONTROL_MAPPING_MIGRATION`/
      // `REQUIREMENT_APPLICABILITY`/`REQUIREMENT_COMPLIANCE_STATE` are
      // registered by the Compliance module itself
      // (`modules/compliance/domain/compliance-audit-allowlist.ts`), not by
      // `registerCoreEntityAuditAllowlists`.
      registerComplianceAuditAllowlists();
      // 005-audit-findings, T019/T020 — same reasoning again:
      // `AUDIT_ENGAGEMENT`/`AUDIT_SCOPE_FRAMEWORK_VERSION`/
      // `AUDIT_SCOPE_REQUIREMENT`/`AUDIT_SCOPE_CONTROL` are registered by
      // the Audit Engagements module itself
      // (`modules/audit-engagements/domain/audit-engagement-audit-allowlist.ts`);
      // `FINDING_CONTROL_LINK`/`FINDING_RISK_LINK` are registered by
      // `registerGrcAuditAllowlists()` above (owned by `grc/finding`,
      // additive to the SAME call already made for `FINDING` itself) —
      // neither is registered by `registerCoreEntityAuditAllowlists`.
      registerAuditEngagementAuditAllowlists();
      // 006-assets-processes, T014 — same reasoning again: `ASSET`/
      // `PROCESS` are registered by the Assets/Processes modules
      // themselves (`modules/assets/domain/asset-audit-allowlist.ts`,
      // `modules/processes/domain/process-audit-allowlist.ts`), not by
      // `registerCoreEntityAuditAllowlists`.
      registerAssetAuditAllowlists();
      registerProcessAuditAllowlists();

      // 008-incidents-problems, foundation — `INCIDENT`/`PROBLEM` are
      // registered by the Incidents/Problems modules themselves
      // (`modules/incidents/domain/incident-audit-allowlist.ts`,
      // `modules/problems/domain/problem-audit-allowlist.ts`), not by
      // `registerCoreEntityAuditAllowlists`, the same shape as
      // Assets/Processes immediately above.
      registerIncidentAuditAllowlists();
      registerProblemAuditAllowlists();

      // 009-indicators-reports, Fase 2 (T011) — same reasoning again:
      // `INDICATOR`/`INDICATOR_MEASUREMENT`/`REPORT` are registered by the
      // Indicators/Reports modules themselves
      // (`modules/indicators/domain/indicator-audit-allowlist.ts`,
      // `modules/reports/domain/report-audit-allowlist.ts`), not by
      // `registerCoreEntityAuditAllowlists`, the same shape as
      // Incidents/Problems immediately above.
      registerIndicatorAuditAllowlists();
      registerReportAuditAllowlists();

      // T206a (SC-011 verification) added a throwaway `_extensibility_probe`
      // module that registered `AuditEntityType.PROBE_RECORD` for the
      // duration of that measurement, then was deleted in full — but
      // PostgreSQL has no `ALTER TYPE ... DROP VALUE`, so `PROBE_RECORD`
      // itself stays in this enum permanently (see
      // docs/deferred-findings.md). No code anywhere registers an
      // allow-list for it any more, and none ever will — nothing can create
      // a `PROBE_RECORD`-typed audit row (the table it described is
      // dropped) — so it is the one value this exhaustiveness check
      // deliberately excludes, by name, rather than silently iterating over
      // an entity type no registration will ever cover again.
      const entityTypesWithoutOrphanedProbeValue = Object.values(AuditEntityType).filter(
        (entityType) => (entityType as string) !== 'PROBE_RECORD',
      );

      for (const entityType of entityTypesWithoutOrphanedProbeValue) {
        const result = applyAuditFieldAllowlist(entityType, { passwordHash: 'x', tokenHash: 'y' });
        // passwordHash/tokenHash are never on any real allow-list, so they
        // are always dropped regardless of entity type.
        expect(result).toBeUndefined();
      }
    });
  });
});
