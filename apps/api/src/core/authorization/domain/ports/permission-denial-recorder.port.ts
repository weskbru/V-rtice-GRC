export type PermissionDenialReason =
  'MISSING_PERMISSION_DECLARATION' | 'NO_ACTOR' | 'PERMISSION_DENIED';

export interface PermissionDenialContext {
  readonly actorUserId: string | undefined;
  readonly requiredPermission: string | undefined;
  readonly reason: PermissionDenialReason;
}

export abstract class PermissionDenialRecorderPort {
  abstract recordDenied(context: PermissionDenialContext): Promise<void>;
}
