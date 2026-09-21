/**
 * T095a — the application-layer read side of `GET /risk-categories`,
 * `GET /risk-types` and `GET /risk-origins` (`contracts/platform.openapi.yaml`).
 * No scope and no permission check beyond "authenticated" (the contract:
 * "Requires an authenticated session; no additional permission" — FR-053),
 * and no transaction/audit entry (a read is never audited, ADR-005) — so
 * this needs nothing but `RiskReferenceDataPort`. Kept as one use case with
 * three methods, not three separate classes, because the three operations
 * are identical in shape and differ only in which reference table they
 * read (CLAUDE.md §2: "não criar abstrações prematuras").
 */
import { Injectable } from '@nestjs/common';

import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';

import type { ReferenceDataItemRecord } from '../domain/ports/risk-reference-data.port';

@Injectable()
export class ListRiskReferenceDataUseCase {
  constructor(private readonly referenceData: RiskReferenceDataPort) {}

  listCategories(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]> {
    return this.referenceData.listCategories(includeInactive);
  }

  listTypes(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]> {
    return this.referenceData.listTypes(includeInactive);
  }

  listOrigins(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]> {
    return this.referenceData.listOrigins(includeInactive);
  }
}
