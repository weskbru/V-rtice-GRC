/**
 * PharosGRC — report situation display mapping (009-indicators-reports, T061), mirroring
 * `features/assets/situation.ts`'s own shape one-for-one (CLAUDE.md §18.12): `isActive` is a
 * plain two-state boolean (`ReportDefinition.isActive`), so this file is intentionally thin — it
 * looks up the label/variant pair `lib/messages/reports.ts` already declares, once, so
 * `report-register-columns.tsx` never repeats the `isActive ? 'active' : 'inactive'` ternary.
 *
 * No icon override: `StatusBadge`'s own per-variant default already differs between `success`
 * (Ativo) and `neutral` (Inativo), so situation is distinguishable by icon shape AND label text,
 * never color alone (CLAUDE.md §18.8).
 */
import { reports } from '@/lib/messages/reports';

import type { StatusVariant } from '@pharos/design-system/components';

export function reportSituationVariant(isActive: boolean): StatusVariant {
  return reports.situationVariant[isActive ? 'active' : 'inactive'];
}

export function reportSituationLabel(isActive: boolean): string {
  return reports.situationLabels[isActive ? 'active' : 'inactive'];
}
