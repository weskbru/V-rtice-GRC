/**
 * `CurrentActorPort` implementation backed by the real ambient
 * `RequestContextStore` (T035, ADR-005/ADR-012). Lives in
 * `core/authorization/infrastructure` because
 * `infrastructure/logging/request-context.ts` is the top-level
 * `infrastructure` element, which only `core-infrastructure`/
 * `core-presentation` may import under the ADR-011 boundary rules.
 */
import { Injectable } from '@nestjs/common';

import { RequestContextStore } from '../../../infrastructure/logging/request-context';
import { CurrentActorPort } from '../domain/ports/current-actor.port';

@Injectable()
export class RequestContextCurrentActorProvider extends CurrentActorPort {
  getCurrentActorUserId(): string | undefined {
    return RequestContextStore.get()?.actorUserId;
  }
}
