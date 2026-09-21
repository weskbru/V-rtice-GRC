/**
 * T056/004-compliance-management — matches `GET
 * /frameworks/{frameworkId}/versions/{versionId}/requirements`'s query
 * parameters (`listRequirements` operation), including the
 * `complianceState` filter (comma-separated `RequirementComplianceState`
 * values).
 */
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { RequirementComplianceState } from '@prisma/client';

const COMPLIANCE_STATE_VALUES: readonly RequirementComplianceState[] = [
  'NOT_APPLICABLE',
  'NOT_MET',
  'NOT_PROVEN',
  'PARTIALLY_MET',
  'COMPLIANT',
];

function splitCsv({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

export class ListRequirementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listRequirementsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listRequirementsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listRequirementsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listRequirementsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listRequirementsQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(COMPLIANCE_STATE_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.listRequirementsQuery.complianceState.isIn,
  })
  complianceState?: RequirementComplianceState[];
}
