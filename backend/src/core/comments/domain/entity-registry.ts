import type { AttachableEntityType, CommentableEntityType } from '@prisma/client';

export interface ParentRecordAccess {
  readonly organizationalUnitId: string | undefined;
}

export interface ParentRecordAccessor {
  resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess>;
}

export class EntityTypeNotRegisteredError extends Error {
  constructor(capability: 'attachable' | 'commentable', entityType: string) {
    super(
      `No ${capability} entity-type accessor is registered for "${entityType}". Register one ` +
        `with register${capability === 'attachable' ? 'Attachable' : 'Commentable'}EntityType(...) ` +
        "from the owning module's own composition root (see core/comments/domain/entity-registry.ts).",
    );
    this.name = 'EntityTypeNotRegisteredError';
  }
}

const attachableRegistry = new Map<AttachableEntityType, ParentRecordAccessor>();
const commentableRegistry = new Map<CommentableEntityType, ParentRecordAccessor>();

export function registerAttachableEntityType(
  entityType: AttachableEntityType,
  accessor: ParentRecordAccessor,
): void {
  if (attachableRegistry.has(entityType)) {
    throw new Error(
      `Attachable entity type "${entityType}" is already registered. Each entity type may be ` +
        'registered exactly once.',
    );
  }
  attachableRegistry.set(entityType, accessor);
}

export function registerCommentableEntityType(
  entityType: CommentableEntityType,
  accessor: ParentRecordAccessor,
): void {
  if (commentableRegistry.has(entityType)) {
    throw new Error(
      `Commentable entity type "${entityType}" is already registered. Each entity type may be ` +
        'registered exactly once.',
    );
  }
  commentableRegistry.set(entityType, accessor);
}

export function getAttachableEntityAccessor(
  entityType: AttachableEntityType,
): ParentRecordAccessor {
  const accessor = attachableRegistry.get(entityType);
  if (!accessor) {
    throw new EntityTypeNotRegisteredError('attachable', entityType);
  }
  return accessor;
}

export function isAttachableEntityTypeRegistered(value: unknown): value is AttachableEntityType {
  return typeof value === 'string' && attachableRegistry.has(value as AttachableEntityType);
}

export function isCommentableEntityTypeRegistered(value: unknown): value is CommentableEntityType {
  return typeof value === 'string' && commentableRegistry.has(value as CommentableEntityType);
}

export function getCommentableEntityAccessor(
  entityType: CommentableEntityType,
): ParentRecordAccessor {
  const accessor = commentableRegistry.get(entityType);
  if (!accessor) {
    throw new EntityTypeNotRegisteredError('commentable', entityType);
  }
  return accessor;
}

export function __resetEntityRegistryForTests(): void {
  attachableRegistry.clear();
  commentableRegistry.clear();
}
