/**
 * `(entityType, entityId)` parent-reference validation shared by every
 * attachable/commentable subject (§19.3's closed type registry) — used by
 * both `core/comments` and `core/files`, so it belongs to neither on its
 * own.
 */
export const entityType = { isIn: 'O tipo de registro informado é inválido.' } as const;
export const entityId = { isUuid: 'O identificador do registro informado é inválido.' } as const;
