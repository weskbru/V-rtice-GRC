import { AuditEntityType, AuditOutcome } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditRecorder } from '../../src/core/audit/application/audit-recorder.service';
import {
  __resetAuditFieldAllowlistRegistryForTests,
  registerAuditFieldAllowlist,
} from '../../src/core/audit/domain/audit-field-allowlist';

import type { AuditEventRecord } from '../../src/core/audit/domain/audit-event.types';
import type { AuditContextPort } from '../../src/core/audit/domain/ports/audit-context.port';
import type { AuditEventWriterPort } from '../../src/core/audit/domain/ports/audit-event-writer.port';

function createFakeWriter(): AuditEventWriterPort & { calls: AuditEventRecord[] } {
  const calls: AuditEventRecord[] = [];
  return {
    calls,
    write: vi.fn((event: AuditEventRecord) => {
      calls.push(event);
      return Promise.resolve();
    }),
  };
}

describe('AuditRecorder (T029)', () => {
  beforeEach(() => {
    __resetAuditFieldAllowlistRegistryForTests();
    registerAuditFieldAllowlist(AuditEntityType.USER, ['email', 'fullName']);
  });

  it('populates actor/ip/userAgent/sessionId/correlationId from the context port', async () => {
    const writer = createFakeWriter();
    const context: AuditContextPort = {
      current: () => ({
        actorUserId: 'actor-1',
        ipAddress: '198.51.100.7',
        userAgent: 'test-agent',
        sessionId: 'session-1',
        correlationId: 'correlation-1',
      }),
    };

    const recorder = new AuditRecorder(writer, context);

    await recorder.record({
      action: 'user.created',
      entityType: AuditEntityType.USER,
      entityId: 'user-1',
      actorLabel: 'Ada Lovelace',
    });

    expect(writer.calls).toHaveLength(1);
    const event = writer.calls[0]!;
    expect(event.actorUserId).toBe('actor-1');
    expect(event.ipAddress).toBe('198.51.100.7');
    expect(event.userAgent).toBe('test-agent');
    expect(event.sessionId).toBe('session-1');
    expect(event.correlationId).toBe('correlation-1');
    expect(event.actorLabel).toBe('Ada Lovelace');
    expect(event.action).toBe('user.created');
    expect(event.entityType).toBe(AuditEntityType.USER);
    expect(event.entityId).toBe('user-1');
    expect(event.outcome).toBe(AuditOutcome.SUCCESS);
    expect(typeof event.id).toBe('string');
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('mints a fresh correlationId and leaves actor/ip/userAgent/sessionId undefined when there is no ambient context', async () => {
    const writer = createFakeWriter();
    const context: AuditContextPort = { current: () => undefined };
    const recorder = new AuditRecorder(writer, context);

    await recorder.record({
      action: 'user.created',
      entityType: AuditEntityType.USER,
      actorLabel: 'system',
    });

    const event = writer.calls[0]!;
    expect(event.actorUserId).toBeUndefined();
    expect(event.ipAddress).toBeUndefined();
    expect(event.userAgent).toBeUndefined();
    expect(event.sessionId).toBeUndefined();
    expect(event.correlationId).toEqual(expect.any(String));
    expect(event.correlationId.length).toBeGreaterThan(0);
  });

  it('defaults outcome to SUCCESS but honors an explicit outcome', async () => {
    const writer = createFakeWriter();
    const context: AuditContextPort = { current: () => undefined };
    const recorder = new AuditRecorder(writer, context);

    await recorder.record({ action: 'a', entityType: AuditEntityType.USER, actorLabel: 'x' });
    expect(writer.calls[0]!.outcome).toBe(AuditOutcome.SUCCESS);

    await recorder.record({
      action: 'b',
      entityType: AuditEntityType.USER,
      actorLabel: 'x',
      outcome: AuditOutcome.DENIED,
    });
    expect(writer.calls[1]!.outcome).toBe(AuditOutcome.DENIED);
  });

  it('filters previousValues/newValues through the entity type allow-list before handing them to the writer', async () => {
    const writer = createFakeWriter();
    const context: AuditContextPort = { current: () => undefined };
    const recorder = new AuditRecorder(writer, context);

    await recorder.record({
      action: 'user.updated',
      entityType: AuditEntityType.USER,
      actorLabel: 'x',
      previousValues: { email: 'old@example.com', internalOnly: 'secret-shaped-but-not-listed' },
      newValues: { email: 'new@example.com' },
    });

    const event = writer.calls[0]!;
    expect(event.previousValues).toEqual({ email: 'old@example.com' });
    expect(event.previousValues).not.toHaveProperty('internalOnly');
    expect(event.newValues).toEqual({ email: 'new@example.com' });
  });

  it('propagates whatever the writer throws (e.g. AuditNotInTransactionError) without swallowing it', async () => {
    const failure = new Error('no ambient transaction');
    const writer: AuditEventWriterPort = { write: vi.fn(() => Promise.reject(failure)) };
    const context: AuditContextPort = { current: () => undefined };
    const recorder = new AuditRecorder(writer, context);

    await expect(
      recorder.record({ action: 'a', entityType: AuditEntityType.USER, actorLabel: 'x' }),
    ).rejects.toThrow(failure);
  });

  it('generates a distinct id for every call', async () => {
    const writer = createFakeWriter();
    const context: AuditContextPort = { current: () => undefined };
    const recorder = new AuditRecorder(writer, context);

    await recorder.record({ action: 'a', entityType: AuditEntityType.USER, actorLabel: 'x' });
    await recorder.record({ action: 'a', entityType: AuditEntityType.USER, actorLabel: 'x' });

    expect(writer.calls[0]!.id).not.toBe(writer.calls[1]!.id);
  });
});
