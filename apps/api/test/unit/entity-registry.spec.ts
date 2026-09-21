/**
 * Unit tests for T191's attachable/commentable entity-type registry (no
 * I/O, no NestJS container) — the extension point F-7 records as
 * previously undocumented and unbuilt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetEntityRegistryForTests,
  EntityTypeNotRegisteredError,
  getAttachableEntityAccessor,
  getCommentableEntityAccessor,
  registerAttachableEntityType,
  registerCommentableEntityType,
} from '../../src/core/comments/domain/entity-registry';

import type { ParentRecordAccessor } from '../../src/core/comments/domain/entity-registry';

function fakeAccessor(): ParentRecordAccessor {
  return {
    resolveViewableParent: vi.fn().mockResolvedValue({ organizationalUnitId: 'unit-1' }),
  };
}

describe('attachable/commentable entity-type registry (T191, FR-098, F-7)', () => {
  beforeEach(() => {
    __resetEntityRegistryForTests();
  });

  afterEach(() => {
    __resetEntityRegistryForTests();
  });

  it('throws for an entity type with no registered accessor, rather than treating it as always/never accessible', () => {
    expect(() => getAttachableEntityAccessor('RISK')).toThrow(EntityTypeNotRegisteredError);
    expect(() => getCommentableEntityAccessor('RISK')).toThrow(EntityTypeNotRegisteredError);
  });

  it('returns the registered accessor for a registered entity type', () => {
    const accessor = fakeAccessor();
    registerAttachableEntityType('RISK', accessor);

    expect(getAttachableEntityAccessor('RISK')).toBe(accessor);
  });

  it('the attachable and commentable registries are independent — registering one does not register the other', () => {
    const accessor = fakeAccessor();
    registerAttachableEntityType('RISK', accessor);

    expect(() => getCommentableEntityAccessor('RISK')).toThrow(EntityTypeNotRegisteredError);
  });

  it('refuses to register the same entity type twice in the same capability', () => {
    registerAttachableEntityType('RISK', fakeAccessor());

    expect(() => registerAttachableEntityType('RISK', fakeAccessor())).toThrow(
      /already registered/,
    );
  });

  it('a future module registers its own entity type independently, without touching an existing registration (worked example)', () => {
    // Simulates a second module registering a DIFFERENT capability
    // (commentable only) for the SAME entity type value a first module
    // already registered as attachable — proving the two registries never
    // interfere with each other, exactly as `entity-registry.ts`'s header
    // describes for a future `PROBLEM` entity type.
    const riskAccessor = fakeAccessor();
    const secondAccessor = fakeAccessor();

    registerAttachableEntityType('RISK', riskAccessor);
    registerCommentableEntityType('RISK', secondAccessor);

    expect(getAttachableEntityAccessor('RISK')).toBe(riskAccessor);
    expect(getCommentableEntityAccessor('RISK')).toBe(secondAccessor);
  });
});
