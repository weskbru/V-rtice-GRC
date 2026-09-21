/**
 * T188 — the `FileStorageProvider` port (ADR-010). An abstract class, not a
 * TypeScript `interface`, so it exists at runtime and can be used as a
 * Nest DI token (`{ provide: FileStorageProvider, useClass:
 * LocalDiskStorageProvider }`) — the same pattern every port in this
 * codebase uses (`AuditEventWriterPort`, `TransactionRunnerPort`, ...).
 *
 * `core/files/infrastructure/local-disk-storage-provider.ts` is the only
 * adapter in this release. A future S3-compatible adapter implements this
 * exact interface and is swapped in `FilesModule`'s own `useClass` binding
 * — nothing in `application/upload.service.ts` or anywhere else that calls
 * this port needs to change (ADR-010's whole point).
 *
 * ## Buffer, not stream, for `put` — a deliberate, documented deviation
 * from ADR-010's literal `put(stream, metadata) → storageKey` wording
 *
 * T189's validation (type allow-list, magic-byte sniffing, size limit,
 * checksum) genuinely needs the COMPLETE file content before any storage
 * decision can be made — a magic-byte signature and a SHA-256 checksum are
 * both whole-content facts, not something derivable from a stream prefix
 * alone. `AttachmentController`'s `FileInterceptor` (Nest's own multipart
 * handling, `@nestjs/platform-express`) already buffers the entire upload
 * into memory before any application code runs, for exactly this class of
 * upload (`ATTACHMENT_MAX_SIZE_BYTES` defaults to 25 MB — small enough to
 * buffer safely). By the time `UploadService` can call `put`, the full
 * content already exists as one `Buffer` in memory; accepting a `Readable`
 * here would not avoid a memory buffer that already happened one layer up,
 * it would only force this port to re-assemble one. `get` still returns a
 * `Readable`, matching ADR-010's stream-based download design exactly —
 * that direction has no equivalent "must see it all first" constraint.
 */
import type { Readable } from 'node:stream';

/** Everything the caller needs back after a successful `put`. The
 * checksum and size are computed from the ACTUAL bytes written — never
 * trusted from caller-supplied metadata — so `Attachment.checksumSha256`
 * is always independently verifiable storage-layer truth, not merely an
 * echo of what the uploader claimed. */
export interface StoredFile {
  /** Opaque, content-addressed identifier. NEVER derived from a caller-
   * supplied file name — this is the whole of the path-traversal defense
   * (ADR-010's "attachment name collisions and unsafe names" edge case):
   * an original name can never influence a location on disk, because it
   * is never consulted to build one. */
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
}

export abstract class FileStorageProvider {
  /** Persists `content`, scoped to `organizationalUnitId`, and returns its
   * generated, content-addressed storage key plus its verified checksum
   * and size. Idempotent for identical content WITHIN THE SAME
   * organizational unit: uploading the same bytes twice, for the same
   * unit, yields the same `storageKey` without a second write — but the
   * same bytes uploaded under a DIFFERENT unit are stored again, under a
   * different key (F-26 fix, research.md D-12/D-R12: partitioning by
   * scope is what closes the cross-scope existence oracle a purely
   * content-addressed key created). `organizationalUnitId` is `undefined`
   * for a parent entity type with no organizational scope of its own —
   * every adapter MUST give that case its own explicit bucket, never
   * silently falling into a scoped bucket or into legacy pre-partition
   * keys. `checksumSha256` on the returned `StoredFile` is unaffected by
   * scope — it is a fact about the bytes, never about the key. */
  abstract put(content: Buffer, organizationalUnitId: string | undefined): Promise<StoredFile>;

  /** Opens a readable stream over the stored content named by
   * `storageKey`. Throws if `storageKey` does not name a stored file —
   * callers are expected to have already confirmed the owning
   * `Attachment` row exists via the repository before calling this. */
  abstract get(storageKey: string): Promise<Readable>;

  /** Removes the stored content named by `storageKey`. Not currently
   * called by any use case in this release (withdrawing an attachment is a
   * soft delete — `Attachment.deletedAt` — that preserves attribution per
   * FR-102, and a content-addressed key may be shared by more than one
   * `Attachment` row, so a single row's withdrawal must never delete bytes
   * another live row still references). Implemented because ADR-010
   * specifies the full port shape; reserved for a future retention/purge
   * tool that can prove no live row still references the key. */
  abstract delete(storageKey: string): Promise<void>;
}
