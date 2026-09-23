import { describe, expect, it } from 'vitest';

import { validatePassword } from '../../src/core/identity/domain/password-policy';

describe('validatePassword (T054, FR-006)', () => {
  const settings = { minLength: 12, requireComplexity: true };

  it('accepts a password meeting both length and complexity', () => {
    expect(validatePassword('Str0ng-Passw0rd!', settings)).toHaveLength(0);
  });

  it('rejects a password shorter than the configured minimum', () => {
    const violations = validatePassword('Sh0rt!', settings);
    expect(violations.map((v) => v.code)).toContain('TOO_SHORT');
  });

  it('accepts a password exactly at the minimum length', () => {
    const exact = 'Abcdefg1!xyz';
    expect(exact).toHaveLength(12);
    expect(validatePassword(exact, settings)).toHaveLength(0);
  });

  it('rejects a long password with only one character class when complexity is required', () => {
    const violations = validatePassword('aaaaaaaaaaaaaaaa', settings);
    expect(violations.map((v) => v.code)).toContain('MISSING_COMPLEXITY');
  });

  it('accepts a long single-class password when complexity is NOT required', () => {
    const relaxed = { minLength: 12, requireComplexity: false };
    expect(validatePassword('aaaaaaaaaaaaaaaa', relaxed)).toHaveLength(0);
  });

  it('accepts a password with exactly three of the four character classes', () => {
    expect(validatePassword('Abcdefgh1234', settings)).toHaveLength(0);
  });

  it('rejects a password with only two character classes', () => {
    const violations = validatePassword('abcdefgh1234', settings);
    expect(violations.map((v) => v.code)).toContain('MISSING_COMPLEXITY');
  });

  it('can report BOTH violations at once for a short, low-complexity password', () => {
    const violations = validatePassword('short', settings);
    expect(violations.map((v) => v.code).sort()).toEqual(['MISSING_COMPLEXITY', 'TOO_SHORT']);
  });

  it('never throws for an empty string', () => {
    expect(() => validatePassword('', settings)).not.toThrow();
    expect(validatePassword('', settings).length).toBeGreaterThan(0);
  });

  it('respects a stricter configured minimum length', () => {
    const strict = { minLength: 20, requireComplexity: false };
    expect(validatePassword('Abcdefghijklmnopqr1!', strict)).toHaveLength(0);
    expect(validatePassword('Abcdefghijklmnopq1!', strict).map((v) => v.code)).toContain(
      'TOO_SHORT',
    );
  });
});
