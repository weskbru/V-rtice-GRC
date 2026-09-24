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
      registerRiskAuditAllowlists();
      registerFilesAuditAllowlist();
      registerCommentsAuditAllowlist();
      registerGrcAuditAllowlists();
      registerControlAuditAllowlists();
      registerControlAssessmentAuditAllowlists();
      registerComplianceAuditAllowlists();
      registerAuditEngagementAuditAllowlists();
      registerAssetAuditAllowlists();
      registerProcessAuditAllowlists();

      registerIncidentAuditAllowlists();
      registerProblemAuditAllowlists();

      registerIndicatorAuditAllowlists();
      registerReportAuditAllowlists();

      const entityTypesWithoutOrphanedProbeValue = Object.values(AuditEntityType).filter(
        (entityType) => (entityType as string) !== 'PROBE_RECORD',
      );

      for (const entityType of entityTypesWithoutOrphanedProbeValue) {
        const result = applyAuditFieldAllowlist(entityType, { passwordHash: 'x', tokenHash: 'y' });
        expect(result).toBeUndefined();
      }
    });
  });
});
