'use client';

import { ChevronRight, FilePlus, Link2, ListChecks } from 'lucide-react';

import { useWideViewport } from '@/components/detail/use-wide-viewport';
import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { controls } from '@/lib/messages/controls';
import { cn } from '@/lib/utils';
import { DisclosureGroup } from '@vertice/design-system/components';

import type { ControlDetail } from '../../types';
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

function controlSectionHref(controlId: string, sectionId: string): string {
  return `/controls/${controlId}?section=${sectionId}`;
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
