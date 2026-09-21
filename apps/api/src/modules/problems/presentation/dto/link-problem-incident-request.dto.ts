/**
 * 008-incidents-problems, US3 — `LinkProblemIncidentRequestDto`
 * (`linkProblemToIncident`, contracts/problems.openapi.yaml).
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkProblemIncidentRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkProblemIncident.incidentId.isUuid })
  incidentId!: string;
}
