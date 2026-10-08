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
