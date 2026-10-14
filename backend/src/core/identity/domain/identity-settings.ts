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
