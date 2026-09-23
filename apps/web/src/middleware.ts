import { NextResponse } from 'next/server';

import { errors } from '@/lib/messages/errors';

import type { NextRequest } from 'next/server';

const ATTACHMENT_UPLOAD_PATH = '/api/v1/attachments';
const MAX_PROXIED_BODY_BYTES = 32 * 1024 * 1024;

export function middleware(request: NextRequest): NextResponse | undefined {
  if (request.method !== 'POST' || request.nextUrl.pathname !== ATTACHMENT_UPLOAD_PATH) {
    return undefined;
  }

  const contentLength = request.headers.get('content-length');
  const size = contentLength === null ? undefined : Number(contentLength);

  if (size === undefined || !Number.isFinite(size) || size <= MAX_PROXIED_BODY_BYTES) {
    return undefined;
  }

  return NextResponse.json(
    {
      type: 'https://pharosgrc.dev/problems/http-413',
      title: errors.payloadTooLargeTitle,
      status: 413,
      detail: errors.fileTooLarge,
      instance: request.nextUrl.pathname,
      correlationId: 'web-proxy-precheck',
    },
    { status: 413, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export const config = {
  matcher: '/api/v1/attachments',
};
