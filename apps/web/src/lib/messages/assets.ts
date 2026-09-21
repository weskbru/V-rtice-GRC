/**
 * PharosGRC — Gestão de Ativos (pt-BR), 006-assets-processes.
 *
 * Promoção do registro mínimo `Asset` (Fase 1) a domínio de negócio próprio
 * (CLAUDE.md §17 item 12, `docs/architecture/grc-roadmap.md`). Segue
 * identicamente a convenção que `controls.ts`/`audit-engagements.ts` já
 * estabeleceram (CLAUDE.md §18.12) — divergência de linguagem visual ou de
 * vocabulário entre módulos, sem justificativa registrada, é defeito.
 *
 * Rótulos de campo espelham `specs/006-assets-processes/data-model.md` e o
 * esquema de requisição/resposta em `contracts/assets.openapi.yaml`.
 *
 * **Sem conflito de versão.** Ao contrário de `controls.ts`/`audit-
 * engagements.ts`, este catálogo não contém nenhuma mensagem de conflito de
 * versão otimista ("alterado por outra pessoa") — o contrato deste recurso
 * não declara `If-Match`, `ETag` nem `409` (ver `features/assets/types.ts`).
 *
 * **Desativação nunca é exclusão (FR-012).** Todo texto de desativação
 * abaixo é redigido para deixar isso inequívoco: o ativo continua legível e
 * continua aparecendo nos vínculos já existentes — só deixa de aceitar
 * vínculo **novo**.
 *
 * Situação (ativo/inativo) nunca depende só de cor (CLAUDE.md §18.8, FR-019)
 * — `StatusBadge` já compõe cor + ícone + rótulo textual por padrão; este
 * catálogo fornece o rótulo e a variante, nunca cor isolada.
 */
import type { AssetListSortField, IncidentStatusRef } from '@/features/assets/types';
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

