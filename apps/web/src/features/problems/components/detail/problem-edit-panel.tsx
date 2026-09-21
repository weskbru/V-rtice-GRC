'use client';

/**
 * PharosGRC — problem detail, "Editar" panel (019-problem-detail-experience,
 * Fase C). Mirrors `IncidentEditPanel`'s own shape exactly
 * (018-incident-detail-experience, Fase 4): `ProblemForm` (`mode="edit"`,
 * unmodified) inside this platform's `Sheet`, composing `DetailPanel
 * mode="overlay"` — the same pairing `RiskEditPanel`/`IncidentEditPanel`
 * already established. There is no "inline, beside a list" mode here
 * either: a problem's detail page has no list next to it to sit beside, so
 * editing is ALWAYS an overlay, at every viewport width. `DetailPanel`'s own
 * header comment explains why `overlay` mode renders no `onClose`/
 * `closeLabel` pair of its own: the `Sheet` already supplies the backdrop,
 * the focus trap, `Escape` and returning focus to whatever opened it
 * (D-15).
 *
 * Before this phase, the "Visão geral" section swapped its own content for
 * `ProblemForm` inline — the rest of the page (Ciclo de vida) disappeared
 * along with it. This panel replaces that swap: the page stays fully
 * readable underneath while editing, exactly like Incident's own Fase 4.
 * `onSaved` is the same shape `ProblemForm` has always emitted — this
 * component adds no behaviour of its own to it.
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { problems } from '@/lib/messages/problems';

import { ProblemForm } from '../problem-form';

import type { ProblemDetail } from '../../types';

export interface ProblemEditPanelProps {
  problem: ProblemDetail;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: ProblemDetail) => void;
}

export function ProblemEditPanel({
  problem,
  onOpenChange,
  onSaved,
}: ProblemEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The panel's own header names the region; a second visible title
        // would repeat it — mirrors `IncidentEditPanel`'s identical choice.
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{problems.form.editHeading}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={problems.form.editHeading}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">
                {problems.form.editHeading}
              </h2>
              <p className="text-sm text-muted-foreground">{problems.form.editDescription}</p>
            </>
          }
        >
          <ProblemForm mode="edit" problem={problem} onSaved={onSaved} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
