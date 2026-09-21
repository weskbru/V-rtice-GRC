/**
 * T056/004-compliance-management — matches `GET
 * /requirements/{requirementId}/applicability-declarations`'s query
 * parameters (`listRequirementApplicabilityDeclarations` operation).
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListApplicabilityDeclarationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listApplicabilityDeclarationsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listApplicabilityDeclarationsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listApplicabilityDeclarationsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listApplicabilityDeclarationsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listApplicabilityDeclarationsQuery.pageSize.isInt })
  pageSize = 25;
}
