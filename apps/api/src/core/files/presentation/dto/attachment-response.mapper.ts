/**
 * T190 — maps `AttachmentRecord` to `contracts/platform.openapi.yaml`'s
 * `Attachment` schema. `storageKey` is NEVER included — it is internal
 * storage layout (ADR-010, FR-107); `contentUrl` is the only path back to
 * the bytes, and it always re-authorizes (FR-098).
 */
import type { AttachmentRecord } from '../../domain/ports/attachment-repository.port';

// `core-presentation` may not import the top-level `infrastructure` element
// (ADR-011 — only `core-infrastructure`/`module-infrastructure` may), so
// `API_GLOBAL_PREFIX` (`infrastructure/http/api-prefix.ts`) cannot be
// imported here. The prefix is a fixed, versioned API contract value
// (ADR-009) — the same literal `contracts/platform.openapi.yaml` itself
// hardcodes for this exact path — so duplicating it as a constant is the
// correct trade-off, not a drift risk.
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
