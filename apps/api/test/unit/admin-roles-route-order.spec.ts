/**
 * 2026-09-13 (015-roles-permissions-surface, T014) — a structural guard on
 * `AdminRolesController`'s handler DECLARATION ORDER, and on the permission
 * every one of its handlers declares.
 *
 * ## The defect this exists to catch
 *
 * Nest registers a controller's routes in the order its handlers are
 * declared on the class, and matches an incoming request against the first
 * registered pattern that fits. `GET /admin/roles/summary` and
 * `GET /admin/roles/:roleId` both fit `/admin/roles/summary`. Declared in
 * the wrong order, the literal route becomes unreachable: the request is
 * routed to `findById`, `ParseUUIDPipe` rejects the string `summary`, and
 * the caller gets a `400` that names a UUID problem on an endpoint that has
 * no UUID in it. Nothing about the use case, the repository, the DTO or the
 * contract would be wrong — and no test that only calls the use case would
 * notice.
 *
 * The contract suite catches it too (a `400` where a `200` was expected),
 * but only while a database is reachable. This check is pure reflection
 * over the class: it runs in the unit suite, in milliseconds, and names the
 * actual cause instead of a status code.
 *
 * ## Why reading the prototype is a faithful proxy for route order
 *
 * `Object.getOwnPropertyNames(Klass.prototype)` yields methods in source
 * declaration order, which is the same order Nest's own `MetadataScanner`
 * walks when `RouterExplorer` registers them. A test asserting against the
 * scanner itself would need the whole Nest application bootstrapped (and a
 * database); this asserts the property that order derives from.
 *
 * ## Non-vacuity
 *
 * Move `summary()` below `findById()` in the controller and the first test
 * fails, naming both handlers. Delete the `@RequirePermission` from any
 * handler and the second fails — that one matters because `PermissionGuard`
 * is deny-by-default (`permission.guard.ts`, point 4): an undecorated
 * handler is refused with `403` rather than left open, so the failure mode
 * is a silently dead endpoint, not an exposed one.
 */
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

    // Sanity: this assertion is worthless if reflection found nothing.
    expect(handlers.length).toBeGreaterThanOrEqual(6);
    for (const handler of handlers) {
      expect(handler.requiredPermission, `handler "${handler.name}" declares no permission`).toBe(
        'role:administer',
      );
    }
  });
});
