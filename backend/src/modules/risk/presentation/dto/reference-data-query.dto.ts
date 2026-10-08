import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReferenceDataQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: USER_MESSAGES.dto.referenceDataQuery.includeInactive.isBoolean })
  includeInactive = false;
}
