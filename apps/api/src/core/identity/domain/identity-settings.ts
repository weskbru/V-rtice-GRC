/**
 * DI tokens + settings shapes for the identity capability (T059, T060,
 * T066). Duplicated from `AppConfigService`'s shapes rather than importing
 * them — `core-domain` may not import top-level `infrastructure` under
 * ADR-011; `identity.module.ts` is the only place that reads the real
 * `AppConfigService` and provides these tokens.
 */
import type { PasswordPolicySettings } from './password-policy';

export interface Argon2Settings {
  readonly memoryCost: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

export interface AuthThrottleSettings {
  readonly accountAttempts: number;
  readonly originAttempts: number;
  readonly windowSeconds: number;
  readonly lockoutMinutes: number;
}

export const ARGON2_SETTINGS = Symbol('ARGON2_SETTINGS');
export const AUTH_THROTTLE_SETTINGS = Symbol('AUTH_THROTTLE_SETTINGS');
export const PASSWORD_POLICY_SETTINGS = Symbol('PASSWORD_POLICY_SETTINGS');

export type { PasswordPolicySettings };
