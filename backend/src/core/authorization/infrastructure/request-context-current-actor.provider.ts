import { Injectable } from '@nestjs/common';

import { RequestContextStore } from '../../../infrastructure/logging/request-context';
import { CurrentActorPort } from '../domain/ports/current-actor.port';

@Injectable()
export class RequestContextCurrentActorProvider extends CurrentActorPort {
  getCurrentActorUserId(): string | undefined {
    return RequestContextStore.get()?.actorUserId;
  }
}
