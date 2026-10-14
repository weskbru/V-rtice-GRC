import { Module } from '@nestjs/common';

import { registerDefaultPlannedAreas } from './domain/default-planned-areas';

@Module({})
export class DashboardModule {
  constructor() {
    registerDefaultPlannedAreas();
  }
}
