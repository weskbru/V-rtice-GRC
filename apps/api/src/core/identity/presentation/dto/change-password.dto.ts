/**
 * Matches `auth.openapi.yaml`'s `ChangePasswordRequest` schema:
 * `currentPassword` (minLength 1, maxLength 256), `newPassword` (minLength
 * 12, maxLength 256 — the contract's floor; the deployed policy,
 * `PasswordPolicySettings`, may be stricter and is enforced separately by
 * `validatePassword`, T060, reported as a 422 field error, never a 400).
 */
import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ChangePasswordRequestDto {
  @IsString({ message: USER_MESSAGES.dto.currentPassword.isString })
  @Length(1, 256, { message: USER_MESSAGES.dto.currentPassword.length })
  currentPassword!: string;

  @IsString({ message: USER_MESSAGES.dto.newPassword.isString })
  @Length(12, 256, { message: USER_MESSAGES.dto.newPassword.length })
  newPassword!: string;
}
