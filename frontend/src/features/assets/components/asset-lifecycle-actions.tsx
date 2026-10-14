'use client';

import { Ban, Power, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { assets } from '@/lib/messages/assets';
import { common } from '@/lib/messages/common';
import { ConfirmDialog, StatusBadge } from '@vertice/design-system/components';

import { assetsApi } from '../api';
import { assetSituationLabel, assetSituationVariant } from '../situation';

import type { AssetDetail } from '../types';

export interface AssetLifecycleActionsProps {
  asset: AssetDetail;
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
