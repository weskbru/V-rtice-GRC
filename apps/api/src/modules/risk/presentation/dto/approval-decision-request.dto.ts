/**
 * T158 — matches `contracts/risks.openapi.yaml`'s
 * `ApprovalDecisionRequest` exactly: `additionalProperties: false` (the
 * deciding user and timestamp are taken from the session, never from the
 * request body — FR-029a/FR-029b).
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

const DECISION_VALUES = ['APPROVED', 'REJECTED'] as const;
type ApprovalDecisionValue = (typeof DECISION_VALUES)[number];

export class ApprovalDecisionRequestDto {
  @IsIn(DECISION_VALUES, { message: USER_MESSAGES.dto.approvalDecision.decision.isIn })
  decision!: ApprovalDecisionValue;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.approvalDecision.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.approvalDecision.justification.maxLength })
  justification?: string;
}
