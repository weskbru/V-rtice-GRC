import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../infrastructure/config/app-config.service';
import { FileStorageProvider, type StoredFile } from '../domain/ports/file-storage-provider.port';

import type { Readable } from 'node:stream';

@Injectable()
export class LocalDiskStorageProvider extends FileStorageProvider {
  private readonly root: string;

  constructor(appConfig: AppConfigService) {
    super();
    this.root = path.resolve(appConfig.attachment.storagePath);
  }

  async put(content: Buffer, organizationalUnitId: string | undefined): Promise<StoredFile> {
    const checksumSha256 = createHash('sha256').update(content).digest('hex');
    const relativeKey = relativeKeyFor(checksumSha256, organizationalUnitId);
    const absolutePath = this.resolveStoragePath(relativeKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    try {
      await writeFile(absolutePath, content, { flag: 'wx' });
    } catch (error) {
      if (!isNodeErrnoException(error) || error.code !== 'EEXIST') {
        throw error;
      }
    }

    return { storageKey: relativeKey, checksumSha256, sizeBytes: content.length };
  }

  get(storageKey: string): Promise<Readable> {
    const absolutePath = this.resolveStoragePath(storageKey);
    return Promise.resolve(createReadStream(absolutePath));
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.resolveStoragePath(storageKey);
    await rm(absolutePath, { force: true });
  }

  private resolveStoragePath(storageKey: string): string {
    const absolutePath = path.resolve(this.root, storageKey);
    const rootWithSeparator = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;
    if (absolutePath !== this.root && !absolutePath.startsWith(rootWithSeparator)) {
      throw new Error(
        `Refusing to resolve storage key outside the storage root (root="${this.root}").`,
      );
    }
    return absolutePath;
  }
}

const UNSCOPED_BUCKET = 'unscoped';

function relativeKeyFor(checksumSha256: string, organizationalUnitId: string | undefined): string {
  const scopeSegments =
    organizationalUnitId === undefined ? [UNSCOPED_BUCKET] : ['org', organizationalUnitId];
  return path.join(
    ...scopeSegments,
    'sha256',
    checksumSha256.slice(0, 2),
    checksumSha256.slice(2, 4),
    checksumSha256,
  );
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
