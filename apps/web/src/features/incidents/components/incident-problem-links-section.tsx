'use client';

/**
 * PharosGRC — incident detail, Problems relationship section (008-
 * incidents-problems, US3), READ-ONLY from this side (research.md D-14):
 * `problems.openapi.yaml`/`problemsApi.linkToIncident`/`.unlinkFromIncident`
 * own the write path for this shared many-to-many —
 * `incidents.relationships.problems`'s own catalog comment says as much,
 * and carries no `pickerLabel`/`linkAction`/`unlinkAction` at all (unlike
 * `incident-relationships-section.tsx`'s three writable siblings). This
 * component therefore renders `GET /incidents/{id}/problems`'s list and
 * nothing else — no picker, no unlink button, no `canLink` prop.
 *
 * The linked problem's own status (`ProblemStatusRef`) is shown with
 * `StatusBadge` — colour plus the real pt-BR word, never colour alone
 * (CLAUDE.md §18.8) — using this module's own `PROBLEM_STATUS_VARIANT`,
 * deliberately separate from `status.ts`'s `STATUS_VARIANT` for
 * `IncidentStatus`: the two enums are not the same type and must never be
 * conflated even where a value name coincides.
 *
 * ## C5 (018-incident-detail-experience, Fase 6) — same column-width
 * discipline as the writable siblings
 *
 * The coordinator's own volume measurement (16/15/15 links, Fase 5 review)
 * targeted `incident-relationships-section.tsx` directly, but named this
 * file for the same check "with the same criteria": `linkedBy.fullName`
 * carried `whitespace-nowrap` with no width cap, the exact mechanism that
 * pushed a column off-screen there. Fixed here even though a rendered
 * overflow was never independently measured for this specific table — the
 * cause (an unbounded single-line name) is identical, and this table has
 * one fewer column of slack to absorb it (no "Desvincular" column, but also
 * no `min-w`/`max-w` on the problem column at all before this fix).
 */
import { StatusBadge } from '@pharos/design-system/components';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { incidents } from '@/lib/messages/incidents';

import { incidentsApi } from '../api';
import { formatTimestampDate } from '../date';

import type { IncidentProblemLinkResponse, ProblemStatusRef } from '../types';
import type { StatusVariant } from '@pharos/design-system/components';

const PROBLEM_STATUS_VARIANT: Record<ProblemStatusRef, StatusVariant> = {
  OPEN: 'info',
  IN_ANALYSIS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export interface IncidentProblemLinksSectionProps {
  incidentId: string;
}

export function IncidentProblemLinksSection({
  incidentId,
}: IncidentProblemLinksSectionProps): React.JSX.Element {
  const messages = incidents.relationships.problems;
  const [links, setLinks] = useState<readonly IncidentProblemLinkResponse[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [resolvedIncidentId, setResolvedIncidentId] = useState<string | null>(null);
  const loading = resolvedIncidentId !== incidentId;

  useEffect(() => {
    let cancelled = false;
    incidentsApi
      .listProblemLinks(incidentId, false)
      .then((result) => {
        if (!cancelled) {
          setLinks(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setResolvedIncidentId(incidentId);
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{messages.sectionTitle}</CardTitle>
        <CardDescription>{messages.sectionDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{messages.loading}</p>
        ) : loadError ? (
          <p role="alert" className="text-sm font-medium text-status-danger-fg">
            {messages.loadError}
          </p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            {/* `table-fixed` — see `incident-relationships-section.tsx`'s
                own C5 comment: `max-w-*` alone on a `<td>` is only a hint
                under `table-layout: auto`, which still grows a column to
                fit its longest unbroken content. Explicit percentage
                widths on `TableHead`, paired with `table-fixed`, make the
                table's own total width authoritative. */}
            <Table className="table-fixed">
              <TableCaption className="sr-only">{messages.sectionTitle}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">{messages.columns.problem}</TableHead>
                  <TableHead className="w-[20%]">{messages.columns.status}</TableHead>
                  <TableHead className="w-[22%]">{messages.columns.linkedBy}</TableHead>
                  <TableHead className="w-[18%]">{messages.columns.linkedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="whitespace-normal break-words">
                      <div className="font-medium text-foreground">{link.problem.title}</div>
                      <div className="text-sm text-muted-foreground">{link.problem.code}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={PROBLEM_STATUS_VARIANT[link.problem.status]}
                        label={messages.statusLabels[link.problem.status]}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">
                      {link.linkedBy.fullName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestampDate(link.linkedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
