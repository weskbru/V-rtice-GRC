import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

/**
 * F-72 — the ledger that makes "did not run" impossible to read as success.
 *
 * ## The defect this exists for
 *
 * A full Chromium run finished **123 passed / 1 failed / 73 did not run**, and
 * the terminal line a human reads was "1 failed". Among the 73 that never
 * executed were the fourteen `/admin/roles` accessibility scans — the gate for
 * a whole screen simply was not measured, and nothing said so louder than the
 * one failure did. That is F-28's class of defect wearing a better number: a
 * gate reporting honestly about something it never looked at.
 *
 * Playwright already *counts* "did not run" (`generateSummary()` in its own
 * base reporter). What it does not do is make the distinction load-bearing:
 * the line is one yellow token among several, it sorts below "failed" in a
 * reader's attention, and — the part that matters — a run can finish with a
 * zero exit code while tests that were discovered never executed at all.
 *
 * ## What this reporter guarantees
 *
 * 1. Every run prints an explicit decomposition —
 *    DISCOVERED · EXECUTED · PASSED · FAILED · FLAKY · SKIPPED · NOT RUN ·
 *    INTERRUPTED — and the identity of every test in the last two buckets, by
 *    file and title. Not a count to be trusted: a list to be checked.
 * 2. `DISCOVERED === EXECUTED + SKIPPED + NOT RUN + INTERRUPTED` is asserted
 *    arithmetically and printed. If the books do not balance, the ledger says
 *    so rather than silently dropping a test from one of its buckets.
 * 3. A run with any NOT RUN or INTERRUPTED test is **not green**, and the
 *    process exits non-zero even when nothing failed — `onEnd` may return a
 *    replacement `status`, which is the supported way to say this
 *    (`Reporter.onEnd` returns `Promise<{ status? } | void>` since 1.42).
 *
 * ## The three buckets, and why the boundary between them is not a judgement call
 *
 * The classification below is Playwright's own, read out of
 * `playwright/lib/runner/index.js`'s `generateSummary()` rather than invented
 * here, so this ledger and the terminal summary can never disagree about what
 * a given test was:
 *
 * | Playwright `test.outcome()` | plus | bucket |
 * |---|---|---|
 * | `expected` | — | PASSED |
 * | `unexpected` | — | FAILED |
 * | `flaky` | — | FLAKY (executed; passed on a retry) |
 * | `skipped` | some result is `interrupted` | INTERRUPTED |
 * | `skipped` | no results at all, **or** `expectedStatus !== 'skipped'` | NOT RUN |
 * | `skipped` | otherwise | SKIPPED (a real `test.skip`, deliberate) |
 *
 * The middle row is the one that matters. A test cancelled because an earlier
 * test in its serial group failed gets a `skipped` result while its
 * `expectedStatus` is still `passed` — it is indistinguishable from a
 * deliberate skip at a glance, and identical to one in the exit code. That is
 * precisely the confusion F-72 measured.
 *
 * ## Deliberate skips are counted, named, and still not silent
 *
 * A `test.skip` is legitimate (`accessibility.spec.ts` skips one scan when the
 * database has fewer than three organizational units). But D-22 Trap 4 records
 * the other kind: with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` unset, almost
 * the entire suite skips and the run exits 0. `requireSeedCredentials` already
 * turns that into a hard failure **in CI** (F-33); locally it still skips by
 * design, for a developer running a subset without a seeded backend. So this
 * ledger does not duplicate that guard — it makes the condition impossible to
 * miss: environment-blocked skips are counted in their own line, and the
 * verdict prints NOT GREEN whenever there is one. Deciding that a local subset
 * run is nevertheless acceptable stays a human's call; believing it was a full
 * green run does not.
 */

type Bucket = 'passed' | 'failed' | 'flaky' | 'skipped' | 'notRun' | 'interrupted';

/**
 * The substring `requireSeedCredentials` puts in its skip reason
 * (`apps/web/e2e/support/admin-session.ts`). Matched on the reason rather than
 * on a spec-file list, so a spec added tomorrow is covered without editing
 * this file.
 */
const ENVIRONMENT_SKIP_MARKER = 'SEED_ADMIN_EMAIL';

interface LedgerEntry {
  readonly bucket: Bucket;
  readonly project: string;
  readonly location: string;
  readonly title: string;
  readonly reason: string | null;
}

function classify(test: TestCase): Bucket {
  switch (test.outcome()) {
    case 'expected':
      return 'passed';
    case 'unexpected':
      return 'failed';
    case 'flaky':
      return 'flaky';
    case 'skipped':
      if (test.results.some((result) => result.status === 'interrupted')) {
        return 'interrupted';
      }
      // Playwright's own rule, verbatim: no result at all, or a result whose
      // expected status was never "skipped", means the test was cancelled —
      // not skipped on purpose.
      if (test.results.length === 0 || test.expectedStatus !== 'skipped') {
        return 'notRun';
      }
      return 'skipped';
    default:
      return 'notRun';
  }
}

