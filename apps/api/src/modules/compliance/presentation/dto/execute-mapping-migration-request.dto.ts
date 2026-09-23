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
