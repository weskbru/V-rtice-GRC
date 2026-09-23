import { Injectable } from '@nestjs/common';

import type { ReportRunItemResult, RunReportResult } from './run-report.usecase';

const CSV_LINE_BREAK = '\r\n';
const CSV_HEADER = ['metricKey', 'label', 'available', 'value', 'scopeApplicability'].join(',');

export interface ExportReportCsvResult {
  readonly filename: string;
  readonly content: string;
}

@Injectable()
export class ExportReportCsvUseCase {
  execute(runResult: RunReportResult): ExportReportCsvResult {
    const rows = runResult.items.map((item) => this.formatRow(item));
    const content = [CSV_HEADER, ...rows].join(CSV_LINE_BREAK) + CSV_LINE_BREAK;

    return {
      filename: `relatorio-${runResult.reportId}.csv`,
      content,
    };
  }

  private formatRow(item: ReportRunItemResult): string {
    const fields = [
      item.metricKey,
      item.label,
      item.available ? 'true' : 'false',
      this.formatValueColumn(item),
      item.scopeApplicability,
    ];
    return fields.map(escapeCsvField).join(',');
  }

  private formatValueColumn(item: ReportRunItemResult): string {
    if (!item.available) {
      return '';
    }
    if (item.valueByBucket !== undefined) {
      return Object.entries(item.valueByBucket)
        .map(([bucket, count]) => `${bucket}=${String(count)}`)
        .join(';');
    }
    if (item.value !== undefined) {
      return String(item.value);
    }
    return '';
  }
}

function escapeCsvField(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
