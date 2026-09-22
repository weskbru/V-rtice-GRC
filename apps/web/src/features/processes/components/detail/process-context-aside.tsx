'use client';

/**
 * PharosGRC — process detail, the contextual aside. Only `DetailLayout`'s
 * `aside` slot — "Relacionamentos" and "Última atualização", fed entirely by
 * data the page already loaded (`ProcessDetail`), never a request of its
 * own. Mirrors `AssetContextAside`'s own shape exactly (CLAUDE.md §18.12) —
 * `Process`'s three relationship tabs ("Riscos vinculados"/"Controles
 * vinculados"/"Incidentes vinculados") are the identical shape Asset's own
 * "Riscos"/"Controles"/"Incidentes" tabs already summarize.
 *
 * ## No "Ações rápidas" — by construction, not an oversight
 *
 * Mirrors `AssetContextAside`'s own reasoning verbatim: Process's three
 * relationship tabs are READ-ONLY BY DESIGN (FR-008 — a link is created and
 * withdrawn only from the Risk/Control/Incident module's own contract,
 * never from here; `process-linked-entities-section.tsx`'s own header
 * comment). There is no "vincular" verb this screen could shortcut to, and
 * "Editar" is already the header's own button. No `quickActions` candidate
 * list exists here at all.
 *
 * ## The honest asymmetry (Riscos/Controles get a real number, Incidentes
 * gets "Ver") — identical to `AssetContextAside`'s own split
 *
 * `ProcessDetail` embeds `risks` and `controls` as REAL, already-loaded
 * arrays (active links, from the process's own side) — their `.length` is
 * the honest count. `Incidentes` is NOT embedded (`GET /processes/
 * {processId}/incidents` is a separate, own request
 * `ProcessLinkedIncidentsSection` issues only once that tab mounts), so
 * this aside shows "Ver" for it, never a fabricated number and never a
 * second request just to produce one (F-59).
 *
 * ## Local `AsideBlock`, not the shared one from Risk/Incident/Problem/
 * Control/Asset
 *
 * Copies the same eleven-line layout-branching mechanism every sibling
 * aside already carries its own copy of, using the ALREADY-SHARED
 * `useWideViewport`. NOT promoted to shared infrastructure itself —
 * CLAUDE.md §19.10 only credits a promotion once exercised by a genuine
 * second consumer of a NEW abstraction, and a sixth independently-authored
 * copy of the same eleven lines does not change that calculus by itself.
 */
import { DisclosureGroup } from '@pharos/design-system/components';
import { ChevronRight } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { processes } from '@/lib/messages/processes';
import { cn } from '@/lib/utils';

import { formatTimestamp } from '../../date';

import type { ProcessDetail } from '../../types';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/** A collapsible-below-`xl` aside block — local copy of `AssetContextAside`'s/`ControlContextAside`'s own mechanism, see this file's header comment for why it is not shared. */
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
  /** Set only for a relationship whose count is not on this page's own payload — a trailing hint distinguishing "not loaded yet" from an actual zero, never a fabricated number. Mirrors `AssetContextAside`'s own `RelationshipRow.hint`. */
  hint?: string;
}

/** The SAME `?section=<id>` deep link this screen's own flat `EntityTabs` reads — built directly rather than routed through `useDetailSection`, since a `Link`'s `href` must be a plain string known at render time, not a commit function. */
function processSectionHref(processId: string, sectionId: string): string {
  return `/processes/${processId}?section=${sectionId}`;
}

export interface ProcessContextAsideProps {
  process: ProcessDetail;
  activeSectionId: string;
}

export function ProcessContextAside({
  process,
  activeSectionId,
}: ProcessContextAsideProps): React.JSX.Element {
  const messages = processes.detail;
  const panel = messages.relationshipsPanel;

  const relationshipRows: RelationshipRow[] = [
    {
      key: 'risks',
      label: panel.risks(process.risks.length),
      targetSection: 'risks',
    },
    {
      key: 'controls',
      label: panel.controls(process.controls.length),
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
      <AsideBlock id="process-relationships" title={panel.heading}>
        <ul className="flex flex-col gap-1">
          {relationshipRows.map((row) => {
            const isActive = row.targetSection === activeSectionId;
            return (
              <li key={row.key}>
                <Link
                  href={processSectionHref(process.id, row.targetSection)}
                  aria-current={isActive ? 'true' : undefined}
                  // Explicit, rather than relying on "name from content" —
                  // JSX inserts no whitespace text node between two elements
                  // split across lines, so the label span and the hint span
                  // would otherwise concatenate with NO separator — the
                  // same accessible-name defect `AssetContextAside`'s own
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

      {/* `ProcessDetail.updatedAt` is a REQUIRED string (`types.ts`), never
          nullable/absent — no guard needed, mirroring `AssetContextAside`'s
          own identical omission. */}
      <AsideBlock id="process-last-updated" title={messages.lastUpdatedHeading}>
        <p className="text-sm text-foreground">{formatTimestamp(process.updatedAt)}</p>
      </AsideBlock>
    </>
  );
}
