import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LoginRequestDto {
  @IsEmail({}, { message: USER_MESSAGES.dto.email.isEmail })
  @MaxLength(320, { message: USER_MESSAGES.dto.email.maxLength })
  email!: string;

  @IsString({ message: USER_MESSAGES.dto.password.isString })
  @Length(1, 256, { message: USER_MESSAGES.dto.password.length })
  password!: string;
}
