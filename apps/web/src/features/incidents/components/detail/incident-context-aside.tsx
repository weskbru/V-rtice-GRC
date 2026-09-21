'use client';

/**
 * PharosGRC — incident detail, the contextual aside
 * (018-incident-detail-experience, Fase 4).
 *
 * Only `DetailLayout`'s `aside` slot — "Ações rápidas", "Relacionamentos"
 * and "Última atualização" — fed entirely by data the page already loaded
 * (`IncidentDetail`), never a request of its own.
 *
 * ## `asideLead` stays omitted — a decision, not an oversight
 *
 * `RiskAttentionAside` (`features/risks/components/detail/risk-context-
 * aside.tsx`) exists because Risk has real, honest pendencies to surface:
 * `overdueReview`, `overdueTreatment`, a pending approval, a blocked
 * transition. `Incident` has NONE of these — no review cadence, no
 * approval workflow, and its lifecycle's only "blocked" concept is a
 * transition that is simply absent from `availableIncidentTransitions`
 * (never offered, so never worth a warning about). There is nothing honest
 * to put in an "Atenção" block, and CLAUDE.md §18.11 ("erros e avisos
 * compreensíveis") does not ask for a warning-shaped panel that just
 * repeats the header's own status badge. `IncidentDetailView` therefore
 * never passes `asideLead` at all — this file does not define one.
 *
 * ## Local `AsideBlock`, not the shared one from Risk
 *
 * Copies `RiskRelationshipsAside`'s own `AsideBlock` mechanism (a plain
 * `<section>` at `xl`+, a `DisclosureGroup` below it) verbatim in
 * behaviour, using the ALREADY-SHARED `useWideViewport`
 * (`@/components/detail/use-wide-viewport`, promoted in Fase 1). This is
 * NOT promoted to shared infrastructure itself: it is eleven lines of
 * layout branching with no logic of its own, and CLAUDE.md §19.10 only
 * credits a promotion once it is exercised by a genuine second consumer —
 * copying it once here is cheaper than a new cross-feature dependency
 * between `features/incidents` and `features/risks`, which nothing else in
 * this app has.
 *
 * ## Quick actions are LINKS, never buttons (the mistake Risk already paid
 * for)
 *
 * Every quick action below is `role="link"` via this app's own `Link`
 * (`@/components/navigation/link`), with a literal `href`
 * (`/incidents/{id}?section={sectionId}`) — never a `<button onClick>`
 * calling a same-page URL commit. `RiskRelationshipsAside`'s own header
 * comment documents why: before its own correction, "Comentar" (the
 * shortcut) and "Comentar" (the real submit button inside the Comentários
 * section) both existed as `<button>`s with the identical accessible name
 * whenever that section was already open — ambiguous for
 * `getByRole('button', { name: … })` and for a screen reader alike. Here
 * the same collision is just as real: "Adicionar ação corretiva" (this
 * shortcut) and the real add-action button inside "Ações corretivas" share
 * the exact same words on purpose (the shortcut names its destination
 * honestly) — a DIFFERENT role is what keeps the two distinguishable, not
 * a deliberately different label.
 *
 * ## No counts in "Relacionamentos"
 *
 * `IncidentDetail` carries no count for risks/assets/processes/problems —
 * fetching one to display would be a new request this phase does not get
 * to add (F-59 is already open). Every row instead carries the same "Ver"
 * hint `RiskRelationshipsAside` uses for its own uncounted relationships
 * (incidents/problems, evidence, findings) — distinguishing "not loaded"
 * from an honest zero, never inventing a number.
 */
import { DisclosureGroup } from '@pharos/design-system/components';
import { ChevronRight, FilePlus, Link2, ListChecks, MessageSquare } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { incidents } from '@/lib/messages/incidents';
import { cn } from '@/lib/utils';

import type { IncidentDetail } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/** A collapsible-below-`xl` aside block — local copy of `RiskRelationshipsAside`'s own mechanism, see this file's header comment for why it is not shared. */
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

interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  targetSection: string;
}

interface RelationshipRow {
  key: string;
  label: string;
  targetSection: string;
}

