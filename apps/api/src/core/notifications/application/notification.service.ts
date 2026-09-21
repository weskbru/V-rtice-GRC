/**
 * T193 — `NotificationService`: the notification PORT ADR-011/F-7 describe
 * as "designed but not built" — this is the producer-facing half a future
 * module calls to notify a user of an event relevant to them (FR-101). No
 * call site exists yet in this release (no business module's event —
 * approval requested, review overdue, ... — is wired to emit one); this
 * class is the reusable capability a future task wires a producer to,
 * exactly as `AuditRecorder` was built once and every module since has
 * called it.
 *
 * ## Why `notify` does not open its own transaction
 *
 * Unlike `AuditRecorder` (ADR-005's hard transactional-coupling
 * requirement), nothing in FR-101 requires a notification to be
 * transactionally atomic with the business event that triggered it — a
 * notification is a best-effort courtesy message, not part of the audit
 * trail (`AuditEntityType` deliberately has no `NOTIFICATION` value; see
 * schema.prisma's own comment). `notify` therefore just writes through
 * `NotificationRepositoryPort`, which — via `PrismaService.client`'s
 * ambient-transaction lookup — automatically JOINS whatever transaction a
 * calling producer already has open via ITS OWN `TransactionRunnerPort`,
 * without this service needing to manage a transaction boundary itself.
 *
 * ## Non-disclosure (FR-101's own words: "must not reveal anything about a
 * record the recipient cannot otherwise see")
 *
 * This service does NOT and cannot verify that `recipientUserId` can see
 * `entityType`/`entityId` — only the PRODUCER, at the point it decides to
 * notify someone about a specific record, has both facts in hand (who is
 * being notified, and whether that specific person may see that specific
 * record). This is therefore a documented obligation on every future
 * caller, not a check this class performs: a producer notifying a user
 * about a record must have already confirmed — typically because the
 * recipient is the one who just performed an action making them
 * inherently authorized (e.g. the analyst who requested an approval), or
 * via the same parent-record accessor `core/comments/domain/
 * entity-registry.ts` exposes — that the recipient may see it BEFORE
 * calling `notify`.
 */
import { Injectable } from '@nestjs/common';

import { NotificationRepositoryPort } from '../domain/ports/notification-repository.port';

import type { NotificationRecord } from '../domain/ports/notification-repository.port';
import type { CommentableEntityType } from '@prisma/client';

export interface NotifyInput {
  readonly recipientUserId: string;
  /** Dot-namespaced business event identifier, e.g.
   * `risk.approval.requested` — see schema.prisma's `Notification.type`
   * comment for why this is a free string, not a closed enum. */
  readonly type: string;
  readonly title: string;
  readonly body?: string | undefined;
  /** Deep-link target — see this file's header: the CALLER is responsible
   * for confirming `recipientUserId` may see this record before including
   * it. */
  readonly entityType?: CommentableEntityType | undefined;
  readonly entityId?: string | undefined;
}

@Injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepositoryPort) {}

  async notify(input: NotifyInput): Promise<NotificationRecord> {
    return this.notificationRepository.create({
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}
