/**
 * T085 — initial `RiskCategory`/`RiskType`/`RiskOrigin` reference data
 * (data-model.md §7: "Organization-configurable reference tables ...
 * referenced from `Risk` with `ON DELETE RESTRICT`").
 *
 * ## Why these specific values
 *
 * Unlike `RiskStatus`/`RiskLevel` (closed platform enums whose exact values
 * `spec.md`/`data-model.md` spell out), data-model.md §7 describes
 * `RiskCategory`/`RiskType`/`RiskOrigin` only by SHAPE ("id, code (unique),
 * name, description, sortOrder, isActive") and states they are
 * "organization-configurable" — it does not enumerate starting values. This
 * seed supplies a defensible, industry-conventional starting set so the
 * risk register is usable immediately after a fresh install, exactly as
 * `platform.seed.ts` seeds system roles the spec names but not, say, a
 * starting organizational unit tree beyond the root. Every row here is
 * ordinary data, not platform logic: an organization can rename, deactivate
 * or add to these later through a reference-data administration screen (a
 * future task) without any code or migration change, because `isActive`
 * (deactivate, never delete — matching `RESTRICT`) and `sortOrder` already
 * exist for exactly that purpose.
 *
 *   - **Categories**: the five named directly in this task's own
 *     instructions (Operacional, Financeiro, Estratégico, Conformidade,
 *     Tecnológico) — the standard top-level GRC risk classification axis.
 *   - **Types**: Interno / Externo — whether the risk's driving factor sits
 *     inside or outside the organization's own control, a distinction
 *     orthogonal to category (a Financeiro risk can be internal — a costing
 *     error — or external — a currency shock).
 *   - **Origins**: Pessoas / Processos / Sistemas e Tecnologia / Eventos
 *     Externos — the classic COSO ERM / Basel operational-risk causal
 *     sources, describing WHERE a risk's cause originates rather than what
 *     domain it affects (category) or whether it is internal/external
 *     (type).
 *
 * `code` values are stable, English, upper-snake-case identifiers (D-8:
 * "everything that is a technical identifier ... stays in English") —
 * never renamed even if `name` is retranslated or edited later. `name`/
 * `description` are pt-BR interface content (D-8).
 *
 * ## Idempotency
 *
 * Every row is upserted on its natural unique key (`code`), exactly like
 * `platform.seed.ts`'s `Permission`/`Role`/`OrganizationalUnit` upserts —
 * safe to run on every deploy, converges `name`/`description`/`sortOrder`
 * to the definitions below without duplicating rows, and never touches
 * `isActive` on an existing row (a re-run must not silently reactivate a
 * category an administrator deliberately deactivated).
 *
 * ## No audit trail for this seed (same reasoning as `platform.seed.ts`)
 *
 * Seeded before any request context exists; there is no real actor to
 * attribute a "category created" event to. See `platform.seed.ts`'s own
 * "Why seed operations do NOT write to audit_event" section — the same
 * reasoning applies verbatim and is not repeated here.
 */
import type { PrismaClient } from '@prisma/client';

interface ReferenceDataDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly sortOrder: number;
}

const RISK_CATEGORY_DEFINITIONS: readonly ReferenceDataDefinition[] = [
  {
    code: 'OPERATIONAL',
    name: 'Operacional',
    description:
      'Riscos decorrentes de falhas em processos, pessoas, sistemas internos ou eventos externos que afetam a operação.',
    sortOrder: 1,
  },
  {
    code: 'FINANCIAL',
    name: 'Financeiro',
    description:
      'Riscos que afetam diretamente os resultados financeiros, o fluxo de caixa ou o valor patrimonial da organização.',
    sortOrder: 2,
  },
  {
    code: 'STRATEGIC',
    name: 'Estratégico',
    description:
      'Riscos relacionados a decisões de alto nível, posicionamento de mercado e alcance dos objetivos organizacionais.',
    sortOrder: 3,
  },
  {
    code: 'COMPLIANCE',
    name: 'Conformidade',
    description:
      'Riscos de descumprimento de leis, regulamentos, normas internas ou obrigações contratuais.',
    sortOrder: 4,
  },
  {
    code: 'TECHNOLOGICAL',
    name: 'Tecnológico',
    description:
      'Riscos relacionados à infraestrutura de tecnologia, segurança da informação e sistemas.',
    sortOrder: 5,
  },
];

