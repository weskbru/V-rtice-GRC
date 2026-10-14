import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { assertApproverDiffersFromRequester } from '../../src/modules/risk/domain/approval';
import { ValidationDomainError } from '../../src/shared/errors/domain-error';

describe('Approval segregation of duties (T148, FR-029a)', () => {
  it('refuses an approver identical to the requester', () => {
    const userId = randomUUID();

    expect(() => assertApproverDiffersFromRequester(userId, userId)).toThrow(ValidationDomainError);
  });

  it('the thrown error names the decision field and carries a pt-BR message', () => {
    const userId = randomUUID();

    try {
      assertApproverDiffersFromRequester(userId, userId);
      expect.unreachable('assertApproverDiffersFromRequester should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationDomainError);
      const validationError = error as ValidationDomainError;
      expect(validationError.errors).toHaveLength(1);
      expect(validationError.errors[0]!.field).toBe('decision');
      expect(validationError.errors[0]!.message).toContain('não pode decidir');
    }
  });

  it('accepts an approver different from the requester', () => {
    const requesterId = randomUUID();
    const approverId = randomUUID();

    expect(() => assertApproverDiffersFromRequester(requesterId, approverId)).not.toThrow();
  });
});
