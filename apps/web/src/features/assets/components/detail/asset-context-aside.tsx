'use client';

/**
 * PharosGRC — asset detail, the contextual aside (022-asset-detail-experience,
 * Fase C). Only `DetailLayout`'s `aside` slot — "Relacionamentos" and "Última
 * atualização", fed entirely by data the page already loaded (`AssetDetail`),
 * never a request of its own. Mirrors `ControlContextAside`'s own shape
 * (CLAUDE.md §18.12), with two deliberate differences.
 *
 * ## No "Ações rápidas" — by construction, not an oversight
 *
 * `ControlContextAside`/`RiskRelationshipsAside` each offer verbs this
 * screen genuinely does not: create/link a relationship, register a
 * verification, add evidence, comment. `Asset`'s own three relationship
 * tabs are READ-ONLY BY DESIGN (FR-008 — a link is created and withdrawn
 * only from the Risk/Control/Incident module's own contract, never from
 * here; `asset-linked-entities-section.tsx`'s own header comment) — there is
 * no "vincular" verb this screen could shortcut to. The two things a caller
 * CAN do here — "Editar" and change "Situação" — are already the header's
 * own button and a card on the SAME tab the screen lands on by default,
 * so a quick-action shortcut to either would be pure duplication, not a
 * shortcut. This aside therefore has no `quickActions` candidate list at
 * all (unlike Control's/Risk's, which build one and filter it by
 * permission) — omitted by construction, the same honest-absence
 * discipline `ControlContextAside` already applies to `asideLead`.
 *
 * ## The "assimetria honesta" (Riscos/Controles get a real number,
 * Incidentes gets "Ver") — the coordinator's own explicit instruction
 *
 * Unlike Control (whose "Vínculos" carries no count for ANY of its three
 * sub-relationships, ADR-020 part 4 aside), `AssetDetail` embeds `risks`
 * and `controls` as REAL, already-loaded arrays (active links, read from
 * the asset's own side) — their `.length` is the honest count. `Incidentes`
 * is NOT embedded (`GET /assets/{assetId}/incidents` is a separate, own
 * request `AssetLinkedIncidentsSection` issues only once that tab mounts),
 * so this aside shows "Ver" for it, never a fabricated number and never a
 * second request just to produce one (F-59). Mirrors
 * `RiskRelationshipsAside`'s own identical split: `controls(count)`/
 * `processesAssets(count)` get real numbers because `RiskDetail` embeds
 * them; `incidents`/`problems` get "Ver" because it does not.
 */
import { DisclosureGroup } from '@pharos/design-system/components';
import { ChevronRight } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { assets } from '@/lib/messages/assets';
import { cn } from '@/lib/utils';

import { formatTimestamp } from '../../date';

import type { AssetDetail } from '../../types';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/** A collapsible-below-`xl` aside block — local copy of `ControlContextAside`'s/`ProblemContextAside`'s own mechanism, see this file's header comment for why it is not shared (CLAUDE.md §19.10 — a fourth independently-authored copy of eleven lines of layout branching does not yet earn promotion). */
function AsideBlock({ id, title, children }: AsideBlockProps): React.JSX.Element {
  const isWide = useWideViewport();

  if (isWide) {
    return (
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2">
        <h2 id={`${id}-heading`} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {children}
      </section>
    );
  }

  return (
    <DisclosureGroup title={title} headingLevel={2}>
      <div className="flex flex-col gap-2">{children}</div>
    </DisclosureGroup>
  );
}

interface RelationshipRow {
  key: string;
  label: string;
  targetSection: string;
  /** Set only for a relationship whose count is not on this page's own payload — a trailing hint distinguishing "not loaded yet" from an actual zero, never a fabricated number. Mirrors `RiskRelationshipsAside`'s own `RelationshipRow.hint`. */
  hint?: string;
}

/** The SAME `?section=<id>` deep link this screen's own flat `EntityTabs` reads — built directly rather than routed through `useDetailSection`, since a `Link`'s `href` must be a plain string known at render time, not a commit function. */
function assetSectionHref(assetId: string, sectionId: string): string {
  return `/assets/${assetId}?section=${sectionId}`;
}

export interface AssetContextAsideProps {
  asset: AssetDetail;
  activeSectionId: string;
}

export function AssetContextAside({
  asset,
  activeSectionId,
}: AssetContextAsideProps): React.JSX.Element {
  const messages = assets.detail;
  const panel = messages.relationshipsPanel;

  const relationshipRows: RelationshipRow[] = [
    {
      key: 'risks',
      label: panel.risks(asset.risks.length),
      targetSection: 'risks',
    },
    {
      key: 'controls',
      label: panel.controls(asset.controls.length),
      targetSection: 'controls',
    },
    {
      key: 'incidents',
      label: panel.incidents,
      targetSection: 'incidents',
      hint: panel.viewHint,
    },
  ];

  return (
    <>
      <AsideBlock id="asset-relationships" title={panel.heading}>
        <ul className="flex flex-col gap-1">
          {relationshipRows.map((row) => {
            const isActive = row.targetSection === activeSectionId;
            return (
              <li key={row.key}>
                <Link
                  href={assetSectionHref(asset.id, row.targetSection)}
                  aria-current={isActive ? 'true' : undefined}
                  // Explicit, rather than relying on "name from content" —
                  // JSX inserts no whitespace text node between two elements
                  // split across lines, so the label span and the hint span
                  // would otherwise concatenate with NO separator
                  // ("Incidentes" + "Ver" = "IncidentesVer") — the exact
                  // accessible-name defect `RiskRelationshipsAside`'s own
                  // header comment already documents and fixes the same way.
                  aria-label={row.hint ? `${row.label} ${row.hint}` : row.label}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive ? 'bg-muted font-semibold text-foreground' : 'text-foreground/90',
                  )}
                >
                  <span aria-hidden="true" className="min-w-0 flex-1 truncate">
                    {row.label}
                  </span>
                  {row.hint ? (
                    <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
                      {row.hint}
                    </span>
                  ) : null}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </AsideBlock>

      {/* No `if (asset.updatedAt)` guard, unlike `ControlContextAside`'s own
          block: `AssetDetail.updatedAt` is a REQUIRED string (`types.ts`),
          never nullable/absent, so the guard those siblings need for their
          own optional field would be dead code here — an honest omission
          of a check that could never be false, not a missed one. */}
      <AsideBlock id="asset-last-updated" title={messages.lastUpdatedHeading}>
        <p className="text-sm text-foreground">{formatTimestamp(asset.updatedAt)}</p>
      </AsideBlock>
    </>
  );
}
