import {
  Injectable,
  Optional,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, Public } from '../../../shared/access/public.decorator';
import { ForbiddenDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { PermissionResolverService } from '../application/permission-resolver.service';
import { CurrentActorPort } from '../domain/ports/current-actor.port';
import { PermissionDenialRecorderPort } from '../domain/ports/permission-denial-recorder.port';

import type { PermissionIdentifier } from '../domain/permissions';

export const REQUIRE_PERMISSION_KEY = 'pharos:requirePermission';
export const NO_PERMISSION_REQUIRED_KEY = 'pharos:noPermissionRequired';
export { IS_PUBLIC_KEY, Public };

export const RequirePermission = (
  identifier: PermissionIdentifier,
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_PERMISSION_KEY, identifier);

export const NoPermissionRequired = (): MethodDecorator & ClassDecorator =>
  SetMetadata(NO_PERMISSION_REQUIRED_KEY, true);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
    private readonly currentActor: CurrentActorPort,
    @Optional() private readonly denialRecorder?: PermissionDenialRecorderPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const requiredPermission = this.reflector.getAllAndOverride<PermissionIdentifier | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermission === undefined) {
      const noPermissionRequired = this.reflector.getAllAndOverride<boolean | undefined>(
        NO_PERMISSION_REQUIRED_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (noPermissionRequired !== true) {
        await this.deny({
          actorUserId: this.currentActor.getCurrentActorUserId(),
          requiredPermission: undefined,
          reason: 'MISSING_PERMISSION_DECLARATION',
        });
        throw new ForbiddenDomainError();
      }

      if (this.currentActor.getCurrentActorUserId() === undefined) {
        await this.deny({
          actorUserId: undefined,
          requiredPermission: undefined,
          reason: 'NO_ACTOR',
        });
        throw new UnauthorizedDomainError();
      }
      return true;
    }

    const actorUserId = this.currentActor.getCurrentActorUserId();
    if (actorUserId === undefined) {
      await this.deny({
        actorUserId: undefined,
        requiredPermission,
        reason: 'NO_ACTOR',
      });
      throw new UnauthorizedDomainError();
    }

    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      await this.deny({
        actorUserId,
        requiredPermission,
        reason: 'PERMISSION_DENIED',
      });
      throw new ForbiddenDomainError();
    }

    return true;
  }

  private async deny(context: {
    actorUserId: string | undefined;
    requiredPermission: PermissionIdentifier | undefined;
    reason: 'MISSING_PERMISSION_DECLARATION' | 'NO_ACTOR' | 'PERMISSION_DENIED';
  }): Promise<void> {
    if (!this.denialRecorder) {
      return;
    }
    await this.denialRecorder.recordDenied(context);
  }
}
