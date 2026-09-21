/**
 * F-22 defect 1 — unit tests proving `entityType` is validated against the
 * LIVE attachable/commentable entity-type registry
 * (`core/comments/domain/entity-registry.ts`), not a hand-maintained
 * literal array evaluated once at import time.
 *
 * `PROBE_RECORD` is real, permanent residue from T206a's throwaway probe
 * module (F-22's "Permanent residue" note): it exists as a genuine
 * `AttachableEntityType`/`CommentableEntityType` Prisma enum member with NO
 * bootstrap registration in production code, which is exactly what a
 * second real business module's entity type looks like the moment it is
 * added to `schema.prisma` but before its module's constructor has
 * registered an accessor for it. Using it here — rather than standing up a
 * second throwaway module — proves the same property T206a's probe
 * proved, without paying that cost again.
 *
 * These tests exercise the DTO classes directly with `class-validator`'s
 * own `validate()`, i.e. the exact mechanism the global `ValidationPipe`
 * (`infrastructure/http/validation.ts`) runs before a controller method
 * body ever executes — this is the HTTP boundary the defect lived at.
 */
// `ListCommentsQueryDto`/`ListAttachmentsQueryDto` decorate `page`/
// `pageSize` with class-transformer's `@Type(() => Number)`, which reads
// design-time type metadata via `Reflect.getMetadata` — polyfilled by
// `reflect-metadata`, which `src/main.ts` imports first for the real
// application but nothing does for a standalone unit test importing a DTO
// module directly.
import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { validate } from 'class-validator';
import { afterEach, describe, expect, it } from 'vitest';

import {
  __resetEntityRegistryForTests,
  registerAttachableEntityType,
  registerCommentableEntityType,
} from '../../src/core/comments/domain/entity-registry';
import { CreateCommentRequestDto } from '../../src/core/comments/presentation/dto/create-comment-request.dto';
import { ListCommentsQueryDto } from '../../src/core/comments/presentation/dto/list-comments-query.dto';
import { ListAttachmentsQueryDto } from '../../src/core/files/presentation/dto/list-attachments-query.dto';
import { UploadAttachmentRequestDto } from '../../src/core/files/presentation/dto/upload-attachment-request.dto';

import type { ParentRecordAccessor } from '../../src/core/comments/domain/entity-registry';

function fakeAccessor(): ParentRecordAccessor {
  return {
    resolveViewableParent: () => Promise.resolve({ organizationalUnitId: 'unit-1' }),
  };
}

function buildCreateCommentDto(entityType: string): CreateCommentRequestDto {
  const dto = new CreateCommentRequestDto();
  // Deliberate double-cast: exercising an entity type the DTO's own
  // TypeScript type does not (yet) admit is the whole point of this test —
  // `class-validator` sees the raw runtime value, not the compile-time type.
  dto.entityType = entityType as unknown as CreateCommentRequestDto['entityType'];
  dto.entityId = randomUUID();
  dto.body = 'Comentário de teste.';
  return dto;
}

function buildListCommentsDto(entityType: string): ListCommentsQueryDto {
  const dto = new ListCommentsQueryDto();
  dto.entityType = entityType as unknown as CreateCommentRequestDto['entityType'];
  dto.entityId = randomUUID();
  return dto;
}

function buildUploadAttachmentDto(entityType: string): UploadAttachmentRequestDto {
  const dto = new UploadAttachmentRequestDto();
  dto.entityType = entityType as unknown as UploadAttachmentRequestDto['entityType'];
  dto.entityId = randomUUID();
  return dto;
}

function buildListAttachmentsDto(entityType: string): ListAttachmentsQueryDto {
  const dto = new ListAttachmentsQueryDto();
  dto.entityType = entityType as unknown as ListAttachmentsQueryDto['entityType'];
  dto.entityId = randomUUID();
  return dto;
}

