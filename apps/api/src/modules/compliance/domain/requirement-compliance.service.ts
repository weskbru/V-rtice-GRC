import type { ControlEffectivenessLevel } from '../../../shared/grc-ports/control-effectiveness.port';
import type { RequirementComplianceState } from '@prisma/client';

export type RequirementApplicability = 'APPLICABLE' | 'NOT_APPLICABLE';

export interface LinkedControlComplianceInput {
  readonly isActive: boolean;
  readonly effectiveness: ControlEffectivenessLevel;
}

function provesFully(control: LinkedControlComplianceInput): boolean {
  return control.isActive && control.effectiveness === 'EFFECTIVE';
}

function provesPartially(control: LinkedControlComplianceInput): boolean {
  return control.isActive && control.effectiveness === 'PARTIALLY_EFFECTIVE';
}

export function calculateRequirementComplianceState(
  applicability: RequirementApplicability,
  linkedControls: readonly LinkedControlComplianceInput[],
): RequirementComplianceState {
  if (applicability === 'NOT_APPLICABLE') {
    return 'NOT_APPLICABLE';
  }

  if (linkedControls.length === 0) {
    return 'NOT_MET';
  }

  const allProveFully = linkedControls.every(provesFully);
  if (allProveFully) {
    return 'COMPLIANT';
  }

  const anyProof = linkedControls.some(
    (control) => provesFully(control) || provesPartially(control),
  );
  if (anyProof) {
    return 'PARTIALLY_MET';
  }

  return 'NOT_PROVEN';
}
