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
