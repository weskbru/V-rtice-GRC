/**
 * T003/006-assets-processes — Assets' own permission definitions
 * (data-model.md §5, FR-009, research.md D-7). Follows
 * `modules/audit-engagements/domain/audit-engagement-permissions.ts` exactly
 * — see that file's header for the full explanation of the two extension
 * points (compile-time `PermissionRegistry` augmentation, static
 * aggregation via `combinePermissionDefinitions` in
 * `src/permission-catalogue.ts`).
 *
 * ## Why `asset:*`, never `risk:view` (US2, FR-009)
 *
 * Today the only authority that grants access to the asset inventory is
 * `risk:view` (`RegistryController`, `modules/risk`) — a defect this fase
 * exists to correct, not a shape to preserve. Reading an asset's own record
 * must never depend on authority over a different module (Constitution
 * Principle III). `asset:view` is the resource's own read permission, and
 * is what `GET /assets`/`GET /assets/{assetId}` require going forward
 * (Fase 3/4, out of this task's own scope — this file only declares the
 * permission identifiers themselves).
 *
 * ## Four permissions, reusing existing `PermissionAction` values
 * (data-model.md §5, research.md D-7)
 *
 * - `asset:view` (`VIEW`) — list and read.
 * - `asset:create` (`CREATE`) — register a new asset.
 * - `asset:edit` (`EDIT`) — correct name, description and organizational
 *   unit.
 * - `asset:administer` (`ADMINISTER`) — the only two-state transition this
 *   record has (deactivate/reactivate, data-model.md §3) — the same
 *   reasoning `control:administer` already documents for a single terminal
 *   transition: a dedicated verb per transition would be granularity
 *   without consequence, since `isActive` is a two-state situation, not a
 *   lifecycle (research.md D-3).
 *
 * No new `PermissionAction` enum value — all four are reused verbatim from
 * the existing set, as `research.md` D-7 requires.
 *
 * ## No `asset:delete`
 *
 * FR-012 forbids ever hard-deleting an asset (leaving operation is
 * `asset:administer`'s deactivate transition) — a `asset:delete` permission
 * would govern an operation that does not exist, the same reasoning
 * `risk-permissions.ts`/`control-permissions.ts` already give for their own
 * deliberate absence of a delete permission.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'asset:view': true;
    'asset:create': true;
    'asset:edit': true;
    'asset:administer': true;
  }
}

/**
 * Assets' seeded permission set (data-model.md §5). Combined with every
 * other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
export const ASSET_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'asset:view',
    resource: 'asset',
    action: 'VIEW',
    description: 'Listar e ler ativos dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'asset:create',
    resource: 'asset',
    action: 'CREATE',
    description: 'Cadastrar um novo ativo.',
  },
  {
    identifier: 'asset:edit',
    resource: 'asset',
    action: 'EDIT',
    description: 'Editar o nome, a descrição e a unidade organizacional de um ativo.',
  },
  {
    identifier: 'asset:administer',
    resource: 'asset',
    action: 'ADMINISTER',
    description: 'Desativar ou reativar um ativo.',
  },
];
