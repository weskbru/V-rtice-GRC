/**
 * T058 — `AuthenticationProvider` port (ADR-001, FR-001 to FR-004).
 *
 * ## How a future LDAP/AD/OIDC/SAML adapter plugs in without touching any
 * business module (FR-004)
 *
 * Every provider does exactly one thing: given provider-specific
 * credentials, verify them and hand back a `VerifiedExternalSubject` — a
 * stable external identifier plus optional profile attributes. It NEVER
 * returns a session and NEVER returns an internal `User`. A future adapter
 * (`core/identity/infrastructure/providers/ldap/ldap-authentication.provider.ts`,
 * say) needs only to:
 *
 *   1. Implement this same `AuthenticationProvider` interface, with
 *      `method` set to its own `AuthenticationMethod` value and `supports`
 *      matching only that value.
 *   2. Be registered on the `AUTHENTICATION_PROVIDERS` multi-provider token
 *      in `identity.module.ts` (or its own module, imported from there) —
 *      one line, no edit to any existing provider.
 *   3. Add a corresponding branch case in `IdentityResolverService`
 *      ONLY IF that method needs different resolution semantics than the
 *      existing `ExternalIdentity`-lookup default (LOCAL is the one
 *      exception, resolved by construction — see that file's header).
 *
 * `AuthOrchestrator` (`core/identity/infrastructure/auth-orchestrator.ts`,
 * the only caller) selects a provider by `credentials.method` via
 * `supports(...)` and is otherwise completely unaware of how any given
 * method verifies anything — it never branches on `LOCAL` vs `LDAP` vs
 * `OIDC` itself. No business module (Risk Management, ...) ever sees an
 * `AuthenticationProvider`, a provider-specific credential shape, or an
 * `AuthenticationMethod` at all beyond the `User.id` it is handed by
 * `IdentityResolverService` — this is the FR-004 guarantee made concrete:
 * adding SAML is adding a provider + a registration line, never touching
 * Risk Management's rules, data, or behavior.
 */
import type { AuthenticationMethod } from '@prisma/client';

/**
 * Local username/password credentials (T059, the only operational method
 * in this release). A future provider adds its own credential shape as a
 * sibling of this interface and includes it in the `AuthenticationCredentials`
 * union below — a compile-time extension point, not a runtime registry,
 * because the *shape* of credentials a provider accepts is fixed at build
 * time (unlike permission identifiers, which a future module genuinely adds
 * new instances of at runtime — see `permissions.ts`'s two-seam design for
 * why that case is different).
 */
export interface LocalAuthenticationCredentials {
  readonly method: 'LOCAL';
  readonly email: string;
  readonly password: string;
}

/** Every credential shape a registered `AuthenticationProvider` may accept.
 * A future provider adds its own member here (e.g. `| OidcAuthenticationCredentials`)
 * — the only edit this file's union requires when a new provider is added,
 * and it is additive, never a change to an existing member. */
export type AuthenticationCredentials = LocalAuthenticationCredentials;

/**
 * What a provider hands back on success: a stable external identifier
 * (`externalSubject`) plus optional profile attributes it happened to
 * observe while verifying — never a session, never an internal `User`.
 * For `LOCAL`, `externalSubject` IS the internal `User.id` (local
 * authentication has no separate external system to be a subject of — see
 * `IdentityResolverService`'s header for what this means for resolution).
 */
export interface VerifiedExternalSubject {
  readonly method: AuthenticationMethod;
  readonly externalSubject: string;
  readonly profile: {
    readonly email: string;
    readonly fullName: string;
    /** LOCAL-specific hint, carried here because `LocalAuthenticationProvider`
     * already has it loaded and no other layer needs to look it up again
     * (data-model.md §14: "seeded administrator account whose password must
     * be changed on first sign-in"). `undefined` for any provider that has
     * no equivalent concept. */
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

/** Multi-provider DI token `identity.module.ts` registers every
 * `AuthenticationProvider` adapter under (`useValue`/`useFactory` with
 * `multi: true` is not a Nest concept — this codebase instead provides an
 * array value directly; see that module for how a future adapter is added
 * to it). */
export const AUTHENTICATION_PROVIDERS = Symbol('AUTHENTICATION_PROVIDERS');
