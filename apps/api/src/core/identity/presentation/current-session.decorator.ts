import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { readPharosAuth } from '../../sessions/presentation/session.guard';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request } from 'express';

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ValidatedSession => {
    const request = context.switchToHttp().getRequest<Request>();
    const session = readPharosAuth(request);
    if (!session) {
      throw new Error('@CurrentSession() used on a route not protected by SessionGuard.');
    }
    return session;
  },
);
