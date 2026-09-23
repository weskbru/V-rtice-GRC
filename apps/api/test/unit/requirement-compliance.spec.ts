import { describe, expect, it } from 'vitest';

import { calculateRequirementComplianceState } from '../../src/modules/compliance/domain/requirement-compliance.service';

import type { LinkedControlComplianceInput } from '../../src/modules/compliance/domain/requirement-compliance.service';

describe('calculateRequirementComplianceState (research.md D-8)', () => {
  it('NOT_APPLICABLE — an active not-applicable declaration excludes the requirement regardless of its links', () => {
    const withLinks: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'EFFECTIVE' },
    ];
    expect(calculateRequirementComplianceState('NOT_APPLICABLE', [])).toBe('NOT_APPLICABLE');
    expect(calculateRequirementComplianceState('NOT_APPLICABLE', withLinks)).toBe('NOT_APPLICABLE');
  });

  it('NOT_MET — applicable, zero linked controls (FR-018: never COMPLIANT by omission)', () => {
    expect(calculateRequirementComplianceState('APPLICABLE', [])).toBe('NOT_MET');
  });

  it('NOT_PROVEN — applicable, at least one link, none of them currently proves it', () => {
    const cases: readonly LinkedControlComplianceInput[][] = [
      [{ isActive: false, effectiveness: 'EFFECTIVE' }],
      [{ isActive: true, effectiveness: 'NOT_ASSESSED' }],
      [{ isActive: true, effectiveness: 'EXPIRED' }],
      [{ isActive: true, effectiveness: 'INEFFECTIVE' }],
      [
        { isActive: true, effectiveness: 'INEFFECTIVE' },
        { isActive: false, effectiveness: 'EFFECTIVE' },
      ],
    ];
    for (const linkedControls of cases) {
      expect(
        calculateRequirementComplianceState('APPLICABLE', linkedControls),
        JSON.stringify(linkedControls),
      ).toBe('NOT_PROVEN');
    }
  });

  it('PARTIALLY_MET — a mix of controls that prove it and controls that do not', () => {
    const oneProvesOneDoesNot: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'EFFECTIVE' },
      { isActive: true, effectiveness: 'INEFFECTIVE' },
    ];
    expect(calculateRequirementComplianceState('APPLICABLE', oneProvesOneDoesNot)).toBe(
      'PARTIALLY_MET',
    );
  });

  it('PARTIALLY_MET — a control that only partially proves it contributes to the mixed bucket, never alone becoming COMPLIANT', () => {
    const onlyPartial: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'PARTIALLY_EFFECTIVE' },
    ];
    expect(calculateRequirementComplianceState('APPLICABLE', onlyPartial)).toBe('PARTIALLY_MET');

    const partialAndFull: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'PARTIALLY_EFFECTIVE' },
      { isActive: true, effectiveness: 'EFFECTIVE' },
    ];
    expect(calculateRequirementComplianceState('APPLICABLE', partialAndFull)).toBe('PARTIALLY_MET');
  });

  it('COMPLIANT — applicable, at least one link, every linked control active and EFFECTIVE (SC-002)', () => {
    const singleEffective: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'EFFECTIVE' },
    ];
    const multipleEffective: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'EFFECTIVE' },
      { isActive: true, effectiveness: 'EFFECTIVE' },
    ];
    expect(calculateRequirementComplianceState('APPLICABLE', singleEffective)).toBe('COMPLIANT');
    expect(calculateRequirementComplianceState('APPLICABLE', multipleEffective)).toBe('COMPLIANT');
  });

  it('edge case — a retired (inactive) control linked to a still-applicable requirement never sustains compliance, but is not an error', () => {
    const retiredOnly: readonly LinkedControlComplianceInput[] = [
      { isActive: false, effectiveness: 'EFFECTIVE' },
    ];
    expect(() => calculateRequirementComplianceState('APPLICABLE', retiredOnly)).not.toThrow();
    expect(calculateRequirementComplianceState('APPLICABLE', retiredOnly)).toBe('NOT_PROVEN');
  });

  it('edge case — a not-applicable requirement with a maintained link is excluded from the calculation, but the link itself is not what is being asserted here (the reading UI keeps it visible — see spec.md edge case)', () => {
    const maintainedLink: readonly LinkedControlComplianceInput[] = [
      { isActive: true, effectiveness: 'EFFECTIVE' },
    ];
    expect(calculateRequirementComplianceState('NOT_APPLICABLE', maintainedLink)).toBe(
      'NOT_APPLICABLE',
    );
  });

  it('every RequirementComplianceState member is reachable by some combination of inputs — no sixth value waiting for an operation that never reaches it', () => {
    const reached = new Set([
      calculateRequirementComplianceState('NOT_APPLICABLE', []),
      calculateRequirementComplianceState('APPLICABLE', []),
      calculateRequirementComplianceState('APPLICABLE', [
        { isActive: true, effectiveness: 'NOT_ASSESSED' },
      ]),
      calculateRequirementComplianceState('APPLICABLE', [
        { isActive: true, effectiveness: 'EFFECTIVE' },
        { isActive: true, effectiveness: 'INEFFECTIVE' },
      ]),
      calculateRequirementComplianceState('APPLICABLE', [
        { isActive: true, effectiveness: 'EFFECTIVE' },
      ]),
    ]);
    expect(reached).toEqual(
      new Set(['NOT_APPLICABLE', 'NOT_MET', 'NOT_PROVEN', 'PARTIALLY_MET', 'COMPLIANT']),
    );
  });
});
