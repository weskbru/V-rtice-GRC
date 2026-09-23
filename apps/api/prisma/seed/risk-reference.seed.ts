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
