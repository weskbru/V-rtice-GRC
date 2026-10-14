import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

export const CONTRACT_DOCUMENTS = {
  Auth: { specDir: '001-grc-platform-foundation', file: 'auth.openapi.yaml' },
  Admin: { specDir: '001-grc-platform-foundation', file: 'admin.openapi.yaml' },
  Platform: { specDir: '001-grc-platform-foundation', file: 'platform.openapi.yaml' },
  Risks: { specDir: '001-grc-platform-foundation', file: 'risks.openapi.yaml' },
  GrcFoundation: { specDir: '002-shared-grc-foundation', file: 'grc-foundation.openapi.yaml' },
  Controls: { specDir: '003-controls-management', file: 'controls.openapi.yaml' },
  Compliance: { specDir: '004-compliance-management', file: 'compliance.openapi.yaml' },
  Audit: { specDir: '005-audit-findings', file: 'audit.openapi.yaml' },
  Assets: { specDir: '006-assets-processes', file: 'assets.openapi.yaml' },
  Processes: { specDir: '006-assets-processes', file: 'processes.openapi.yaml' },
  Problems: { specDir: '008-incidents-problems', file: 'problems.openapi.yaml' },
  Incidents: { specDir: '008-incidents-problems', file: 'incidents.openapi.yaml' },
  Indicators: { specDir: '009-indicators-reports', file: 'indicators.openapi.yaml' },
  Reports: { specDir: '009-indicators-reports', file: 'reports.openapi.yaml' },
} as const;

export type ContractDocumentKey = keyof typeof CONTRACT_DOCUMENTS;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface OpenApiMediaType {
  readonly schema?: unknown;
}

export interface OpenApiResponse {
  readonly content?: Readonly<Record<string, OpenApiMediaType>>;
  readonly $ref?: string;
}

export interface OpenApiOperation {
  readonly operationId?: string;
  readonly responses?: Readonly<Record<string, OpenApiResponse>>;
}

export type OpenApiPathItem = Readonly<Partial<Record<HttpMethod, OpenApiOperation>>>;

export interface OpenApiDocument {
  readonly paths?: Readonly<Record<string, OpenApiPathItem>>;
  readonly components?: {
    readonly schemas?: Readonly<Record<string, unknown>>;
    readonly responses?: Readonly<Record<string, OpenApiResponse>>;
  };
}

export function resolveResponseObject(
  doc: OpenApiDocument,
  responseEntry: OpenApiResponse,
  ownPointer: string,
): { readonly response: OpenApiResponse; readonly pointer: string } {
  if (!responseEntry.$ref) {
    return { response: responseEntry, pointer: ownPointer };
  }
  const refPath = responseEntry.$ref.replace(/^#\//, '').split('/');
  const target = refPath.reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, doc);
  if (!target) {
    throw new Error(`Could not resolve response $ref "${responseEntry.$ref}".`);
  }
  return { response: target, pointer: `/${refPath.join('/')}` };
}

const specsRoot = path.resolve(__dirname, '../../../../specs');

const documentCache = new Map<ContractDocumentKey, OpenApiDocument>();

export function loadContractDocument(key: ContractDocumentKey): OpenApiDocument {
  const cached = documentCache.get(key);
  if (cached) {
    return cached;
  }

  const { specDir, file } = CONTRACT_DOCUMENTS[key];
  const sourcePath = path.resolve(specsRoot, specDir, 'contracts', file);
  const raw = readFileSync(sourcePath, 'utf-8');
  const doc = parse(raw) as OpenApiDocument;
  documentCache.set(key, doc);
  return doc;
}

export interface ContractOperation {
  readonly documentKey: ContractDocumentKey;
  readonly path: string;
  readonly method: HttpMethod;
  readonly operationId: string;
  readonly operation: OpenApiOperation;
}