export const assets = {
  situationLabels: SITUATION_LABELS,
  situationVariant: SITUATION_VARIANT,

  /** `/assets` — the asset inventory (US1, US2, US3). */
  register: {
    pageTitle: 'Ativos',
    pageDescription:
      'Inventário de ativos da organização: o que a organização possui ou opera, sua unidade e a que riscos e controles está vinculado.',
    createAction: 'Novo ativo',
    tableCaption: 'Lista de ativos cadastrados',

    /**
     * Indicadores compactos do topo do inventário (T046, CLAUDE.md §19.7):
     * cada figura lê `meta.total` da MESMA consulta `GET /assets` que o
     * próprio inventário usa (`assetsApi.listCatalog`, `pageSize: 1`),
     * filtrada exatamente como o link do próprio card filtra o inventário —
     * um único calculador para "quantos ativos casam com X", nunca uma
     * recontagem no cliente. Mirrors `controls.ts`'s/`audit-engagements.ts`'s
     * own `register.summary` shape (CLAUDE.md §18.12).
     */
    summary: {
      regionLabel: 'Resumo do inventário de ativos',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de ativos',
        hint: 'Todos os ativos no seu escopo',
        linkLabel: 'Ver todos os ativos',
      },
      active: {
        label: 'Ativos em uso',
        hint: 'Situação ativa — aceitam novos vínculos',
        linkLabel: 'Ver ativos em uso',
      },
      inactive: {
        label: 'Ativos desativados',
        hint: 'Situação inativa — não aceitam novos vínculos',
        linkLabel: 'Ver ativos desativados',
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
      regionLabel: 'Filtros do inventário de ativos',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar ativos',
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
        total === 1 ? '1 ativo' : `${total.toLocaleString('pt-BR')} ativos`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: {
        code: 'Código',
        name: 'Nome',
        updatedAt: 'Última atualização',
      } satisfies Record<AssetListSortField, string>,
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
      regionLabel: 'Ativos',
      selectLabel: (code: string, name: string): string => `Abrir ativo ${code} — ${name}`,
      orgUnitLabel: 'Unidade',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },

    loading: 'Carregando ativos…',
    loadError: 'Não foi possível carregar o inventário de ativos.',
    retryAction: 'Tentar novamente',

    empty: {
      noneYet: {
        title: 'Nenhum ativo cadastrado',
        description:
          'Cadastre o primeiro ativo da sua unidade organizacional para começar a vinculá-lo a riscos e controles.',
        createAction: 'Cadastrar ativo',
      },
      noResults: {
        title: 'Nenhum ativo encontrado',
        description: 'Nenhum ativo corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  /**
   * `/assets/[id]` — asset detail (US1, 022-asset-detail-experience Fase A).
   */
  detail: {
    /** `DetailLayout`'s header breadcrumb — "Ativos › AST-…", mirroring `controls.detail.breadcrumbLabel`'s own naming exactly. */
    breadcrumbLabel: 'Ativos',
    loading: 'Carregando ativo…',
    notFoundTitle: 'Ativo não encontrado',
    notFoundDescription:
      'Este ativo não existe ou está fora do seu escopo organizacional de acesso.',
    editAction: 'Editar',
    backToRegister: 'Voltar ao inventário de ativos',
    metadata: {
      orgUnit: (name: string): string => `Unidade: ${name}`,
      /** Um ativo cadastrado antes deste módulo pode não ter unidade registrada (data-model.md §1/§6). */
      noOrgUnit: 'Unidade não definida',
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    /**
     * Tab labels for the flat, `size="compact"` `EntityTabs` strip
     * (022-asset-detail-experience Fase A). `risks`/`controls`/`incidents`
     * were shortened from "Riscos vinculados"/"Controles vinculados"/
     * "Incidentes vinculados" — measured at 390px, with `compact` applied in
     * both cases: the four tabs wrapped across **2** lines with the old,
     * longer labels (`getBoundingClientRect().top` distinguishing 338px and
     * 372px) versus a single line with these short ones. `stripOverflow` was
     * already `0` either way (`compact`'s own `flex-wrap` never lets a tab
     * clip), so this change is purely about how TALL the strip reads, not
     * about eliminating overflow. It also aligns Asset with Risk's/
     * Incident's/Problem's own bare nouns for their linked-entity tabs, which
     * never carried "vinculados" either. See `asset-detail-view.tsx`'s own
     * header comment for the fuller narrative. `e2e/accessibility.spec.ts`'s
     * two asset-detail tab lookups were updated to these same short names in
     * the same commit.
     */
    sections: {
      overview: 'Visão geral',
      risks: 'Riscos',
      controls: 'Controles',
      /** 013-incidents-problems-reverse-links — the reverse read of
       * `IncidentAssetLink`, surfaced from the Asset side for the first
       * time this phase. */
      incidents: 'Incidentes',
    },
    /**
     * "Visão geral" cards (022-asset-detail-experience Fase B — replaces the
     * flat, card-less `<dl>` this section used to be). `situationLabel` was
     * removed: `isActive` now shows ONLY in the header badge and in its own
     * dedicated "Situação" card (`lifecycle.cardTitle` below) — mirroring
     * `controls.detail.overview`'s own restraint for `status`, never a third
     * copy in "Detalhes do ativo".
     */
    overview: {
      descriptionCardTitle: 'Descrição',
      noDescription: 'Sem descrição.',
      detailsCardTitle: 'Detalhes do ativo',
      orgUnitLabel: 'Unidade organizacional',
      createdAtLabel: 'Cadastrado em',
      updatedAtLabel: 'Atualizado em',
      notSet: 'Não definido',
    },
    /**
     * Accessible name for `DetailLayout`'s `asideLabel` — the sticky
     * `complementary` landmark holding "Relacionamentos"/"Última
     * atualização" (022-asset-detail-experience Fase C). Mirrors
     * `controls.detail.asideLabel`'s own naming exactly.
     */
    asideLabel: 'Contexto do ativo',
    /**
     * The contextual aside's "Relacionamentos" block (`asset-context-aside.
     * tsx`, Fase C). No "Ações rápidas" heading here — see that file's own
     * header comment for why Asset's three relationship tabs (read-only by
     * design, FR-008) offer no create/link verb to shortcut to.
     *
     * `risks`/`controls` take a REAL count — `AssetDetail.risks`/`.controls`
     * arrive already embedded (active links, from the asset's own side),
     * unlike Control's own "Vínculos" row, which carries no count for any
     * of its three sub-relationships. `incidents` gets the same "Ver" hint
     * `controls.detail.relationshipsPanel.viewHint`/`risks.detail.
     * relationshipsPanel.viewHint` already use for an uncounted
     * relationship — `GET /assets/{assetId}/incidents` is its own request,
     * never fetched just to produce a number here (F-59).
     */
    relationshipsPanel: {
      heading: 'Relacionamentos',
      risks: (count: number): string => `Riscos (${count})`,
      controls: (count: number): string => `Controles (${count})`,
      incidents: 'Incidentes',
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',
  },

  /**
   * `AssetRiskLinksSection`/`AssetControlLinksSection` — leitura somente
   * (FR-008, ADR-020 parte 4). O vínculo é criado e desfeito exclusivamente
   * pelo lado do Risco e do Controle, nunca por aqui (`GET
   * /assets/{assetId}` só mostra vínculos ATIVOS, do lado do ativo) — não há
   * ação de vincular/desvincular nesta seção, deliberadamente.
   */
  linkedRisks: {
    sectionDescription:
      'Riscos que referenciam este ativo. Vínculos são criados e desfeitos a partir do registro do risco.',
    columns: { code: 'Código', title: 'Título' },
    empty: 'Nenhum risco vinculado a este ativo.',
    loadError: 'Não foi possível carregar os riscos vinculados a este ativo.',
  },
  linkedControls: {
    sectionDescription:
      'Controles que atuam sobre este ativo. Vínculos são criados e desfeitos a partir do registro do controle.',
    columns: { code: 'Código', name: 'Nome' },
    empty: 'Nenhum controle vinculado a este ativo.',
    loadError: 'Não foi possível carregar os controles vinculados a este ativo.',
  },
  /**
   * 013-incidents-problems-reverse-links — READ-ONLY reverse of
   * `IncidentAssetLink` (`GET /assets/{assetId}/incidents`): `modules/assets`
   * never writes this table — `POST`/`DELETE /incidents/{incidentId}/assets`
   * on the Incident side owns that write path. Unlike `linkedRisks`/
   * `linkedControls` above (embedded in `GET /assets/{assetId}` itself),
   * this section issues its own `GET` — hence `loading`, which those two
   * never needed.
   */
  linkedIncidents: {
    sectionDescription:
      'Incidentes que referenciam este ativo. Vínculos são criados e desfeitos a partir do registro do incidente.',
    columns: { code: 'Código', title: 'Título', status: 'Status' },
    empty: 'Nenhum incidente vinculado a este ativo.',
    loading: 'Carregando incidentes vinculados…',
    loadError: 'Não foi possível carregar os incidentes vinculados a este ativo.',
    statusLabels: {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em andamento',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
      CANCELLED: 'Cancelado',
    } satisfies Record<IncidentStatusRef, string>,
  },

  /** Asset create/edit form. */
  form: {
    createTitle: 'Novo ativo',
    createDescription:
      'Cadastre um ativo informando o que ele é e a que unidade organizacional pertence.',
    editTitle: 'Editar ativo',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que este ativo é e a que unidade organizacional pertence.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: {
        label: 'Descrição',
        helper: 'Opcional. Descreva o que este ativo é e para que serve.',
      },
      orgUnit: {
        label: 'Unidade organizacional',
        placeholder: 'Selecione a unidade',
        /** Torna a invariante A1 inconfundível na própria tela — nunca só o asterisco genérico de obrigatório. */
        helper: 'Obrigatória. Define quem enxerga e pode vincular este ativo.',
      },
    },
    unsavedNote: 'As alterações só são salvas ao confirmar.',
    actions: {
      save: 'Salvar alterações',
      saving: 'Salvando…',
      saveAndCreate: 'Cadastrar ativo',
      creating: 'Cadastrando…',
    },
    createSuccess: 'Ativo cadastrado.',
    updateSuccess: 'Ativo atualizado.',
    genericError: 'Não foi possível salvar o ativo. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
    validation: {
      name: {
        required: 'Informe o nome do ativo.',
        tooLong: 'O nome deve ter no máximo 300 caracteres.',
      },
      orgUnit: {
        required: 'Selecione a unidade organizacional. Este campo é obrigatório.',
        invalid: 'A unidade selecionada não existe ou está fora do seu escopo de acesso.',
      },
    },
  },

  /**
   * `AssetLifecycleCard` — as duas transições de situação (desativar /
   * reativar, US1, FR-005/FR-006). Nunca redigido como exclusão: um ativo
   * desativado continua legível e continua nos vínculos já existentes —
   * só deixa de aceitar vínculo **novo** (FR-012).
   */
  lifecycle: {
    cardTitle: 'Situação',
    cardDescription: 'Situação atual do ativo e as ações disponíveis para alterá-la.',
    deactivate: {
      action: 'Desativar',
      confirmTitle: 'Desativar este ativo?',
      confirmDescription:
        'O ativo deixa de poder ser vinculado a novos riscos e controles a partir de agora. Ele continua totalmente legível e continua aparecendo nos vínculos que já existem — nada é apagado, e a transição fica registrada na trilha de auditoria.',
      confirmAction: 'Desativar',
      confirming: 'Desativando…',
      success: 'Ativo desativado.',
      genericError: 'Não foi possível desativar o ativo. Tente novamente.',
      alreadyInactiveError: 'Este ativo já está inativo.',
    },
    reactivate: {
      action: 'Reativar',
      confirmTitle: 'Reativar este ativo?',
      confirmDescription:
        'O ativo volta a poder ser vinculado a riscos e controles novos. Os vínculos criados enquanto estava inativo, se houver, não foram afetados pela desativação.',
      confirmAction: 'Reativar',
      confirming: 'Reativando…',
      success: 'Ativo reativado.',
      genericError: 'Não foi possível reativar o ativo. Tente novamente.',
      alreadyActiveError: 'Este ativo já está ativo.',
    },
  },
} as const;
