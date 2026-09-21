'use client';

/**
 * PharosGRC — Administration, activate/deactivate an organizational unit
 * (T183, FR-060). An active descendant blocks deactivation — the server's
 * 422 is surfaced intelligibly rather than as a generic failure.
 */
import { ConfirmDialog } from '@pharos/design-system/components';
import { Power, ShieldOff } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';

import { adminApi } from '../../api';

import type { OrgUnitNode } from '../../types';

export interface OrgUnitStatusDialogProps {
  unit: OrgUnitNode | null;
  onOpenChange: (open: boolean) => void;
  onChanged: (unit: OrgUnitNode) => void;
  onError: (message: string) => void;
}

export function OrgUnitStatusDialog({
  unit,
  onOpenChange,
  onChanged,
  onError,
}: OrgUnitStatusDialogProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const activating = unit?.status === 'INACTIVE';

  async function handleConfirm(): Promise<void> {
    if (!unit) return;
    setSubmitting(true);
    try {
      const updated = await adminApi.setOrgUnitStatus(unit.id, {
        status: activating ? 'ACTIVE' : 'INACTIVE',
      });
      onChanged(updated);
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 422) {
        onError(admin.organization.statusDialog.blockedByActiveDescendantError);
      } else {
        onError(admin.organization.form.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={unit !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      title={
        unit
          ? activating
            ? admin.organization.statusDialog.activateTitle(unit.name)
            : admin.organization.statusDialog.deactivateTitle(unit.name)
          : ''
      }
      description={
        activating
          ? admin.organization.statusDialog.activateDescription
          : admin.organization.statusDialog.deactivateDescription
      }
      variant={activating ? 'default' : 'sensitive'}
      icon={activating ? Power : ShieldOff}
      isConfirming={submitting}
      onConfirm={() => void handleConfirm()}
      labels={{
        confirm: activating
          ? admin.organization.statusDialog.confirmActivate
          : admin.organization.statusDialog.confirmDeactivate,
        cancel: common.confirmDialog.cancel,
        close: common.confirmDialog.close,
      }}
    />
  );
}
