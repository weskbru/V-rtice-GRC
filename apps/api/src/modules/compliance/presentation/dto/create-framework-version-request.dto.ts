/**
 * T030/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `CreateFrameworkVersionRequest`
 * exactly: `additionalProperties: false` — `status`/`publishedAt`/
 * `publishedBy`/`version` are server-owned and rejected as unknown
 * properties by not being declared here.
 */
import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateFrameworkVersionRequestDto {
  @IsString({ message: USER_MESSAGES.dto.frameworkVersion.label.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.frameworkVersion.label.length })
  label!: string;
}
