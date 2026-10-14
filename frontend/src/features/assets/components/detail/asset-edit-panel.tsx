'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { assets } from '@/lib/messages/assets';
import { DetailPanel } from '@vertice/design-system/components';

import { AssetForm } from '../asset-form';

import type { AssetDetail } from '../../types';

export interface AssetEditPanelProps {
  asset: AssetDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (asset: AssetDetail) => void;
}

export function AssetEditPanel({
  asset,
  onOpenChange,
  onSaved,
}: AssetEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{assets.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={assets.form.editTitle}
          header={
            <h2 className="text-base font-semibold text-foreground">{assets.form.editTitle}</h2>
          }
        >
          <AssetForm
            mode="edit"
            asset={asset}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
