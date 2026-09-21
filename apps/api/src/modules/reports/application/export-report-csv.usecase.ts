/**
 * 009-indicators-reports, Fase 7 (T053) — `ExportReportCsvUseCase`, hand-
 * written CSV serialization of `RunReportUseCase`'s own result (FR-029,
 * research.md D-10: text is trivially generable without a dependency, so
 * none is introduced — verified, not presumed, by that decision's own
 * search of `package.json`/source for `csv`/`xlsx`/`pdf`/`exceljs`/
 * `papaparse`/`json2csv`).
 *
 * ## Column order and shape — fixed by the contract, not decided here
 *
 * `contracts/reports.openapi.yaml`'s `runReport` operation already names
 * the exact header row: `metricKey,label,available,value,scopeApplicability`
 * — this file follows it verbatim, one data row per item, in
 * `RunReportUseCase`'s own declared order (already `definition.metricKeys`'
 * order, T052's own header).
 *
 * ## The `BY_BUCKET` representation — the one thing the contract decided,
 * ## and this file's own note on what would have had to decide it otherwise
 *
 * `contracts/reports.openapi.yaml` already resolves this: a `BY_BUCKET`
 * item's `value` column is a semicolon-separated `bucket=count` list (e.g.
 * `LOW=3;MEDIUM=1;HIGH=0;CRITICAL=0`), because CSV has no native nested-
 * object representation and this keeps every row single-line. This use
 * case follows that decision (`formatValueColumn` below), rather than
 * re-deciding it — spec.md itself never names an FR for this specific
 * question; had the contract not already resolved it, FR-029 ("uma linha
 * de cabeçalho e uma linha por `metricKey`") would have been the natural
 * place to decide it, since a report row that silently expanded into
 * several CSV lines for one `BY_BUCKET` metric would violate that FR's own
 * "uma linha por metricKey" wording.
 *
 * ## Edge cases a hand-written CSV serializer always gets wrong if untested
 *
 * Every one of the five below is covered by
 * `test/unit/export-report-csv.usecase.spec.ts`:
 *
 *   - A field containing the delimiter (`,`) — quoted.
 *   - A field containing a double quote (`"`) — quoted, with the quote
 *     itself doubled (RFC 4180).
 *   - A field containing a line break (`\n` or `\r\n`) — quoted, so the row
 *     still parses as one logical record even though it spans physical
 *     lines.
 *   - An empty value — `available: false` NEVER writes a value at all
 *     (empty string, not `"0"` or `"false"`); an `available: true` item
 *     whose `value`/`valueByBucket` is itself `undefined` (an unmeasurable
 *     `SINGLE_VALUE` metric with no data yet — `IndicatorCalculationPort`'s
 *     own "nunca 0 nem 100" edge case) gets the SAME empty column, for the
 *     identical reason: a measured zero and an absent measurement must
 *     never look alike (spec.md's own edge case for a single indicator,
 *     applied here to every item of a report).
 *   - `available: false` distinguishable from a measured value under ANY
 *     of the above — an unavailable item's `value` column is always empty,
 *     never a stringified `false` or a stale number.
 */
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
  /** Pure transformation — no I/O, no permission check of its own:
   * `RunReportUseCase.execute` has already resolved every item (including
   * FR-026's `available: false` items) by the time this runs. */
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

  /** Empty string for `available: false` (never a value) and for an
   * `available: true` item with no measurable value yet — both must be
   * indistinguishable from "no data", never from a measured zero (this
   * file's own header, edge case list). A `BY_BUCKET` item's value is the
   * contract's own `bucket=count;bucket=count` list
   * (`contracts/reports.openapi.yaml`'s `runReport` description). */
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

/** RFC 4180 field escaping: a field containing the delimiter, a double
 * quote, or a line break (`\n`/`\r`) is wrapped in double quotes, with
 * every double quote inside it doubled. Every other field is left
 * untouched — quoting a field that needs no quoting is legal CSV, but
 * needlessly obscures the common case in this platform's output. */
function escapeCsvField(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
