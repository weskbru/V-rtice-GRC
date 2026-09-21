/**
 * 009-indicators-reports, Fase 7 (T054) — matches
 * `GET /reports/{reportId}/run`'s `format` query parameter
 * (`contracts/reports.openapi.yaml`'s `runReport` operation): `json`
 * (default) or `csv`. `csv` may also be requested via `Accept: text/csv`
 * — `ReportController.run` resolves that ambiguity, `format` taking
 * precedence when both are present, per the contract's own description.
 */
import { IsIn, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export type RunReportFormat = 'json' | 'csv';

const RUN_REPORT_FORMAT_VALUES: readonly RunReportFormat[] = ['json', 'csv'];

export class RunReportQueryDto {
  @IsOptional()
  @IsIn(RUN_REPORT_FORMAT_VALUES, { message: USER_MESSAGES.dto.runReportQuery.format.isIn })
  format?: RunReportFormat;
}
