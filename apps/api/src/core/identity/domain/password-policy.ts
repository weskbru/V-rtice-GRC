/**
 * T060 — password policy domain service (FR-006). Pure: no I/O, no
 * framework dependency, no DI decorator — a plain function callable from
 * any layer that already has a candidate password and the configured
 * settings in hand (`LocalAuthenticationProvider`'s seed-time hashing has
 * nothing to validate; the two real callers are `AuthOrchestrator`'s
 * `changeOwnPassword` flow and this file's own unit test, T054).
 *
 * `PasswordPolicySettings` duplicates the shape of
 * `AppConfigService.passwordPolicy` deliberately — `core-domain` may not
 * import `AppConfigService` (top-level `infrastructure`) under ADR-011;
 * `identity.module.ts` is the only place that reads the real config and
 * hands this shape to whoever needs it.
 */
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export interface PasswordPolicySettings {
  readonly minLength: number;
  readonly requireComplexity: boolean;
}

export interface PasswordPolicyViolation {
  readonly code: 'TOO_SHORT' | 'MISSING_COMPLEXITY';
  readonly message: string;
}

const COMPLEXITY_CLASSES: readonly RegExp[] = [
  /[a-z]/, // lowercase
  /[A-Z]/, // uppercase
  /[0-9]/, // digit
  /[^a-zA-Z0-9]/, // symbol
];
const MIN_COMPLEXITY_CLASSES_PRESENT = 3;

/**
 * Returns every violation of `settings` that `password` commits (empty when
 * compliant — never throws). Length is checked unconditionally; complexity
 * (at least `MIN_COMPLEXITY_CLASSES_PRESENT` of the four character classes
 * above present) only when `settings.requireComplexity` is true.
 */
export function validatePassword(
  password: string,
  settings: PasswordPolicySettings,
): readonly PasswordPolicyViolation[] {
  const violations: PasswordPolicyViolation[] = [];

  if (password.length < settings.minLength) {
    violations.push({
      code: 'TOO_SHORT',
      message: USER_MESSAGES.passwordPolicy.tooShort(settings.minLength),
    });
  }

  if (settings.requireComplexity) {
    const classesPresent = COMPLEXITY_CLASSES.filter((pattern) => pattern.test(password)).length;
    if (classesPresent < MIN_COMPLEXITY_CLASSES_PRESENT) {
      violations.push({
        code: 'MISSING_COMPLEXITY',
        message: USER_MESSAGES.passwordPolicy.missingComplexity,
      });
    }
  }

  return violations;
}
