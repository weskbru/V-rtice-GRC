/**
 * PharosGRC — incident detail, "Visão geral" section, first two of its
 * three cards (018-incident-detail-experience, Fase 2+3 — replaces the flat,
 * card-less `<dl>` this component used to be, measured at zero `<h2>`s on
 * the whole screen against Risk's eight).
 *
 * Two cards, mirroring `RiskOverview`'s own hierarchy exactly (CLAUDE.md
 * §18.12 — Risk is this product's established visual language, not a
 * template every field must copy): "Descrição" gets its own prominent card,
 * and the record's classification/ownership facts sit together in
 * "Detalhes do incidente", each field anchored by a small semantic icon via
 * the shared `DetailField` (`@/components/detail/detail-field`, promoted in
 * this same rodada once Incidents became its second real consumer —
 * CLAUDE.md §19.10).
 *
 * The THIRD card this section shows on screen — "Ciclo de vida" — is
 * `IncidentLifecycleSection` (`components/detail/`), composed by the detail
 * view alongside this component, not inside it: it is a different concern
 * (lifecycle trajectory, transitions, outcome facts), not a classification
 * fact about the record's identity.
 *
 * The resolution/closure/cancellation outcome facts that used to live in
 * this component's own flat `<dl>` (`resolutionSummary`, `resolvedAt`/
 * `resolvedBy`, `closedAt`/`closedBy`, `cancellationReason`) moved to that
 * same "Ciclo de vida" card — they describe an OUTCOME OF THE LIFECYCLE, not
 * the record's identity, and this component no longer renders them at all.
 *
 * No `SummaryStatCard` row was added above these cards — the user
 * explicitly declined the three-card summary strip proposed for this
 * screen: severity and status already have a real presence in the header's
 * own badges, and "Reportado em" is temporal context, not a KPI worth a
 * dedicated card. `DetailLayout`'s `summary` slot stays omitted.
 */
import { StatusBadge } from '@pharos/design-system/components';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarPlus,
  FileText,
  User,
  UserCheck,
} from 'lucide-react';

import { DetailField } from '@/components/detail/detail-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { incidents } from '@/lib/messages/incidents';

import { formatDateOnly, formatTimestamp } from '../date';
import { incidentSeverityBadgeVariant, incidentSeverityLabel } from '../status';

import type { IncidentDetail } from '../types';

export interface IncidentOverviewProps {
  incident: IncidentDetail;
}

export function IncidentOverview({ incident }: IncidentOverviewProps): React.JSX.Element {
  const overview = incidents.overview;
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
          <p className="whitespace-pre-wrap text-sm text-foreground">{incident.description}</p>
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
                  variant={incidentSeverityBadgeVariant(incident.severity)}
                  label={incidentSeverityLabel(incident.severity)}
                />
              }
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={Building2}
              label={fields.orgUnit}
              value={incident.orgUnit.name}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={User}
              label={fields.owner}
              value={incident.owner.fullName}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={CalendarPlus}
              label={fields.reportedOn}
              value={formatDateOnly(incident.reportedOn)}
              emptyLabel={overview.notSet}
            />
            <DetailField
              icon={UserCheck}
              label={fields.reportedBy}
              value={incident.reportedBy.fullName}
              emptyLabel={overview.notSet}
            />
            {incident.createdAt ? (
              <DetailField
                icon={CalendarClock}
                label={fields.createdAt}
                value={formatTimestamp(incident.createdAt)}
                emptyLabel={overview.notSet}
              />
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
