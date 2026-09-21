/**
 * `NotificationsModule` — the notifications capability's composition root
 * (T193, ADR-011). Sits directly under `src/core/notifications/`, outside
 * the `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify.
 *
 * `NotificationService` is exported so a future business module can inject
 * it once it has an event worth notifying a user about (FR-101) — see that
 * class's own header for why no call site exists yet in this release.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { ListNotificationsUseCase } from './application/list-notifications.usecase';
import { MarkAllNotificationsReadUseCase } from './application/mark-all-notifications-read.usecase';
import { MarkNotificationReadUseCase } from './application/mark-notification-read.usecase';
import { NotificationService } from './application/notification.service';
import { NotificationRepositoryPort } from './domain/ports/notification-repository.port';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository';
import { NotificationController } from './presentation/notification.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    ListNotificationsUseCase,
    MarkAllNotificationsReadUseCase,
    MarkNotificationReadUseCase,
    { provide: NotificationRepositoryPort, useClass: PrismaNotificationRepository },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
