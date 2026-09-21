/**
 * T180 — matches `contracts/admin.openapi.yaml`'s
 * `ResetUserPasswordRequest` (`additionalProperties: false`).
 */
import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ResetUserPasswordRequestDto {
  @IsString({ message: USER_MESSAGES.dto.resetUserPassword.newPassword.isString })
  @Length(12, 256, { message: USER_MESSAGES.dto.resetUserPassword.newPassword.length })
  newPassword!: string;
}
