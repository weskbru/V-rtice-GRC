export interface AttachmentSettings {
  readonly allowedMimeTypes: readonly string[];
  readonly maxSizeBytes: number;
}

export const ATTACHMENT_SETTINGS = Symbol('ATTACHMENT_SETTINGS');
