import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';

type Bucket = 'passed' | 'failed' | 'flaky' | 'skipped' | 'notRun' | 'interrupted';

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
      if (test.results.length === 0 || test.expectedStatus !== 'skipped') {
        return 'notRun';
      }
      return 'skipped';
    default:
      return 'notRun';
  }
}

function projectName(test: TestCase): string {
  for (let suite: Suite | undefined = test.parent; suite; suite = suite.parent) {
    if (suite.type === 'project') {
      return suite.title;
    }
  }
  return '';
}

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
    const base = config.configFile ? dirname(config.configFile) : process.cwd();
    this.outputFile = resolve(base, 'playwright-report', 'execution-ledger.json');
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- a implementação é síncrona; a interface aceita Promise ou void.
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

    const green =
      discovered > 0 &&
      failed === 0 &&
      notRun === 0 &&
      interrupted === 0 &&
      environmentSkips.length === 0 &&
      balanced &&
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

    if (!green && result.status === 'passed') {
      return { status: 'failed' };
    }
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- a implementação é síncrona, mas o tipo exige Promise<void>.
  async onExit(): Promise<void> {
    if (!this.outputFile) {
      return;
    }
    try {
      mkdirSync(dirname(this.outputFile), { recursive: true });
      writeFileSync(this.outputFile, `${JSON.stringify(this.ledger, null, 2)}\n`, 'utf8');
    } catch {}
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
