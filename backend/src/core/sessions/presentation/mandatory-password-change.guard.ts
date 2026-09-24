import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY } from '../../../shared/access/allowed-during-mandatory-password-change.decorator';
import { IS_PUBLIC_KEY } from '../../../shared/access/public.decorator';
import { PasswordChangeRequiredDomainError } from '../../../shared/errors/domain-error';

import { readPharosAuth } from './session.guard';

import type { Request } from 'express';

@Injectable()
export class MandatoryPasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = readPharosAuth(request);
    if (!session?.mustChangePassword) {
      return true;
    }

    const allowedDuringChange = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowedDuringChange === true) {
      return true;
    }

    throw new PasswordChangeRequiredDomainError();
  }
}
