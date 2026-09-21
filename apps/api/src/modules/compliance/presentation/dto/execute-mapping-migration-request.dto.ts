/**
 * T043/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `ExecuteMappingMigrationRequest`/
 * `MappingMigrationCorrespondence` exactly: `additionalProperties: false`
 * on both, `sourceRequirementIds` non-empty per entry (`minItems: 1`).
 * Nested-array validation follows `CreateMethodologyVersionRequestDto`'s
 * own established convention (`@ValidateNested({ each: true })` +
 * `@Type(() => X)`).
 */
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class MappingMigrationCorrespondenceRequestDto {
  @IsUUID('all', {
    message: USER_MESSAGES.dto.mappingMigrationCorrespondence.targetRequirementId.isUuid,
  })
  targetRequirementId!: string;

  @ArrayMinSize(1, {
    message: USER_MESSAGES.dto.mappingMigrationCorrespondence.sourceRequirementIds.arrayMinSize,
  })
  @IsUUID('all', {
    each: true,
    message: USER_MESSAGES.dto.mappingMigrationCorrespondence.sourceRequirementIds.isUuid,
  })
  sourceRequirementIds!: string[];
}

export class ExecuteMappingMigrationRequestDto {
  @IsUUID('all', {
    message: USER_MESSAGES.dto.executeMappingMigration.sourceFrameworkVersionId.isUuid,
  })
  sourceFrameworkVersionId!: string;

  @IsArray({ message: USER_MESSAGES.dto.executeMappingMigration.correspondences.isArray })
  @ValidateNested({ each: true })
  @Type(() => MappingMigrationCorrespondenceRequestDto)
  correspondences!: MappingMigrationCorrespondenceRequestDto[];
}
