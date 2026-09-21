'use client';

/**
 * PharosGRC — asset detail, "Situação" card (T049, US1, FR-005, FR-006,
 * FR-012; restyled in 022-asset-detail-experience Fase B).
 *
 * Exactly two transitions, both boolean-simple (`isActive` flips), unlike
 * `ControlLifecycleActions`'/`AuditEngagementLifecycleActions`' richer
 * state machines: no server-fetched transition table, no precondition to
 * check client-side, no `ETag` (`assets` carries no `version` column —
 * `features/assets/types.ts`'s own header comment). `POST
 * /assets/{assetId}/deactivate`/`.../reactivate` take no request body.
 *
 * ## No lifecycle track — a deliberate decision, not a gap (Fase B)
 *
 * `isActive` is a two-state switch, not a three/four-state trajectory the
 * way `Control`'s/`Problem`'s own `status` is — drawing a track for two
 * states would invent a percurso where the data models a switch (the
 * coordinator's own explicit instruction for this rodada). This stays a
 * plain badge + sentence + one button, never a stepper, never a node.
 *
 * ## Composed INSIDE "Visão geral" now, second, right after "Descrição"
 * (Fase B; before Fase B it sat in `DetailLayout`'s `children` slot, always
 * visible on every tab)
 *
 * Placed second — ahead of "Detalhes do ativo" — mirroring
 * `ControlOverview`'s own "Efetividade" card placement, not a lifecycle
 * card's usual "always last" position (`ProblemLifecycleSection`'s own
 * placement after "Detalhes do problema"): unlike Control/Problem, `Asset`
 * has no separate track/outcome-facts card competing for the "last" slot —
 * this SAME small card carries both the central fact (is this asset usable
 * right now?) and the one action that changes it, which is structurally
 * closer to Efetividade's "central fact + hint" shape than to a full
 * lifecycle section's. Like `ControlOverview`'s Fase B inline-edit swap,
 * this card disappears along with the rest of "Visão geral" while `editing`
 * is `true` — a narrowing from "always visible on every tab" that every
 * sibling module made at this same phase, and one Fase C's move to an
 * overlay panel removes entirely.
 *
 * The `StatusBadge` below is new in Fase B — added for the SAME reason
 * `ControlOverview`'s Efetividade card carries one despite the header
 * already showing it: a self-contained card reads as substantive on its
 * own, not just from context above it. Measured directly against the
 * rendered card at 1440px (`getBoundingClientRect`, header + content
 * children summed against the card's own total height, not estimated):
 * this card's own (header + badge + sentence + button) fill ratio is
 * **52.9%** (110px of 208px) — in the SAME range as its two sibling
 * overview cards on this same screen (Descrição 41.3%, Detalhes do ativo
 * 51.9%), not the ~90%+-empty full-width card the coordinator measured and
 * flagged in four earlier modules' own first drafts. `StatusBadge` also
 * carries `className="self-start"` — without it, a `flex flex-col` parent
 * stretches it to the card's full width regardless of its own `inline-flex`
 * display (confirmed present, unfixed, in `ControlOverview`'s own
 * "Efetividade" card — recorded as F-80, `docs/deferred-findings.md`,
 * rather than silently inherited here or fixed in a file this rodada does
 * not own).
 *
 * **Deactivation is not deletion (FR-012), and the confirmation says so —
 * not only a toast afterward (CLAUDE.md §18.11).** `assets.lifecycle.
 * deactivate.confirmDescription` states plainly that the asset stays fully
 * readable and stays visible in every link it already has; only new links
 * are refused from this point on. `ConfirmDialog`'s `variant="sensitive"`
 * is used for deactivation — not `"destructive"` — because nothing is
 * lost: the same distinction the design system's own doc comment draws for
 * "deactivating a user" (an immediate, consequential effect that is not
 * itself data-destroying).
 */
import { ConfirmDialog, StatusBadge } from '@pharos/design-system/components';
import { Ban, Power, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';

import { assetsApi } from '../api';
import { assetSituationLabel, assetSituationVariant } from '../situation';

import type { AssetDetail } from '../types';

export interface AssetLifecycleActionsProps {
  asset: AssetDetail;
  /** `asset:administer` — the server's own gate on both transitions (`AssetController`). */
  canAdminister: boolean;
  onChanged: (asset: AssetDetail) => void;
}

type PendingAction = 'deactivate' | 'reactivate' | null;

export function AssetLifecycleActions({
  asset,
  canAdminister,
  onChanged,
}: AssetLifecycleActionsProps): React.JSX.Element | null {
  const lifecycle = assets.lifecycle;
  const [pending, setPending] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!canAdminister) {
    return null;
  }

  function closeDialog(): void {
    if (submitting) return;
    setPending(null);
    setActionError(null);
  }

  async function handleDeactivate(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await assetsApi.deactivateAsset(asset.id);
      feedback.success(lifecycle.deactivate.success);
      closeDialog();
      onChanged(updated);
    } catch {
      setActionError(lifecycle.deactivate.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(): Promise<void> {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await assetsApi.reactivateAsset(asset.id);
      feedback.success(lifecycle.reactivate.success);
      closeDialog();
      onChanged(updated);
    } catch {
      setActionError(lifecycle.reactivate.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Power aria-hidden="true" className="size-4 text-muted-foreground" />
          {lifecycle.cardTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* `self-start`: a flex-column parent stretches a child with no
            intrinsic width to its own full width by default, regardless of
            the child's own `inline-flex` display — `StatusBadge` would
            otherwise render as a full-width bar instead of a compact pill
            (confirmed against this exact `flex flex-col gap-3` shape:
            `ControlOverview`'s own "Efetividade" card carries the identical,
            pre-existing defect — out of this rodada's scope, recorded as
            F-80, `docs/deferred-findings.md`, rather than silently
            inherited here). */}
        <StatusBadge
          variant={assetSituationVariant(asset.isActive)}
          label={assetSituationLabel(asset.isActive)}
          className="self-start"
        />
        <p className="text-sm text-muted-foreground">{lifecycle.cardDescription}</p>
        {asset.isActive ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => setPending('deactivate')}
          >
            <Ban aria-hidden="true" className="size-4" />
            {lifecycle.deactivate.action}
          </Button>
        ) : (
          <Button type="button" className="w-fit" onClick={() => setPending('reactivate')}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {lifecycle.reactivate.action}
          </Button>
        )}
      </CardContent>

      <ConfirmDialog
        open={pending === 'deactivate'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={lifecycle.deactivate.confirmTitle}
        description={
          actionError ? (
            <span role="alert" className="text-status-danger-fg">
              {actionError}
            </span>
          ) : (
            lifecycle.deactivate.confirmDescription
          )
        }
        labels={{
          confirm: submitting
            ? lifecycle.deactivate.confirming
            : lifecycle.deactivate.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="sensitive"
        icon={Ban}
        isConfirming={submitting}
        onConfirm={() => void handleDeactivate()}
      />

      <ConfirmDialog
        open={pending === 'reactivate'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={lifecycle.reactivate.confirmTitle}
        description={
          actionError ? (
            <span role="alert" className="text-status-danger-fg">
              {actionError}
            </span>
          ) : (
            lifecycle.reactivate.confirmDescription
          )
        }
        labels={{
          confirm: submitting
            ? lifecycle.reactivate.confirming
            : lifecycle.reactivate.confirmAction,
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        variant="default"
        icon={RotateCcw}
        isConfirming={submitting}
        onConfirm={() => void handleReactivate()}
      />
    </Card>
  );
}
