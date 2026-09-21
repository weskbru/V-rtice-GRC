'use client';

/**
 * PharosGRC — risk detail, the contextual aside (016-risk-detail-experience
 * §4.7, split in two per P11 2026-09-15).
 *
 * Two components, both fed by data the page ALREADY loaded — no request of
 * their own, ever (§4.9):
 *
 *   - **`RiskAttentionAside`** — real pendencies only (a blocked
 *     transition, a pending approval, `overdueReview`, `overdueTreatment`).
 *     Omitted ENTIRELY when there is nothing to report — never an empty
 *     "tudo certo" panel. Always a plain section, never a `DisclosureGroup`
 *     — spec §4.1's own exception ("seus blocos viram `DisclosureGroup`
 *     fechados, **exceto Atenção**"). Rendered as `DetailLayout`'s
 *     `asideLead`, which promotes it above `navigation` on every viewport
 *     (P11) — pendencies must reach the reader before the record's own
 *     content, on a phone most of all.
 *   - **`RiskRelationshipsAside`** — "Ações rápidas", "Relacionamentos" and
 *     "Última atualização". Rendered as `DetailLayout`'s `aside`, which
 *     reflows AFTER the record's content below `xl` (P11) — none of these
 *     three block the path to what the reader came for.
 *
 * Each pendency in `RiskAttentionAside` is a SHORT summary that navigates
 * to where the full explanation lives — never a second copy of it. Before
 * P1, a blocked transition's full precondition sentence appeared here AND
 * inside the lifecycle spine AND inside `RiskLifecycleActions`, three times
 * on the same screen; the sentence now renders in exactly one place
 * (`RiskLifecycleActions`, via its `trajectory` slot — see
 * `risk-lifecycle-section.tsx`), and this panel only names the transition
 * that is blocked.
 *
 * ## Two kinds of control, two roles (corrected 2026-09-17 — accessible-name
 * collision found by the full E2E regression)
 *
 * `RiskAttentionAside`'s pendencies stay `<button>` + `onNavigate` — a
 * same-page `?section=` update the caller drives (`RiskDetailView` wires
 * `onNavigate` to its own URL-commit hook), never a real page navigation.
 *
 * `RiskRelationshipsAside`'s six "Ações rápidas" shortcuts and every
 * "Relacionamentos" row are NAVIGATION, not action — spec §4.7 already
 * calls the six shortcuts "atalhos de navegação para as superfícies de ação
 * que já existem", and a relationship row has never done anything but jump
 * to a section. Before this correction they were `<button onClick=...>`
 * calling the same `onNavigate`, which put TWO controls with the identical
 * accessible name on screen at once whenever the target section was
 * already open and rendered its own real action button — "Comentar" (this
 * shortcut) and "Comentar" (`RiskCommentsSection`'s actual submit button)
 * both existed simultaneously, ambiguous for a screen reader exactly as it
 * was for `getByRole('button', { name: 'Comentar' })` (§18.8, §18.11). A
 * control that only ever changes the URL is a link, not a button — with
 * `role="link"` the SAME two controls no longer collide (different role,
 * same name is fine), the browser's own "open in new tab" starts working,
 * and the semantics stop lying. Both use this app's own `Link`
 * (`@/components/navigation/link`), the same wrapper every other
 * navigation in the product goes through (specs/014-institutional-loader).
 */
import { DisclosureGroup } from '@pharos/design-system/components';
import {
  ChevronRight,
  ClipboardCheck,
  FileText,
  Link2,
  ListChecks,
  MessageSquare,
  Wrench,
} from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { risks } from '@/lib/messages/risks';
import { cn } from '@/lib/utils';

import { formatLifecycleTransitionLabel, riskStatusLabel } from '../../status';

import type { RiskDetail, RiskLifecycleState } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

/**
 * A collapsible-below-`xl` aside block — used by `RiskRelationshipsAside`'s
 * three sections. `RiskAttentionAside` deliberately does NOT use this: it
 * is the one block spec §4.1 exempts from becoming a `DisclosureGroup`.
 */
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

interface AttentionItem {
  key: string;
  text: string;
  targetSection: string;
}

