'use client';

/**
 * PharosGRC — risk detail, "Editar" panel (016-risk-detail-experience §4.8).
 *
 * `RiskForm` (`mode="edit"`, unmodified — 870 lines, intocado per the
 * spec) inside this platform's `Sheet`, composing `DetailPanel
 * mode="overlay"` — the same pairing `RolePanelShell` already established
 * (015-roles-permissions-surface). Unlike `RolePanelShell`, there is no
 * "inline, beside a list" mode here at all: a risk's detail page has no list
 * next to it to sit beside, so editing is ALWAYS an overlay, at every
 * viewport width. `DetailPanel`'s own header comment explains why `overlay`
 * mode renders no `onClose`/`closeLabel` pair of its own: the `Sheet`
 * already supplies the backdrop, the focus trap, `Escape` and returning
 * focus to whatever opened it (D-15) — implementing any of that here again
 * would only make focus fight itself.
 *
 * The page behind the sheet stays in read-only mode throughout (§4.8): this
 * component owns nothing about the risk's own display, only the form and
 * the panel chrome around it. `onSaved` is the same shape `RiskForm` has
 * always emitted — this component adds no behaviour of its own to it.
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { risks } from '@/lib/messages/risks';

import { RiskForm } from '../risk-form';

import type { RiskDetail } from '../../types';

export interface RiskEditPanelProps {
  risk: RiskDetail;
  etag: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: { risk: RiskDetail; etag: string }) => void;
}

export function RiskEditPanel({
  risk,
  etag,
  onOpenChange,
  onSaved,
}: RiskEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The panel's own header names the region; a second visible title
        // would repeat it — mirrors `RolePanelShell`'s identical choice.
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{risks.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={risks.form.editTitle}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">{risks.form.editTitle}</h2>
              <p className="text-sm text-muted-foreground">{risks.form.editDescription}</p>
            </>
          }
        >
          <RiskForm mode="edit" risk={risk} etag={etag} onSaved={onSaved} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
