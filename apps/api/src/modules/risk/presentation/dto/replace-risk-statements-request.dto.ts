import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReplaceRiskStatementsRequestDto {
  @IsArray({ message: USER_MESSAGES.dto.riskStatementItems.isArray })
  @ArrayMaxSize(50, { message: USER_MESSAGES.dto.riskStatementItems.arrayMaxSize })
  @IsString({ each: true, message: USER_MESSAGES.dto.riskStatementItems.isString })
  @MinLength(1, { each: true, message: USER_MESSAGES.dto.riskStatementItems.minLength })
  items!: string[];
}
