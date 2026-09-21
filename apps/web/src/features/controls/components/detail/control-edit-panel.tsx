'use client';

/**
 * PharosGRC — control detail, "Editar" panel (021-control-detail-experience,
 * Fase C, corrected in the same rodada per F-79 below). Mirrors
 * `ProblemEditPanel`'s/`ActionEditPanel`'s own shape exactly: `ControlForm`
 * (`mode="edit"`) inside this platform's `Sheet`, composing `DetailPanel
 * mode="overlay"`. There is no "inline, beside a list" mode here either: a
 * control's detail page has no list next to it to sit beside, so editing is
 * ALWAYS an overlay, at every viewport width. `DetailPanel`'s own header
 * comment explains why `overlay` mode renders no `onClose`/`closeLabel` pair
 * of its own: the `Sheet` already supplies the backdrop, the focus trap,
 * `Escape` and returning focus to whatever opened it (D-15) — here, the
 * header's own "Editar" button.
 *
 * Before this phase, "Visão geral" swapped its own content for `ControlForm`
 * inline — the rest of the page (Ciclo de vida) disappeared along with it.
 * This panel replaces that swap: the page stays fully readable underneath
 * while editing. `onSaved` is the same shape `ControlForm` has always
 * emitted — this component adds no behaviour of its own to it. `ControlForm`
 * itself gained exactly one new, OPTIONAL prop for this panel to use
 * (`onCancel`, see below) — every other part of it is unchanged.
 *
 * ## `ControlForm`'s own "Cancelar" — wired to the SAME close the `X`/
 * `Escape` already use (corrected 2026-09-18, F-79)
 *
 * `ControlForm` DOES render its own "Cancelar" button — this file's own
 * earlier claim that it did not was wrong, caught by the coordinator's own
 * rendered measurement (`docs/deferred-findings.md`, F-79): before this
 * correction, "Cancelar" called `ControlForm`'s default `navigate.back()`
 * (real browser history navigation), which — unlike the `Sheet`'s own `X`
 * and `Escape`, both correct — took the caller off `/controls/{id}`
 * entirely instead of merely closing the overlay. `navigate.back()` was
 * the RIGHT behaviour in `ControlForm`'s two original contexts
 * (`/controls/new`, the now-removed inline swap, where a real navigation
 * got you there) and the WRONG one inside this overlay, which is not a
 * navigation at all.
 *
 * The fix is the smallest one that closes the gap without touching
 * `ControlForm`'s default behaviour for its other caller: `ControlForm`
 * gained an OPTIONAL `onCancel` prop (mirrors `ActionEditForm`'s own
 * `onCancel: () => void` contract exactly — not invented here, aligning the
 * one sibling that had not yet needed it), and this panel passes
 * `() => onOpenChange(false)` — the EXACT SAME function the `Sheet`'s own
 * dismissal (`Escape`, backdrop click) already calls via `onOpenChange`,
 * not a second, independently-written close mechanism. `/controls/new`
 * passes no `onCancel` at all and keeps its own `navigate.back()`,
 * byte-for-byte unchanged.
 *
 * The `Sheet`'s default `X` stays ON even after this fix — deliberately
 * NOT `ActionEditPanel`'s `showCloseButton={false}` (turned off there
 * because `ActionEditForm`'s own footer, four fields, sits inside the
 * initial viewport at every supported width, making the `X` genuinely
 * redundant). `ControlForm`'s own footer does not: measured directly at
 * 1440×900 with the panel open, `Salvar alterações`/`Cancelar` are BOTH
 * outside the viewport (`inView: false`) while the `X` alone is
 * (`inView: true`) — this panel's own earlier header comment already
 * documented that measurement for 1440/390 (no scrolling needed to REACH
 * the `X`). Making `Cancelar` correct does not make it reachable without
 * scrolling; the `X` remains the one affordance guaranteed visible the
 * instant the panel opens, at any viewport this screen supports. All three
 * — `X`, `Escape`, and now `Cancelar` — converge on the same
 * `onOpenChange(false)`, never a second, independently-written mechanism.
 *
 * ## Close affordance stays reachable without scrolling (measured, not
 * assumed)
 *
 * `ControlForm` (682 lines) is substantially taller than `ProblemForm`
 * (356) or `ActionEditForm` (182) — the coordinator's own explicit concern
 * for this phase. `DetailPanel`'s structure already answers it
 * structurally, not by chance: the `Sheet`'s own `X` sits in `SheetContent`
 * (`fixed`, `h-full`), positioned `absolute top-4 right-4` against that
 * FIXED container — never inside `DetailPanel`'s own scrolling body
 * (`overflow-y-auto`, `detail-panel.tsx`'s own `detail-panel-body`). A
 * taller form makes the BODY scroll internally; it cannot push the `X` out
 * of the viewport, at any content height, at any viewport width. Confirmed
 * by rendered measurement at 1440 and 390 during this phase — the close
 * button is visible in the initial viewport with zero scrolling at both —
 * not assumed from the structural argument alone.
 */
import { DetailPanel } from '@pharos/design-system/components';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { controls } from '@/lib/messages/controls';

import { ControlForm } from '../control-form';

import type { ControlDetail } from '../../types';

export interface ControlEditPanelProps {
  control: ControlDetail;
  etag: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: { control: ControlDetail; etag: string }) => void;
}

export function ControlEditPanel({
  control,
  etag,
  onOpenChange,
  onSaved,
}: ControlEditPanelProps): React.JSX.Element {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The panel's own header names the region; a second visible title
        // would repeat it — mirrors `ProblemEditPanel`'s/`ActionEditPanel`'s
        // identical choice.
        aria-describedby={undefined}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">{controls.form.editTitle}</SheetTitle>
        <DetailPanel
          mode="overlay"
          ariaLabel={controls.form.editTitle}
          header={
            <>
              <h2 className="text-base font-semibold text-foreground">{controls.form.editTitle}</h2>
              <p className="text-sm text-muted-foreground">{controls.form.editDescription}</p>
            </>
          }
        >
          <ControlForm
            mode="edit"
            control={control}
            etag={etag}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        </DetailPanel>
      </SheetContent>
    </Sheet>
  );
}
