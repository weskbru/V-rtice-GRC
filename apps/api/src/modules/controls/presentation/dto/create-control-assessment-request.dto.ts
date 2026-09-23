import { IsIn, IsString, IsDateString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ControlAssessmentResult } from '@prisma/client';

const CONTROL_ASSESSMENT_RESULT_VALUES: readonly ControlAssessmentResult[] = [
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
];

export class CreateControlAssessmentRequestDto {
  @IsDateString({}, { message: USER_MESSAGES.dto.controlAssessment.assessedOn.isDateString })
  assessedOn!: string;

  @IsIn(CONTROL_ASSESSMENT_RESULT_VALUES, {
    message: USER_MESSAGES.dto.controlAssessment.result.isIn,
  })
  result!: ControlAssessmentResult;

  @IsString({ message: USER_MESSAGES.dto.controlAssessment.conclusion.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.controlAssessment.conclusion.length })
  conclusion!: string;
}
