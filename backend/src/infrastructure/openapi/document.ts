import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import type { INestApplication } from '@nestjs/common';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Vértice GRC API')
    .setDescription(
      'Vértice GRC — corporate Governance, Risk and Compliance platform. ' +
        'REST contracts are versioned under /api/v1, DTO-bounded, and errors ' +
        'follow RFC 9457 application/problem+json (ADR-009).',
    )
    .setVersion('1.0.0')
    .addTag('health', 'Liveness and readiness probes (unauthenticated)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  return { ...document, openapi: '3.1.0' };
}
