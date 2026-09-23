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
    registerCommentableEntityType('PROBE_RECORD', fakeAccessor());
    const errors = await validate(buildCreateCommentDto('PROBE_RECORD'));
    expect(errors).toHaveLength(0);
  });
});
