/**
 * PharosGRC — process situation display mapping (T046/T048, CLAUDE.md
 * §18.8, FR-019). Mirrors `features/assets/situation.ts` shape-for-shape
 * (FR-020) — see that file's own doc comment for the full reasoning.
 */
import { processes } from '@/lib/messages/processes';

import type { StatusVariant } from '@pharos/design-system/components';

export function processSituationVariant(isActive: boolean): StatusVariant {
  return processes.situationVariant[isActive ? 'active' : 'inactive'];
}

export function processSituationLabel(isActive: boolean): string {
  return processes.situationLabels[isActive ? 'active' : 'inactive'];
}
