'use client';

/**
 * PharosGRC — incident detail, "Editar" panel (018-incident-detail-experience,
 * Fase 4). Mirrors `RiskEditPanel`'s own shape exactly
 * (016-risk-detail-experience §4.8): `IncidentForm` (`mode="edit"`,
 * unmodified) inside this platform's `Sheet`, composing `DetailPanel
 * mode="overlay"` — the same pairing `RolePanelShell`/`RiskEditPanel`
 * already established. There is no "inline, beside a list" mode here
 * either: an incident's detail page has no list next to it to sit beside,
 * so editing is ALWAYS an overlay, at every viewport width. `DetailPanel`'s
 * own header comment explains why `overlay` mode renders no `onClose`/
 * `closeLabel` pair of its own: the `Sheet` already supplies the backdrop,
 * the focus trap, `Escape` and returning focus to whatever opened it
 * (D-15).
 *
 * Before this phase, the "Visão geral" section swapped its own content for
 * `IncidentForm` inline — the rest of the page (Ciclo de vida, the aside)
 * disappeared along with it. This panel replaces that swap: the page stays
 * fully readable underneath while editing, exactly like Risk's own §4.8.
 * `onSaved` is the same shape `IncidentForm` has always emitted — this
 * component adds no behaviour of its own to it.
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { incidents } from '@/lib/messages/incidents';

import { IncidentForm } from '../incident-form';

import type { IncidentDetail } from '../../types';

export interface IncidentEditPanelProps {
  incident: IncidentDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: IncidentDetail) => void;
}

export function IncidentEditPanel({
  incident,
  onOpenChange,
  onSaved,
}: IncidentEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The panel's own header names the region; a second visible title
        // would repeat it — mirrors `RiskEditPanel`'s identical choice.
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{incidents.form.editHeading}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={incidents.form.editHeading}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">
                {incidents.form.editHeading}
              </h2>
              <p className="text-sm text-muted-foreground">{incidents.form.editDescription}</p>
            </>
          }
        >
          <IncidentForm mode="edit" incident={incident} onSaved={onSaved} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
