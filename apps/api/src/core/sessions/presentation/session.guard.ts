/**
 * T064 — `SessionGuard`, the global authentication guard (ADR-002, FR-012,
 * FR-015). Registered as `APP_GUARD` in `AppModule`, running BEFORE
 * `PermissionGuard` (see `app.module.ts`'s header for the composition and
 * ordering rationale) — it is what actually populates
 * `RequestContext.actorUserId`/`sessionId`/`authMethod`, which
 * `PermissionGuard`'s `CurrentActorPort` and every `AuditRecorder.record(...)`
 * call downstream depend on.
 *
 * ## Deny by default
 *
 *   1. `@Public()` (`shared/access/public.decorator.ts`) — the only
 *      bypass. Applied to `/auth/login` and every `/health/*` route.
 *   2. No cookie present, or `SessionService.validateSession` refuses it
 *      (not found / revoked / expired) — `UnauthorizedDomainError` (401).
 *      Deliberately the SAME generic outcome for all three reasons: FR-030
 *      applies here too (a caller must not learn whether "no session" and
 *      "revoked session" differ).
 *   3. Valid — the resolved session is attached to the request
 *      (`attachPharosAuth`, read by `@CurrentSession()`) and
 *      `RequestContextStore.enrich(...)` is called so every guard/service/
 *      audit call downstream in this request sees the actor.
 */
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../../shared/access/public.decorator';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { SessionService, type ValidatedSession } from '../application/session.service';
import { RequestContextEnricherPort } from '../domain/ports/request-context-enricher.port';
import { SESSION_SETTINGS, type SessionSettings } from '../domain/session-settings';

import type { Request } from 'express';

const PHAROS_AUTH_REQUEST_KEY = 'pharosAuth';

export interface PharosAuthRequest extends Request {
  [PHAROS_AUTH_REQUEST_KEY]?: ValidatedSession;
}

/** Reads the cookie by name without depending on any cookie-parser
 * middleware being registered globally — cookies arrive as a single raw
 * `Cookie` header the guard parses itself, exactly the amount of "cookie
 * handling" a guard needs (T064 is the guard; T063's cookie helpers cover
 * generation/hashing/attribute-building, used by `SessionService` and
 * `AuthController` respectively). */
function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

export function attachPharosAuth(request: Request, session: ValidatedSession): void {
  (request as PharosAuthRequest)[PHAROS_AUTH_REQUEST_KEY] = session;
}

export function readPharosAuth(request: Request): ValidatedSession | undefined {
  return (request as PharosAuthRequest)[PHAROS_AUTH_REQUEST_KEY];
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
    private readonly requestContextEnricher: RequestContextEnricherPort,
    @Inject(SESSION_SETTINGS) private readonly settings: SessionSettings,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawToken = readCookie(request, this.settings.cookieName);
    if (!rawToken) {
      throw new UnauthorizedDomainError();
    }

    const result = await this.sessionService.validateSession(rawToken);
    if (!result.valid) {
      throw new UnauthorizedDomainError();
    }

    attachPharosAuth(request, result.session);
    this.requestContextEnricher.enrich({
      actorUserId: result.session.userId,
      sessionId: result.session.sessionId,
      authMethod: result.session.authenticationMethod,
    });

    return true;
  }
}
