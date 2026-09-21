'use client';

/**
 * PharosGRC — control detail, the contextual aside
 * (021-control-detail-experience, Fase C).
 *
 * Only `DetailLayout`'s `aside` slot — "Ações rápidas", "Relacionamentos"
 * and "Última atualização" — fed entirely by data the page already loaded
 * (`ControlDetail`), never a request of its own. Mirrors
 * `ProblemContextAside`'s own shape exactly (CLAUDE.md §18.12).
 *
 * ## Why Control gets an aside, unlike Action
 *
 * `Action` settled on NO aside at all — it has no relationships, no
 * evidence, no attachments, no comments section to summarize
 * (`action-detail-view.tsx`'s own header comment). `Control` is the
 * opposite: it has real relationships ("Vínculos" — Riscos read-only,
 * Processos, Ativos) and a permission-gated Evidência section, exactly the
 * class of content `ProblemContextAside`/`IncidentContextAside` already
 * summarize for their own siblings. An "Ações rápidas" block here has real
 * destinations to link to, not ceremony.
 *
 * ## `asideLead` stays omitted — a decision, not an oversight
 *
 * Mirrors `ProblemContextAside`'s own reasoning: `Control` has no honest
 * pendency to list as a BLOCKING warning distinct from "not offered" — a
 * transition simply absent from `availableTransitions` is never offered,
 * never worth a separate "Atenção" panel repeating what the lifecycle
 * card's own pendency bullets already say. `ControlDetailView` therefore
 * never passes `asideLead` at all — this file does not define one.
 *
 * ## Local `AsideBlock`, not the shared one from Risk/Incident/Problem
 *
 * Copies `ProblemContextAside`'s own `AsideBlock` mechanism (a plain
 * `<section>` at `xl`+, a `DisclosureGroup` below it) verbatim in
 * behaviour, using the ALREADY-SHARED `useWideViewport`. NOT promoted to
 * shared infrastructure itself — CLAUDE.md §19.10 only credits a
 * promotion once exercised by a genuine second consumer, and this would be
 * a FOURTH independently-authored copy (Risk, Incident, Problem, now
 * Control) of the same eleven lines of layout branching.
 *
 * ## Quick actions are LINKS, never buttons (the mistake Risk already paid
 * for)
 *
 * Every quick action below is `role="link"` via this app's own `Link`
 * (`@/components/navigation/link`), with a literal `href`
 * (`/controls/{id}?section={sectionId}`) — never a `<button onClick>`
 * calling a same-page URL commit. The real "Vincular"/"Registrar
 * verificação" buttons inside "Vínculos"/"Verificações" share vocabulary
 * with these shortcuts on purpose; a DIFFERENT role is what keeps the two
 * distinguishable (`ProblemContextAside`'s own header comment documents the
 * three specs this exact collision cost on Risk).
 *
 * ## No counts in "Relacionamentos"
 *
 * `ControlDetail` carries no count for its "Vínculos" section — fetching
 * one just to display it would be a new request this phase does not get to
 * add. The single row instead carries the same "Ver" hint `ProblemContext
 * Aside`/`IncidentContextAside` use for their own uncounted relationships,
 * distinguishing "not loaded" from an honest zero, never inventing a
 * number. Only ONE row — "Vínculos" — exists because Riscos/Processos/
 * Ativos are three SUBSECTIONS of the same "Vínculos" tab
 * (`control-links-section.tsx`), not three independently deep-linkable
 * sections the way Problem's own Riscos/Incidentes are; a second or third
 * row pointing at the identical `?section=relationships` href would be
 * ceremony, not information.
 */
import { DisclosureGroup } from '@pharos/design-system/components';
import { ChevronRight, FilePlus, Link2, ListChecks } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { controls } from '@/lib/messages/controls';
import { cn } from '@/lib/utils';

import type { ControlDetail } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/** A collapsible-below-`xl` aside block — local copy of `ProblemContextAside`'s own mechanism, see this file's header comment for why it is not shared. */
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

/** The SAME `?section=<id>` deep link this screen's own flat `EntityTabs` reads — built directly rather than routed through `useDetailSection`, since a `Link`'s `href` must be a plain string known at render time, not a commit function. */
function controlSectionHref(controlId: string, sectionId: string): string {
  return `/controls/${controlId}?section=${sectionId}`;
}

/** `12/09/2026, 11:02` — pt-BR, no seconds, mirroring `ProblemContextAside`'s/`IncidentContextAside`'s own `formatUpdatedAt`. */
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface ControlContextAsideProps {
  control: ControlDetail;
  activeSectionId: string;
  canTest: boolean;
  canLinkRelationships: boolean;
  canCreateEvidence: boolean;
  canViewEvidence: boolean;
}

export function ControlContextAside({
  control,
  activeSectionId,
  canTest,
  canLinkRelationships,
  canCreateEvidence,
  canViewEvidence,
}: ControlContextAsideProps): React.JSX.Element {
  const messages = controls.detail;

  const quickActionCandidates: (QuickAction & { enabled: boolean })[] = [
    {
      key: 'assess',
      label: messages.quickActions.registerAssessment,
      icon: ListChecks,
      targetSection: 'assessments',
      enabled: canTest,
    },
    {
      key: 'link',
      label: messages.quickActions.linkRelationship,
      icon: Link2,
      targetSection: 'relationships',
      enabled: canLinkRelationships,
    },
    {
      key: 'evidence',
      label: messages.quickActions.addEvidence,
      icon: FilePlus,
      targetSection: 'evidence',
      // Both permissions matter: a caller lacking `evidence:view` would
      // land on a `?section=evidence` link that `EntityTabs` silently
      // resolves back to the first VISIBLE tab (the "evidence" tab is
      // itself `visible: canViewEvidence`, control-detail-view.tsx's own
      // tab list) — never offer a shortcut to a destination that would
      // quietly redirect elsewhere.
      enabled: canCreateEvidence && canViewEvidence,
    },
  ];
  const quickActions = quickActionCandidates.filter((action) => action.enabled);

  const viewHint = messages.relationshipsPanel.viewHint;
  const isRelationshipsActive = activeSectionId === 'relationships';

  return (
    <>
      {quickActions.length > 0 ? (
        <AsideBlock id="control-quick-actions" title={messages.quickActions.heading}>
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
                  <Link href={controlSectionHref(control.id, action.targetSection)}>
                    <Icon aria-hidden="true" className="size-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </AsideBlock>
      ) : null}

      <AsideBlock id="control-relationships" title={messages.relationshipsPanel.heading}>
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href={controlSectionHref(control.id, 'relationships')}
              aria-current={isRelationshipsActive ? 'true' : undefined}
              // Explicit, rather than relying on "name from content" — see
              // this file's own header comment and `ProblemContextAside`'s
              // identical fix.
              aria-label={`${messages.relationshipsPanel.links} ${viewHint}`}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isRelationshipsActive
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-foreground/90',
              )}
            >
              <span aria-hidden="true" className="min-w-0 flex-1 truncate">
                {messages.relationshipsPanel.links}
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
        </ul>
      </AsideBlock>

      {control.updatedAt ? (
        <AsideBlock id="control-last-updated" title={messages.lastUpdatedHeading}>
          <p className="text-sm text-foreground">{formatUpdatedAt(control.updatedAt)}</p>
        </AsideBlock>
      ) : null}
    </>
  );
}
