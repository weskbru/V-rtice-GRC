import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

const DECISION_VALUES = ['APPROVED', 'REJECTED'] as const;
type AttestationDecision = (typeof DECISION_VALUES)[number];

export class ControlAssessmentAttestationDecisionRequestDto {
  @IsIn(DECISION_VALUES, {
    message: USER_MESSAGES.dto.controlAssessmentAttestationDecision.decision.isIn,
  })
  decision!: AttestationDecision;

  @IsOptional()
  @IsString({
    message: USER_MESSAGES.dto.controlAssessmentAttestationDecision.justification.maxLength,
  })
  @MaxLength(2000, {
    message: USER_MESSAGES.dto.controlAssessmentAttestationDecision.justification.maxLength,
  })
  justification?: string;
}