/**
 * One item per real pendency, each a SHORT summary (never the full
 * precondition sentence — see this file's own header comment). A blocked
 * transition contributes ONE item regardless of how many
 * `unmetPreconditions` strings it carries; today's precondition evaluators
 * (`transition-preconditions.ts`) each produce exactly one message per
 * unmet precondition ID, so this is not currently lossy, and even if a
 * future evaluator added a second string for the SAME transition, showing
 * "Transição bloqueada" twice for the one transition would only repeat
 * itself, never add information — the reader follows the item to
 * `RiskLifecycleActions`, which lists every unmet precondition in full.
 */
function buildAttentionItems(
  risk: RiskDetail,
  lifecycle: RiskLifecycleState | null,
): readonly AttentionItem[] {
  const messages = risks.detail.attention;
  const items: AttentionItem[] = [];

  if (lifecycle?.pendingApproval) {
    items.push({
      key: 'pending-approval',
      text: messages.pendingApproval(
        formatLifecycleTransitionLabel(lifecycle.pendingApproval.requestedTransition),
      ),
      targetSection: 'overview',
    });
  }
  if (risk.overdueReview) {
    items.push({ key: 'overdue-review', text: messages.overdueReview, targetSection: 'overview' });
  }
  if (risk.overdueTreatment) {
    // `overdueTreatment` reflects overdue TREATMENT ACTIONS
    // (`aggregate.treatmentActionSummary.overdue > 0` server-side), not the
    // treatment DECISION's own deadline — a risk with no current decision
    // at all can still carry this (P9). The summary card's own "Tratamento"
    // value is a different fact (the decision); this text is deliberately
    // about the actions, and points at "Planos de Ação", where they live.
    items.push({
      key: 'overdue-treatment',
      text: messages.overdueTreatment,
      targetSection: 'action-plans',
    });
  }
  for (const transition of lifecycle?.availableTransitions ?? []) {
    if (transition.preconditionsMet) continue;
    items.push({
      key: `blocked-${transition.toStatus}`,
      text: messages.blockedTransition(riskStatusLabel(transition.toStatus)),
      targetSection: 'overview',
    });
  }

  return items;
}

export interface RiskAttentionAsideProps {
  risk: RiskDetail;
  lifecycle: RiskLifecycleState | null;
  onNavigate: (sectionId: string) => void;
}

/**
 * `DetailLayout`'s `asideLead` (P11) — real pendencies, always a plain
 * section (never a `DisclosureGroup`, spec §4.1's own exception), omitted
 * entirely when there is nothing to report.
 */
export function RiskAttentionAside({
  risk,
  lifecycle,
  onNavigate,
}: RiskAttentionAsideProps): React.JSX.Element | null {
  const messages = risks.detail.attention;
  const items = buildAttentionItems(risk, lifecycle);

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="risk-attention-heading" className="flex flex-col gap-2">
      <h2 id="risk-attention-heading" className="text-sm font-semibold text-foreground">
        {messages.heading}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onNavigate(item.targetSection)}
              className="w-full rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-left text-sm text-status-warning-fg transition-colors hover:bg-status-warning-bg/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </section>
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
  /** Set only for a relationship whose count is not on this page's own payload (R-8) — a trailing hint distinguishing "not loaded yet" from an actual zero (P6), never a fabricated number. */
  hint?: string;
}

/** `12/09/2026, 11:02` — pt-BR, no seconds. Seconds are noise in a context column no one reads to the second (P8). */
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The SAME `?section=<id>` deep link `useDetailSection` reads (§4.4) — built directly rather than routed through that hook, since a `Link`'s `href` must be a plain string known at render time, not a commit function. */
function riskSectionHref(riskId: string, sectionId: string): string {
  return `/risks/${riskId}?section=${sectionId}`;
}

export interface RiskRelationshipsAsideProps {
  risk: RiskDetail;
  activeSectionId: string;
  canAssess: boolean;
  canTreat: boolean;
  canCreateEvidence: boolean;
  canComment: boolean;
  canViewEvidence: boolean;
  canViewFindings: boolean;
}

