'use client';

/**
 * PharosGRC — control detail, lifecycle action bar (T047, US1, D-6).
 *
 * Renders exactly what `GET /controls/{controlId}/lifecycle` returns —
 * this component contains no transition table and no precondition logic
 * of its own (same discipline as `RiskLifecycleActions`, ADR-006 applied
 * here to Controls). Unlike Risk, there is no approval-gated transition in
 * this domain: every transition here is either applied directly
 * (`control:edit`) or is the terminal retirement (`control:administer`) —
 * `POST /controls/{controlId}/transitions` re-evaluates the same
 * declarative table server-side regardless.
 *
 * Retirement into `RETIRED` requires `justification` (US1 AS3) — the
 * dialog marks that field required only when the target is `RETIRED`,
 * honestly reflecting the contract rather than always demanding it.
 *
 * ## No longer its own card, no longer its own fetch
 * (021-control-detail-experience, Fase B)
 *
 * Before this phase, this component owned BOTH a `GET .../lifecycle` fetch
 * and a page-level `Card` — the entire "Ciclo de vida" surface, mounted
 * above the tabs. `ControlLifecycleSection` (`components/detail/`) now owns
 * both: the fetch (`useControlLifecycle`, lifted to `ControlDetailView`'s
 * own level, since the "Ciclo de vida" card's track visual needs the same
 * `ControlLifecycleState`) and the card casing, alongside the track
 * (`ControlLifecycleTrackView`) and the control's conditional outcome facts
 * (`retiredAt`/`retiredBy`/`retirementReason`). This component is now a
 * PLAIN button row — `availableTransitions` arrives as a prop instead of
 * being fetched here, and the "Nenhuma transição disponível" sentence is
 * preserved (unlike Problem's/Incident's/Action's own equivalent, which
 * retired that sentence as redundant with their track) because the
 * coordinator's own instruction for this phase was explicit that the
 * per-transition "Pendências para esta transição" text is real information
 * this module has that the others do not, and nothing about this
 * component's actual rendered behaviour — which buttons appear, which
 * pendencies show, when the dialog opens — changes in this phase, only
 * where the data it renders comes from.
 *
 * The illegal-transition guarantee is UNCHANGED: a transition absent from
 * `availableTransitions` is never offered, not even disabled — the same
 * omission-not-disabling discipline this component always had, now proven
 * against a prop instead of an internal fetch result
 * (`control-lifecycle-actions.test.tsx`).
 */
import { FormField } from '@pharos/design-system/components';
import { ArrowRightCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { common } from '@/lib/messages/common';
import { controls } from '@/lib/messages/controls';

import { controlsApi } from '../api';
import { controlStatusLabel } from '../status';

import type { AvailableControlTransition } from '../types';

export interface ControlLifecycleActionsProps {
  controlId: string;
  /** The control's current `ETag` — required by `POST .../transitions`. */
  etag: string;
  /** `ControlLifecycleState.availableTransitions`, fetched once at the page level (`useControlLifecycle`, `components/detail/`) — see this file's own header comment for why the fetch moved out of this component. */
  availableTransitions: readonly AvailableControlTransition[];
  /** Called after a successful transition. The caller re-reads both the whole control AND the lifecycle (`useControlLifecycle`'s own `reload`), mirroring `RiskLifecycleActions`'/`ControlLifecycleSection`'s own `onChanged`. */
  onChanged: () => void;
}

function TransitionConfirmDialog({
  open,
  onOpenChange,
  controlId,
  etag,
  transition,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
  etag: string;
  transition: AvailableControlTransition | null;
  onApplied: () => void;
}): React.JSX.Element {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleOpenChange(next: boolean): void {
    if (submitting) return;
    if (!next) {
      setJustification('');
      setError(null);
      setValidationError(null);
    }
    onOpenChange(next);
  }

  const isRetirement = transition?.toStatus === 'RETIRED';
  const targetLabel = transition ? controlStatusLabel(transition.toStatus) : '';

  async function handleConfirm(): Promise<void> {
    if (!transition) return;
    if (isRetirement && !justification.trim()) {
      setValidationError(controls.lifecycle.transitionDialog.justificationRequiredForRetirement);
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    setError(null);
    try {
      await controlsApi.transitionControl(
        controlId,
        {
          toStatus: transition.toStatus,
          justification: justification.trim() ? justification.trim() : undefined,
        },
        etag,
      );
      feedback.success(controls.lifecycle.transitionDialog.submitSuccess(targetLabel));
      handleOpenChange(false);
      onApplied();
    } catch (submitError) {
      const fallback =
        submitError instanceof ApiError && submitError.problem.status === 409
          ? controls.lifecycle.transitionDialog.conflictError
          : controls.lifecycle.transitionDialog.genericError;
      setError(
        submitError instanceof ApiError ? (submitError.problem.detail ?? fallback) : fallback,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{controls.lifecycle.transitionDialog.title(targetLabel)}</DialogTitle>
          <DialogDescription>
            {controls.lifecycle.transitionDialog.description(targetLabel)}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {error}
          </p>
        ) : null}

        <FormField
          label={controls.lifecycle.transitionDialog.justificationLabel}
          required={isRetirement}
          optionalIndicator={isRetirement ? undefined : common.formField.optionalIndicator}
          description={
            isRetirement
              ? controls.lifecycle.transitionDialog.justificationDescriptionRetirement
              : controls.lifecycle.transitionDialog.justificationDescriptionDefault
          }
          error={validationError ?? undefined}
        >
          {(field) => (
            <Textarea
              {...field}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              disabled={submitting}
            />
          )}
        </FormField>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {controls.lifecycle.transitionDialog.cancelAction}
          </Button>
          <Button
            type="button"
            variant={isRetirement ? 'destructive' : 'default'}
            disabled={submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {submitting
              ? controls.lifecycle.transitionDialog.confirmingAction
              : controls.lifecycle.transitionDialog.confirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ControlLifecycleActions({
  controlId,
  etag,
  availableTransitions,
  onChanged,
}: ControlLifecycleActionsProps): React.JSX.Element {
  const [pendingTransition, setPendingTransition] = useState<AvailableControlTransition | null>(
    null,
  );

  return (
    <>
      {availableTransitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{controls.lifecycle.noneAvailable}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {availableTransitions.map((transition) => (
            <div key={transition.toStatus} className="flex flex-col gap-1">
              <Button
                type="button"
                variant={transition.toStatus === 'RETIRED' ? 'destructive' : 'default'}
                disabled={!transition.preconditionsMet}
                className="w-fit"
                onClick={() => setPendingTransition(transition)}
              >
                <ArrowRightCircle aria-hidden="true" className="size-4" />
                {controls.lifecycle.actions.apply(controlStatusLabel(transition.toStatus))}
              </Button>
              {!transition.preconditionsMet &&
              transition.unmetPreconditions &&
              transition.unmetPreconditions.length > 0 ? (
                <div className="pl-1 text-sm text-status-warning-fg">
                  <p className="font-medium">{controls.lifecycle.unmetPreconditionsTitle}</p>
                  <ul className="list-disc pl-5">
                    {transition.unmetPreconditions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <TransitionConfirmDialog
        open={pendingTransition !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTransition(null);
        }}
        controlId={controlId}
        etag={etag}
        transition={pendingTransition}
        onApplied={() => {
          setPendingTransition(null);
          onChanged();
        }}
      />
    </>
  );
}
