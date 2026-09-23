import { assets } from '@/lib/messages/assets';

import type { StatusVariant } from '@pharos/design-system/components';

export function assetSituationVariant(isActive: boolean): StatusVariant {
  return assets.situationVariant[isActive ? 'active' : 'inactive'];
}

export function assetSituationLabel(isActive: boolean): string {
  return assets.situationLabels[isActive ? 'active' : 'inactive'];
}
