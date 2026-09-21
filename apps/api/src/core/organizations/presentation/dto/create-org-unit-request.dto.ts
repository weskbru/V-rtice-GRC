/**
 * T180 — matches `contracts/admin.openapi.yaml`'s `CreateOrgUnitRequest`
 * exactly (`additionalProperties: false`). `path`/`depth` are never
 * declared here — server-derived (ADR-004) — so a request supplying either
 * is rejected with `400` before this DTO's own validators even run, same
 * FR-062-style mechanism `CreateRiskRequestDto`'s header documents.
 */
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateOrgUnitRequestDto {
  @IsString({ message: USER_MESSAGES.dto.writeOrgUnit.code.isString })
  @Length(1, 50, { message: USER_MESSAGES.dto.writeOrgUnit.code.length })
  code!: string;

  @IsString({ message: USER_MESSAGES.dto.writeOrgUnit.name.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.writeOrgUnit.name.length })
  name!: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.writeOrgUnit.parentId.isUuid })
  parentId?: string | null;
}
