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
