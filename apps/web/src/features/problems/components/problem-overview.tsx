'use client';

/**
 * PharosGRC — problem detail, "Visão geral" section, three of its four
 * cards (019-problem-detail-experience, Fase B — replaces the flat,
 * card-less `<dl>` this component used to be, mirroring `IncidentOverview`'s
 * own Fase 2+3 correction on the sibling screen).
 *
 * Three cards, mirroring `IncidentOverview`'s own hierarchy (CLAUDE.md
 * §18.12 — Incident is this product's established visual language for this
 * exact section shape, not a template every field must copy blindly):
 * "Descrição" gets its own prominent card, "Causa raiz" gets its OWN card
 * right after it (see below for why), and the record's remaining
 * classification/ownership facts sit together in "Detalhes do problema",
 * each field anchored by a small semantic icon via the shared `DetailField`
 * (`@/components/detail/detail-field`).
 *
 * ## Why "Causa raiz" is not a `DetailField` cell (the point of this phase)
 *
 * For a Problem, the root cause is the POINT of the record — it is the
 * result of the investigative work `IN_ANALYSIS` exists to name (unlike
 * Incident's own `IN_PROGRESS`, a Problem's own status vocabulary names its
 * central activity as analysis, not mitigation). Before this phase it was
 * the seventh cell of a flat `<dl>`, with the exact same typographic weight
 * as "Registrado em" — the coordinator's own rendered measurement of the
 * defect this phase exists to fix. It now gets a dedicated card, directly
 * after "Descrição", with an honest empty state
 * (`overview.rootCauseEmptyDescription`) when `rootCause` is still `null` —
 * never a placeholder that reads like content, never a claim the data does
 * not support.
 *
 * The FOURTH card this section shows on screen — "Ciclo de vida" — is
 * `ProblemLifecycleSection` (`components/detail/`), composed by the detail
 * view alongside this component, not inside it: it is a different concern
 * (lifecycle trajectory, transitions, outcome facts), not a classification
 * fact about the record's identity.
 *
 * The resolution/closure/cancellation outcome facts that used to live in
 * this component's own flat `<dl>` (`resolvedAt`/`resolvedBy`, `closedAt`/
 * `closedBy`, `cancellationReason`) moved to that same "Ciclo de vida" card
 * — they describe an OUTCOME OF THE LIFECYCLE, not the record's identity,
 * and this component no longer renders them at all.
 *
 * No `SummaryStatCard` row was added above these cards — `ProblemDetailView`
 * (Fase A)'s own header comment already records the same decision Incident
 * made: severity has a real presence in the header's own badges, and
 * "Registrado em"/"Atualizado em" are temporal context, not a KPI.
 * `DetailLayout`'s `summary` slot stays omitted.
 */
import { StatusBadge } from '@pharos/design-system/components';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarPlus,
  FileText,
  Search,
  User,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { problems } from '@/lib/messages/problems';

import { formatDateOnly, formatTimestampDate } from '../date';
import { problemSeverityBadgeVariant, problemSeverityLabel } from '../status';

import type { ProblemDetail } from '../types';

export interface ProblemOverviewProps {
  problem: ProblemDetail;
}

export function ProblemOverview({ problem }: ProblemOverviewProps): React.JSX.Element {
  const overview = problems.overview;
  const fields = overview.fields;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.descriptionCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-foreground">{problem.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search aria-hidden="true" className="size-4 text-muted-foreground" />
            {overview.rootCauseCardTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {problem.rootCause ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{problem.rootCause}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{overview.rootCauseEmptyDescription}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{overview.detailsCardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField
              icon={AlertTriangle}
              label={fields.severity}
              value={
                <StatusBadge
                  variant={problemSeverityBadgeVariant(problem.severity)}
                  label={problemSeverityLabel(problem.severity)}
                />
              }
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={problem.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={problem.owner.fullName}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.identifiedOn}
              value={formatDateOnly(problem.identifiedOn)}
              emptyLabel={overview.notSet}
            />
            {/* `createdAt` is absent from `ProblemDetail`'s generated
                `required` array even though the server always sets it —
                see `problem-detail-view.tsx`'s identical comment. */}
            {problem.createdAt ? (
              <DetailField
                icon={CalendarClock}
                label={fields.createdAt}
                value={formatTimestampDate(problem.createdAt)}
                emptyLabel={overview.notSet}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
