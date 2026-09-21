/**
 * Unit tests for the pure assignment-line rule
 * (`src/core/organizations/domain/assignment-line.ts`) — no I/O, no Prisma,
 * no database. See that file's own header for the rule and for the defect
 * (F-34) it exists to close: the assignment line of unit U is U itself,
 * every ANCESTOR of U (parsed from its own materialized path) and every
 * DESCENDANT of U (supplied by the caller, already expanded).
 */
import { describe, expect, it } from 'vitest';

import {
  buildAssignmentLine,
  parseAncestorOrSelfIds,
} from '../../src/core/organizations/domain/assignment-line';

describe('parseAncestorOrSelfIds', () => {
  it('parses every unit id on a materialized path, root-to-self, in order', () => {
    const path = '/root/child/leaf/';
    expect(parseAncestorOrSelfIds(path)).toEqual(['root', 'child', 'leaf']);
  });

  it('yields a single id for a root unit path', () => {
    expect(parseAncestorOrSelfIds('/root/')).toEqual(['root']);
  });

  it('yields an empty list for an empty path', () => {
    expect(parseAncestorOrSelfIds('')).toEqual([]);
  });

  it('yields an empty list for a malformed path holding only separators', () => {
    expect(parseAncestorOrSelfIds('//')).toEqual([]);
    expect(parseAncestorOrSelfIds('/')).toEqual([]);
  });
});

describe('buildAssignmentLine', () => {
  it('unions ancestors-or-self (from the path) with the supplied descendant ids', () => {
    const line = buildAssignmentLine('/root/child/leaf/', ['leaf', 'grandchild-a', 'grandchild-b']);

    expect([...line].sort()).toEqual(
      ['root', 'child', 'leaf', 'grandchild-a', 'grandchild-b'].sort(),
    );
  });

  it('excludes ids that are neither ancestors-or-self nor supplied descendants (siblings)', () => {
    const line = buildAssignmentLine('/root/child-a/leaf/', ['leaf']);

    expect(line.has('child-b')).toBe(false);
    expect(line.has('root')).toBe(true);
    expect(line.has('child-a')).toBe(true);
    expect(line.has('leaf')).toBe(true);
  });

  it('deduplicates overlap between ancestors-or-self and descendants without error', () => {
    const line = buildAssignmentLine('/root/leaf/', ['leaf', 'root']);

    expect(line.size).toBe(2);
    expect([...line].sort()).toEqual(['leaf', 'root']);
  });

  it('a malformed/empty path contributes no ancestors — the line is exactly the descendant set', () => {
    const line = buildAssignmentLine('', ['a', 'b']);

    expect([...line].sort()).toEqual(['a', 'b']);
  });

  it('a malformed/empty path with no descendants yields an empty line', () => {
    const line = buildAssignmentLine('', []);

    expect(line.size).toBe(0);
  });
});
