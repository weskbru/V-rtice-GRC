import type { Readable } from 'node:stream';

export interface StoredFile {
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
}

export abstract class FileStorageProvider {
  abstract put(content: Buffer, organizationalUnitId: string | undefined): Promise<StoredFile>;

  abstract get(storageKey: string): Promise<Readable>;

  abstract delete(storageKey: string): Promise<void>;
}
