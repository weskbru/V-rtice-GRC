/**
 * 008-incidents-problems, US3 — `LinkIncidentAssetRequestDto`
 * (`linkIncidentToAsset`, contracts/incidents.openapi.yaml).
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkIncidentAssetRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkIncidentAsset.assetId.isUuid })
  assetId!: string;
}
