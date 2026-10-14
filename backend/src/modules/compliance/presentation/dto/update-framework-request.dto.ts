import { IsIn, IsOptional, IsString, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FrameworkOrigin } from '@prisma/client';

const FRAMEWORK_ORIGIN_VALUES: readonly FrameworkOrigin[] = [
  'EXTERNAL_STANDARD',
  'INTERNAL_POLICY',
];

export class UpdateFrameworkRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.framework.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.framework.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.framework.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.framework.description.minLength })
  description?: string;

  @IsOptional()
  @IsIn(FRAMEWORK_ORIGIN_VALUES, { message: USER_MESSAGES.dto.framework.origin.isIn })
  origin?: FrameworkOrigin;
}