/** The project (`chromium`/`firefox`/`webkit`) this test instance belongs to. */
function projectName(test: TestCase): string {
  for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
    if (suite.type === 'project') {
      return suite.title;
    }
  }
  return '';
}

/**
 * The test's title with its enclosing `describe` titles, and nothing else.
 *
 * Deliberately NOT `titlePath().slice(2)` — and neither is `projectName` above
 * `titlePath()[1]`: that path's shape depends on whether the config declares
 * named projects (with them, index 1 is the project and index 2 the file;
 * without them the file lands at index 1), so the same code prints the file
 * name twice in one configuration and correctly in the other. Walking the
 * suite chain and reading each node's declared `type` is true in both.
 */
function describeTitle(test: TestCase): string {
  const parts: string[] = [test.title];
  for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
    if (suite.type === 'describe' && suite.title) {
      parts.unshift(suite.title);
    }
  }
  return parts.join(' › ');
}

function skipReason(test: TestCase): string | null {
  const annotation = test.annotations.find((item) => item.type === 'skip' || item.type === 'fixme');
  return annotation?.description ?? null;
}

export default class ExecutionLedgerReporter implements Reporter {
  private suite: Suite | undefined;
  private config: FullConfig | undefined;
  private entries: LedgerEntry[] = [];
  private outputFile = '';
  private ledger: Record<string, unknown> = {};

