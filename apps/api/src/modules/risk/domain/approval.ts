import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export function assertApproverDiffersFromRequester(
  requesterUserId: string,
  approverUserId: string,
): void {
  if (approverUserId === requesterUserId) {
    throw new ValidationDomainError(USER_MESSAGES.risk.lifecycle.approvalSelfApproval, [
      { field: 'decision', message: USER_MESSAGES.risk.lifecycle.approvalSelfApproval },
    ]);
  }
}
