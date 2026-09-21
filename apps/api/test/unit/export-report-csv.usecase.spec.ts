/**
 * 009-indicators-reports, Fase 7 (T053) — unit tests for
 * `ExportReportCsvUseCase`. Pure serializer, no ports to fake — every test
 * feeds a hand-built `RunReportResult` and asserts the exact CSV text.
 *
 * Covers every edge case a hand-written CSV serializer characteristically
 * gets wrong (this use case's own header): a value containing the
 * delimiter, a value containing a double quote, a value containing a line
 * break, an empty/absent value, and `available: false` staying
 * distinguishable from a measured zero. Also covers the `BY_BUCKET`
 * representation `contracts/reports.openapi.yaml` already decided
 * (`bucket=count;bucket=count`).
 */
import { IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ExportReportCsvUseCase } from '../../src/modules/reports/application/export-report-csv.usecase';

import type {
  ReportRunItemResult,
  RunReportResult,
} from '../../src/modules/reports/application/run-report.usecase';

const COMPUTED_AT = new Date('2026-09-12T12:00:00.000Z');

function buildResult(items: readonly ReportRunItemResult[]): RunReportResult {
  return { reportId: 'report-1', computedAt: COMPUTED_AT, items };
}

function csvRows(content: string): readonly string[] {
  // Split on the use case's own CRLF line break; drop the trailing empty
  // element produced by the final line break.
  return content
    .split('\r\n')
    .filter((line, index, all) => !(index === all.length - 1 && line === ''));
}

describe('ExportReportCsvUseCase', () => {
  const useCase = new ExportReportCsvUseCase();

  it('writes the fixed header row, exactly as contracts/reports.openapi.yaml declares it', () => {
    const { content } = useCase.execute(buildResult([]));

    expect(csvRows(content)).toEqual(['metricKey,label,available,value,scopeApplicability']);
  });

  it('writes one row per item, in the given order', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.RISK_TREATMENT_OVERDUE_COUNT,
        label: 'Tratamentos de risco em atraso',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 3,
        valueByBucket: undefined,
      },
      {
        metricKey: IndicatorMetricKey.ASSET_INACTIVE_COUNT,
        label: 'Ativos inativos',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 0,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));

    expect(csvRows(content)).toEqual([
      'metricKey,label,available,value,scopeApplicability',
      'RISK_TREATMENT_OVERDUE_COUNT,Tratamentos de risco em atraso,true,3,ORGANIZATIONAL_UNIT',
      'ASSET_INACTIVE_COUNT,Ativos inativos,true,0,ORGANIZATIONAL_UNIT',
    ]);
  });

  it('edge case — a measured zero is written as "0", never confused with an empty/unavailable value', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.ASSET_INACTIVE_COUNT,
        label: 'Ativos inativos',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 0,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe('ASSET_INACTIVE_COUNT,Ativos inativos,true,0,ORGANIZATIONAL_UNIT');
  });

  it('edge case — available:false writes an EMPTY value column, never "0" or "false"', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
        label: 'Controles inativos',
        available: false,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: undefined,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe('CONTROL_INACTIVE_COUNT,Controles inativos,false,,ORGANIZATIONAL_UNIT');
  });

  it('edge case — available:true with no measurable value yet (e.g. Compliance with no data) also writes an empty value column, never a stringified zero', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.COMPLIANCE_PERCENTAGE,
        label: 'Percentual de conformidade',
        available: true,
        scopeApplicability: 'ORGANIZATION_WIDE',
        value: undefined,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe(
      'COMPLIANCE_PERCENTAGE,Percentual de conformidade,true,,ORGANIZATION_WIDE',
    );
  });

  it('BY_BUCKET representation: bucket=count pairs joined by ";", per contracts/reports.openapi.yaml', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        label: 'Riscos por nível',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: undefined,
        valueByBucket: { LOW: 3, MEDIUM: 1, HIGH: 0, CRITICAL: 0 },
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe(
      'RISK_TOTAL_BY_LEVEL,Riscos por nível,true,LOW=3;MEDIUM=1;HIGH=0;CRITICAL=0,ORGANIZATIONAL_UNIT',
    );
  });

  it('a BY_BUCKET item marked unavailable still writes an empty value column, not a partial bucket list', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.FINDING_OPEN_COUNT_BY_SEVERITY,
        label: 'Achados abertos por severidade',
        available: false,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: undefined,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe(
      'FINDING_OPEN_COUNT_BY_SEVERITY,Achados abertos por severidade,false,,ORGANIZATIONAL_UNIT',
    );
  });

  it('edge case — a label containing the delimiter (",") is quoted', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.ASSET_INACTIVE_COUNT,
        label: 'Ativos, inativos e descontinuados',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 2,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe(
      'ASSET_INACTIVE_COUNT,"Ativos, inativos e descontinuados",true,2,ORGANIZATIONAL_UNIT',
    );
  });

  it('edge case — a label containing a double quote is quoted, with the quote itself doubled (RFC 4180)', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.ASSET_INACTIVE_COUNT,
        label: 'Ativos "críticos" inativos',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 1,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).toBe(
      'ASSET_INACTIVE_COUNT,"Ativos ""críticos"" inativos",true,1,ORGANIZATIONAL_UNIT',
    );
  });

  it('edge case — a label containing a line break is quoted, keeping the row a single logical CSV record', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.ASSET_INACTIVE_COUNT,
        label: 'Ativos inativos\ne descontinuados',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 4,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));

    // The embedded line break makes this row span two PHYSICAL lines; the
    // quoting is what keeps it one LOGICAL CSV record. Assert on the raw
    // content directly rather than through `csvRows` (which splits on
    // every `\r\n`, including the one inside the quoted field).
    expect(content).toContain(
      'ASSET_INACTIVE_COUNT,"Ativos inativos\ne descontinuados",true,4,ORGANIZATIONAL_UNIT',
    );
  });

  it('edge case — an empty description-like field with no special characters is left unquoted', () => {
    const items: ReportRunItemResult[] = [
      {
        metricKey: IndicatorMetricKey.ASSET_INACTIVE_COUNT,
        label: 'Ativos inativos',
        available: true,
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        value: 5,
        valueByBucket: undefined,
      },
    ];

    const { content } = useCase.execute(buildResult(items));
    const [, dataRow] = csvRows(content);

    expect(dataRow).not.toContain('"');
  });
});
