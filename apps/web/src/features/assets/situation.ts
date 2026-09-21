/**
 * PharosGRC — asset situation display mapping (T046/T048, CLAUDE.md §18.8,
 * FR-019).
 *
 * `isActive` is a plain two-state boolean (data-model.md §3) — there is no
 * server-computed lifecycle table to mirror here (unlike
 * `features/controls/status.ts`'s/`features/audit-engagements/status.ts`'s
 * multi-state enums), so this file is intentionally thin: it looks up the
 * label/variant pair `lib/messages/assets.ts` already declares, once, so
 * `AssetCard`/`asset-register-columns.tsx`/`AssetOverview` never repeat the
 * `isActive ? 'active' : 'inactive'` ternary three times over.
 *
 * No icon override: `StatusBadge`'s own per-variant default already differs
 * between `success` (Ativo) and `neutral` (Inativo) — CircleCheck vs.
 * MinusCircle — so situation is distinguishable by icon shape AND label
 * text, never colour alone (FR-019, CLAUDE.md §18.8), with no icon map to
 * duplicate here.
 */
import { assets } from '@/lib/messages/assets';

import type { StatusVariant } from '@pharos/design-system/components';

export function assetSituationVariant(isActive: boolean): StatusVariant {
  return assets.situationVariant[isActive ? 'active' : 'inactive'];
}

export function assetSituationLabel(isActive: boolean): string {
  return assets.situationLabels[isActive ? 'active' : 'inactive'];
}
