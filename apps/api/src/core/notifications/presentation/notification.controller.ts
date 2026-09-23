import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { NoPermissionRequired } from '../../authorization/presentation/permission.guard';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { ListNotificationsUseCase } from '../application/list-notifications.usecase';
import { MarkAllNotificationsReadUseCase } from '../application/mark-all-notifications-read.usecase';
import { MarkNotificationReadUseCase } from '../application/mark-notification-read.usecase';

import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkAllNotificationsReadRequestDto } from './dto/mark-all-notifications-read-request.dto';
import {
  toNotificationResponse,
  type NotificationResponse,
} from './dto/notification-response.mapper';

import type { ValidatedSession } from '../../sessions/application/session.service';

export interface NotificationPageResponse {
  readonly data: readonly NotificationResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
  readonly unreadCount: number;
}

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
  ) {}

  @NoPermissionRequired()
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationPageResponse> {
    const result = await this.listNotificationsUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: query.unreadOnly,
    });

    return {
      data: result.page.items.map(toNotificationResponse),
      meta: {
        page: result.page.page,
        pageSize: result.page.pageSize,
        total: result.page.total,
        totalPages: result.page.totalPages,
      },
      unreadCount: result.unreadCount,
    };
  }

  @NoPermissionRequired()
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(
    @CurrentSession() session: ValidatedSession,
    @Body() _body: MarkAllNotificationsReadRequestDto,
  ): Promise<void> {
    await this.markAllNotificationsReadUseCase.execute(session.userId);
  }

  @NoPermissionRequired()
  @Post(':notificationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @CurrentSession() session: ValidatedSession,
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ): Promise<void> {
    await this.markNotificationReadUseCase.execute({
      actorUserId: session.userId,
      notificationId,
    });
  }
}
