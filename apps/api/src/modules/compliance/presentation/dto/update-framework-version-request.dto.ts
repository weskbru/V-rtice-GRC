/**
 * T030/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `UpdateFrameworkVersionRequest`:
 * `label` is required (the contract's own schema has no
 * `minProperties`/partial shape here — a single-field resource has no
 * partial update to make), `additionalProperties: false`.
 */
import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateFrameworkVersionRequestDto {
  @IsString({ message: USER_MESSAGES.dto.frameworkVersion.label.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.frameworkVersion.label.length })
  label!: string;
}
