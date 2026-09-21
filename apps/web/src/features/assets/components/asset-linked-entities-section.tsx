'use client';

/**
 * PharosGRC — asset detail, linked risks/controls/incidents tabs (T047,
 * FR-008, ADR-020 part 4; incidents added by
 * 013-incidents-problems-reverse-links).
 *
 * Unlike `ControlLinksSection`'s `RelationshipSubsection` (which issues its
 * own `GET .../risks|processes|assets` calls), `AssetDetail.risks`/
 * `.controls` arrive ALREADY embedded in the single `GET /assets/{assetId}`
 * response this screen already fetched (`features/assets/types.ts`'s own
 * `AssetDetail` — no separate endpoint exists to fail independently of that
 * one load). There is therefore genuinely only one load-failure state to
 * show here — the detail view's own top-level `ErrorState` already covers
 * it — so `AssetLinkedRisksSection`/`AssetLinkedControlsSection` own no
 * network call and no error state of their own, only the empty state each
 * tab's own message key already names
 * (`assets.linkedRisks.empty`/`assets.linkedControls.empty`).
 *
 * `AssetLinkedIncidentsSection` below is the one exception in this file:
 * `IncidentAssetLink` is READ-ONLY reverse of a table `modules/incidents`
 * owns (`GET /assets/{assetId}/incidents`), never embedded in `AssetDetail`
 * — so it self-fetches and owns its own loading/error state, mirroring
 * `features/incidents/components/incident-problem-links-section.tsx`'s own
 * `IncidentProblemLinksSection` for the data-fetching shape, while keeping
 * THIS screen's own plain, card-less visual family (Link + Table, no
 * `Card` wrapper) rather than importing that other component's `Card`
 * (CLAUDE.md §18.12 — follow the screen's own established pattern).
 *
 * Read-only by design (FR-008): the link is created and withdrawn
 * exclusively from the Risk/Control/Incident module's own contract, never
 * from here — no link/unlink affordance appears on this screen.
 *
 * ## Fase D — no progressive-disclosure trigger to add, by design
 *
 * `022-asset-detail-experience`'s own Fase D asked every linked-entity
 * section to check for a permanently-open picker/form and move it behind an
 * intent button. There is none here to move: all three tabs are READ-ONLY
 * BY DESIGN (FR-008, restated above) — no picker, no "Vincular" button, no
 * write affordance of any kind ever existed on this screen, unlike
 * `ControlLinksSection`'s own Processos/Ativos subsections (which DO own a
 * picker and needed exactly this Fase D correction). Adding one here would
 * be new functionality this rodada is not authorized to introduce (CLAUDE.md
 * §2, §14) — a UX/UI rodada over EXISTING functionality, not a mandate to
 * invent a write path this contract does not have.
 *
 * ## Fase D — volume-safe tables
 *
 * `sm:table-fixed` (never unprefixed) with percentage `TableHead` widths and
 * `whitespace-normal break-words` on the code/name/title cells — the SAME
 * fix `control-links-section.tsx`'s own Fase D applied, for the identical
 * reason `problem-relationships-section.tsx`'s own C1 review first measured:
 * `table-fixed` at every width squeezes columns onto ~130px each at 390,
 * overlapping cell text and breaking titles mid-word. Below `sm` the table
 * reverts to the browser's default `table-layout: auto`, scrolling
 * horizontally within the existing `overflow-x-auto` wrapper — honest
 * scroll, never overlapping text. Measured against real, API-provisioned
 * links (three risks, three controls, two incidents added to one real
 * asset, created and withdrawn through each module's own contract — never
 * against this screen, which has no write path of its own): at 1440/1024
 * every table's own scroll container reports `scrollWidth - clientWidth ===
 * 0`, and at 390 no cell's own content box crosses its `<td>`'s right edge
 * (measured directly per element, not just the table's own overall
 * overflow, which the coordinator's own review already found insufficient
 * once in Incidentes/Problemas — a table can pass a zero-overflow check
 * while a header or a title still visually collides).
 *
 * A SEPARATE, deliberately unrealistic stress test (rendering evidence
 * only, via a network-intercepted single 105-character unbroken string —
 * never a claim any real title looks like this) confirms the fallback
 * itself: below `sm`, an unbreakable string this long DOES grow the
 * table's own scroll container (`containerOverflow` 382–489px), but the
 * PAGE never gains horizontal scroll (`pageOverflow === 0`, every section)
 * and `leakCount` stays `0` — the table scrolls honestly within its own
 * wrapper instead of any cell's content spilling into its neighbour. Every
 * real pt-BR title/name contains spaces, so this branch is a safety net,
 * not an expected production shape.
 */
