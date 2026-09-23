import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RISK_LEVEL_VALUES } from '../../domain/methodology.schema';

class ScalePointRequestDto {
  @IsInt({ message: USER_MESSAGES.dto.methodology.scalePoint.value.isInt })
  value!: number;

  @IsString({ message: USER_MESSAGES.dto.methodology.scalePoint.label.isString })
  label!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.methodology.scalePoint.label.isString })
  description?: string | null;
}

class MatrixCellRequestDto {
  @IsInt({ message: USER_MESSAGES.dto.methodology.matrixCell.probability.isInt })
  probability!: number;

  @IsInt({ message: USER_MESSAGES.dto.methodology.matrixCell.impact.isInt })
  impact!: number;

  @IsInt({ message: USER_MESSAGES.dto.methodology.matrixCell.score.isInt })
  score!: number;

  @IsIn(RISK_LEVEL_VALUES, { message: USER_MESSAGES.dto.methodology.matrixCell.level.isIn })
  level!: (typeof RISK_LEVEL_VALUES)[number];
}

class LevelBandRequestDto {
  @IsIn(RISK_LEVEL_VALUES, { message: USER_MESSAGES.dto.methodology.levelBand.level.isIn })
  level!: (typeof RISK_LEVEL_VALUES)[number];

  @IsInt({ message: USER_MESSAGES.dto.methodology.levelBand.minScore.isInt })
  minScore!: number;

  @IsInt({ message: USER_MESSAGES.dto.methodology.levelBand.maxScore.isInt })
  maxScore!: number;

  @IsOptional()
  @IsString()
  colorToken?: string;
}

export class CreateMethodologyVersionRequestDto {
  @ArrayMinSize(2, { message: USER_MESSAGES.dto.methodology.probabilityScale.arrayMinSize })
  @ValidateNested({ each: true })
  @Type(() => ScalePointRequestDto)
  probabilityScale!: ScalePointRequestDto[];

  @ArrayMinSize(2, { message: USER_MESSAGES.dto.methodology.impactScale.arrayMinSize })
  @ValidateNested({ each: true })
  @Type(() => ScalePointRequestDto)
  impactScale!: ScalePointRequestDto[];

  @ArrayMinSize(4, { message: USER_MESSAGES.dto.methodology.matrix.arrayMinSize })
  @ValidateNested({ each: true })
  @Type(() => MatrixCellRequestDto)
  matrix!: MatrixCellRequestDto[];

  @ArrayMinSize(2, { message: USER_MESSAGES.dto.methodology.levelBands.arrayMinSize })
  @ValidateNested({ each: true })
  @Type(() => LevelBandRequestDto)
  levelBands!: LevelBandRequestDto[];

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.methodology.effectiveFrom.isDateString })
  effectiveFrom?: string;
}
