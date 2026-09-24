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
    const riskAccessor = fakeAccessor();
    const secondAccessor = fakeAccessor();

    registerAttachableEntityType('RISK', riskAccessor);
    registerCommentableEntityType('RISK', secondAccessor);

    expect(getAttachableEntityAccessor('RISK')).toBe(riskAccessor);
    expect(getCommentableEntityAccessor('RISK')).toBe(secondAccessor);
  });
});
