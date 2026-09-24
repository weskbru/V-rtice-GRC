import { Prisma } from '@prisma/client';

import { FREQUENCY_WINDOW_DAYS } from '../domain/control-effectiveness.service';

import type { ControlFrequency } from '@prisma/client';

function frequencyWindowDaysCase(frequencyColumn: Prisma.Sql): Prisma.Sql {
  const clauses = (Object.entries(FREQUENCY_WINDOW_DAYS) as [ControlFrequency, number][])
    .map(([frequency, days]) => `WHEN '${frequency}' THEN ${String(days)}`)
    .join(' ');
  return Prisma.sql`(CASE (${frequencyColumn})::text ${Prisma.raw(clauses)} END)`;
}

export function controlEffectivenessExpression(
  controlIdColumn: Prisma.Sql,
  frequencyColumn: Prisma.Sql,
  referenceDateParam: string,
): Prisma.Sql {
  const latestAttestedAssessedOn = Prisma.sql`(
    SELECT ca.assessed_on FROM control_assessments ca
    WHERE ca.control_id = ${controlIdColumn} AND ca.attested_at IS NOT NULL
    ORDER BY ca.assessed_on DESC, ca.created_at DESC
    LIMIT 1
  )`;
  const latestAttestedResult = Prisma.sql`(
    SELECT ca.result::text FROM control_assessments ca
    WHERE ca.control_id = ${controlIdColumn} AND ca.attested_at IS NOT NULL
    ORDER BY ca.assessed_on DESC, ca.created_at DESC
    LIMIT 1
  )`;

  return Prisma.sql`(
    CASE
      WHEN ${latestAttestedAssessedOn} IS NULL THEN 'NOT_ASSESSED'
      WHEN ${frequencyColumn} IS NOT NULL
        AND ${latestAttestedAssessedOn} < (${referenceDateParam}::date - (${frequencyWindowDaysCase(frequencyColumn)}) * INTERVAL '1 day')
      THEN 'EXPIRED'
      ELSE ${latestAttestedResult}
    END
  )`;
}
