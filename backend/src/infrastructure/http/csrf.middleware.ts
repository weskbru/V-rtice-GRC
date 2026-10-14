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
