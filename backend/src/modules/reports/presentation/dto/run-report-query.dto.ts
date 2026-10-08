import { IsIn, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export type RunReportFormat = 'json' | 'csv';

const RUN_REPORT_FORMAT_VALUES: readonly RunReportFormat[] = ['json', 'csv'];

export class RunReportQueryDto {
  @IsOptional()
  @IsIn(RUN_REPORT_FORMAT_VALUES, { message: USER_MESSAGES.dto.runReportQuery.format.isIn })
  format?: RunReportFormat;
}
