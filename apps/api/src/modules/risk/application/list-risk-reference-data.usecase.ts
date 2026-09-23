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
