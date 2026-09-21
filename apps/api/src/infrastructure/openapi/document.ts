/**
 * Shared OpenAPI document builder (T025 / ADR-009). Used by both
 * `scripts/generate-openapi.ts` and `scripts/check-openapi.ts` so the two
 * can never define the document differently and disagree.
 */
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import type { INestApplication } from '@nestjs/common';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('PharosGRC API')
    .setDescription(
      'PharosGRC — corporate Governance, Risk and Compliance platform. ' +
        'REST contracts are versioned under /api/v1, DTO-bounded, and errors ' +
        'follow RFC 9457 application/problem+json (ADR-009).',
    )
    .setVersion('1.0.0')
    .addTag('health', 'Liveness and readiness probes (unauthenticated)')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // @nestjs/swagger produces an OpenAPI 3.0 document; ADR-009 fixes 3.1.
  // The decorator-driven schemas Nest generates are valid JSON Schema
  // fragments compatible with both versions at this project's current
  // level of usage, so overriding the version field is a safe, explicit
  // choice rather than a structural rewrite.
  return { ...document, openapi: '3.1.0' };
}
