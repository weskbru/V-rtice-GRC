'use client';

/**
 * PharosGRC — action detail screen (`/actions/{id}`, 020-action-detail
 * -experience, Fase A shell, Fase B cards, Fase C overlay editing). Fills
 * the gap the coordinator originally
 * measured (`getAction`/`updateAction` had no caller anywhere in the
 * frontend before 010-action-plan-surface added this file, and `/actions`
 * had no `[id]` route the way every other GRC register does) and now
 * carries that screen through the same `DetailLayout` shell Risk/Incident/
 * Problem already established (CLAUDE.md §18.12).
 *
 * ## Deliberately NOT two-level navigation (the coordinator's own
 * instruction for this rodada, measured before it started)
 *
 * Risk/Incident/Problem each nested two `EntityTabs` because each had
 * 7-14 sections and a flat strip overflowed. `Action` has exactly two:
 * "Visão geral" and "Auditoria" (the latter gated by `audit:view`). The
 * coordinator measured `stripOverflow = 0` at both 1440 and 390 for this
 * screen — the problem two-level navigation solves does not exist here.
 * `navigation` below is therefore a SINGLE flat `EntityTabs`, exactly the
 * shape `DetailLayout`'s own doc comment anticipates ("a module with a
 * single level of sections passes just one"). Grouping two sections into
 * one "group" would be empty ceremony, not structure.
 *
 * ## `summary` stays omitted
 *
 * `Action` carries no honest count of its own (unlike Risk's KPI row) — the
 * coordinator's instruction is explicit that a `SummaryStatCard` strip built
 * only for visual symmetry with the other three modules was already
 * rejected once. No fabricated indicator is introduced here.
 *
 * ## `aside` stays omitted — a decision, not a gap (Fase A)
 *
 * `Action` has no relationships, evidence, attachments or comments section
 * to summarize, and its only two honestly-contextual facts — Origem and
 * "Atualizada em" — already live in the "Visão geral" cards (Fase B) and
 * the header respectively. An "Ações rápidas" block with nothing to link to
 * would be ceremony, exactly the aside `ProblemContextAside`'s own header
 * comment reasons its way OUT of for the same class of empty case. This
 * makes Action the FIRST screen to compose `DetailLayout` with genuinely no
 * aside at all — see this same commit's fix to `DetailLayout` itself
 * (`packages/design-system/src/components/detail-layout.tsx`): its
 * two-column grid used to apply unconditionally, regardless of whether an
 * aside existed, leaving ~320px of dead column space at `xl`+ on a screen
 * with no aside to fill it (measured mid-rodada during 018, never shipped
 * before now because every prior consumer always passed one). The fix
 * scopes the grid to `hasAsideColumn` — a no-op for Risk/Incident/Problem
 * (all three still pass `aside`), verified by re-running their own suites
 * and re-capturing their rendered screens unchanged.
 *
 * ## `?section=` deep link — deliberately NOT adopted (a decision, not an
 * oversight)
 *
 * Every prior `DetailLayout` consumer wires `useDetailSection` +
 * `resolveActiveDetailSection` so its own `Suspense`-wrapped content can be
 * deep-linked and kept in the URL. With exactly two sections — one of them
 * gated behind `audit:view` and consulted only occasionally — the benefit
 * (bookmarking "Auditoria" specifically) is marginal, and the cost is real:
 * a second component split purely to host `useSearchParams()`, a `Suspense`
 * boundary, and test surface for a URL state nothing in this screen's own
 * usage pattern asks for. `EntityTabs` below stays UNCONTROLLED (no
 * `value`/`onValueChange`), exactly as this file already had it before this
 * rodada — this component therefore needs no `Suspense` of its own either.
 *
 * ## "Visão geral" (Fase B)
 *
 * The read-only path of the "overview" tab now composes `ActionOverview`
 * (three cards: Descrição, Origem, Detalhes da ação — see that component's
 * own header for why Origem earns its own card) and `ActionLifecycleSection`
 * (`components/detail/`, a fourth "Ciclo de vida" card: the lifecycle track
 * visual, the transition button row, and the conditional outcome facts moved
 * out of the old flat `<dl>`) — mirroring `IncidentDetailView`'s/
 * `ProblemDetailView`'s own identical two-component composition. `Action
 * LifecycleActions` (the transition buttons) is no longer rendered directly
 * by this file, nor does it keep its own page-level `Card`; `ActionLifecycle
 * Section` owns both now.
 *
 * `EntityHeader` gains a breadcrumb ("Planos de Ação › ACT-…", mirroring
 * every other module's own detail breadcrumb) — its code/badges/title/
 * metadata/actions are otherwise byte-identical. Both status and the
 * overdue flag render as `StatusBadge` in the header — colour plus a real
 * pt-BR word, never colour alone (CLAUDE.md §18.8).
 *
 * ## Leitura × edição (Fase C — overlay, no longer an inline swap)
 *
 * `Editar` opens `ActionEditPanel` (`components/detail/`) — an overlay
 * `Sheet` composing `DetailPanel mode="overlay"` around the SAME
 * `ActionEditForm` (unchanged) — instead of swapping "Visão geral"'s own
 * content for the form inline, as it did through Fase A/B. The page behind
 * the panel (Ciclo de vida included) stays fully readable throughout;
 * saving closes the panel and updates `action` through the same `onSaved`
 * shape as before. The "Editar" button in the header no longer hides itself
 * while `editing` is true (it used to, when editing meant the button's own
 * tab content disappeared) — mirrors `IncidentDetailView`'s/
 * `ProblemDetailView`'s own header actions exactly; the `Sheet`'s own focus
 * trap and D-15's documented focus-return handle the rest.
 * `ActionEditPanel`'s own header comment explains the one decision this
 * module needed that Incident's/Problem's own panels did not:
 * `ActionEditForm` carries its own `Cancelar` button, so the `Sheet`'s
 * default icon-only `X` is turned off (`showCloseButton={false}`) rather
 * than showing two visible "abandon and close" controls at once — `Escape`
 * and the backdrop click are untouched, both still work exactly as on every
 * other panel.
 *
 * ## Authorization
 *
 * Reaching this screen at all requires `action:view` (enforced server-side
 * by `ActionController#findById`'s own `@RequirePermission`) — a caller
 * missing it entirely gets a `403`, rendered here as `actions.detail
 * .forbidden`, distinct from the 404 non-disclosure path. Edit and every
 * transition are additionally gated by `action:edit` (`canEdit` below,
 * mirroring `MyActionsView`'s own advisory-only gate, FR-042) — a caller
 * with only `action:view` sees the full action and no edit/transition
 * affordance at all, and the server independently re-checks
 * `action:edit` on every write regardless of what this hook returns.
 */
