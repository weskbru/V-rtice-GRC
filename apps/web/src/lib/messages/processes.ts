/**
 * PharosGRC — Gestão de Processos (pt-BR), 006-assets-processes.
 *
 * Promoção do registro mínimo `Process` (Fase 1) a domínio de negócio
 * próprio (CLAUDE.md §17 item 12, `docs/architecture/grc-roadmap.md`), na
 * mesma fase que `assets.ts` e com a **mesma forma**, deliberadamente
 * (FR-020) — este catálogo espelha `assets.ts` seção por seção; onde os
 * dois divergem é só vocabulário ("ativo" -> "processo") e o prefixo do
 * código (`AST` -> `PRC`). Segue identicamente a convenção que `controls.ts`/
 * `audit-engagements.ts` já estabeleceram (CLAUDE.md §18.12).
 *
 * Rótulos de campo espelham `specs/006-assets-processes/data-model.md` e o
 * esquema de requisição/resposta em `contracts/processes.openapi.yaml`.
 *
 * **Sem conflito de versão.** Ao contrário de `controls.ts`/`audit-
 * engagements.ts`, este catálogo não contém nenhuma mensagem de conflito de
 * versão otimista ("alterado por outra pessoa") — o contrato deste recurso
 * não declara `If-Match`, `ETag` nem `409` (ver `features/processes/
 * types.ts`).
 *
 * **Desativação nunca é exclusão (FR-012).** Todo texto de desativação
 * abaixo é redigido para deixar isso inequívoco: o processo continua
 * legível e continua aparecendo nos vínculos já existentes — só deixa de
 * aceitar vínculo **novo**.
 *
 * Situação (ativo/inativo) nunca depende só de cor (CLAUDE.md §18.8, FR-019)
 * — `StatusBadge` já compõe cor + ícone + rótulo textual por padrão; este
 * catálogo fornece o rótulo e a variante, nunca cor isolada.
 */
import type { IncidentStatusRef, ProcessListSortField } from '@/features/processes/types';
import type { StatusVariant } from '@pharos/design-system/components';

/** Mirrors `isActive` — a two-state situation, never a third value (data-model.md §3). Distinguishable by more than color: label + `StatusBadge`'s own icon (FR-019, CLAUDE.md §18.8). */
const SITUATION_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
} as const;

const SITUATION_VARIANT: Record<keyof typeof SITUATION_LABELS, StatusVariant> = {
  active: 'success',
  inactive: 'neutral',
};

