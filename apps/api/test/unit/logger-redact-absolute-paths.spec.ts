/**
 * S-11 (audit A6-F02) — `redactAbsoluteFilePaths` (`infrastructure/logging/
 * logger.ts`). `ProblemDetailsFilter.logException` logs
 * `exception.message` verbatim for every unhandled >=500 error; a
 * `PrismaClientKnownRequestError`'s own `.message` embeds a "code frame"
 * citing the absolute source path of the call site — a value
 * `sanitizeLogMeta`'s name-based redaction cannot catch (it lives under the
 * innocuous key `message`, not a key matching `SENSITIVE_KEY_PATTERN`).
 *
 * Reproduced against a REAL sample captured during the audit (A6-F02's own
 * evidence): running the contract suite under PostgreSQL connection
 * contention surfaced
 * `test/contract/information-disclosure.spec.ts` failing with exactly this
 * shape of message reaching the operational log.
 */
import { describe, expect, it } from 'vitest';

import { redactAbsoluteFilePaths } from '../../src/infrastructure/logging/logger';

describe('redactAbsoluteFilePaths (S-11, A6-F02)', () => {
  it('redacts a Windows absolute path embedded in a realistic PrismaClientKnownRequestError message, preserving the diagnostic prefix/suffix', () => {
    const message =
      'Invalid `this.prisma.client.action.count()` invocation in\n' +
      'D:\\dev\\pharos-grc\\apps\\api\\src\\grc\\finding\\infrastructure\\prisma-finding.repository.ts:181:35\n\n' +
      "Can't reach database server at `localhost:5432`";

    const redacted = redactAbsoluteFilePaths(message);

    expect(redacted).not.toContain('D:\\dev\\pharos-grc');
    expect(redacted).not.toMatch(/[A-Za-z]:\\/);
    // Diagnostic content on either side of the path survives.
    expect(redacted).toContain('Invalid `this.prisma.client.action.count()` invocation in');
    expect(redacted).toContain("Can't reach database server at `localhost:5432`");
    expect(redacted).toContain('[redacted-path]');
  });

  it('redacts a POSIX absolute path under a well-known top-level directory', () => {
    const message =
      'Invalid `this.prisma.client.risk.findMany()` invocation in ' +
      '/home/runner/work/pharos-grc/apps/api/src/modules/risk/infrastructure/prisma-risk.repository.ts:42:10';

    const redacted = redactAbsoluteFilePaths(message);

    expect(redacted).not.toContain('/home/runner');
    expect(redacted).toContain('[redacted-path]');
  });

  it('leaves a message with no absolute path completely unchanged', () => {
    const message = 'Unique constraint failed on the fields: (`email`)';
    expect(redactAbsoluteFilePaths(message)).toBe(message);
  });

  it('FAILS without the fix: proves the pre-fix behaviour (logging exception.message verbatim) would have leaked the path', () => {
    // This is the exact pre-fix expression `logException` used to build its
    // `message` field: `exception.message` with no redaction at all. This
    // test documents — and would fail if `redactAbsoluteFilePaths` regressed
    // to an identity function — that the fix actually changes the value.
    const message =
      'Invalid `this.prisma.client.action.count()` invocation in D:\\dev\\pharos-grc\\apps\\api\\src\\foo.ts:1:1';
    const unfixedBehaviour = message; // what `logException` sent to the log before S-11
    const fixedBehaviour = redactAbsoluteFilePaths(message);

    expect(fixedBehaviour).not.toBe(unfixedBehaviour);
    expect(unfixedBehaviour).toContain('D:\\dev\\pharos-grc'); // the pre-fix leak, for contrast
    expect(fixedBehaviour).not.toContain('D:\\dev\\pharos-grc');
  });
});
