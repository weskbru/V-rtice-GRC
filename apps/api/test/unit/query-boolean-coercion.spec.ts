import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';

import { ListNotificationsQueryDto } from '../../src/core/notifications/presentation/dto/list-notifications-query.dto';
import { ListActionQueryDto } from '../../src/grc/action/presentation/dto/list-action-query.dto';
import { ListEvidenceLinksQueryDto } from '../../src/grc/evidence/presentation/dto/list-evidence-links-query.dto';
import { ListFindingQueryDto } from '../../src/grc/finding/presentation/dto/list-finding-query.dto';
import { ListAssetsQueryDto } from '../../src/modules/assets/presentation/dto/list-assets-query.dto';
import { ListProcessesQueryDto } from '../../src/modules/processes/presentation/dto/list-processes-query.dto';
import { ListRisksQueryDto } from '../../src/modules/risk/presentation/dto/list-risks-query.dto';
import { ListTreatmentActionsQueryDto } from '../../src/modules/risk/presentation/dto/list-treatment-actions-query.dto';

interface BooleanQueryCase {
  readonly label: string;
  readonly dto: new () => object;
  readonly field: string;
}

const BOOLEAN_QUERY_FIELDS: readonly BooleanQueryCase[] = [
  { label: 'ListNotificationsQueryDto', dto: ListNotificationsQueryDto, field: 'unreadOnly' },
  { label: 'ListActionQueryDto', dto: ListActionQueryDto, field: 'overdue' },
  { label: 'ListEvidenceLinksQueryDto', dto: ListEvidenceLinksQueryDto, field: 'includeUnlinked' },
  { label: 'ListFindingQueryDto', dto: ListFindingQueryDto, field: 'withoutRemediation' },
  { label: 'ListRisksQueryDto (overdueReview)', dto: ListRisksQueryDto, field: 'overdueReview' },
  {
    label: 'ListRisksQueryDto (overdueTreatment)',
    dto: ListRisksQueryDto,
    field: 'overdueTreatment',
  },
  { label: 'ListTreatmentActionsQueryDto', dto: ListTreatmentActionsQueryDto, field: 'overdue' },
  { label: 'ListAssetsQueryDto', dto: ListAssetsQueryDto, field: 'isActive' },
  { label: 'ListProcessesQueryDto', dto: ListProcessesQueryDto, field: 'isActive' },
];

const PIPE_TRANSFORM_OPTIONS = { enableImplicitConversion: true } as const;

function transform(testCase: BooleanQueryCase, raw: string): unknown {
  const instance = plainToInstance(
    testCase.dto,
    { [testCase.field]: raw },
    PIPE_TRANSFORM_OPTIONS,
  ) as Record<string, unknown>;
  return instance[testCase.field];
}

describe('boolean query parameters survive the global pipe implicit conversion', () => {
  it.each(BOOLEAN_QUERY_FIELDS)('$label: ?$field=false is read as false, not true', (testCase) => {
    expect(transform(testCase, 'false')).toBe(false);
  });

  it.each(BOOLEAN_QUERY_FIELDS)('$label: ?$field=true is read as true', (testCase) => {
    expect(transform(testCase, 'true')).toBe(true);
  });

  it('exercises every DTO in the table, and each named field actually exists', () => {
    expect(BOOLEAN_QUERY_FIELDS.length).toBeGreaterThanOrEqual(9);

    for (const testCase of BOOLEAN_QUERY_FIELDS) {
      expect(transform(testCase, 'true')).not.toBeUndefined();
    }
  });
});
