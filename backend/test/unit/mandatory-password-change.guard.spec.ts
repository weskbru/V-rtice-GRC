import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { MandatoryPasswordChangeGuard } from '../../src/core/sessions/presentation/mandatory-password-change.guard';
import { attachVerticeAuth } from '../../src/core/sessions/presentation/session.guard';
import { AllowedDuringMandatoryPasswordChange } from '../../src/shared/access/allowed-during-mandatory-password-change.decorator';
import { Public } from '../../src/shared/access/public.decorator';
import { PasswordChangeRequiredDomainError } from '../../src/shared/errors/domain-error';

import type { ValidatedSession } from '../../src/core/sessions/application/session.service';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

class FixtureController {
  @Public()
  publicRoute(): void {}

  @AllowedDuringMandatoryPasswordChange()
  allowedDuringChangeRoute(): void {}

  ordinaryRoute(): void {
    return;
  }
}

/* eslint-disable @typescript-eslint/unbound-method */
const publicRouteHandler = FixtureController.prototype.publicRoute;
const allowedDuringChangeRouteHandler = FixtureController.prototype.allowedDuringChangeRoute;
const ordinaryRouteHandler = FixtureController.prototype.ordinaryRoute;
/* eslint-enable @typescript-eslint/unbound-method */

function createContext(handler: () => void, session?: ValidatedSession): ExecutionContext {
  const request = {} as Request;
  if (session) {
    attachVerticeAuth(request, session);
  }
  return {
    getHandler: () => handler,
    getClass: () => FixtureController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function session(overrides: Partial<ValidatedSession> = {}): ValidatedSession {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    authenticationMethod: 'LOCAL',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3_600_000),
    lastActivityAt: new Date(),
    ipAddress: undefined,
    userAgent: undefined,
    mustChangePassword: false,
    ...overrides,
  };
}

describe('MandatoryPasswordChangeGuard (S-01, A6-F01)', () => {
  const guard = new MandatoryPasswordChangeGuard(new Reflector());

  it('allows a @Public() route regardless of session state', () => {
    const context = createContext(publicRouteHandler, session({ mustChangePassword: true }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when no session is attached (nothing for this guard to enforce)', () => {
    const context = createContext(ordinaryRouteHandler);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a normal caller whose mustChangePassword is false', () => {
    const context = createContext(ordinaryRouteHandler, session({ mustChangePassword: false }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a pending-change caller on a route carrying @AllowedDuringMandatoryPasswordChange()', () => {
    const context = createContext(
      allowedDuringChangeRouteHandler,
      session({ mustChangePassword: true }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('refuses a pending-change caller on every other route with PasswordChangeRequiredDomainError', () => {
    const context = createContext(ordinaryRouteHandler, session({ mustChangePassword: true }));
    expect(() => guard.canActivate(context)).toThrow(PasswordChangeRequiredDomainError);
  });
});
