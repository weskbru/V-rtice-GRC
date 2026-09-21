/**
 * T087 — the sole implementation of `RiskCodeGeneratorPort`.
 *
 * ## Collision avoidance under concurrency
 *
 * `risk_code_sequences` holds one row per year (`year` is its primary key).
 * `nextCode` does exactly one `UPSERT`:
 *
 * ```sql
 * INSERT INTO risk_code_sequences (year, last_value) VALUES ($1, 1)
 * ON CONFLICT (year) DO UPDATE SET last_value = risk_code_sequences.last_value + 1
 * RETURNING last_value;
 * ```
 *
 * (Prisma's `upsert` with an `{ increment: 1 }` update compiles to exactly
 * this `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on PostgreSQL.) This
 * is the standard atomic-counter idiom: when two concurrent transactions
 * both attempt this statement for the SAME year, PostgreSQL serializes them
 * at the row level — the second transaction's `INSERT ... ON CONFLICT`
 * blocks until the first commits (or rolls back), then applies its own
 * `+ 1` against the now-current value. Two concurrent callers therefore
 * always observe two DIFFERENT, sequential `lastValue`s for the same year;
 * neither can read-then-write past the other (which a naive
 * `SELECT MAX(...) + 1` from `risks` would allow). `formatRiskCode`
 * (`domain/risk-code.ts`) is a pure function of `(year, sequence)`, so two
 * different sequence numbers can never format to the same code string.
 *
 * ## Why a failed risk creation does not "burn" a code number in the
 * success path, and why a gap is still acceptable if one occurs
 *
 * `nextCode` is always called from inside the SAME `prisma.runInTransaction`
 * scope as the `Risk` row insert (`CreateRiskUseCase`). If that transaction
 * later rolls back for any reason, PostgreSQL rolls back the counter
 * increment too — the row lock is released and the NEXT caller (in a new
 * transaction) allocates the SAME number this failed attempt would have
 * used, so a failed create never leaves a permanent gap. If a gap does
 * occur for some other reason (e.g. a crash between commit and an
 * unrelated external failure), that is still acceptable: FR-054 requires
 * `code` to be unique, human-readable and immutable — it never requires the
 * per-year sequence to be gap-free.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskCodeGeneratorPort } from '../domain/ports/risk-code-generator.port';
import { formatRiskCode } from '../domain/risk-code';

@Injectable()
export class PrismaRiskCodeGenerator implements RiskCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {}

  async nextCode(year: number): Promise<string> {
    const row = await this.prisma.client.riskCodeSequence.upsert({
      where: { year },
      create: { year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });

    return formatRiskCode(year, row.lastValue);
  }
}
