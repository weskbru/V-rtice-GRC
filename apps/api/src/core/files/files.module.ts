import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { AppConfigService } from '../../infrastructure/config/app-config.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AuditModule } from '../audit/audit.module';

import { GetAttachmentContentUseCase } from './application/get-attachment-content.usecase';
import { ListAttachmentsUseCase } from './application/list-attachments.usecase';
import { UploadService } from './application/upload.service';
import { WithdrawAttachmentUseCase } from './application/withdraw-attachment.usecase';
import { ATTACHMENT_SETTINGS, type AttachmentSettings } from './domain/attachment-settings';
import { registerFilesAuditAllowlist } from './domain/files-audit-allowlist';
import { ActorDirectoryPort } from './domain/ports/actor-directory.port';
import { AttachmentRepositoryPort } from './domain/ports/attachment-repository.port';
import { FileStorageProvider } from './domain/ports/file-storage-provider.port';
import { LocalDiskStorageProvider } from './infrastructure/local-disk-storage-provider';
import { PrismaActorDirectory } from './infrastructure/prisma-actor-directory';
import { PrismaAttachmentRepository } from './infrastructure/prisma-attachment.repository';
import { PrismaTransactionRunner } from './infrastructure/prisma-transaction-runner';
import { AttachmentController } from './presentation/attachment.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    MulterModule.registerAsync({
      useFactory: (appConfig: AppConfigService) => ({
        limits: { fileSize: appConfig.attachment.maxSizeBytes },
        defParamCharset: 'utf8' as const,
      }),
      inject: [AppConfigService],
    }),
  ],
  controllers: [AttachmentController],
  providers: [
    UploadService,
    ListAttachmentsUseCase,
    WithdrawAttachmentUseCase,
    GetAttachmentContentUseCase,
    { provide: AttachmentRepositoryPort, useClass: PrismaAttachmentRepository },
    { provide: FileStorageProvider, useClass: LocalDiskStorageProvider },
    { provide: ActorDirectoryPort, useClass: PrismaActorDirectory },
    { provide: TransactionRunnerPort, useClass: PrismaTransactionRunner },
    {
      provide: ATTACHMENT_SETTINGS,
      useFactory: (appConfig: AppConfigService): AttachmentSettings => appConfig.attachment,
      inject: [AppConfigService],
    },
  ],
})
export class FilesModule {
  constructor() {
    registerFilesAuditAllowlist();
  }
}