export function listAllOperations(): readonly ContractOperation[] {
  const operations: ContractOperation[] = [];

  for (const documentKey of Object.keys(CONTRACT_DOCUMENTS) as ContractDocumentKey[]) {
    const doc = loadContractDocument(documentKey);
    const paths = doc.paths ?? {};
    for (const [operationPath, pathItem] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation?.operationId) {
          continue;
        }
        operations.push({
          documentKey,
          path: operationPath,
          method,
          operationId: operation.operationId,
          operation,
        });
      }
    }
  }

  return operations;
}

const JSON_CONTENT_TYPES = new Set(['application/json', 'application/problem+json']);

export interface OperationBodyClassification {
  readonly hasJsonBody: boolean;
  readonly hasNonJsonBody: boolean;
  readonly hasAnySuccessResponse: boolean;
}

export function classifyOperationBody(operation: OpenApiOperation): OperationBodyClassification {
  const responses = operation.responses ?? {};
  const successCodes = Object.keys(responses).filter((code) => /^2\d\d$/.test(code));

  let hasJsonBody = false;
  let hasNonJsonBody = false;

  for (const code of successCodes) {
    const content = responses[code]?.content;
    if (!content) {
      continue;
    }
    const contentTypes = Object.keys(content);
    if (contentTypes.some((type) => JSON_CONTENT_TYPES.has(type))) {
      hasJsonBody = true;
    }
    if (contentTypes.some((type) => !JSON_CONTENT_TYPES.has(type))) {
      hasNonJsonBody = true;
    }
  }

  return { hasJsonBody, hasNonJsonBody, hasAnySuccessResponse: successCodes.length > 0 };
}

export function buildBodyExclusionInventory(): {
  readonly noBody: readonly ContractOperation[];
  readonly binary: readonly ContractOperation[];
} {
  const noBody: ContractOperation[] = [];
  const binary: ContractOperation[] = [];

  for (const op of listAllOperations()) {
    const classification = classifyOperationBody(op.operation);
    if (!classification.hasAnySuccessResponse) {
      continue;
    }
    if (!classification.hasJsonBody && !classification.hasNonJsonBody) {
      noBody.push(op);
    } else if (!classification.hasJsonBody && classification.hasNonJsonBody) {
      binary.push(op);
    }
  }

  return { noBody, binary };
}

export function findOperation(
  documentKey: ContractDocumentKey,
  operationId: string,
): ContractOperation {
  const doc = loadContractDocument(documentKey);
  const paths = doc.paths ?? {};
  for (const [operationPath, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation?.operationId === operationId) {
        return { documentKey, path: operationPath, method, operationId, operation };
      }
    }
  }
  throw new Error(`No operation "${operationId}" found in the ${documentKey} contract.`);
}

interface CompiledOperationMatcher {
  readonly operation: ContractOperation;
  readonly segments: readonly string[];
}

let compiledMatchers: readonly CompiledOperationMatcher[] | undefined;

function compileMatchers(): readonly CompiledOperationMatcher[] {
  if (compiledMatchers) {
    return compiledMatchers;
  }
  compiledMatchers = listAllOperations().map((operation) => ({
    operation,
    segments: operation.path.split('/').filter((segment) => segment.length > 0),
  }));
  return compiledMatchers;
}

export function matchOperationForRequest(
  method: string,
  requestPath: string,
): ContractOperation | undefined {
  const normalizedMethod = method.toLowerCase();
  if (!(HTTP_METHODS as readonly string[]).includes(normalizedMethod)) {
    return undefined;
  }
  const requestSegments = requestPath.split('/').filter((segment) => segment.length > 0);

  for (const candidate of compileMatchers()) {
    if (candidate.operation.method !== normalizedMethod) {
      continue;
    }
    if (candidate.segments.length !== requestSegments.length) {
      continue;
    }
    const matches = candidate.segments.every((templateSegment, index) => {
      const requestSegment = requestSegments[index];
      if (requestSegment === undefined) {
        return false;
      }
      if (templateSegment.startsWith('{') && templateSegment.endsWith('}')) {
        return requestSegment.length > 0;
      }
      return templateSegment === requestSegment;
    });
    if (matches) {
      return candidate.operation;
    }
  }
  return undefined;
}
