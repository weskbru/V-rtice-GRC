/**
 * 008-incidents-problems, US3 — `LinkIncidentRiskRequestDto`
 * (`linkIncidentToRisk`, contracts/incidents.openapi.yaml). Mirrors
 * `grc/finding/presentation/dto/create-finding-risk-link-request.dto.ts`
 * exactly.
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkIncidentRiskRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkIncidentRisk.riskId.isUuid })
  riskId!: string;
}