const RISK_TYPE_DEFINITIONS: readonly ReferenceDataDefinition[] = [
  {
    code: 'INTERNAL',
    name: 'Interno',
    description: 'O fator determinante do risco está sob o controle direto da organização.',
    sortOrder: 1,
  },
  {
    code: 'EXTERNAL',
    name: 'Externo',
    description: 'O fator determinante do risco está fora do controle direto da organização.',
    sortOrder: 2,
  },
];

const RISK_ORIGIN_DEFINITIONS: readonly ReferenceDataDefinition[] = [
  {
    code: 'PEOPLE',
    name: 'Pessoas',
    description: 'Risco originado por ação, omissão ou capacitação de colaboradores.',
    sortOrder: 1,
  },
  {
    code: 'PROCESS',
    name: 'Processos',
    description: 'Risco originado por falhas de desenho ou execução de processos internos.',
    sortOrder: 2,
  },
  {
    code: 'SYSTEMS_TECHNOLOGY',
    name: 'Sistemas e Tecnologia',
    description:
      'Risco originado por falhas, indisponibilidade ou vulnerabilidade de sistemas e tecnologia.',
    sortOrder: 3,
  },
  {
    code: 'EXTERNAL_EVENTS',
    name: 'Eventos Externos',
    description:
      'Risco originado por eventos fora do controle da organização, como fatores regulatórios, de mercado ou naturais.',
    sortOrder: 4,
  },
];

export interface RiskReferenceSeedResult {
  readonly categoryCount: number;
  readonly typeCount: number;
  readonly originCount: number;
}

/**
 * `prisma` follows the same convention as `seedPlatform`: the seed opens its
 * own transaction directly against the raw `PrismaClient` handed over by
 * `prisma/seed/index.ts`, rather than through `PrismaService`'s
 * `AsyncLocalStorage`-based `runInTransaction` — there is no `AuditRecorder`
 * call here that needs to join an ambient transaction implicitly (see the
 * file header's "No audit trail for this seed").
 */
export async function seedRiskReferenceData(
  prisma: PrismaClient,
): Promise<RiskReferenceSeedResult> {
  return prisma.$transaction(async (tx) => {
    for (const definition of RISK_CATEGORY_DEFINITIONS) {
      await tx.riskCategory.upsert({
        where: { code: definition.code },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          sortOrder: definition.sortOrder,
        },
        // `isActive` is deliberately absent from `update` — see the file
        // header's "Idempotency" section: a re-run must never silently
        // reactivate a row an administrator deactivated.
        update: {
          name: definition.name,
          description: definition.description,
          sortOrder: definition.sortOrder,
        },
      });
    }

    for (const definition of RISK_TYPE_DEFINITIONS) {
      await tx.riskType.upsert({
        where: { code: definition.code },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          sortOrder: definition.sortOrder,
        },
        update: {
          name: definition.name,
          description: definition.description,
          sortOrder: definition.sortOrder,
        },
      });
    }

    for (const definition of RISK_ORIGIN_DEFINITIONS) {
      await tx.riskOrigin.upsert({
        where: { code: definition.code },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          sortOrder: definition.sortOrder,
        },
        update: {
          name: definition.name,
          description: definition.description,
          sortOrder: definition.sortOrder,
        },
      });
    }

    return {
      categoryCount: RISK_CATEGORY_DEFINITIONS.length,
      typeCount: RISK_TYPE_DEFINITIONS.length,
      originCount: RISK_ORIGIN_DEFINITIONS.length,
    };
  });
}
