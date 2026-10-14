import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import {
  loadContractDocument,
  resolveResponseObject,
  type ContractDocumentKey,
  type ContractOperation,
} from './openapi-documents';

import type { ErrorObject, ValidateFunction } from 'ajv';

const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  discriminator: false,
});
addFormats(ajv);

const registeredDocuments = new Set<ContractDocumentKey>();

function ensureDocumentRegistered(documentKey: ContractDocumentKey): void {
  if (registeredDocuments.has(documentKey)) {
    return;
  }
  const doc = loadContractDocument(documentKey);
  ajv.addSchema(doc, documentKey);
  registeredDocuments.add(documentKey);
}

const compiledValidators = new Map<string, ValidateFunction>();

function getComponentSchemaValidator(
  documentKey: ContractDocumentKey,
  schemaName: string,
): ValidateFunction {
  const cacheKey = `${documentKey}#/components/schemas/${schemaName}`;
  const cached = compiledValidators.get(cacheKey);
  if (cached) {
    return cached;
  }

  ensureDocumentRegistered(documentKey);
  const validate = ajv.getSchema(cacheKey);
  if (!validate) {
    throw new Error(
      `Ajv could not resolve ${cacheKey} — check the schema name against the contract's own ` +
        `components.schemas keys.`,
    );
  }
  compiledValidators.set(cacheKey, validate);
  return validate;
}

export interface ResponseSchemaLookup {
  readonly jsonPointer: string;
  readonly contentType: string;
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function resolveResponseSchema(
  operation: ContractOperation,
  statusCode: number,
): ResponseSchemaLookup | undefined {
  const rawResponseEntry = operation.operation.responses?.[String(statusCode)];
  if (!rawResponseEntry) {
    return undefined;
  }

  const ownPointer = [
    '',
    'paths',
    escapePointerSegment(operation.path),
    operation.method,
    'responses',
    String(statusCode),
  ].join('/');

  const doc = loadContractDocument(operation.documentKey);
  const { response: responseEntry, pointer: responsePointer } = resolveResponseObject(
    doc,
    rawResponseEntry,
    ownPointer,
  );

  const content = responseEntry.content;
  if (!content) {
    return undefined;
  }
  const contentType = content['application/json']
    ? 'application/json'
    : content['application/problem+json']
      ? 'application/problem+json'
      : undefined;
  if (!contentType) {
    return undefined;
  }

  const jsonPointer = `${responsePointer}/content/${escapePointerSegment(contentType)}/schema`;

  return { jsonPointer, contentType };
}

export interface PayloadValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || '(root)';
    return (
      `${location} ${error.message ?? 'failed validation'} ` +
      `(keyword: ${error.keyword}${error.params ? `, params: ${JSON.stringify(error.params)}` : ''})`
    );
  });
}

export function validateResponseBody(
  operation: ContractOperation,
  statusCode: number,
  body: unknown,
): PayloadValidationResult {
  const lookup = resolveResponseSchema(operation, statusCode);
  if (!lookup) {
    throw new Error(
      `${operation.operationId} declares no JSON response body for status ${String(statusCode)} — ` +
        'this status is not validatable; check buildBodyExclusionInventory() before calling this ' +
        'function for a bodyless or binary operation.',
    );
  }

  const { documentKey } = operation;
  ensureDocumentRegistered(documentKey);

  const schemaRef = `${documentKey}#${lookup.jsonPointer}`;
  let validate = compiledValidators.get(schemaRef);
  if (!validate) {
    const resolved = ajv.getSchema(schemaRef);
    if (!resolved) {
      throw new Error(`Ajv could not resolve ${schemaRef} for operation ${operation.operationId}.`);
    }
    validate = resolved;
    compiledValidators.set(schemaRef, validate);
  }

  const valid = validate(body);
  return { valid, errors: formatErrors(validate.errors) };
}

export function validateAgainstSchema(
  documentKey: ContractDocumentKey,
  schemaName: string,
  body: unknown,
): PayloadValidationResult {
  const validate = getComponentSchemaValidator(documentKey, schemaName);
  const valid = validate(body);
  return { valid, errors: formatErrors(validate.errors) };
}
