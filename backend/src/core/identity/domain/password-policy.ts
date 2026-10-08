import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export interface PasswordPolicySettings {
  readonly minLength: number;
  readonly requireComplexity: boolean;
}

export interface PasswordPolicyViolation {
  readonly code: 'TOO_SHORT' | 'MISSING_COMPLEXITY';
  readonly message: string;
}

const COMPLEXITY_CLASSES: readonly RegExp[] = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];
const MIN_COMPLEXITY_CLASSES_PRESENT = 3;

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
