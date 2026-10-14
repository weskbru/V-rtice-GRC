import type { AuthenticationMethod } from '@prisma/client';

export interface LocalAuthenticationCredentials {
  readonly method: 'LOCAL';
  readonly email: string;
  readonly password: string;
}

export type AuthenticationCredentials = LocalAuthenticationCredentials;

export interface VerifiedExternalSubject {
  readonly method: AuthenticationMethod;
  readonly externalSubject: string;
  readonly profile: {
    readonly email: string;
    readonly fullName: string;
    readonly mustChangePassword?: boolean;
  };
}

export type AuthenticationFailureReason = 'INVALID_CREDENTIALS' | 'ACCOUNT_INACTIVE';

export type AuthenticationResult =
  | { readonly outcome: 'AUTHENTICATED'; readonly subject: VerifiedExternalSubject }
  | { readonly outcome: AuthenticationFailureReason };

export interface AuthenticationProvider {
  readonly method: AuthenticationMethod;
  supports(method: AuthenticationMethod): boolean;
  authenticate(credentials: AuthenticationCredentials): Promise<AuthenticationResult>;
}

export const AUTHENTICATION_PROVIDERS = Symbol('AUTHENTICATION_PROVIDERS');
