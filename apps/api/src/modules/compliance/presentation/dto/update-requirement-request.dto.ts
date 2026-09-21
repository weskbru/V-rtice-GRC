/**
 * T030/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `UpdateRequirementRequest`: every
 * property optional (partial update), `additionalProperties: false`,
 * `minProperties: 1` enforced by the controller (mirrors
 * `UpdateControlRequestDto`'s identical convention).
 */
import { IsOptional, IsString, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateRequirementRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.requirement.externalRef.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.requirement.externalRef.length })
  externalRef?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.requirement.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.requirement.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.requirement.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.requirement.description.minLength })
  description?: string;
}
