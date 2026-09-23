import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

const MAX_NOTE_LENGTH = 1000;

export function assertLinkNoteWithinBounds(note: string | null | undefined): void {
  if (note !== null && note !== undefined && note.length > MAX_NOTE_LENGTH) {
    throw new ValidationDomainError(USER_MESSAGES.evidence.link.noteTooLong, [
      { field: 'note', message: USER_MESSAGES.evidence.link.noteTooLong },
    ]);
  }
}
