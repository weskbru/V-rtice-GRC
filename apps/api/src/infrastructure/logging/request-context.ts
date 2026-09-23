import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';

import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export interface RequestContextData {
  readonly correlationId: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly method: string;
  readonly path: string;
  actorUserId?: string;
  sessionId?: string;
  authMethod?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export const RequestContextStore = {
  run<T>(context: RequestContextData, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
  },

  get(): RequestContextData | undefined {
    return asyncLocalStorage.getStore();
  },

  enrich(
    fields: Partial<Pick<RequestContextData, 'actorUserId' | 'sessionId' | 'authMethod'>>,
  ): void {
    const context = asyncLocalStorage.getStore();
    if (!context) {
      return;
    }
    Object.assign(context, fields);
  },
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = randomUUID();
    const userAgent = req.get('user-agent');

    const context: RequestContextData = {
      correlationId,
      ipAddress: req.ip ?? '',
      userAgent: userAgent ?? '',
      method: req.method,
      path: req.path,
    };

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    RequestContextStore.run(context, () => {
      next();
    });
  }
}
