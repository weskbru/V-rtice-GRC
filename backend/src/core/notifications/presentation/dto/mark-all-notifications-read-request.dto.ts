import { IsIn } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class MarkAllNotificationsReadRequestDto {
  @IsIn(['MARK_ALL_READ'], { message: USER_MESSAGES.dto.notification.action.isIn })
  action!: 'MARK_ALL_READ';
}