  printsToStdio(): boolean {
    return true;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    // Beside the HTML report, which Playwright places relative to the CONFIG
    // FILE's directory — not relative to `rootDir`, which is the common
    // ancestor of the test directories (`apps/web/e2e` here) and would drop a
    // report folder inside the suite itself.
    const base = config.configFile ? dirname(config.configFile) : process.cwd();
    this.outputFile = resolve(base, 'playwright-report', 'execution-ledger.json');
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- `Reporter.onEnd` may only return a Promise or void, and everything it does here is synchronous.
  async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | void> {
    const tests = this.suite?.allTests() ?? [];

    this.entries = tests.map((test) => ({
      bucket: classify(test),
      project: projectName(test),
      location: `${relativeFile(test, this.config)}:${String(test.location.line)}`,
      title: describeTitle(test),
      reason: skipReason(test),
    }));

    const count = (bucket: Bucket): number =>
      this.entries.filter((entry) => entry.bucket === bucket).length;

    const discovered = this.entries.length;
    const passed = count('passed');
    const failed = count('failed');
    const flaky = count('flaky');
    const skipped = count('skipped');
    const notRun = count('notRun');
    const interrupted = count('interrupted');
    const executed = passed + failed + flaky;
    const balanced = executed + skipped + notRun + interrupted === discovered;

    const environmentSkips = this.entries.filter(
      (entry) =>
        entry.bucket === 'skipped' && (entry.reason ?? '').includes(ENVIRONMENT_SKIP_MARKER),
    );

    /**
     * A run that discovered nothing measured nothing — and it must never read
     * as success.
     *
     * This clause exists because the FIRST real invocation of this reporter
     * found the hole: `globalSetup` threw (a bootstrap account whose password
     * did not settle), so no test was ever collected, every bucket was 0, and
     * the ledger printed "VERDICT: GREEN" over `Playwright status: failed`.
     * That is the very shape of F-72 — a gate reporting cheerfully about
     * something it never looked at — reproduced by the gate written to prevent
     * it. Recorded rather than quietly patched, because "zero of zero passed"
     * is exactly the arithmetic that makes an empty run look like a clean one.
     */
    const green =
      discovered > 0 &&
      failed === 0 &&
      notRun === 0 &&
      interrupted === 0 &&
      environmentSkips.length === 0 &&
      balanced &&
      // Playwright's own verdict still counts: a `globalSetup` throw, a fatal
      // worker error or an `onError` outside any test lands here and in none
      // of the per-test buckets above.
      result.status === 'passed';

    this.ledger = {
      generatedAt: new Date().toISOString(),
      playwrightStatus: result.status,
      verdict: green ? 'GREEN' : 'NOT GREEN',
      counts: {
        discovered,
        executed,
        passed,
        failed,
        flaky,
        skipped,
        notRun,
        interrupted,
        environmentBlockedSkips: environmentSkips.length,
      },
      balanced,
      notRunTests: this.entries
        .filter((entry) => entry.bucket === 'notRun' || entry.bucket === 'interrupted')
        .map((entry) => ({
          bucket: entry.bucket,
          project: entry.project,
          location: entry.location,
          title: entry.title,
        })),
      skippedTests: this.entries
        .filter((entry) => entry.bucket === 'skipped')
        .map((entry) => ({
          project: entry.project,
          location: entry.location,
          title: entry.title,
          reason: entry.reason,
        })),
    };

    this.print({
      discovered,
      executed,
      passed,
      failed,
      flaky,
      skipped,
      notRun,
      interrupted,
      environmentSkips: environmentSkips.length,
      balanced,
      green,
      playwrightStatus: result.status,
    });

    // The whole point of the ledger: a run that did not execute what it
    // discovered cannot exit 0. Playwright's own status is already `failed`
    // when something failed; this ADDS the case where nothing failed and tests
    // were nevertheless cancelled or never started.
    if (!green && result.status === 'passed') {
      return { status: 'failed' };
    }
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- `Reporter.onExit` is typed as returning `Promise<void>`; there is nothing asynchronous to do here.
  async onExit(): Promise<void> {
    if (!this.outputFile) {
      return;
    }
    try {
      mkdirSync(dirname(this.outputFile), { recursive: true });
      writeFileSync(this.outputFile, `${JSON.stringify(this.ledger, null, 2)}\n`, 'utf8');
    } catch {
      // A ledger that cannot be written must not take the run down with it —
      // the decomposition was already printed to stdout, which is the channel
      // the gate actually depends on.
    }
  }

  private print(summary: {
    discovered: number;
    executed: number;
    passed: number;
    failed: number;
    flaky: number;
    skipped: number;
    notRun: number;
    interrupted: number;
    environmentSkips: number;
    balanced: boolean;
    green: boolean;
    playwrightStatus: string;
  }): void {
    const lines: string[] = [];
    const rule = '='.repeat(72);
    lines.push('');
    lines.push(rule);
    lines.push('EXECUTION LEDGER (F-72) — what was discovered, and what actually ran');
    lines.push(rule);
    lines.push(`  DISCOVERED  ${pad(summary.discovered)}`);
    lines.push(`  EXECUTED    ${pad(summary.executed)}   (passed + failed + flaky)`);
    lines.push(`    PASSED    ${pad(summary.passed)}`);
    lines.push(`    FAILED    ${pad(summary.failed)}`);
    lines.push(`    FLAKY     ${pad(summary.flaky)}`);
    lines.push(
      `  SKIPPED     ${pad(summary.skipped)}   (deliberate test.skip — ${String(
        summary.environmentSkips,
      )} of them blocked by environment)`,
    );
    lines.push(`  NOT RUN     ${pad(summary.notRun)}   (discovered, never executed)`);
    lines.push(`  INTERRUPTED ${pad(summary.interrupted)}   (started, never finished)`);
    lines.push(
      `  BALANCE     ${
        summary.balanced
          ? 'ok (executed + skipped + not run + interrupted = discovered)'
          : 'MISMATCH — the buckets do not add up to the discovered total'
      }`,
    );

    const blocked = this.entries.filter(
      (entry) => entry.bucket === 'notRun' || entry.bucket === 'interrupted',
    );
    if (blocked.length > 0) {
      lines.push('');
      lines.push(`  The ${String(blocked.length)} test(s) that were discovered and never ran:`);
      for (const entry of blocked) {
        lines.push(
          `    [${entry.bucket === 'interrupted' ? 'INTERRUPTED' : 'NOT RUN'}] ` +
            `${entry.project ? `[${entry.project}] ` : ''}${entry.location} › ${entry.title}`,
        );
      }
    }

    if (summary.environmentSkips > 0) {
      lines.push('');
      lines.push(
        `  ${String(summary.environmentSkips)} test(s) skipped because the environment is not ` +
          'configured (D-22 Trap 4): SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. This run measured ' +
          'nothing about the authenticated product.',
      );
    }

    if (summary.discovered === 0) {
      lines.push('');
      lines.push(
        '  NO TEST WAS EVEN DISCOVERED. Nothing was measured — check globalSetup, the project ' +
          'filter and the file arguments. "0 failed" here means "0 looked at".',
      );
    }

    lines.push('');
    lines.push(
      summary.green
        ? '  VERDICT: GREEN — every discovered test executed, and every one of them passed.'
        : '  VERDICT: NOT GREEN — see the decomposition above. A run in which a discovered test ' +
            'never executed is not a passing regression, whatever the failure count says.',
    );
    lines.push(`  (Playwright status: ${summary.playwrightStatus})`);
    lines.push(rule);
    lines.push('');

    process.stdout.write(`${lines.join('\n')}\n`);
  }
}

function pad(value: number): string {
  return String(value).padStart(4, ' ');
}

function relativeFile(test: TestCase, config: FullConfig | undefined): string {
  const root = config?.rootDir ?? '';
  const file = test.location.file;
  if (root && file.startsWith(root)) {
    return file.slice(root.length + 1).replace(/\\/g, '/');
  }
  return file.replace(/\\/g, '/');
}