describe('entityType validated against the LIVE registry, not a hand-maintained literal (F-22 defect 1)', () => {
  afterEach(() => {
    __resetEntityRegistryForTests();
  });

  describe('comments (CreateCommentRequestDto / ListCommentsQueryDto)', () => {
    it('refuses PROBE_RECORD while it is unregistered, with the entityType.isIn message', async () => {
      const errors = await validate(buildCreateCommentDto('PROBE_RECORD'));
      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('entityType');
      expect(Object.values(errors[0]?.constraints ?? {})).toContain(
        'O tipo de registro informado é inválido.',
      );
    });

    it('accepts PROBE_RECORD once a module registers it — proving the registry, not a literal, is consulted', async () => {
      registerCommentableEntityType('PROBE_RECORD', fakeAccessor());

      const createErrors = await validate(buildCreateCommentDto('PROBE_RECORD'));
      expect(createErrors.filter((error) => error.property === 'entityType')).toHaveLength(0);

      const listErrors = await validate(buildListCommentsDto('PROBE_RECORD'));
      expect(listErrors.filter((error) => error.property === 'entityType')).toHaveLength(0);
    });

    it('still refuses a value that is not a real entity type at all, even once something else is registered', async () => {
      registerCommentableEntityType('PROBE_RECORD', fakeAccessor());

      const errors = await validate(buildCreateCommentDto('NOT_A_REAL_TYPE'));
      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('entityType');
    });

    it('still accepts the pre-existing RISK type once RISK is registered (regression: the fix must not narrow what already worked)', async () => {
      registerCommentableEntityType('RISK', fakeAccessor());

      const errors = await validate(buildCreateCommentDto('RISK'));
      expect(errors.filter((error) => error.property === 'entityType')).toHaveLength(0);
    });
  });

  describe('attachments (UploadAttachmentRequestDto / ListAttachmentsQueryDto)', () => {
    it('refuses PROBE_RECORD while it is unregistered, with the entityType.isIn message', async () => {
      const errors = await validate(buildUploadAttachmentDto('PROBE_RECORD'));
      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('entityType');
      expect(Object.values(errors[0]?.constraints ?? {})).toContain(
        'O tipo de registro informado é inválido.',
      );
    });

    it('accepts PROBE_RECORD once a module registers it — proving the registry, not a literal, is consulted', async () => {
      registerAttachableEntityType('PROBE_RECORD', fakeAccessor());

      const uploadErrors = await validate(buildUploadAttachmentDto('PROBE_RECORD'));
      expect(uploadErrors.filter((error) => error.property === 'entityType')).toHaveLength(0);

      const listErrors = await validate(buildListAttachmentsDto('PROBE_RECORD'));
      expect(listErrors.filter((error) => error.property === 'entityType')).toHaveLength(0);
    });

    it('still refuses a value that is not a real entity type at all, even once something else is registered', async () => {
      registerAttachableEntityType('PROBE_RECORD', fakeAccessor());

      const errors = await validate(buildUploadAttachmentDto('NOT_A_REAL_TYPE'));
      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('entityType');
    });

    it('still accepts the pre-existing RISK type once RISK is registered (regression: the fix must not narrow what already worked)', async () => {
      registerAttachableEntityType('RISK', fakeAccessor());

      const errors = await validate(buildUploadAttachmentDto('RISK'));
      expect(errors.filter((error) => error.property === 'entityType')).toHaveLength(0);
    });
  });

  it('the timing fix: registering AFTER this test file has already been imported still works (proves the check is not a decoration-time snapshot)', async () => {
    // This file's own `import` statements above already loaded
    // create-comment-request.dto.ts and its decorators long before this
    // test body runs. A decoration-time-evaluated `@IsIn(...)` could never
    // see a registration that happens later, in a DIFFERENT test's
    // `beforeEach`/module constructor — which is exactly F-22's failure
    // mode. Registering here, well after import, and succeeding proves
    // `validate()` is consulting the LIVE registry at call time.
    registerCommentableEntityType('PROBE_RECORD', fakeAccessor());
    const errors = await validate(buildCreateCommentDto('PROBE_RECORD'));
    expect(errors).toHaveLength(0);
  });
});
