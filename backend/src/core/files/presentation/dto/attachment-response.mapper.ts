import type { AttachmentRecord } from '../../domain/ports/attachment-repository.port';

const API_PATH_PREFIX = '/api/v1';

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface AttachmentResponse {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly uploadedBy: UserRefResponse;
  readonly createdAt: string;
  readonly contentUrl: string;
}

export function toAttachmentResponse(record: AttachmentRecord): AttachmentResponse {
  return {
    id: record.id,
    entityType: record.entityType,
    entityId: record.entityId,
    fileName: record.fileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    checksumSha256: record.checksumSha256,
    uploadedBy: {
      id: record.uploadedBy.id,
      fullName: record.uploadedBy.fullName,
      email: record.uploadedBy.email,
    },
    createdAt: record.createdAt.toISOString(),
    contentUrl: `${API_PATH_PREFIX}/attachments/${record.id}/content`,
  };
}
