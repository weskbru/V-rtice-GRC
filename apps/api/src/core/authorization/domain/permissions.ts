/**
 * T034 — the permission identifier registry (ADR-003, FR-021, FR-022,
 * data-model.md §3). Pure domain data — no I/O, no framework import other
 * than the generated `PermissionAction` enum type (a data shape, not a
 * runtime dependency on Prisma's client — the same acceptable use already
 * established by `core/audit/application/audit-recorder.service.ts`
 * importing `AuditOutcome` from `@prisma/client`).
 *
 * ## Two extension points, working together (SC-011, FR-038, ADR-011)
 *
 * A future module must be able to add its own permissions ("a new module
 * seeds its own permission rows" — ADR-003) WITHOUT editing this file. Two
 * mechanisms, one compile-time and one a static aggregation, are required
 * together because they solve different problems:
 *
 * 1. **Compile-time — TypeScript declaration merging on `PermissionRegistry`.**
 *    `PermissionIdentifier` is `keyof PermissionRegistry`, and interfaces in
 *    TypeScript merge across files: a future module adds its own file
 *    (anywhere in its own tree, never here) containing:
 *
 *    ```ts
 *    declare module '../../../core/authorization/domain/permissions' {
 *      interface PermissionRegistry {
 *        'problem:view': true;
 *        'problem:create': true;
 *      }
 *    }
 *    ```
 *
 *    (the relative-path module specifier resolved from the augmenting
 *    file's own location — there is no `paths` alias configured in
 *    `tsconfig.json` for this package, so the specifier must resolve, by
 *    ordinary relative-import rules, to this exact file; TypeScript merges
 *    by resolved file identity, not by the literal specifier text). This is
 *    the exact mechanism Express/`i18next`/etc. use to let a plugin extend a
 *    library's ambient types — it requires no edit to this file, and the
 *    moment that declaration is compiled anywhere in the program (every
 *    file under `src/**` is part of the program per `tsconfig.json`'s
 *    `include`, so this holds regardless of whether anything imports the
 *    augmenting file), `PermissionIdentifier` includes the new keys
 *    everywhere, so `@RequirePermission('problem:view')` type-checks and
 *    `@RequirePermission('problme:view')` (typo) fails `tsc` — the ADR-003
 *    trade-off ("mitigated by generating a TypeScript union ... so a typo
 *    in a decorator fails type-check") this registry exists to satisfy.
 *    `modules/risk/domain/risk-permissions.ts` is the worked example.
 *
 * 2. **Static aggregation — `combinePermissionDefinitions`.** The type-level
 *    merge above only proves a string is a *valid identifier shape*; it
 *    does not, by itself, put a future module's `{ identifier, resource,
 *    action, description }` rows anywhere a seed script can enumerate them.
 *
 *    A prior design of this mechanism had a future module's own composition
 *    root call a mutable, module-level `registerPermissionDefinitions(...)`
 *    once at Nest bootstrap. That cannot work for this platform:
 *    `apps/api/prisma/seed/platform.seed.ts` — which upserts every
 *    permission and validates every role's permission set — runs as a
 *    **standalone script** that boots only a minimal `AppConfigModule`/
 *    `PrismaModule` application context (`prisma/seed/index.ts`), never
 *    `RiskModule` or any future module's own `*.module.ts`. A permission
 *    registered only as a side effect of a Nest module constructor would
 *    never be seen by that script, and seeding a role holding one of its
 *    permissions would fail. The same hazard showed up independently in
 *    `test/integration/support/authorization-fixtures.ts`, which used to
 *    snapshot the permission set into a module-level constant evaluated at
 *    test-collection time, before any module's constructor had run.
 *
 *    The fix used here: each module owns a **static** array of its own
 *    `PermissionDefinition` rows (this file's `CORE_PERMISSION_DEFINITIONS`
 *    is core's; `modules/risk/domain/risk-permissions.ts`'s
 *    `RISK_PERMISSION_DEFINITIONS` is Risk Management's), and
 *    `combinePermissionDefinitions` below — a pure, synchronous function,
 *    no mutable state — merges any number of such sets, throwing on a
 *    duplicate identifier. `src/permission-catalogue.ts`, the single
 *    aggregator, calls it once with core's set plus every module's,
 *    computed at import time. Both the Nest application (transitively, via
 *    `RiskModule`'s own imports) and the standalone seed script import that
 *    one aggregator and see the identical, complete set — no import-order
 *    hazard, no Nest bootstrap requirement for the seed script.
 *
 *    This file cannot itself be that aggregator: ADR-011 forbids `core/**`
 *    from importing `modules/**`, and the aggregator necessarily imports
 *    every module's own permission-definitions file.
 *
 * Both seams are exercised by any future module the same way Risk
 * Management does today; there is nothing "core" needs to do differently
 * for module #2 than for module #1.
 *
 * ## The deliberate absence of `risk:delete`
 *
 * data-model.md §3 and ADR-003 both specify this explicitly: FR-102
 * forbids ever hard-deleting a risk (removal is represented as archival,
 * gated by `risk:administer`), so a `risk:delete` permission would govern
 * an operation that does not exist — an administrator reading the role
 * editor would see a capability the platform never actually grants.
 * `PermissionAction.DELETE` remains meaningful in the enum: it is genuinely
 * exercised by `attachment:delete` and `comment:delete` below. This is
 * recorded here, in core, rather than moving with `risk:*` to the risk
 * module, because it explains a core enum value's continued use, not a
 * risk-specific decision.
 */
