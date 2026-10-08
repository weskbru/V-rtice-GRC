import { afterEach, describe, expect, it } from 'vitest';

import {
  __resetEvidenceSubjectRegistryForTests,
  EvidenceSubjectTypeNotRegisteredError,
  getEvidenceSubjectAccessor,
  registerEvidenceSubjectResolver,
} from '../../src/grc/shared/domain/ports/evidence-subject-resolver.port';

import type { EvidenceSubjectAccessor } from '../../src/grc/shared/domain/ports/evidence-subject-resolver.port';

const NOOP_ACCESSOR: EvidenceSubjectAccessor = {
  resolveViewableSubject: () => Promise.resolve({ organizationalUnitId: 'org-1', label: 'x' }),
};

describe('evidence-subject-resolver registry', () => {
  afterEach(() => {
    __resetEvidenceSubjectRegistryForTests();
  });

  it('throws EvidenceSubjectTypeNotRegisteredError for an unregistered subject type', () => {
    expect(() => getEvidenceSubjectAccessor('RISK')).toThrow(EvidenceSubjectTypeNotRegisteredError);
  });

  it('returns the registered accessor for a subject type', () => {
    registerEvidenceSubjectResolver('RISK', NOOP_ACCESSOR);
    expect(getEvidenceSubjectAccessor('RISK')).toBe(NOOP_ACCESSOR);
  });

  it('registering the same subject type twice throws — two accessors disagreeing is a bug', () => {
    registerEvidenceSubjectResolver('RISK', NOOP_ACCESSOR);
    expect(() => registerEvidenceSubjectResolver('RISK', NOOP_ACCESSOR)).toThrow();
  });

  it('each subject type has its own independent registration', () => {
    registerEvidenceSubjectResolver('RISK', NOOP_ACCESSOR);
    expect(() => getEvidenceSubjectAccessor('RISK_TREATMENT_DECISION')).toThrow(
      EvidenceSubjectTypeNotRegisteredError,
    );
  });

  it('__resetEvidenceSubjectRegistryForTests clears every registration', () => {
    registerEvidenceSubjectResolver('RISK', NOOP_ACCESSOR);
    __resetEvidenceSubjectRegistryForTests();
    expect(() => getEvidenceSubjectAccessor('RISK')).toThrow(EvidenceSubjectTypeNotRegisteredError);
  });
});
