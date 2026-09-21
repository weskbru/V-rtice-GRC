/**
 * T047/004-compliance-management (research.md D-8) — the single calculator
 * of `RequirementComplianceState`. Built ahead of its own scheduled phase
 * (Fase 5, User Story 3): the contract's `Requirement` schema declares
 * `complianceState` as a REQUIRED, always-present field on every
 * `Requirement` representation, including the two operations this
 * workstream (Fase 3, User Story 1) itself owns — `createRequirement` and
 * `updateRequirement` both return the full `Requirement` shape. Serving
 * that response honestly requires a real calculator, not a hard-coded
 * literal — and research.md D-8 already fully specifies this function's
 * exact signature and behavior, so implementing it now is applying an
 * already-approved design, not making a new one.
 *
 * What THIS task does not build: `RequirementComplianceAuditMark` and the
 * observation-time audit comparison (research.md D-11, T049-T052) — the
 * "detect and audit a state change" mechanism remains Fase 5's own scope.
 * This file is the pure, I/O-free half of D-8 only; gathering the real
 * `applicability`/`linkedControls` inputs from the database is
 * `application/requirement-compliance-reader.service.ts`, this
 * workstream's own minimal wiring of the two facts that exist today
 * (every requirement is `APPLICABLE` with zero linked controls, since
 * Fase 4/5's write paths do not exist yet — see that file's own header).
 *
 * Pure function: no I/O, no framework import, no clock read. Exhaustively
 * unit-tested (`requirement-compliance.spec.ts`) against all five
 * acceptance scenarios of US3 plus the two edge cases research.md D-8
 * names by name, deliberately ahead of the discipline failure this
 * project has already paid for twice (`FindingStatus`, Fase 1; the
 * `Control` lifecycle draft, Fase 2) — no sixth value, and every value
 * reachable by a real, tested combination of inputs.
 */
import type { ControlEffectivenessLevel } from '../../../shared/grc-ports/control-effectiveness.port';
import type { RequirementComplianceState } from '@prisma/client';

export type RequirementApplicability = 'APPLICABLE' | 'NOT_APPLICABLE';

/** One currently-linked control's contribution to the calculation — the
 * projection `RequirementComplianceService` needs, resolved via
 * `ControlDirectoryPort.isActive` and `ControlEffectivenessPort` (D-9),
 * never the control's own domain model. */
export interface LinkedControlComplianceInput {
  readonly isActive: boolean;
  readonly effectiveness: ControlEffectivenessLevel;
}

/** A control "proves" a requirement fully when it is active AND
 * `EFFECTIVE` (research.md D-8's own "prova plenamente"). A retired/
 * inactive control never proves anything, regardless of its last-known
 * effectiveness — the edge case "controle aposentado ligado a cláusula
 * vigente" (D-8) is exactly this branch. */
function provesFully(control: LinkedControlComplianceInput): boolean {
  return control.isActive && control.effectiveness === 'EFFECTIVE';
}

/** A control "proves" a requirement partially when it is active with
 * `PARTIALLY_EFFECTIVE` (research.md D-8's own "prova parcialmente") — it
 * contributes to the mixed bucket that produces `PARTIALLY_MET`, exactly
 * as an ineffective control would, and never alone becomes `COMPLIANT`. */
function provesPartially(control: LinkedControlComplianceInput): boolean {
  return control.isActive && control.effectiveness === 'PARTIALLY_EFFECTIVE';
}

/**
 * The single calculator (data-model.md §7, research.md D-8): entry point
 * every future caller — this workstream's own create/update/get/list
 * requirement use cases, and Fase 5's compliance-summary/audit-mark
 * machinery alike — MUST call to answer "what is this requirement's
 * compliance state right now". Never a stored column (FR-017, §19.7).
 *
 * `linkedControls` is the projection of EVERY currently-linked control
 * (`RequirementControlLink.unlinkedAt IS NULL`) — never the withdrawn
 * history, which does not sustain current compliance (FR-011 still keeps
 * it readable as history, just not as an input here).
 */
export function calculateRequirementComplianceState(
  applicability: RequirementApplicability,
  linkedControls: readonly LinkedControlComplianceInput[],
): RequirementComplianceState {
  if (applicability === 'NOT_APPLICABLE') {
    return 'NOT_APPLICABLE';
  }

  if (linkedControls.length === 0) {
    // FR-018: never COMPLIANT by omission — the absence of any mapping is,
    // itself, the information.
    return 'NOT_MET';
  }

  const allProveFully = linkedControls.every(provesFully);
  if (allProveFully) {
    // SC-002: every linked control proves it, and at least one exists.
    return 'COMPLIANT';
  }

  const anyProof = linkedControls.some(
    (control) => provesFully(control) || provesPartially(control),
  );
  if (anyProof) {
    // A mix of proving and non-proving controls (or a partial-only proof)
    // — AS6 of US3: the mixture is the reason this state exists at all.
    return 'PARTIALLY_MET';
  }

  // FR-019: mapped, but none of the mapped controls currently proves it —
  // distinct from NOT_MET, which has no mapping at all.
  return 'NOT_PROVEN';
}
