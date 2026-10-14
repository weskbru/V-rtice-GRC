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