/** The SAME `?section=<id>` deep link `useDetailSection` reads — built directly rather than routed through that hook, since a `Link`'s `href` must be a plain string known at render time, not a commit function. */
function incidentSectionHref(incidentId: string, sectionId: string): string {
  return `/incidents/${incidentId}?section=${sectionId}`;
}

/** `12/09/2026, 11:02` — pt-BR, no seconds, mirroring `RiskRelationshipsAside`'s own `formatUpdatedAt`. */
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface IncidentContextAsideProps {
  incident: IncidentDetail;
  activeSectionId: string;
  canLink: boolean;
  canCreateAction: boolean;
  canCreateEvidence: boolean;
  canComment: boolean;
}

export function IncidentContextAside({
  incident,
  activeSectionId,
  canLink,
  canCreateAction,
  canCreateEvidence,
  canComment,
}: IncidentContextAsideProps): React.JSX.Element {
  const messages = incidents.detail;

  const quickActionCandidates: (QuickAction & { enabled: boolean })[] = [
    {
      key: 'link-risk',
      label: messages.quickActions.linkRisk,
      icon: Link2,
      targetSection: 'risks',
      enabled: canLink,
    },
    {
      key: 'link-asset',
      label: messages.quickActions.linkAsset,
      icon: Link2,
      targetSection: 'assets',
      enabled: canLink,
    },
    {
      key: 'link-process',
      label: messages.quickActions.linkProcess,
      icon: Link2,
      targetSection: 'processes',
      enabled: canLink,
    },
    {
      key: 'corrective-action',
      label: messages.quickActions.addCorrectiveAction,
      icon: ListChecks,
      targetSection: 'corrective-actions',
      enabled: canCreateAction,
    },
    {
      key: 'evidence',
      label: messages.quickActions.addEvidence,
      icon: FilePlus,
      targetSection: 'evidence',
      enabled: canCreateEvidence,
    },
    {
      key: 'comment',
      label: messages.quickActions.comment,
      icon: MessageSquare,
      targetSection: 'comments',
      enabled: canComment,
    },
  ];
  const quickActions = quickActionCandidates.filter((action) => action.enabled);

  const relationshipRows: RelationshipRow[] = [
    { key: 'risks', label: messages.relationshipsPanel.risks, targetSection: 'risks' },
    { key: 'assets', label: messages.relationshipsPanel.assets, targetSection: 'assets' },
    { key: 'processes', label: messages.relationshipsPanel.processes, targetSection: 'processes' },
    { key: 'problems', label: messages.relationshipsPanel.problems, targetSection: 'problems' },
  ];
  const viewHint = messages.relationshipsPanel.viewHint;

  return (
    <>
      {quickActions.length > 0 ? (
        <AsideBlock id="incident-quick-actions" title={messages.quickActions.heading}>
          <div
            className="flex flex-col gap-2"
            role="group"
            aria-label={messages.quickActions.heading}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.key}
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-start"
                >
                  <Link href={incidentSectionHref(incident.id, action.targetSection)}>
                    <Icon aria-hidden="true" className="size-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </AsideBlock>
      ) : null}

      <AsideBlock id="incident-relationships" title={messages.relationshipsPanel.heading}>
        <ul className="flex flex-col gap-1">
          {relationshipRows.map((row) => {
            const isActive = row.targetSection === activeSectionId;
            return (
              <li key={row.key}>
                <Link
                  href={incidentSectionHref(incident.id, row.targetSection)}
                  aria-current={isActive ? 'true' : undefined}
                  // Explicit, rather than relying on "name from content" —
                  // see this file's own header comment and
                  // `RiskRelationshipsAside`'s identical fix (its own doc
                  // comment names it "Riscos8").
                  aria-label={`${row.label} ${viewHint}`}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive ? 'bg-muted font-semibold text-foreground' : 'text-foreground/90',
                  )}
                >
                  <span aria-hidden="true" className="min-w-0 flex-1 truncate">
                    {row.label}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
                    {viewHint}
                  </span>
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

      {incident.updatedAt ? (
        <AsideBlock id="incident-last-updated" title={messages.lastUpdatedHeading}>
          <p className="text-sm text-foreground">{formatUpdatedAt(incident.updatedAt)}</p>
        </AsideBlock>
      ) : null}
    </>
  );
}
