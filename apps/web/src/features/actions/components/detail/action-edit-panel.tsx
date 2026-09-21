'use client';

/**
 * PharosGRC — action detail, "Editar" panel (020-action-detail-experience,
 * Fase C). Mirrors `IncidentEditPanel`'s/`ProblemEditPanel`'s own shape:
 * `ActionEditForm` (unmodified) inside this platform's `Sheet`, composing
 * `DetailPanel mode="overlay"` — the same pairing `RiskEditPanel` already
 * established. There is no "inline, beside a list" mode here either: an
 * action's detail page has no list next to it to sit beside, so editing is
 * ALWAYS an overlay, at every viewport width. `DetailPanel`'s own header
 * comment explains why `overlay` mode renders no `onClose`/`closeLabel` pair
 * of its own: the `Sheet` already supplies the backdrop, the focus trap,
 * `Escape` and returning focus to whatever opened it (D-15).
 *
 * Before this phase, the "Visão geral" tab swapped its own content for
 * `ActionEditForm` inline — the rest of the page (Ciclo de vida) disappeared
 * along with it. This panel replaces that swap: the page stays fully
 * readable underneath while editing, exactly like Incident's/Problem's own
 * Fase 4/Fase C. `onSaved` is the same shape `ActionEditForm` has always
 * emitted — this component adds no behaviour of its own to it.
 *
 * ## `showCloseButton={false}` — the one decision Incident's/Problem's own
 * panels never had to make
 *
 * `ActionEditForm` is the one edit form in this platform's queue of overlay
 * panels that carries its OWN `Cancelar` button (`onCancel`, a required
 * prop — `IncidentForm`/`ProblemForm` have neither). Left at the `Sheet`'s
 * default, that produces TWO visible, functionally identical "abandon and
 * close" controls on screen at once: the `Sheet`'s own icon-only `X` at the
 * top-right corner (`sheet.tsx`'s `SheetContent`, `showCloseButton: true` by
 * default) and `ActionEditForm`'s own textual "Cancelar" button beside
 * "Salvar alterações" at the bottom. `DetailPanel`'s own header comment
 * already states the platform's rule for exactly this shape of redundancy:
 * "the sheet renders its own close control and a second one inside the
 * header would be a duplicate" — this file applies the SAME rule to the
 * icon-only `X` specifically, because `ActionEditForm`'s own `Cancelar` is
 * the one that cannot be removed (the form is unmodified) and is also the
 * more discoverable, better-labelled control of the two (a real word next
 * to the primary action, not a bare icon in a corner).
 *
 * `showCloseButton={false}` on `SheetContent` below removes ONLY the visible
 * `X` icon — it does not touch `Escape` or a backdrop click, both handled by
 * the underlying Radix `Dialog` primitive independently of that button, and
 * both stay exactly as available as on every other panel in this product.
 * `ActionEditForm`'s own `onCancel` is wired to close the sheet the same way
 * `Escape`/the backdrop already do (`onOpenChange(false)`) — not a second,
 * independent close mechanism, the SAME one, reached through a third,
 * better-labelled door.
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { actions } from '@/lib/messages/actions';

import { ActionEditForm } from '../action-edit-form';

import type { Action } from '../../types';

export interface ActionEditPanelProps {
  action: Action;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Action) => void;
}

export function ActionEditPanel({
  action,
  onOpenChange,
  onSaved,
}: ActionEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        // The panel's own header names the region; a second visible title
        // would repeat it — mirrors `IncidentEditPanel`'s/`ProblemEditPanel`'s
        // identical choice.
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{actions.detail.form.editHeading}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={actions.detail.form.editHeading}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">
                {actions.detail.form.editHeading}
              </h2>
              <p className="text-sm text-muted-foreground">{actions.detail.form.editDescription}</p>
            </>
          }
        >
          <ActionEditForm action={action} onSaved={onSaved} onCancel={() => onOpenChange(false)} />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
