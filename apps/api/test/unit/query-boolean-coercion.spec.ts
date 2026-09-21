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

/**
 * 006-assets-processes — regression guard for a platform-wide query-string
 * defect: **an explicit `?flag=false` was silently read as `true`.**
 *
 * ## The defect
 *
 * `main.ts` configures the global `ValidationPipe` with
 * `transformOptions: { enableImplicitConversion: true }`. That option makes
 * `class-transformer` coerce each field to its reflected design type BEFORE
 * any `@Transform` callback runs. For a field declared `boolean`, the
 * coercion is `Boolean(rawValue)` — and `Boolean('false')` is `true`,
 * because `'false'` is a non-empty string.
 *
 * Every DTO below therefore received an already-`true` `value` in its
 * `@Transform(({ value }) => ...)` callback and had no way to recover the
 * caller's actual intent. `?withoutRemediation=false` filtered as
 * `withoutRemediation=true`; `?includeInactive=false` included inactive
 * records anyway. Silent, and wrong in the direction that shows the user
 * MORE than they asked for.
 *
 * ## Why the guard is a loop over every DTO, not one test per fix
 *
 * The shape was present in **seven** DTOs across notifications, actions,
 * evidence links, findings, risks, treatment actions and the reference
 * registry — copied from one another, each with a comment claiming it
 * "mirrors" a sibling. AGENTS.md requires a fix to "generalize to every call
 * site sharing the vulnerable pattern, not only the reported instance", and
 * this table is that requirement in executable form: a future DTO that
 * reintroduces `({ value })` fails here rather than shipping and being
 * discovered one endpoint at a time.
 *
 * It was found while implementing the Asset/Process listing (this fase's own
 * `includeInactive`), not by any existing gate — the pre-existing DTOs had no
 * test that ever passed `'false'`, so the bug was latent and green.
 *
 * ## What the fix is
 *
 * Read `obj[key]` — the untouched raw value — instead of `value`. Each
 * corrected `toBoolean` carries the explanation at its own call site.
 */

interface BooleanQueryCase {
  readonly label: string;
  readonly dto: new () => object;
  readonly field: string;
}

/**
 * Every DTO on the platform with a boolean query field, and the field to
 * exercise. Adding a DTO with a boolean query parameter means adding a row
 * here — that is the point.
 */
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

/** Exactly the options `main.ts` gives the global pipe — the whole point is
 * that the defect only appears under `enableImplicitConversion`. */
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

  // Non-vacuity: a table that somehow resolved to no cases, or to fields that
  // do not exist on their DTO, would pass both assertions above while
  // testing nothing.
  it('exercises every DTO in the table, and each named field actually exists', () => {
    expect(BOOLEAN_QUERY_FIELDS.length).toBeGreaterThanOrEqual(9);

    for (const testCase of BOOLEAN_QUERY_FIELDS) {
      // If the field name were wrong, the transform would return `undefined`
      // for BOTH inputs and the assertions above would silently compare
      // `undefined` to nothing meaningful.
      expect(transform(testCase, 'true')).not.toBeUndefined();
    }
  });
});
