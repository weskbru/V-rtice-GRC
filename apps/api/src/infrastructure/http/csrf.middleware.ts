/**
 * T065 — `CsrfMiddleware` (ADR-002, FR-019). Session authentication rides
 * on a cookie (`SameSite=Lax` alone does not stop every cross-site
 * scenario, e.g. a top-level GET navigation or certain non-`<form>` POSTs
 * in older/misconfigured browsers), so ADR-002 additionally requires every
 * state-changing request's `Origin` (falling back to `Referer`) to match
 * `APP_ORIGIN`, refusing a mismatch with `403`.
 *
 * "State-changing" = anything other than `GET`/`HEAD`/`OPTIONS` — this is
 * evaluated by HTTP method alone, never by route, so it applies uniformly
 * including to `@Public()` routes.
 *
 * ## Deliberate, reported deviation from `auth.openapi.yaml`
 *
 * `POST /auth/login`'s documented responses are `200, 400, 401, 429` — no
 * `403`. ADR-002's own text is unconditional ("every state-changing
 * request"), with no login exception, and a forged cross-site login
 * request (login CSRF: silently signing a victim into an attacker's
 * account) is a real, known attack this check also happens to close. This
 * middleware therefore also rejects a cross-origin `POST /auth/login` with
 * `403`, which `auth.openapi.yaml` does not enumerate for that path. This
 * is flagged loudly in the implementation report per this task's working
 * rules — it is an ADDITIVE possible response, not a change to any
 * documented one, so it should not break a frontend client that only
 * submits same-origin requests (the standard case per ADR-014's
 * single-origin proxy), but a caller intentionally testing the contract
 * literally should be aware `403` can occur here.
 *
 * A request with NEITHER `Origin` nor `Referer` is refused, not allowed
 * through — fail closed (working rule #2). Legitimate same-origin browser
 * requests always send at least one of the two.
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';

import { ForbiddenDomainError } from '../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../shared/messages/user-messages';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger } from '../logging/app-logger.service';

import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly logger: AppLogger,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const candidateOrigin = originOf(req.get('origin')) ?? originOf(req.get('referer'));
    const expectedOrigin = originOf(this.appConfig.app.appOrigin);

    if (!candidateOrigin || candidateOrigin !== expectedOrigin) {
      this.logger.security('Rejected a state-changing request with a missing/mismatched Origin.', {
        method: req.method,
        path: req.path,
      });
      throw new ForbiddenDomainError(USER_MESSAGES.auth.crossOriginRejected);
    }

    next();
  }
}
