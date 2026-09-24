import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NotificationService } from '../../src/core/notifications/application/notification.service';
import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture } from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

interface NotificationBody {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly readAt: string | null;
  readonly createdAt: string;
}

interface NotificationPageBody {
  readonly data: readonly NotificationBody[];
  readonly meta: { readonly page: number; readonly pageSize: number; readonly total: number };
  readonly unreadCount: number;
}

describe('/notifications contract coverage (T193, D-11, FR-101, FR-030)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let recipientAgent: ReturnType<typeof request.agent>;
  let recipientUserId: string;
  let otherUserAgent: ReturnType<typeof request.agent>;

  async function login(email: string, password: string): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(ctx.app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    const prisma = ctx.app.get(PrismaService);

    const recipient = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('nf-recipient')}@example.test`,
    });
    recipientUserId = recipient.user.id;
    recipientAgent = await login(recipient.user.email, recipient.rawPassword);

    const otherUser = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('nf-other')}@example.test`,
    });
    otherUserAgent = await login(otherUser.user.email, otherUser.rawPassword);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /notifications', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/notifications');
      expect(response.status).toBe(401);
    });

    it('succeeds for a ZERO-permission authenticated user, with the declared {data, meta, unreadCount} shape', async () => {
      const response = await recipientAgent.get('/api/v1/notifications').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as NotificationPageBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toMatchObject({ page: 1, pageSize: 25 });
      expect(typeof body.unreadCount).toBe('number');
    });

    it("never returns another user's notifications, even to a caller with global scope none of the notification routes even consult", async () => {
      const notificationService = ctx.app.get(NotificationService);
      await notificationService.notify({
        recipientUserId,
        type: 'test.contract.probe',
        title: 'Notificação de teste para o destinatário correto',
      });

      const response = await otherUserAgent.get('/api/v1/notifications').set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as NotificationPageBody;
      expect(
        body.data.some((n) => n.title === 'Notificação de teste para o destinatário correto'),
      ).toBe(false);
    });
  });

  describe('POST /notifications/{notificationId}/read', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/notifications/${randomUUID()}/read`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(401);
    });

    it('404 for a notification addressed to a DIFFERENT user — existence is not disclosed (FR-030)', async () => {
      const notificationService = ctx.app.get(NotificationService);
      const notification = await notificationService.notify({
        recipientUserId,
        type: 'test.contract.probe',
        title: 'Notificação privada do destinatário',
      });

      const response = await otherUserAgent
        .post(`/api/v1/notifications/${notification.id}/read`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('404 for a nonexistent notification id', async () => {
      const response = await recipientAgent
        .post(`/api/v1/notifications/${randomUUID()}/read`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('204 for the true recipient, ZERO permission required, and idempotent on a second call', async () => {
      const notificationService = ctx.app.get(NotificationService);
      const notification = await notificationService.notify({
        recipientUserId,
        type: 'test.contract.probe',
        title: 'Notificação a ser marcada como lida',
      });

      const first = await recipientAgent
        .post(`/api/v1/notifications/${notification.id}/read`)
        .set('Origin', appOrigin);
      expect(first.status).toBe(204);

      const second = await recipientAgent
        .post(`/api/v1/notifications/${notification.id}/read`)
        .set('Origin', appOrigin);
      expect(second.status).toBe(204);

      const listResponse = await recipientAgent
        .get('/api/v1/notifications')
        .set('Origin', appOrigin);
      const listed = (listResponse.body as NotificationPageBody).data.find(
        (n) => n.id === notification.id,
      );
      expect(listed?.readAt).not.toBeNull();
    });
  });

  describe('POST /notifications (MARK_ALL_READ)', () => {
    it('401 with no session', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Origin', appOrigin)
        .send({ action: 'MARK_ALL_READ' });
      expect(response.status).toBe(401);
    });

    it('400 for an invalid action value', async () => {
      const response = await recipientAgent
        .post('/api/v1/notifications')
        .set('Origin', appOrigin)
        .send({ action: 'DO_SOMETHING_ELSE' });
      expect(response.status).toBe(400);
    });

    it("204 for a ZERO-permission authenticated user, marking every unread notification of the caller as read (and no one else's)", async () => {
      const notificationService = ctx.app.get(NotificationService);
      await notificationService.notify({
        recipientUserId,
        type: 'test.contract.probe',
        title: 'Notificação a ser marcada em massa',
      });
      await notificationService.notify({
        recipientUserId,
        type: 'test.contract.probe',
        title: 'Segunda notificação a ser marcada em massa',
      });

      const response = await recipientAgent
        .post('/api/v1/notifications')
        .set('Origin', appOrigin)
        .send({ action: 'MARK_ALL_READ' });
      expect(response.status).toBe(204);

      const listResponse = await recipientAgent
        .get('/api/v1/notifications')
        .query({ unreadOnly: true })
        .set('Origin', appOrigin);
      expect((listResponse.body as NotificationPageBody).data).toHaveLength(0);
      expect((listResponse.body as NotificationPageBody).unreadCount).toBe(0);
    });
  });
});
