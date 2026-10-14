'use client';

import { ChevronRight, FilePlus, Link2, ListChecks, MessageSquare } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { problems } from '@/lib/messages/problems';
import { cn } from '@/lib/utils';
import { DisclosureGroup } from '@vertice/design-system/components';

import type { ProblemDetail } from '../../types';
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

function problemSectionHref(problemId: string, sectionId: string): string {
  return `/problems/${problemId}?section=${sectionId}`;
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

export interface ProblemContextAsideProps {
  problem: ProblemDetail;
  activeSectionId: string;
  canLink: boolean;
  canCreateAction: boolean;
  canCreateEvidence: boolean;
  canComment: boolean;
}

export function ProblemContextAside({
  problem,
  activeSectionId,
  canLink,
  canCreateAction,
  canCreateEvidence,
  canComment,
}: ProblemContextAsideProps): React.JSX.Element {
  const messages = problems.detail;

  const quickActionCandidates: (QuickAction & { enabled: boolean })[] = [
    {
      key: 'link-risk',
      label: messages.quickActions.linkRisk,
      icon: Link2,
      targetSection: 'risks',
      enabled: canLink,
    },
    {
      key: 'link-incident',
      label: messages.quickActions.linkIncident,
      icon: Link2,
      targetSection: 'incidents',
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
    { key: 'incidents', label: messages.relationshipsPanel.incidents, targetSection: 'incidents' },
  ];
  const viewHint = messages.relationshipsPanel.viewHint;

  return (
    <>
      {quickActions.length > 0 ? (
        <AsideBlock id="problem-quick-actions" title={messages.quickActions.heading}>
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
                  <Link href={problemSectionHref(problem.id, action.targetSection)}>
                    <Icon aria-hidden="true" className="size-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </AsideBlock>
      ) : null}

      <AsideBlock id="problem-relationships" title={messages.relationshipsPanel.heading}>
        <ul className="flex flex-col gap-1">
          {relationshipRows.map((row) => {
            const isActive = row.targetSection === activeSectionId;
            return (
              <li key={row.key}>
                <Link
                  href={problemSectionHref(problem.id, row.targetSection)}
                  aria-current={isActive ? 'true' : undefined}
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

      {problem.updatedAt ? (
        <AsideBlock id="problem-last-updated" title={messages.lastUpdatedHeading}>
          <p className="text-sm text-foreground">{formatUpdatedAt(problem.updatedAt)}</p>
        </AsideBlock>
      ) : null}
    </>
  );
}