import { StatusBadge } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { assets } from '@/lib/messages/assets';

import { assetsApi } from '../api';

import type { AssetIncidentLink, ControlRef, IncidentStatusRef, RiskRef } from '../types';
import type { StatusVariant } from '@pharos/design-system/components';

const INCIDENT_STATUS_VARIANT: Record<IncidentStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export interface AssetLinkedRisksSectionProps {
  risks: readonly RiskRef[];
}

export function AssetLinkedRisksSection({
  risks,
}: AssetLinkedRisksSectionProps): React.JSX.Element {
  const messages = assets.linkedRisks;

  if (risks.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="sm:table-fixed">
        <TableCaption className="sr-only">{assets.detail.sections.risks}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">{messages.columns.code}</TableHead>
            <TableHead className="w-[70%]">{messages.columns.title}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((risk) => (
            <TableRow key={risk.id}>
              <TableCell className="whitespace-normal break-words">
                <Link
                  href={`/risks/${risk.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {risk.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal break-words text-foreground">
                {risk.title}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}

export interface AssetLinkedControlsSectionProps {
  controls: readonly ControlRef[];
}

export function AssetLinkedControlsSection({
  controls,
}: AssetLinkedControlsSectionProps): React.JSX.Element {
  const messages = assets.linkedControls;

  if (controls.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="sm:table-fixed">
        <TableCaption className="sr-only">{assets.detail.sections.controls}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">{messages.columns.code}</TableHead>
            <TableHead className="w-[70%]">{messages.columns.name}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.map((control) => (
            <TableRow key={control.id}>
              <TableCell className="whitespace-normal break-words">
                <Link
                  href={`/controls/${control.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {control.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal break-words text-foreground">
                {control.name}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}

export interface AssetLinkedIncidentsSectionProps {
  assetId: string;
}

export function AssetLinkedIncidentsSection({
  assetId,
}: AssetLinkedIncidentsSectionProps): React.JSX.Element {
  const messages = assets.linkedIncidents;
  const [links, setLinks] = useState<readonly AssetIncidentLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedAssetId, setResolvedAssetId] = useState<string | null>(null);
  const loading = resolvedAssetId !== assetId;

  useEffect(() => {
    let cancelled = false;
    assetsApi
      .listIncidentLinks(assetId, false)
      .then((result) => {
        if (!cancelled) {
          setLinks(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedAssetId(assetId);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{messages.loading}</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm font-medium text-status-danger-fg">
        {messages.loadError}
      </p>
    );
  }

  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">{messages.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className="sm:table-fixed">
        <TableCaption className="sr-only">{assets.detail.sections.incidents}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%]">{messages.columns.code}</TableHead>
            <TableHead className="w-[53%]">{messages.columns.title}</TableHead>
            <TableHead className="w-[25%]">{messages.columns.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <TableRow key={link.id}>
              <TableCell className="whitespace-normal break-words">
                <Link
                  href={`/incidents/${link.incident.id}`}
                  className="font-medium text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.incident.code}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal break-words text-foreground">
                {link.incident.title}
              </TableCell>
              <TableCell className="whitespace-normal">
                <StatusBadge
                  variant={INCIDENT_STATUS_VARIANT[link.incident.status]}
                  label={messages.statusLabels[link.incident.status]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">{messages.sectionDescription}</p>
    </div>
  );
}
