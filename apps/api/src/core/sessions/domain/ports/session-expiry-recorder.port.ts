import type { SessionRecord } from './session-repository.port';

export abstract class SessionExpiryRecorderPort {
  abstract expireSession(session: SessionRecord): Promise<SessionRecord>;
}
