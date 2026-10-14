import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { PermissionResolverService } from '../../src/core/authorization/application/permission-resolver.service';
import { CurrentActorPort } from '../../src/core/authorization/domain/ports/current-actor.port';
import {
  PermissionDenialRecorderPort,
  type PermissionDenialContext,
} from '../../src/core/authorization/domain/ports/permission-denial-recorder.port';
import {
  NoPermissionRequired,
  Public,
  RequirePermission,
  PermissionGuard,
} from '../../src/core/authorization/presentation/permission.guard';
import {
  ForbiddenDomainError,
  UnauthorizedDomainError,
} from '../../src/shared/errors/domain-error';

import type { ExecutionContext } from '@nestjs/common';

class FixtureController {
  @RequirePermission('risk:edit')
  requiresEdit(): void {}

  @Public()
  publicRoute(): void {}

  @NoPermissionRequired()
  authenticatedOnlyRoute(): void {}

  noDecorator(): void {
    return;
  }
}

function createContext(handler: () => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => FixtureController,
  } as unknown as ExecutionContext;
}

/* eslint-disable @typescript-eslint/unbound-method */
const requiresEditHandler = FixtureController.prototype.requiresEdit;
const publicRouteHandler = FixtureController.prototype.publicRoute;
const authenticatedOnlyRouteHandler = FixtureController.prototype.authenticatedOnlyRoute;
const noDecoratorHandler = FixtureController.prototype.noDecorator;
/* eslint-enable @typescript-eslint/unbound-method */

class FakeCurrentActor extends CurrentActorPort {
  userId: string | undefined;

  getCurrentActorUserId(): string | undefined {
    return this.userId;
  }
}

class FakeDenialRecorder extends PermissionDenialRecorderPort {
  denials: PermissionDenialContext[] = [];

  recordDenied(context: PermissionDenialContext): Promise<void> {
    this.denials.push(context);
    return Promise.resolve();
  }
}

function fakeResolver(allowedPermissions: readonly string[]): PermissionResolverService {
  return {
    hasPermission: (_userId: string, permission: string) =>
      Promise.resolve(allowedPermissions.includes(permission)),
  } as unknown as PermissionResolverService;
}

describe('PermissionGuard', () => {
  it('allows a request through when the actor holds the required permission', async () => {
    const actor = new FakeCurrentActor();
    actor.userId = 'user-1';
    const guard = new PermissionGuard(new Reflector(), fakeResolver(['risk:edit']), actor);

    await expect(guard.canActivate(createContext(requiresEditHandler))).resolves.toBe(true);
  });

  it('denies with ForbiddenDomainError, not a message naming the resource, when the actor lacks the permission', async () => {
    const actor = new FakeCurrentActor();
    actor.userId = 'user-1';
    const guard = new PermissionGuard(new Reflector(), fakeResolver([]), actor);

    const promise = guard.canActivate(createContext(requiresEditHandler));
    await expect(promise).rejects.toBeInstanceOf(ForbiddenDomainError);
    await promise.catch((error: ForbiddenDomainError) => {
      expect(error.message).toBe('Você não tem permissão para executar esta ação.');
    });
  });

  it('denies with UnauthorizedDomainError when there is no resolved actor at all', async () => {
    const actor = new FakeCurrentActor();
    const guard = new PermissionGuard(new Reflector(), fakeResolver(['risk:edit']), actor);

    await expect(guard.canActivate(createContext(requiresEditHandler))).rejects.toBeInstanceOf(
      UnauthorizedDomainError,
    );
  });

  it('allows a @Public() route through with no actor and no permission check at all', async () => {
    const actor = new FakeCurrentActor();
    const guard = new PermissionGuard(new Reflector(), fakeResolver([]), actor);

    await expect(guard.canActivate(createContext(publicRouteHandler))).resolves.toBe(true);
  });

  it('allows an authenticated actor through @NoPermissionRequired() with no permission check at all (T067)', async () => {
    const actor = new FakeCurrentActor();
    actor.userId = 'user-1';
    const guard = new PermissionGuard(new Reflector(), fakeResolver([]), actor);

    await expect(guard.canActivate(createContext(authenticatedOnlyRouteHandler))).resolves.toBe(
      true,
    );
  });

  it('still fails closed with UnauthorizedDomainError for @NoPermissionRequired() with no resolved actor', async () => {
    const actor = new FakeCurrentActor();
    const guard = new PermissionGuard(new Reflector(), fakeResolver([]), actor);

    await expect(
      guard.canActivate(createContext(authenticatedOnlyRouteHandler)),
    ).rejects.toBeInstanceOf(UnauthorizedDomainError);
  });

  it('FAILS CLOSED for a handler with no @RequirePermission and no @Public() — never a default that grants', async () => {
    const actor = new FakeCurrentActor();
    actor.userId = 'user-1';
    const guard = new PermissionGuard(new Reflector(), fakeResolver(['*']), actor);

    await expect(guard.canActivate(createContext(noDecoratorHandler))).rejects.toBeInstanceOf(
      ForbiddenDomainError,
    );
  });

  it('calls the optional denial recorder with the reason on each deny path, and never on allow', async () => {
    const actor = new FakeCurrentActor();
    actor.userId = 'user-1';
    const recorder = new FakeDenialRecorder();
    const guard = new PermissionGuard(new Reflector(), fakeResolver([]), actor, recorder);

    await guard.canActivate(createContext(requiresEditHandler)).catch(() => undefined);

    expect(recorder.denials).toHaveLength(1);
    expect(recorder.denials[0]).toMatchObject({
      actorUserId: 'user-1',
      requiredPermission: 'risk:edit',
      reason: 'PERMISSION_DENIED',
    });
  });

  it('works with no denial recorder bound at all (the T040a seam is optional)', async () => {
    const actor = new FakeCurrentActor();
    actor.userId = 'user-1';
    const guard = new PermissionGuard(new Reflector(), fakeResolver([]), actor, undefined);

    await expect(guard.canActivate(createContext(requiresEditHandler))).rejects.toBeInstanceOf(
      ForbiddenDomainError,
    );
  });
});
