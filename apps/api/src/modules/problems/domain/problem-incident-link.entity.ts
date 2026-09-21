/**
 * 008-incidents-problems, US3 (data-model.md §6, research.md D-13 to
 * D-15) — domain shape for `ProblemIncidentLink`. `modules/problems` owns
 * the WRITE path here (unlike `incident-problem-link.entity.ts`, which is
 * read-only from the Incident side); the target incident's identity is
 * resolved through `IncidentDirectoryPort`, never a direct import of
 * `modules/incidents` (ADR-011).
 */
import type { IncidentStatus } from '@prisma/client';

export interface ProblemIncidentLinkIncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface ProblemIncidentLinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemIncidentLinkRecord {
  readonly id: string;
  readonly problemId: string;
  readonly incident: ProblemIncidentLinkIncidentRef;
  readonly linkedBy: ProblemIncidentLinkUserRef;
  readonly linkedAt: Date;
  readonly unlinkedBy: ProblemIncidentLinkUserRef | undefined;
  readonly unlinkedAt: Date | undefined;
}
