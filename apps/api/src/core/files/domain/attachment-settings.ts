/**
 * DI token + settings shape for the files capability (T189). Duplicated
 * from `AppConfigService.attachment`'s shape rather than importing it —
 * `core-domain`/`core-application` may not import the top-level
 * `infrastructure` element under ADR-011; `files.module.ts` is the only
 * place that reads the real `AppConfigService` and provides this token —
 * exactly the pattern `core/identity/domain/identity-settings.ts` already
 * establishes for `ARGON2_SETTINGS`/`AUTH_THROTTLE_SETTINGS`/
 * `PASSWORD_POLICY_SETTINGS`.
 */
export interface AttachmentSettings {
  readonly allowedMimeTypes: readonly string[];
  readonly maxSizeBytes: number;
}

export const ATTACHMENT_SETTINGS = Symbol('ATTACHMENT_SETTINGS');
