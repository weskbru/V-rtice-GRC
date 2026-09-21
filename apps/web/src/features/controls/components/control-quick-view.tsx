'use client';

/**
 * PharosGRC — control catalog quick view (CLAUDE.md §18, §18.12 — reusing
 * the risk register's quick-view pattern: a read-only, non-modal reading
 * panel beside the catalog, never a second editing surface).
 *
 * Simpler than `RiskQuickView` by necessity — Controls has no equivalent of
 * the risk matrix or lifecycle-approval history to preview — but the same
 * shape: instant header from the already-loaded `ControlSummary` row, detail
 * fetched in the background, one way forward ("Abrir controle completo"),
 * and focus returned to the originating card on close (handled by the
 * caller, `ControlCatalogView`, exactly like `RiskRegisterView`).
 */
import { ReadOnlyField, StatusBadge } from '@pharos/design-system/components';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { controls } from '@/lib/messages/controls';
import { cn } from '@/lib/utils';

import { controlsApi } from '../api';
import { formatTimestampDate } from '../date';
import {
  controlEffectivenessBadgeVariant,
  controlEffectivenessIcon,
  controlEffectivenessLabel,
  controlStatusBadgeVariant,
  controlStatusIcon,
  controlStatusLabel,
} from '../status';

import type { ControlDetail, ControlSummary } from '../types';

export interface ControlQuickViewProps {
  controlId: string;
  /** The already-loaded catalog row, used to paint the header instantly while the detail request is in flight. */
  summary: ControlSummary | null;
  onClose: () => void;
  className?: string;
}

export function ControlQuickView({
  controlId,
  summary,
  onClose,
  className,
}: ControlQuickViewProps): React.JSX.Element {
  const [detail, setDetail] = useState<ControlDetail | null>(null);
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    controlsApi
      .getControl(controlId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result.control);
        setDetailError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDetailError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [controlId]);

  const code = detail?.code ?? summary?.code ?? '';
  const name = detail?.name ?? summary?.name ?? '';
  const status = detail?.status ?? summary?.status;
  const effectiveness = detail?.effectiveness ?? summary?.effectiveness;
  const orgUnitName = detail?.orgUnit?.name ?? summary?.orgUnit?.name;
  const ownerName = detail?.owner?.fullName ?? summary?.owner?.fullName;

  return (
    <section
      aria-label={controls.register.quickView.title}
      className={cn('flex flex-col gap-4 rounded-lg border border-border bg-card p-4', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">{code}</span>
          <h2 className="line-clamp-2 text-base font-semibold text-foreground">{name}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={controls.register.quickView.closeLabel}
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {status ? (
          <StatusBadge
            variant={controlStatusBadgeVariant(status)}
            label={controlStatusLabel(status)}
            icon={controlStatusIcon(status)}
          />
        ) : null}
        {effectiveness ? (
          <StatusBadge
            variant={controlEffectivenessBadgeVariant(effectiveness)}
            label={controlEffectivenessLabel(effectiveness)}
            icon={controlEffectivenessIcon(effectiveness)}
          />
        ) : null}
      </div>

      {detailError ? (
        <p role="alert" className="text-sm font-medium text-status-danger-fg">
          {controls.register.quickView.loadError}
        </p>
      ) : !detail ? (
        <p className="text-sm text-muted-foreground">{controls.register.quickView.loading}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          <ReadOnlyField
            label={controls.register.card.orgUnitLabel}
            value={orgUnitName ?? controls.register.columns.notSet}
          />
          <ReadOnlyField
            label={controls.register.card.ownerLabel}
            value={ownerName ?? controls.register.card.noOwner}
          />
          <ReadOnlyField
            full
            label={controls.register.quickView.descriptionTitle}
            value={detail.description || controls.register.quickView.noDescription}
          />
          <ReadOnlyField
            label={controls.register.quickView.updatedAtLabel}
            value={formatTimestampDate(detail.updatedAt)}
            muted
          />
        </dl>
      )}

      <Button asChild>
        <Link href={`/controls/${controlId}`}>{controls.register.quickView.openControl}</Link>
      </Button>
    </section>
  );
}
