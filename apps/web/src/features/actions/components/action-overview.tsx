'use client';

/**
 * PharosGRC — action detail, "Visão geral" section, three cards
 * (020-action-detail-experience, Fase B — replaces the flat, card-less
 * `<dl>` this component used to be, mirroring `IncidentOverview`'s/
 * `ProblemOverview`'s own Fase 2+3/Fase B correction on the sibling
 * screens).
 *
 * Three cards, mirroring the platform's established hierarchy (CLAUDE.md
 * §18.12): "Descrição" gets its own prominent card, "Origem" gets its OWN
 * card right after it (see below for why), and the record's remaining
 * classification/ownership facts sit together in "Detalhes da ação", each
 * field anchored by a small semantic icon via the shared `DetailField`
 * (`@/components/detail/detail-field`).
 *
 * The FOURTH card this section shows on screen — "Ciclo de vida" — is
 * `ActionLifecycleSection` (`components/detail/`), composed by the detail
 * view alongside this component, not inside it: a different concern
 * (lifecycle trajectory, transitions, outcome facts), not a classification
 * fact about the record's identity. `completedAt`/`reopenedAt` — this
 * component's own flat `<dl>` used to render both, unconditionally, as
 * muted fields — now live there instead: they describe an OUTCOME OF THE
 * LIFECYCLE, not the record's identity, and this component no longer
 * renders them at all.
 *
 * ## Why "Origem" is not a `DetailField` cell (the point of this phase)
 *
 * `Action` is the one entity in this platform's queue that exists BECAUSE
 * of another record — every action is born from a risk in treatment, a
 * finding, a control assessment, an incident or a problem
 * (`ActionOriginType`, CLAUDE.md §19.3's closed five-value registry). That
 * origin is the context that explains why the action exists at all. Before
 * this phase it was the second cell of a flat `<dl>`, exactly the same
 * typographic weight as "Criada em" — the coordinator's own framing for why
 * this needed a dedicated card, the same reasoning Problem's own "Causa
 * raiz" card exists for.
 *
 * The card shows BOTH facts the platform actually has, distinctly, WHEN they
 * actually differ: the origin TYPE (`originTypeLabels`, always present — a
 * closed registry, never blank) as a small eyebrow caption above the
 * origin's own specific label (`action.originLabel`) as the prominent value
 * underneath — linked through `actionOriginHref` EXACTLY as before
 * (`origin.ts`'s own header explains why `FINDING`/`CONTROL_ASSESSMENT`
 * render as plain text, never a guessed or wrong link — untouched by this
 * phase). When the server has no specific `originLabel` (a defensive
 * fallback path, `origin.ts`'s own comment on why this can happen), the
 * value falls back to the SAME type name — and the eyebrow is then omitted
 * entirely rather than showing the identical string twice.
 *
 * `Milestone` is deliberately NOT `Building2`, even though
 * `my-actions-columns.tsx`'s sibling `action-card.tsx` uses `Building2` for
 * this exact same origin concept on the register's own card. `Building2` is
 * the platform-wide convention for ORG UNIT — Risk's, Incident's and
 * Problem's own overview cards all use it for exactly that, and "Detalhes
 * da ação" below needs `Building2` for `orgUnit` on THIS SAME screen. Reusing
 * it for Origem here would collide with that field on this exact card grid.
 * `action-card.tsx`'s own choice predates this icon-vocabulary discipline
 * and is a narrow, register-card-only inconsistency this phase does not
 * propagate — not silently: this paragraph is the record of the deviation.
 *
 * ## The width this card grid gets, and why it is `xl:grid-cols-4`
 *
 * `Action`'s detail screen composes `DetailLayout` with NO `aside`
 * (`action-detail-view.tsx`'s own Fase A header comment) — its main column
 * measures ~1120px at `xl`+, not the ~776px every aside-bearing screen
 * (Risk/Incident/Problem) gets. Copying their own `sm:grid-cols-2
 * lg:grid-cols-3` verbatim into that extra width left the fifth field
 * (`updatedAt`) alone on its own mostly-empty row and every OTHER field
 * carrying visibly more padding than its content needed — measured directly
 * against the rendered screen (CLAUDE.md §18.1), not assumed. `xl:grid-
 * cols-4` is added ONLY at `xl` — exactly the breakpoint where the extra
 * room actually exists (below `xl`, every `DetailLayout` consumer's main
 * column is the same full width regardless of whether it has an aside, so
 * `sm:grid-cols-2 lg:grid-cols-3` still governs identically down there).
 */
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  FileText,
  History,
  Milestone,
  User,
} from 'lucide-react';

import { formatDateOnly, formatTimestamp } from '../../risks/date';
import { actionOriginHref } from '../origin';

import type { Action } from '../types';

import { DetailField } from '@/components/detail/detail-field';
import { Link } from '@/components/navigation/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { actions } from '@/lib/messages/actions';

export interface ActionOverviewProps {
  action: Action;
}

export function ActionOverview({ action }: ActionOverviewProps): React.JSX.Element {
  const overview = actions.overview;
  const fields = overview.fields;

  const originTypeLabel = actions.originTypeLabels[action.originType];
  const originLabel = action.originLabel ?? originTypeLabel;
  const originHref = actionOriginHref(action.originType, action.originId);
  // Never show the eyebrow when it would read as the identical string twice
  // (the defensive fallback path — see this file's own header comment).
  const showOriginTypeEyebrow = originLabel !== originTypeLabel;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
              {overview.descriptionCardTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {action.description?.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{action.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{overview.descriptionEmpty}</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Milestone aria-hidden="true" className="size-4 text-muted-foreground" />
              {overview.originCardTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {showOriginTypeEyebrow ? (
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {originTypeLabel}
              </p>
            ) : null}
            <p className="text-base font-medium text-foreground">
              {originHref ? (
                <Link
                  href={originHref}
                  className="text-primary-on-surface underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {originLabel}
                </Link>
              ) : (
                originLabel
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={action.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.responsible}
              value={action.responsible.fullName}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarClock}
              label={fields.dueOn}
              value={formatDateOnly(action.dueOn)}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.createdAt}
              value={formatTimestamp(action.createdAt)}
              emptyLabel={overview.notSet}
              muted
            />
            <DetailField
              icon={History}
              label={fields.updatedAt}
              value={formatTimestamp(action.updatedAt)}
              emptyLabel={overview.notSet}
              muted
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