/**
 * `DetailLayout`'s `aside` (P11) — "Ações rápidas", "Relacionamentos" and
 * "Última atualização". Reflows AFTER the record's own content below `xl`;
 * see this file's own header comment.
 */
export function RiskRelationshipsAside({
  risk,
  activeSectionId,
  canAssess,
  canTreat,
  canCreateEvidence,
  canComment,
  canViewEvidence,
  canViewFindings,
}: RiskRelationshipsAsideProps): React.JSX.Element {
  const messages = risks.detail;

  const quickActionCandidates: (QuickAction & { enabled: boolean })[] = [
    {
      key: 'assess',
      label: messages.quickActions.recordAssessment,
      icon: ClipboardCheck,
      targetSection: 'assessment',
      enabled: canAssess,
    },
    {
      key: 'treat',
      label: messages.quickActions.recordTreatmentDecision,
      icon: Wrench,
      targetSection: 'treatment',
      enabled: canTreat,
    },
    {
      key: 'plan',
      label: messages.quickActions.createActionPlan,
      icon: ListChecks,
      targetSection: 'action-plans',
      enabled: canTreat,
    },
    {
      key: 'control',
      label: messages.quickActions.linkControl,
      icon: Link2,
      targetSection: 'controls',
      enabled: canTreat,
    },
    {
      key: 'evidence',
      label: messages.quickActions.addEvidence,
      icon: FileText,
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
    {
      key: 'action-plans',
      label: messages.relationshipsPanel.actionPlans(risk.treatmentActionSummary.total),
      targetSection: 'action-plans',
    },
    {
      key: 'controls',
      label: messages.relationshipsPanel.controls(risk.controls.length),
      targetSection: 'controls',
    },
    {
      key: 'processes-assets',
      label: messages.relationshipsPanel.processesAssets(
        risk.processes.length + risk.assets.length,
      ),
      targetSection: 'processes-assets',
    },
    {
      key: 'incidents',
      label: messages.relationshipsPanel.incidents,
      targetSection: 'incidents',
      hint: messages.relationshipsPanel.viewHint,
    },
    {
      key: 'problems',
      label: messages.relationshipsPanel.problems,
      targetSection: 'problems',
      hint: messages.relationshipsPanel.viewHint,
    },
    ...(canViewEvidence
      ? [
          {
            key: 'evidence',
            label: messages.relationshipsPanel.evidence,
            targetSection: 'evidence',
            hint: messages.relationshipsPanel.viewHint,
          },
        ]
      : []),
    ...(canViewFindings
      ? [
          {
            key: 'findings',
            label: messages.relationshipsPanel.findings,
            targetSection: 'findings',
            hint: messages.relationshipsPanel.viewHint,
          },
        ]
      : []),
  ];

  return (
    <>
      {quickActions.length > 0 ? (
        <AsideBlock id="risk-quick-actions" title={messages.quickActions.heading}>
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
                  <Link href={riskSectionHref(risk.id, action.targetSection)}>
                    <Icon aria-hidden="true" className="size-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </AsideBlock>
      ) : null}

      <AsideBlock id="risk-relationships" title={messages.relationshipsPanel.heading}>
        <ul className="flex flex-col gap-1">
          {relationshipRows.map((row) => {
            const isActive = row.targetSection === activeSectionId;
            return (
              <li key={row.key}>
                <Link
                  href={riskSectionHref(risk.id, row.targetSection)}
                  aria-current={isActive ? 'true' : undefined}
                  // Explicit, rather than relying on "name from content":
                  // JSX inserts no whitespace text node between two
                  // elements split across lines, so the label `<span>` and
                  // the hint `<span>` would otherwise concatenate with NO
                  // separator ("IncidentesVer") — the exact accessible-name
                  // collision class `DisclosureGroup`'s own doc comment
                  // already records ("Riscos8") from the identical cause.
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

      <AsideBlock id="risk-last-updated" title={messages.lastUpdatedHeading}>
        <p className="text-sm text-foreground">{formatUpdatedAt(risk.updatedAt)}</p>
      </AsideBlock>
    </>
  );
}
