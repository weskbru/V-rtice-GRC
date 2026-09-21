/**
 * T030/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `CreateFrameworkRequest` exactly:
 * `additionalProperties: false` (global `ValidationPipe`'s
 * `forbidNonWhitelisted`) means this class is also, by construction, where
 * "code/version are server-owned and rejected as unknown properties" is
 * enforced — not declaring the property IS the rejection, the same
 * discipline `CreateControlRequestDto`'s own header documents.
 */
import { IsIn, IsString, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FrameworkOrigin } from '@prisma/client';

const FRAMEWORK_ORIGIN_VALUES: readonly FrameworkOrigin[] = [
  'EXTERNAL_STANDARD',
  'INTERNAL_POLICY',
];

export class CreateFrameworkRequestDto {
  @IsString({ message: USER_MESSAGES.dto.framework.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.framework.name.length })
  name!: string;

  @IsString({ message: USER_MESSAGES.dto.framework.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.framework.description.minLength })
  description!: string;

  @IsIn(FRAMEWORK_ORIGIN_VALUES, { message: USER_MESSAGES.dto.framework.origin.isIn })
  origin!: FrameworkOrigin;
}