import type { PermissionAction } from '@prisma/client';

export interface PermissionDefinition {
  readonly identifier: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly description: string;
}

/**
 * The compile-time extension point (see file header, mechanism 1). Every
 * key is a valid `PermissionIdentifier`. A future module adds keys via
 * `declare module` augmentation from its own file — never by editing this
 * interface body.
 */

export interface PermissionRegistry {
  'audit:view': true;
  'user:administer': true;
  'role:administer': true;
  'org_unit:administer': true;
  'methodology:administer': true;
  'attachment:create': true;
  'attachment:delete': true;
  'comment:create': true;
  'comment:delete': true;
}

/** Every valid permission identifier, core plus whatever a future module
 * has merged in via `PermissionRegistry` augmentation. Use this type on
 * every `@RequirePermission(...)` call site and everywhere else a
 * permission identifier is accepted as input, so a typo is a compile
 * error rather than a permission check that silently never matches. */
export type PermissionIdentifier = keyof PermissionRegistry;

/**
 * The seeded core permission set (data-model.md §3, FR-022), in the exact
 * `resource:action` form and order the spec lists them. `risk:*` used to
 * live here too; it moved to `modules/risk/domain/risk-permissions.ts`'s
 * `RISK_PERMISSION_DEFINITIONS` (A3 remediation — see the file header)
 * because it is Risk Management's own business-module data, not a
 * transversal core concern, and `core/**` must not declare it (ADR-011).
 * Consumed by `src/permission-catalogue.ts`'s `getAllPermissionDefinitions`,
 * the single aggregator both the Nest application and the standalone seed
 * script (T042) import.
 */
export const CORE_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'audit:view',
    resource: 'audit',
    action: 'VIEW',
    description: 'Ver a trilha de auditoria de um registro.',
  },
  {
    identifier: 'user:administer',
    resource: 'user',
    action: 'ADMINISTER',
    description: 'Criar, modificar, desativar e atribuir papéis a usuários.',
  },
  {
    identifier: 'role:administer',
    resource: 'role',
    action: 'ADMINISTER',
    description: 'Criar e modificar papéis e suas permissões.',
  },
  {
    identifier: 'org_unit:administer',
    resource: 'org_unit',
    action: 'ADMINISTER',
    description: 'Criar, modificar e reorganizar a estrutura de unidades organizacionais.',
  },
  {
    identifier: 'methodology:administer',
    resource: 'methodology',
    action: 'ADMINISTER',
    description: 'Configurar a metodologia de risco (escalas, matriz, faixas de nível).',
  },
  {
    identifier: 'attachment:create',
    resource: 'attachment',
    action: 'CREATE',
    description: 'Enviar um anexo para um registro.',
  },
  {
    identifier: 'attachment:delete',
    resource: 'attachment',
    action: 'DELETE',
    description: 'Retirar um anexo de um registro.',
  },
  {
    identifier: 'comment:create',
    resource: 'comment',
    action: 'CREATE',
    description: 'Adicionar um comentário a um registro.',
  },
  {
    identifier: 'comment:delete',
    resource: 'comment',
    action: 'DELETE',
    description: 'Retirar um comentário de um registro.',
  },
];

/**
 * The static-aggregation extension point (see file header, mechanism 2).
 * Combines any number of permission-definition sets — core's own plus every
 * business module's — into one, keyed by identifier. Pure and synchronous:
 * no mutable module state, no registration order to get wrong, safe to call
 * more than once (e.g. once from `src/permission-catalogue.ts`'s
 * module-level constant, and again from a test that wants to prove the
 * duplicate check works — see `test/unit/permissions.spec.ts`).
 *
 * Throws on a duplicate identifier across the supplied sets — a collision
 * is a bug (two modules, or a module and core, claiming the same
 * permission), never a silent overwrite of the platform's own
 * authorization data.
 */
export function combinePermissionDefinitions(
  ...definitionSets: readonly (readonly PermissionDefinition[])[]
): readonly PermissionDefinition[] {
  const byIdentifier = new Map<string, PermissionDefinition>();

  for (const definitions of definitionSets) {
    for (const definition of definitions) {
      if (byIdentifier.has(definition.identifier)) {
        throw new Error(
          `Permission identifier "${definition.identifier}" is already registered. ` +
            'Permission identifiers must be globally unique across every module.',
        );
      }
      byIdentifier.set(definition.identifier, definition);
    }
  }

  return Array.from(byIdentifier.values());
}
