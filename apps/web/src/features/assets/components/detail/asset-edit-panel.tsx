'use client';

/**
 * PharosGRC — asset detail, "Editar" panel (022-asset-detail-experience,
 * Fase C). Mirrors `ControlEditPanel`'s/`ActionEditPanel`'s own shape:
 * `AssetForm` (`mode="edit"`, unmodified apart from the new optional
 * `onCancel` this same phase added) inside this platform's `Sheet`,
 * composing `DetailPanel mode="overlay"`. There is no "inline, beside a
 * list" mode here either: an asset's detail page has no list next to it to
 * sit beside, so editing is ALWAYS an overlay, at every viewport width.
 * `DetailPanel`'s own header comment explains why `overlay` mode renders no
 * `onClose`/`closeLabel` pair of its own: the `Sheet` already supplies the
 * backdrop, the focus trap, `Escape` and returning focus to whatever opened
 * it (D-15) — here, the header's own "Editar" button.
 *
 * Before this phase, "Visão geral" swapped its own content for `AssetForm`
 * inline — the rest of the page (the "Situação" card) disappeared along
 * with it (Fase B's own documented, deliberately short-lived narrowing).
 * This panel replaces that swap: the page stays fully readable underneath
 * while editing. `onSaved` is the same shape `AssetForm` has always
 * emitted — this component adds no behaviour of its own to it.
 *
 * ## `showCloseButton={false}` — decided by measurement, mirroring `Action`'s
 * own reasoning, not `Control`'s
 *
 * `AssetForm` has exactly three fields (Nome, Descrição, Unidade
 * organizacional) — far closer to `ActionEditForm`'s four than to
 * `ControlForm`'s much larger surface. Measured directly against the
 * rendered panel (not assumed from field count alone): at BOTH 1440×900 and
 * 390×844, `AssetForm`'s own "Salvar alterações"/"Cancelar" footer is fully
 * inside the initial viewport with zero scrolling — the same shape that
 * earned `ActionEditPanel` its `showCloseButton={false}`, not `Control`'s
 * (`ControlForm`, 700+ lines, scrolls even at 1440). Removing the icon-only
 * `X` here avoids the same redundant-control shape `ActionEditPanel`'s own
 * header comment documents: `AssetForm`'s own "Cancelar" is the more
 * discoverable, better-labelled control of the two, and is reachable
 * without scrolling at every viewport this screen supports. `showCloseButton
 * ={false}` removes ONLY the visible icon — `Escape` and a backdrop click
 * both stay exactly as available, handled by the underlying Radix `Dialog`
 * independently of that button.
 *
 * `AssetForm`'s own "Cancelar" is wired to `() => onOpenChange(false)` — the
 * EXACT SAME function `Escape`/the backdrop already call, never a second,
 * independently-written close mechanism. This closes the gap F-79
 * (`docs/deferred-findings.md`) found in `ControlForm`'s equivalent button
 * (`navigate.back()`, a real navigation, ejecting the caller from the
 * screen) — `AssetForm` gained the same optional `onCancel` prop this same
 * phase, applied preemptively here rather than shipping the overlay first
 * and discovering the identical defect a second time.
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { assets } from '@/lib/messages/assets';

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
        // The panel's own header names the region; a second visible title
        // would repeat it — mirrors `ControlEditPanel`'s/`ActionEditPanel`'s
        // identical choice.
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
