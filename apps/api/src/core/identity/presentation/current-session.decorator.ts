/**
 * `@CurrentSession()` — reads the `ValidatedSession` `SessionGuard` already
 * attached to the request (`core/sessions/presentation/session.guard.ts`).
 * `AuthController` never re-validates the cookie itself; by the time a
 * handler runs, `SessionGuard` has already refused anything invalid (or the
 * handler is `@Public()`, in which case this decorator must not be used).
 */
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { readPharosAuth } from '../../sessions/presentation/session.guard';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request } from 'express';

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ValidatedSession => {
    const request = context.switchToHttp().getRequest<Request>();
    const session = readPharosAuth(request);
    if (!session) {
      // Programming error (handler used outside SessionGuard's protection) —
      // never a case a real client request can trigger, since SessionGuard
      // throws before any handler using this decorator would run.
      throw new Error('@CurrentSession() used on a route not protected by SessionGuard.');
    }
    return session;
  },
);
