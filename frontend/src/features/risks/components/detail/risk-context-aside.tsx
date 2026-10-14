'use client';

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
import { DisclosureGroup } from '@vertice/design-system/components';

import { formatLifecycleTransitionLabel, riskStatusLabel } from '../../status';

import type { RiskDetail, RiskLifecycleState } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface AsideBlockProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

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
  hint?: string;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