import {
  DetailLayout,
  EmptyState,
  EntityHeader,
  EntityTabs,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@pharos/design-system/components';
import { AlertTriangle, Eye, History, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Link } from '@/components/navigation/link';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { actions } from '@/lib/messages/actions';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

import { formatDateOnly } from '../../risks/date';
import { actionsApi } from '../api';
import { actionStatusBadgeVariant, actionStatusLabel } from '../status';

import { ActionAuditSection } from './action-audit-section';
import { ActionOverview } from './action-overview';
import { ActionEditPanel } from './detail/action-edit-panel';
import { ActionLifecycleSection } from './detail/action-lifecycle-section';

import type { Action } from '../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface ActionDetailViewProps {
  actionId: string;
}

export function ActionDetailView({ actionId }: ActionDetailViewProps): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [problem, setProblem] = useState<ErrorStateProblem | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await actionsApi.getAction(actionId);
        if (!cancelled) {
          setAction(result);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.problem.status === 404) {
          setNotFound(true);
        } else if (error instanceof ApiError && error.problem.status === 403) {
          setForbidden(true);
        } else if (error instanceof ApiError) {
          setProblem({
            title: error.problem.title,
            detail: error.problem.detail,
            correlationId: error.problem.correlationId,
          });
        } else {
          setProblem({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  if (loading) {
    return <LoadingState variant="block" label={actions.detail.loading} />;
  }

  if (notFound) {
    return (
      <EmptyState
        variant="empty"
        title={actions.detail.notFoundTitle}
        description={actions.detail.notFoundDescription}
      />
    );
  }

  if (forbidden) {
    return <ErrorState problem={actions.detail.forbidden} />;
  }

  if (!action) {
    return <ErrorState problem={problem} />;
  }

  const canEdit = hasPermission('action:edit');
  const canViewAudit = hasPermission('audit:view');

  return (
    <>
      <DetailLayout
        header={
          <EntityHeader
            breadcrumb={
              <>
                <Link href="/actions" className="hover:underline">
                  {actions.detail.breadcrumbLabel}
                </Link>
                <span aria-hidden="true"> › </span>
                <span>{action.code}</span>
              </>
            }
            code={action.code}
            title={action.title}
            badges={
              <>
                <StatusBadge
                  variant={actionStatusBadgeVariant(action.status)}
                  label={actionStatusLabel(action.status)}
                />
                {action.overdue ? (
                  <StatusBadge
                    variant="danger"
                    label={actions.myActions.indicators.overdue}
                    icon={AlertTriangle}
                  />
                ) : null}
              </>
            }
            metadata={
              <>
                <span>{actions.detail.metadata.orgUnit(action.orgUnit.name)}</span>
                <span>{actions.detail.metadata.responsible(action.responsible.fullName)}</span>
                <span>{actions.detail.metadata.dueOn(formatDateOnly(action.dueOn))}</span>
              </>
            }
            actions={
              canEdit ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-4" />
                  {actions.detail.editAction}
                </Button>
              ) : null
            }
          />
        }
        navigation={
          <EntityTabs
            ariaLabel={common.entityTabs.sectionsAriaLabel}
            scrollLabels={{
              scrollBack: common.entityTabs.scrollBack,
              scrollForward: common.entityTabs.scrollForward,
            }}
            tabs={[
              {
                id: 'overview',
                label: actions.detail.sections.overview,
                // `Eye` matches every other detail screen's own overview
                // tab; `History` (below) matches the exact icon
                // Risk/Problem/Incident already use for their own audit-
                // trail-bearing "Registro" group (CLAUDE.md §18.12).
                icon: Eye,
                content: (
                  <div className="flex flex-col gap-6">
                    <ActionOverview action={action} />
                    <ActionLifecycleSection
                      action={action}
                      canTransition={canEdit}
                      onChanged={(updated) => setAction(updated)}
                    />
                  </div>
                ),
              },
              {
                id: 'audit',
                label: actions.detail.sections.audit,
                icon: History,
                visible: canViewAudit,
                content: <ActionAuditSection actionId={action.id} />,
              },
            ]}
          />
        }
      />

      {editing ? (
        <ActionEditPanel
          action={action}
          onOpenChange={(open) => {
            if (!open) setEditing(false);
          }}
          onSaved={(updated) => {
            setAction(updated);
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}
