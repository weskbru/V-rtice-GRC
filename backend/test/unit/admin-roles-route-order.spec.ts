import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { AdminRolesController } from '../../src/core/authorization/presentation/admin-roles.controller';
import { REQUIRE_PERMISSION_KEY } from '../../src/core/authorization/presentation/permission.guard';

interface DeclaredHandler {
  readonly name: string;
  readonly index: number;
  readonly path: string;
  readonly method: RequestMethod;
  readonly requiredPermission: unknown;
}

function declaredHandlers(): readonly DeclaredHandler[] {
  const prototype = AdminRolesController.prototype as unknown as Record<string, unknown>;
  const handlers: DeclaredHandler[] = [];

  Object.getOwnPropertyNames(prototype).forEach((name, index) => {
    if (name === 'constructor') {
      return;
    }
    const handler = prototype[name];
    if (typeof handler !== 'function') {
      return;
    }
    const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
    if (path === undefined) {
      return;
    }
    handlers.push({
      name,
      index,
      path,
      method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
      requiredPermission: Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler),
    });
  });

  return handlers;
}

describe('AdminRolesController route declaration order (015, T014)', () => {
  it('declares GET /admin/roles/summary before the GET :roleId handler that would otherwise swallow it', () => {
    const handlers = declaredHandlers();

    const summary = handlers.find(
      (handler) => handler.path === 'summary' && handler.method === RequestMethod.GET,
    );
    const byId = handlers.find(
      (handler) => handler.path === ':roleId' && handler.method === RequestMethod.GET,
    );

    expect(summary, 'no GET handler declaring the literal path "summary"').toBeDefined();
    expect(byId, 'no GET handler declaring the parameterized path ":roleId"').toBeDefined();
    expect(
      summary!.index,
      `"${summary!.name}" (GET summary) must be declared before "${byId!.name}" (GET :roleId), ` +
        'or Nest routes /admin/roles/summary into the UUID-parsing handler and the endpoint ' +
        'answers 400 forever',
    ).toBeLessThan(byId!.index);
  });

  it('gates every handler on the controller with role:administer — none relies on the guard defaulting open, because it does not', () => {
    const handlers = declaredHandlers();

    expect(handlers.length).toBeGreaterThanOrEqual(6);
    for (const handler of handlers) {
      expect(handler.requiredPermission, `handler "${handler.name}" declares no permission`).toBe(
        'role:administer',
      );
    }
  });
});