export const processes = {
  situationLabels: SITUATION_LABELS,
  situationVariant: SITUATION_VARIANT,

  /** `/processes` — the process catalog (US1, US2, US3). */
  register: {
    pageTitle: 'Processos',
    pageDescription:
      'Catálogo de processos da organização: o que a organização executa, sua unidade e a que riscos e controles está vinculado.',
    createAction: 'Novo processo',
    tableCaption: 'Lista de processos cadastrados',

    /**
     * Indicadores compactos do topo do catálogo (T046, CLAUDE.md §19.7):
     * cada figura lê `meta.total` da MESMA consulta `GET /processes` que o
     * próprio catálogo usa (`processesApi.listCatalog`, `pageSize: 1`),
     * filtrada exatamente como o link do próprio card filtra o catálogo —
     * um único calculador para "quantos processos casam com X", nunca uma
     * recontagem no cliente. Espelha `assets.ts`'s own `register.summary`
     * shape-for-shape (FR-020, CLAUDE.md §18.12).
     */
    summary: {
      regionLabel: 'Resumo do catálogo de processos',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de processos',
        hint: 'Todos os processos no seu escopo',
        linkLabel: 'Ver todos os processos',
      },
      active: {
        label: 'Processos em uso',
        hint: 'Situação ativa — aceitam novos vínculos',
        linkLabel: 'Ver processos em uso',
      },
      inactive: {
        label: 'Processos desativados',
        hint: 'Situação inativa — não aceitam novos vínculos',
        linkLabel: 'Ver processos desativados',
      },
    },

    view: {
      cards: 'Cards',
      cardsLabel: 'Exibir como cards',
      table: 'Tabela',
      tableLabel: 'Exibir como tabela',
      groupLabel: 'Modo de exibição',
    },

    filters: {
      regionLabel: 'Filtros do catálogo de processos',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar processos',
      searchPlaceholder: 'Buscar por código ou nome…',
      orgUnitLabel: 'Unidade organizacional',
      situationLabel: 'Situação',
      situationAll: 'Todas as situações',
      situationActive: 'Ativo',
      situationInactive: 'Inativo',
      loadingOptions: 'Carregando opções…',
      optionsError: 'Não foi possível carregar as opções de filtro.',
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 processo' : `${total.toLocaleString('pt-BR')} processos`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: {
        code: 'Código',
        name: 'Nome',
        updatedAt: 'Última atualização',
      } satisfies Record<ProcessListSortField, string>,
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      },
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} — ${directionLabel}`,
      /** Every field the contract accepts, in both directions — the same set this register has always offered, now declared instead of recomputed in the component. */
      sortOptions: {
        'code:asc': 'Código — crescente',
        'code:desc': 'Código — decrescente',
        'name:asc': 'Nome — crescente',
        'name:desc': 'Nome — decrescente',
        'updatedAt:asc': 'Última atualização — crescente',
        'updatedAt:desc': 'Última atualização — decrescente',
      } as Record<string, string>,
    },

    columns: {
      code: 'Código',
      name: 'Nome',
      orgUnit: 'Unidade organizacional',
      situation: 'Situação',
      updatedAt: 'Última atualização',
      notSet: 'Não definida',
    },

    card: {
      regionLabel: 'Processos',
      selectLabel: (code: string, name: string): string => `Abrir processo ${code} — ${name}`,
      orgUnitLabel: 'Unidade',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },

    loading: 'Carregando processos…',
    loadError: 'Não foi possível carregar o catálogo de processos.',
    retryAction: 'Tentar novamente',

    empty: {
      noneYet: {
        title: 'Nenhum processo cadastrado',
        description:
          'Cadastre o primeiro processo da sua unidade organizacional para começar a vinculá-lo a riscos e controles.',
        createAction: 'Cadastrar processo',
      },
      noResults: {
        title: 'Nenhum processo encontrado',
        description: 'Nenhum processo corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  /** `/processes/[id]` — process detail (US1). */
  detail: {
    loading: 'Carregando processo…',
    notFoundTitle: 'Processo não encontrado',
    notFoundDescription:
      'Este processo não existe ou está fora do seu escopo organizacional de acesso.',
    editAction: 'Editar',
    backToRegister: 'Voltar ao catálogo de processos',
    metadata: {
      orgUnit: (name: string): string => `Unidade: ${name}`,
      /** Um processo cadastrado antes deste módulo pode não ter unidade registrada (data-model.md §1/§6). */
      noOrgUnit: 'Unidade não definida',
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      risks: 'Riscos vinculados',
      controls: 'Controles vinculados',
      /** 013-incidents-problems-reverse-links — the reverse read of
       * `IncidentProcessLink`, surfaced from the Process side for the
       * first time this phase. */
      incidents: 'Incidentes vinculados',
    },
    overview: {
      descriptionLabel: 'Descrição',
      noDescription: 'Sem descrição.',
      situationLabel: 'Situação',
      orgUnitLabel: 'Unidade organizacional',
      createdAtLabel: 'Cadastrado em',
      updatedAtLabel: 'Atualizado em',
    },
  },

  /**
   * `ProcessRiskLinksSection`/`ProcessControlLinksSection` — leitura
   * somente (FR-008, ADR-020 parte 4). O vínculo é criado e desfeito
   * exclusivamente pelo lado do Risco e do Controle, nunca por aqui (`GET
   * /processes/{processId}` só mostra vínculos ATIVOS, do lado do
   * processo) — não há ação de vincular/desvincular nesta seção,
   * deliberadamente.
   */
  linkedRisks: {
    sectionDescription:
      'Riscos que referenciam este processo. Vínculos são criados e desfeitos a partir do registro do risco.',
    columns: { code: 'Código', title: 'Título' },
    empty: 'Nenhum risco vinculado a este processo.',
    loadError: 'Não foi possível carregar os riscos vinculados a este processo.',
  },
  linkedControls: {
    sectionDescription:
      'Controles que atuam sobre este processo. Vínculos são criados e desfeitos a partir do registro do controle.',
    columns: { code: 'Código', name: 'Nome' },
    empty: 'Nenhum controle vinculado a este processo.',
    loadError: 'Não foi possível carregar os controles vinculados a este processo.',
  },
  /**
   * 013-incidents-problems-reverse-links — READ-ONLY reverse of
   * `IncidentProcessLink` (`GET /processes/{processId}/incidents`):
   * `modules/processes` never writes this table —
   * `POST`/`DELETE /incidents/{incidentId}/processes` on the Incident side
   * owns that write path. Mirrors `assets.ts`'s own `linkedIncidents`
   * shape-for-shape (FR-020).
   */
  linkedIncidents: {
    sectionDescription:
      'Incidentes que referenciam este processo. Vínculos são criados e desfeitos a partir do registro do incidente.',
    columns: { code: 'Código', title: 'Título', status: 'Status' },
    empty: 'Nenhum incidente vinculado a este processo.',
    loading: 'Carregando incidentes vinculados…',
    loadError: 'Não foi possível carregar os incidentes vinculados a este processo.',
    statusLabels: {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em andamento',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
      CANCELLED: 'Cancelado',
    } satisfies Record<IncidentStatusRef, string>,
  },

  /** Process create/edit form. */
  form: {
    createTitle: 'Novo processo',
    createDescription:
      'Cadastre um processo informando o que ele é e a que unidade organizacional pertence.',
    editTitle: 'Editar processo',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que este processo é e a que unidade organizacional pertence.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: {
        label: 'Descrição',
        helper: 'Opcional. Descreva o que este processo faz.',
      },
      orgUnit: {
        label: 'Unidade organizacional',
        placeholder: 'Selecione a unidade',
        /** Torna a invariante A1 inconfundível na própria tela — nunca só o asterisco genérico de obrigatório. */
        helper: 'Obrigatória. Define quem enxerga e pode vincular este processo.',
      },
    },
    unsavedNote: 'As alterações só são salvas ao confirmar.',
    actions: {
      save: 'Salvar alterações',
      saving: 'Salvando…',
      saveAndCreate: 'Cadastrar processo',
      creating: 'Cadastrando…',
    },
    createSuccess: 'Processo cadastrado.',
    updateSuccess: 'Processo atualizado.',
    genericError: 'Não foi possível salvar o processo. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
    validation: {
      name: {
        required: 'Informe o nome do processo.',
        tooLong: 'O nome deve ter no máximo 300 caracteres.',
      },
      orgUnit: {
        required: 'Selecione a unidade organizacional. Este campo é obrigatório.',
        invalid: 'A unidade selecionada não existe ou está fora do seu escopo de acesso.',
      },
    },
  },

  /**
   * `ProcessLifecycleCard` — as duas transições de situação (desativar /
   * reativar, US1, FR-005/FR-006). Nunca redigido como exclusão: um
   * processo desativado continua legível e continua nos vínculos já
   * existentes — só deixa de aceitar vínculo **novo** (FR-012).
   */
  lifecycle: {
    cardTitle: 'Situação',
    cardDescription: 'Situação atual do processo e as ações disponíveis para alterá-la.',
    deactivate: {
      action: 'Desativar',
      confirmTitle: 'Desativar este processo?',
      confirmDescription:
        'O processo deixa de poder ser vinculado a novos riscos e controles a partir de agora. Ele continua totalmente legível e continua aparecendo nos vínculos que já existem — nada é apagado, e a transição fica registrada na trilha de auditoria.',
      confirmAction: 'Desativar',
      confirming: 'Desativando…',
      success: 'Processo desativado.',
      genericError: 'Não foi possível desativar o processo. Tente novamente.',
      alreadyInactiveError: 'Este processo já está inativo.',
    },
    reactivate: {
      action: 'Reativar',
      confirmTitle: 'Reativar este processo?',
      confirmDescription:
        'O processo volta a poder ser vinculado a riscos e controles novos. Os vínculos criados enquanto estava inativo, se houver, não foram afetados pela desativação.',
      confirmAction: 'Reativar',
      confirming: 'Reativando…',
      success: 'Processo reativado.',
      genericError: 'Não foi possível reativar o processo. Tente novamente.',
      alreadyActiveError: 'Este processo já está ativo.',
    },
  },
} as const;
