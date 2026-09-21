/**
 * 009-indicators-reports, Fase 4 (T035/T036) —
 * `PrismaIndicatorMeasurementRepository`: the sole Prisma-backed
 * implementation of `IndicatorMeasurementRepositoryPort`. No `ScopeFilter`
 * anywhere (that port's own header) — every method reads/writes
 * `indicator_measurements` unconditionally, gated only by the caller-level
 * `ScopeFilter.kind === 'GLOBAL'` check the use cases perform before
 * calling this class at all.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  IndicatorMeasurementRepositoryPort,
  type CreateIndicatorMeasurementInput,
  type IndicatorMeasurementListPage,
  type IndicatorMeasurementListQuery,
} from '../domain/ports/indicator-measurement-repository.port';

import type { IndicatorMeasurementRecord } from '../domain/indicator-measurement.entity';
import type { IndicatorMeasurement } from '@prisma/client';

@Injectable()
export class PrismaIndicatorMeasurementRepository implements IndicatorMeasurementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateIndicatorMeasurementInput): Promise<IndicatorMeasurementRecord> {
    const row = await this.prisma.client.indicatorMeasurement.create({
      data: {
        metricKey: input.metricKey,
        value: input.value,
        // A `Json?` column needs the explicit `Prisma.JsonNull` sentinel
        // to persist SQL `NULL` — passing bare `null` would instead be
        // interpreted as "leave this field out of the write" by Prisma's
        // JSON handling (the same distinction
        // `prisma-audit-event-writer.ts` already documents for
        // `previousValues`/`newValues`).
        valueByBucket:
          input.valueByBucket === null
            ? Prisma.JsonNull
            : (input.valueByBucket as Prisma.InputJsonValue),
        breached: input.breached,
        computedByUserId: input.computedByUserId,
      },
    });
    return toIndicatorMeasurementRecord(row);
  }

  async list(query: IndicatorMeasurementListQuery): Promise<IndicatorMeasurementListPage> {
    const where = { metricKey: query.metricKey };

    const [rows, total] = await Promise.all([
      this.prisma.client.indicatorMeasurement.findMany({
        where,
        // Chronological, oldest first (this port's own header;
        // `contracts/indicators.openapi.yaml`'s `listIndicatorMeasurements`
        // description) — the same column data-model.md §2's
        // `@@index([metricKey, computedAt])` covers.
        orderBy: { computedAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.indicatorMeasurement.count({ where }),
    ]);

    return { items: rows.map(toIndicatorMeasurementRecord), total };
  }
}

function toIndicatorMeasurementRecord(row: IndicatorMeasurement): IndicatorMeasurementRecord {
  return {
    id: row.id,
    metricKey: row.metricKey,
    value: row.value ? row.value.toNumber() : null,
    valueByBucket:
      row.valueByBucket === null ? null : (row.valueByBucket as Readonly<Record<string, number>>),
    breached: row.breached,
    computedAt: row.computedAt,
    computedByUserId: row.computedByUserId,
  };
}
