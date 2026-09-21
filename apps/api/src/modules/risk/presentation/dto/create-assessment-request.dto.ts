/**
 * T125 — matches `contracts/risks.openapi.yaml`'s `CreateRiskAssessmentRequest`
 * exactly: `additionalProperties: false` (global `ValidationPipe`'s
 * `forbidNonWhitelisted`, T022) means this class is also, by construction,
 * where FR-062 is enforced for assessments — `inherentScore`,
 * `inherentLevel`, `residualScore`, `residualLevel` are never declared
 * here, so a request supplying any of them is rejected with `400` before
 * this DTO's own validators even run (the identical mechanism
 * `CreateRiskRequestDto`'s header documents for `Risk` itself — T118's
 * contract test exercises this for assessments).
 */
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateAssessmentRequestDto {
  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.assessment.assessedOn.isDateString })
  assessedOn?: string;

  @IsInt({ message: USER_MESSAGES.dto.assessment.inherentProbability.isInt })
  @Min(1, { message: USER_MESSAGES.dto.assessment.inherentProbability.isInt })
  inherentProbability!: number;

  @IsInt({ message: USER_MESSAGES.dto.assessment.inherentImpact.isInt })
  @Min(1, { message: USER_MESSAGES.dto.assessment.inherentImpact.isInt })
  inherentImpact!: number;

  @IsInt({ message: USER_MESSAGES.dto.assessment.residualProbability.isInt })
  @Min(1, { message: USER_MESSAGES.dto.assessment.residualProbability.isInt })
  residualProbability!: number;

  @IsInt({ message: USER_MESSAGES.dto.assessment.residualImpact.isInt })
  @Min(1, { message: USER_MESSAGES.dto.assessment.residualImpact.isInt })
  residualImpact!: number;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: USER_MESSAGES.dto.assessment.controlIdsConsidered.isUuid,
  })
  controlIdsConsidered?: string[];

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.assessment.rationale.isString })
  rationale?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.assessment.methodologyVersionId.isUuid })
  methodologyVersionId?: string | null;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.assessment.nextReviewOn.isDateString })
  nextReviewOn?: string | null;
}
