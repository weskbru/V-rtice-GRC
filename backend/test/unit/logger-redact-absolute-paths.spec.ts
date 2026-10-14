import { describe, expect, it } from 'vitest';

import { redactAbsoluteFilePaths } from '../../src/infrastructure/logging/logger';

describe('redactAbsoluteFilePaths (S-11, A6-F02)', () => {
  it('redacts a Windows absolute path embedded in a realistic PrismaClientKnownRequestError message, preserving the diagnostic prefix/suffix', () => {
    const message =
      'Invalid `this.prisma.client.action.count()` invocation in\n' +
      'D:\\dev\\vertice-grc\\apps\\api\\src\\grc\\finding\\infrastructure\\prisma-finding.repository.ts:181:35\n\n' +
      "Can't reach database server at `localhost:5432`";

    const redacted = redactAbsoluteFilePaths(message);

    expect(redacted).not.toContain('D:\\dev\\vertice-grc');
    expect(redacted).not.toMatch(/[A-Za-z]:\\/);
    expect(redacted).toContain('Invalid `this.prisma.client.action.count()` invocation in');
    expect(redacted).toContain("Can't reach database server at `localhost:5432`");
    expect(redacted).toContain('[redacted-path]');
  });

  it('redacts a POSIX absolute path under a well-known top-level directory', () => {
    const message =
      'Invalid `this.prisma.client.risk.findMany()` invocation in ' +
      '/home/runner/work/vertice-grc/backend/src/modules/risk/infrastructure/prisma-risk.repository.ts:42:10';

    const redacted = redactAbsoluteFilePaths(message);

    expect(redacted).not.toContain('/home/runner');
    expect(redacted).toContain('[redacted-path]');
  });

  it('leaves a message with no absolute path completely unchanged', () => {
    const message = 'Unique constraint failed on the fields: (`email`)';
    expect(redactAbsoluteFilePaths(message)).toBe(message);
  });

  it('FAILS without the fix: proves the pre-fix behaviour (logging exception.message verbatim) would have leaked the path', () => {
    const message =
      'Invalid `this.prisma.client.action.count()` invocation in D:\\dev\\vertice-grc\\apps\\api\\src\\foo.ts:1:1';
    const unfixedBehaviour = message;
    const fixedBehaviour = redactAbsoluteFilePaths(message);

    expect(fixedBehaviour).not.toBe(unfixedBehaviour);
    expect(unfixedBehaviour).toContain('D:\\dev\\vertice-grc');
    expect(fixedBehaviour).not.toContain('D:\\dev\\vertice-grc');
  });
});
