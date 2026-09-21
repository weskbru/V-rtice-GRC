/**
 * PharosGRC — Administration (US8, T181–T183) pt-BR copy.
 *
 * Two consequences the interface must state plainly BEFORE the user commits,
 * because the backend genuinely does them (CLAUDE.md §11.1, task brief):
 * deactivating a user immediately kills their live sessions
 * (`users.statusDialog.deactivateDescription`), and revoking sessions signs
 * them out everywhere (`users.sessionsDialog.description`). A role's
 * permission change and a scope grant/revoke take effect on the affected
 * user's NEXT request, not immediately for an already-open session
 * (`roles.form.effectNotice`, `organization.scopeGrants.effectNotice`,
 * FR-028). Reparenting an organizational unit rewrites every descendant's
 * path and can change who can see what across the whole platform
 * (`organization.reparent.warning`).
 *
 * `roles.summary` and everything below it belongs to the roles and
 * permissions surface (015-roles-permissions-surface). Three of its strings
 * are statements about the platform's security model, not decoration, and
 * they are worded against the real model rather than the familiar one:
 * permissions are granted DIRECTLY by the role, there is NO inheritance
 * between roles, and a person's effective access is the UNION of the roles
 * assigned to them (`roles.permissionsTab.model`, FR-015 — "herdada de" and
 * any suggestion of hierarchy are forbidden); listing the people who hold a
 * role requires `user:administer`, which `role:administer` does not imply
 * (`roles.usersTab.restricted`, FR-020); and organizational scope is granted
 * per user, never by the role assignment (`roles.usersTab.scopeNotice`,
 * FR-022).
 */
import type { RoleSortOption, RoleTypeFilter } from '@/features/admin/types';

export const admin = {
  users: {
    pageTitle: 'Usuários',
    pageDescription: 'Provisionamento, papéis, sessões e escopo organizacional dos usuários.',
    createAction: 'Novo usuário',
    table: {
      caption: 'Usuários da plataforma',
      columns: {
        fullName: 'Nome',
        email: 'E-mail',
        status: 'Status',
        /**
         * Full name — used only where there is real room for it: the
         * `ColumnVisibilityMenu` checkbox list (`USER_ADMIN_HIDEABLE_COLUMNS`
         * below), not the `<th>` itself. The `<th>` is fixed-width and
         * `whitespace-nowrap` with no truncation (`data-table.tsx`), so this
         * full label measurably overran its own header cell and bled into
         * "Papéis" at 1024px — `orgUnitHeader` below is what the column
         * definition's `header` actually renders.
         */
        orgUnit: 'Unidade organizacional',
        /** Short form for the `<th>` itself — see the comment on `orgUnit` above for why the two differ. Matches `card.orgUnitLabel`, the same field's label in the card view. */
        orgUnitHeader: 'Unidade',
        roles: 'Papéis',
        lastLoginAt: 'Último acesso',
      },
      neverLoggedIn: 'Nunca acessou',
      noOrgUnit: '—',
      noRoles: 'Nenhum papel',
    },
    /**
     * Four indicators above the toolbar (CLAUDE.md §18.5, §19.7), mirroring
     * `risks.register.summary`'s own reasoning: every figure is an O(1)
     * server aggregate — `listUsers({ pageSize: 1, ... })`'s `meta.total`
     * for the first three, `adminApi.getRolesSummary()` for the fourth —
     * never a second count computed on this screen from the loaded page.
     *
     * "Sem papel" requires `role:administer` (the same permission
     * `GET /admin/roles/summary` itself requires), which this screen's own
     * `user:administer` does not imply — the caller may hold one without
     * the other. When it is absent, the tile is not rendered at all (never
     * a zero, never a skeleton that never resolves) and the strip lays out
     * the remaining three.
     */
    summary: {
      regionLabel: 'Resumo de usuários',
      total: {
        label: 'Total de usuários',
        hint: 'Todos os usuários da plataforma',
        linkLabel: 'Ver todos os usuários',
      },
      active: {
        label: 'Ativos',
        hint: 'Podem autenticar-se na plataforma',
        linkLabel: 'Filtrar o registro por usuários ativos',
      },
      inactive: {
        label: 'Inativos',
        hint: 'Não podem autenticar-se',
        linkLabel: 'Filtrar o registro por usuários inativos',
      },
      /** Not a link: `GET /admin/users` has no filter for "sem papel" — see this screen's own doc comment (F-1 discipline: never fake a link the contract cannot honour). */
      withoutRole: {
        label: 'Sem papel',
        hint: 'Nenhum papel atribuído',
      },
      value: (count: number): string => count.toLocaleString('pt-BR'),
      loading: 'Carregando indicadores…',
      /** A failure here degrades to one quiet line — it must never hide or block the register underneath it. */
      loadError: 'Não foi possível carregar os indicadores. A lista de usuários continua abaixo.',
    },
    filters: {
      regionLabel: 'Filtros de usuários',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar usuários',
      searchPlaceholder: 'Buscar por nome ou e-mail…',
      statusLabel: 'Status',
      statusAll: 'Todos',
      statusActive: 'Ativo',
      statusInactive: 'Inativo',
      orgUnitLabel: 'Unidade organizacional',
      orgUnitAllOption: 'Todas as unidades',
      roleLabel: 'Papel',
      roleAllOption: 'Todos os papéis',
      optionsError: 'Não foi possível carregar as opções de filtro.',
      loadingOptions: 'Carregando opções…',
      columnsMenuLabel: 'Colunas',
      activeFiltersLabel: 'Filtros ativos',
      searchChipLabel: (value: string): string => `Busca: "${value}"`,
      removeSearchFilterLabel: 'Remover filtro de busca',
      statusChipLabel: (statusLabel: string): string => `Status: ${statusLabel}`,
      removeStatusFilterLabel: 'Remover filtro de status',
    },
    /**
     * The active-filter chips, in the exact shape `@/lib/register/filter-chips`
     * asks for (`searchChip`, `singleValueChip`) — mirrors
     * `admin.roles.activeFilters`'s own precedent for this same
     * administration area. Supersedes `filters.activeFiltersLabel`,
     * `filters.searchChipLabel`, `filters.statusChipLabel` and their two
     * `remove*FilterLabel` siblings, which produce the same strings through
     * field-specific functions the shared builders cannot consume; those
     * five stay in place as orphans rather than removed (015/STATE.md §4.1).
     */
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },
    /** The results line: how many users the current search and filters left, and the ordering in force. */
    results: {
      count: (total: number): string =>
        total === 1 ? '1 usuário' : `${total.toLocaleString('pt-BR')} usuários`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortOptions: {
        'fullName:asc': 'Nome (A–Z)',
        'fullName:desc': 'Nome (Z–A)',
        'lastLoginAt:desc': 'Último acesso (mais recente)',
        'status:asc': 'Status',
      } as Readonly<Record<string, string>>,
      sortFieldLabels: {
        fullName: 'Nome',
        email: 'E-mail',
        status: 'Status',
        lastLoginAt: 'Último acesso',
      } as Readonly<Record<string, string>>,
      sortDirectionLabels: { asc: 'crescente', desc: 'decrescente' },
      customSortOption: (field: string, direction: string): string => `${field} (${direction})`,
    },
    /** Cards ↔ Tabela segmented control (CLAUDE.md §18.12) — Tabela is this screen's default (an administrative listing is read densely, row by row), unlike the business registers where Cards is primary. */
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver os usuários em cards',
      tableLabel: 'Ver os usuários em tabela',
    },
    /** One user, as a card in the list. Mirrors the table's own identity cell and fields — the two views must never disagree about what a user "is". */
    card: {
      regionLabel: 'Usuários',
      openLabel: (fullName: string): string => `Abrir usuário ${fullName}`,
      orgUnitLabel: 'Unidade',
      rolesLabel: 'Papéis',
      lastLoginLabel: 'Último acesso',
    },
    /**
     * The "+N" roles overflow control (table cell and card, one shared
     * component) — every role name must be reachable by a screen reader,
     * not only by hover or a `title` tooltip, so the trigger's own
     * accessible name already states which roles it hides, and the Radix
     * `Popover` it opens lists them again for anyone who prefers to read
     * rather than have them announced inline.
     */
    rolesOverflow: {
      moreLabel: (count: number): string => `+${count}`,
      moreAriaLabel: (count: number, names: string): string =>
        `Mais ${count === 1 ? '1 papel' : `${count} papéis`}: ${names}`,
      popoverRegionLabel: 'Papéis adicionais',
    },
    empty: {
      noneYet: {
        title: 'Nenhum usuário registrado',
        description: 'Crie o primeiro usuário da plataforma.',
        createAction: 'Novo usuário',
      },
      noResults: {
        title: 'Nenhum usuário encontrado',
        description: 'Nenhum usuário corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
    status: {
      active: 'Ativo',
      inactive: 'Inativo',
    },
    actions: {
      edit: 'Editar',
      activate: 'Ativar',
      deactivate: 'Desativar',
      resetPassword: 'Redefinir senha',
      revokeSessions: 'Encerrar sessões',
      manageRoles: 'Papéis',
      rowActionsLabel: (fullName: string): string => `Ações para ${fullName}`,
    },
    form: {
      createTitle: 'Novo usuário',
      editTitle: 'Editar usuário',
      fields: {
        email: { label: 'E-mail' },
        fullName: { label: 'Nome completo' },
        jobTitle: { label: 'Cargo (opcional)' },
        orgUnit: {
          label: 'Unidade organizacional (opcional)',
          placeholder: 'Selecione uma unidade',
          none: 'Nenhuma',
        },
        initialPassword: {
          label: 'Senha inicial',
          description:
            'O usuário deverá alterá-la obrigatoriamente no primeiro acesso. Mínimo de 12 caracteres.',
        },
      },
      submitCreate: 'Criar usuário',
      submitting: 'Salvando…',
      submitEdit: 'Salvar alterações',
      cancel: 'Cancelar',
      genericError: 'Não foi possível salvar o usuário. Tente novamente.',
      fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    },
    validation: {
      email: { required: 'Informe o e-mail.', invalid: 'Informe um e-mail válido.' },
      fullName: { required: 'Informe o nome completo.' },
      initialPassword: {
        tooShort: 'A senha deve ter no mínimo 12 caracteres.',
      },
    },
    statusDialog: {
      activateTitle: 'Ativar usuário?',
      activateDescription: (fullName: string): string =>
        `${fullName} poderá autenticar-se na plataforma novamente.`,
      deactivateTitle: 'Desativar usuário?',
      deactivateDescription: (fullName: string): string =>
        `${fullName} não poderá mais autenticar-se e TODAS as sessões ativas dessa conta serão encerradas imediatamente — qualquer requisição em andamento com essa sessão será recusada.`,
      confirmActivate: 'Ativar',
      confirmDeactivate: 'Desativar',
      selfDeactivateError: 'Você não pode desativar sua própria conta.',
    },
    passwordDialog: {
      title: (fullName: string): string => `Redefinir senha de ${fullName}`,
      description:
        'Uma nova senha temporária será definida e o usuário deverá alterá-la no próximo acesso. TODAS as sessões ativas dessa conta serão encerradas imediatamente.',
      fields: {
        newPassword: {
          label: 'Nova senha',
          description: 'Mínimo de 12 caracteres.',
        },
        confirmPassword: { label: 'Confirmar nova senha' },
      },
      validation: {
        tooShort: 'A senha deve ter no mínimo 12 caracteres.',
        mismatch: 'As senhas não coincidem.',
      },
      submit: 'Redefinir senha',
      submitting: 'Redefinindo…',
    },
    sessionsDialog: {
      title: (fullName: string): string => `Encerrar sessões de ${fullName}?`,
      description:
        'O usuário será desconectado de TODOS os dispositivos e navegadores imediatamente e precisará autenticar-se novamente para continuar.',
      confirm: 'Encerrar sessões',
    },
    rolesDialog: {
      title: (fullName: string): string => `Papéis de ${fullName}`,
      description:
        'A alteração substitui o conjunto completo de papéis do usuário e passa a valer na próxima requisição dele — sem necessidade de novo login.',
      noRoles: 'Nenhum papel cadastrado.',
      submit: 'Salvar papéis',
      submitting: 'Salvando…',
    },
    feedback: {
      createSuccess: 'Usuário criado com sucesso.',
      updateSuccess: 'Usuário atualizado com sucesso.',
      activateSuccess: 'Usuário ativado.',
      deactivateSuccess: 'Usuário desativado e suas sessões foram encerradas.',
      passwordResetSuccess: 'Senha redefinida e as sessões do usuário foram encerradas.',
      sessionsRevokedSuccess: 'Sessões encerradas com sucesso.',
      rolesUpdatedSuccess: 'Papéis atualizados com sucesso.',
      emailInUseError: 'Este e-mail já está em uso.',
      loadError: 'Não foi possível carregar os usuários.',
      loadDetailError: 'Não foi possível carregar os dados do usuário.',
      genericError: 'Não foi possível concluir a ação. Tente novamente.',
    },
  },
  roles: {
    pageTitle: 'Papéis e permissões',
    pageDescription: 'Composição de papéis a partir do catálogo de permissões da plataforma.',
    createAction: 'Novo papel',
    table: {
      caption: 'Papéis da plataforma',
      columns: {
        role: 'Papel',
        permissions: 'Permissões',
        assignedUserCount: 'Usuários',
        actions: 'Ações',
      },
      /** One-line inventory above the table: how many roles, and how many of each kind. */
      summary: (total: number, system: number, custom: number): string =>
        `${total === 1 ? '1 papel' : `${total} papéis`} · ${system} do sistema · ${
          custom === 1 ? '1 personalizado' : `${custom} personalizados`
        }`,
      openDetailsLabel: (name: string): string => `Ver detalhes do papel ${name}`,
      assignedUsersLabel: (count: number): string =>
        count === 1 ? '1 usuário atribuído' : `${count} usuários atribuídos`,
    },
    /** Role kind, shown as a discreet tag next to the role name. */
    type: {
      system: 'Sistema',
      custom: 'Personalizado',
    },
    /** Compact permission overview in the roles table: a count, and the platform areas it reaches. */
    permissionOverview: {
      count: (count: number): string => (count === 1 ? '1 permissão' : `${count} permissões`),
      areaCount: (count: number): string => (count === 1 ? '1 área' : `${count} áreas`),
      moreAreas: (count: number): string => `+${count}`,
      areasLabel: (areas: string): string => `Áreas: ${areas}`,
      none: 'Nenhuma permissão',
    },
    /**
     * pt-BR names for the permission catalogue's technical vocabulary. The
     * identifiers themselves (`risk:view`, `audit-engagement:scope`) stay
     * untouched and are always shown next to these labels — this only gives
     * them a readable name. An identifier absent from these maps falls back to
     * its raw value, so a catalogue entry added later is never hidden.
     */
    permissionCatalog: {
      areas: {
        risk: 'Riscos',
        action: 'Planos de Ação',
        problem: 'Problemas',
        incident: 'Incidentes',
        control: 'Controles',
        asset: 'Ativos',
        process: 'Processos',
        compliance: 'Compliance',
        audit: 'Auditoria e achados',
        indicator: 'Indicadores',
        report: 'Relatórios',
        collaboration: 'Evidências e colaboração',
        administration: 'Administração',
        other: 'Outras permissões',
      },
      resources: {
        risk: 'Riscos',
        methodology: 'Metodologia de risco',
        action: 'Ações',
        problem: 'Problemas',
        incident: 'Incidentes',
        control: 'Controles',
        asset: 'Ativos',
        process: 'Processos',
        compliance: 'Compliance',
        'audit-engagement': 'Engajamentos de auditoria',
        finding: 'Achados',
        indicator: 'Indicadores',
        report: 'Relatórios',
        evidence: 'Evidências',
        comment: 'Comentários',
        attachment: 'Anexos',
        user: 'Usuários',
        role: 'Papéis e permissões',
        org_unit: 'Estrutura organizacional',
        audit: 'Trilha de auditoria',
      } as Readonly<Record<string, string>>,
      /** Keyed by the identifier's own verb (`control:test` → `test`), which is more precise than its `action` category. */
      verbs: {
        view: 'Visualizar',
        create: 'Criar',
        edit: 'Editar',
        delete: 'Excluir',
        approve: 'Aprovar',
        administer: 'Administrar',
        assess: 'Avaliar',
        treat: 'Tratar',
        transition: 'Alterar ciclo de vida',
        link: 'Vincular',
        close: 'Encerrar',
        scope: 'Definir escopo',
        map: 'Mapear',
        test: 'Testar',
        remediate: 'Remediar',
      } as Readonly<Record<string, string>>,
    },

    /** FR-016, extended to the role's own name: the stored `Role.name` is revealed alongside the permission identifiers, never rewritten. */
    technicalName: {
      label: 'Nome técnico',
    },
    /** Read-only role details, opened from the role name or the row menu. */
    details: {
      assignedUsers: 'Usuários atribuídos',
      permissions: 'Permissões',
      areas: 'Áreas',
      type: 'Tipo',
      grantedPermissions: 'Permissões concedidas',
      areaPermissionCount: (count: number): string =>
        count === 1 ? '1 permissão' : `${count} permissões`,
      systemRestriction:
        'Papel do sistema: não pode ser renomeado, ter as permissões alteradas nem ser excluído.',
      assignedRestriction: (count: number): string =>
        count === 1
          ? 'Não pode ser excluído enquanto estiver atribuído a 1 usuário.'
          : `Não pode ser excluído enquanto estiver atribuído a ${count} usuários.`,
      noPermissions: 'Este papel não concede nenhuma permissão.',
      close: 'Fechar',
    },
    /** Read-only preview of a role's granted permissions, shown inline in the roles table (T182, wave 4) so a reader understands what a role actually grants without opening the edit dialog. */
    permissionsSummary: {
      moreCount: (count: number): string => `+${count}`,
      expand: 'Ver todas as permissões',
      collapse: 'Ocultar permissões',
      ariaLabel: (roleName: string): string => `Permissões do papel ${roleName}`,
      none: 'Nenhuma permissão',
    },
    empty: {
      title: 'Nenhum papel encontrado',
      description: 'Crie um novo papel para compor um conjunto de permissões.',
    },
    actions: {
      viewDetails: 'Ver detalhes',
      edit: 'Editar',
      delete: 'Excluir',
      rowActionsLabel: (name: string): string => `Ações para o papel ${name}`,
      /** Shown under a disabled "Excluir" so the restriction is explained, not just enforced. */
      deleteBlockedSystem: 'Papel do sistema',
      deleteBlockedAssigned: (count: number): string =>
        count === 1 ? 'Atribuído a 1 usuário' : `Atribuído a ${count} usuários`,
    },
    form: {
      createTitle: 'Novo papel',
      editTitle: 'Editar papel',
      fields: {
        name: { label: 'Nome' },
        description: { label: 'Descrição' },
        permissions: {
          label: 'Permissões',
          searchPlaceholder: 'Buscar permissão…',
          empty: 'Nenhuma permissão encontrada.',
          selectedCount: (count: number): string =>
            count === 1 ? '1 permissão selecionada' : `${count} permissões selecionadas`,
        },
      },
      /** FR-028: an administrator granting/revoking a permission must know it does not affect an already-open session. */
      effectNotice:
        'A alteração no conjunto de permissões passa a valer na próxima requisição de cada usuário afetado — sem necessidade de novo login.',
      systemRoleNotice:
        'Papéis do sistema não podem ser renomeados nem ter as permissões alteradas; apenas a descrição pode ser ajustada aqui.',
      submitCreate: 'Criar papel',
      submitEdit: 'Salvar alterações',
      submitting: 'Salvando…',
      cancel: 'Cancelar',
      genericError: 'Não foi possível salvar o papel. Tente novamente.',
    },
    validation: {
      /**
       * The maxima mirror the server's own `Length(1, 100)` / `Length(1, 500)`
       * (`write-role-request.dto.ts`, `update-role-request.dto.ts`) on SHAPE
       * only — the server's refusal stands whatever the client does
       * (015 FR-033). What the client owes the user is naming the limit
       * before the request, instead of an opaque 400 after it.
       */
      name: {
        required: 'Informe o nome do papel.',
        tooLong: 'O nome do papel deve ter no máximo 100 caracteres.',
      },
      description: {
        required: 'Informe uma descrição do papel.',
        tooLong: 'A descrição do papel deve ter no máximo 500 caracteres.',
      },
      permissions: { required: 'Selecione ao menos uma permissão.' },
    },
    deleteDialog: {
      title: (name: string): string => `Excluir o papel "${name}"?`,
      description:
        'Esta ação não pode ser desfeita. Um papel do sistema, ou ainda atribuído a algum usuário, não pode ser excluído.',
      confirm: 'Excluir',
    },
    feedback: {
      createSuccess: 'Papel criado com sucesso.',
      updateSuccess: 'Papel atualizado com sucesso.',
      deleteSuccess: 'Papel excluído com sucesso.',
      nameInUseError: 'Já existe um papel com esse nome.',
      systemRoleError: 'Papéis do sistema não podem ter o nome ou as permissões alterados.',
      /** F-68 — the whole role is the platform's, so the refusal names all three fields. */
      systemRoleNotEditableError:
        'Papéis do sistema são definidos pela plataforma: nome, descrição e permissões não podem ser alterados.',
      deleteBlockedError:
        'Este papel é um papel do sistema ou ainda está atribuído a pelo menos um usuário.',
      loadError: 'Não foi possível carregar os papéis.',
      loadPermissionsError: 'Não foi possível carregar o catálogo de permissões.',
      genericError: 'Não foi possível concluir a ação. Tente novamente.',
    },

    // =================================================================
    // Roles and permissions surface (015-roles-permissions-surface).
    // Everything from here down belongs to the redesigned screen: four
    // indicators, search/filters/ordering, the role cards, the detail
    // panel with its two tabs, in-panel editing, and the list states.
    // =================================================================

    /**
     * The four indicators (FR-001 to FR-004). Every figure comes from
     * `GET /admin/roles/summary` — none is hard-coded and none is recounted
     * from the loaded page. The first three are interactive controls that
     * apply the matching kind filter, so each carries its own accessible
     * name (`filterLabel`); the fourth is deliberately inert (FR-003) and
     * has none.
     */
    summary: {
      regionLabel: 'Resumo de papéis e permissões',
      total: {
        label: 'Papéis',
        hint: 'Todos os papéis da plataforma',
        filterLabel: 'Mostrar todos os papéis',
      },
      system: {
        label: 'Papéis do sistema',
        hint: 'Definidos pela plataforma, com campos protegidos',
        filterLabel: 'Mostrar somente os papéis do sistema',
      },
      custom: {
        label: 'Papéis personalizados',
        hint: 'Criados pela organização',
        filterLabel: 'Mostrar somente os papéis personalizados',
      },
      /** FR-040: distinct people. Someone holding three roles is counted once — the hint says so, because the number next to "Papéis" invites the wrong reading. */
      usersWithRoles: {
        label: 'Usuários com papéis',
        hint: 'Pessoas com ao menos um papel; quem tem vários conta uma vez',
      },
      value: (count: number): string => count.toLocaleString('pt-BR'),
      /** Non-colour channel for the selected indicator (NFR-004): the state is also said in text. */
      activeLabel: 'Filtro aplicado',
      loading: 'Carregando indicadores…',
      /** A failure here degrades to one quiet line and never hides the list underneath. */
      loadError: 'Não foi possível carregar os indicadores. A lista de papéis continua abaixo.',
    },

    /** Search, kind filter, module filter (FR-005, FR-005a). All applied over the page the screen already loaded (FR-005c). */
    filters: {
      regionLabel: 'Filtros de papéis',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar papéis',
      searchPlaceholder: 'Buscar por nome ou descrição…',
      typeLabel: 'Tipo',
      typeOptions: {
        all: 'Todos',
        system: 'Sistema',
        custom: 'Personalizados',
      } satisfies Record<RoleTypeFilter, string>,
      moduleLabel: 'Módulo',
      moduleAllOption: 'Todos os módulos',
      /** FR-005a — "at least one permission of that module", said plainly so the result set is never surprising. */
      moduleHint: 'Mostra os papéis que concedem ao menos uma permissão do módulo.',
      activeFiltersLabel: 'Filtros ativos',
      searchChipLabel: (term: string): string => `Busca: "${term}"`,
      typeChipLabel: (typeLabel: string): string => `Tipo: ${typeLabel}`,
      moduleChipLabel: (moduleLabel: string): string => `Módulo: ${moduleLabel}`,
      removeFilterLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    /**
     * The active-filter chips, in the exact shape `@/lib/register/filter-chips`
     * asks for — the same builders (`searchChip`, `singleValueChip`) the five
     * business registers use, so this screen composes its chip row the same
     * way they do instead of assembling chips by hand (CLAUDE.md §18.12).
     *
     * These four supersede `filters.activeFiltersLabel`, `filters.searchChipLabel`,
     * `filters.typeChipLabel`, `filters.moduleChipLabel` and
     * `filters.removeFilterLabel`, which produce the same strings through
     * field-specific functions the shared builders cannot consume. Those five
     * are left in place and listed as orphans rather than removed, per the
     * standing rule of `015/STATE.md` §4.1.
     */
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    /** The results line: how many roles the current search and filters left, and the ordering in force (FR-005b). */
    results: {
      count: (total: number): string =>
        total === 1 ? '1 papel' : `${total.toLocaleString('pt-BR')} papéis`,
      countLoading: 'Carregando resultados…',
      countOfTotal: (shown: number, total: number): string =>
        `${shown.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} papéis`,
      sortLabel: 'Ordenar por',
      /** The ordering in force is always nameable by the control itself — never an unlabelled arrow. */
      sortOptions: {
        'name:asc': 'Nome (A–Z)',
        'name:desc': 'Nome (Z–A)',
        'permissions:desc': 'Quantidade de permissões',
        'users:desc': 'Quantidade de usuários',
      } satisfies Record<RoleSortOption, string>,
    },

    /** One role, as a card in the list (FR-006 to FR-008). */
    card: {
      listLabel: 'Papéis da plataforma',
      openLabel: (name: string): string => `Abrir detalhes do papel ${name}`,
      /** Selection is also said in text, never signalled by colour alone (NFR-004). */
      selectedLabel: 'Papel selecionado',
      permissionCount: (count: number): string =>
        count === 1 ? '1 permissão' : `${count.toLocaleString('pt-BR')} permissões`,
      userCount: (count: number): string =>
        count === 1 ? '1 usuário' : `${count.toLocaleString('pt-BR')} usuários`,
      noPermissions: 'Nenhuma permissão',
      noUsers: 'Nenhum usuário',
      modulesLabel: 'Módulos alcançados',
      /** FR-007 — the visible chips are capped; this names the rest. */
      moreModules: (count: number): string =>
        count === 1 ? '+1 módulo' : `+${count.toLocaleString('pt-BR')} módulos`,
      /** FR-007 — the COMPLETE module list, for a screen reader, even when the visible chips are truncated. */
      modulesAccessibleLabel: (modules: string): string => `Módulos alcançados: ${modules}`,
      noModules: 'Não alcança nenhum módulo',
      /** FR-008 — the card clamps the description visually; the stored text is never altered and the panel shows it whole. */
      noDescription: 'Sem descrição.',
    },

    /**
     * The privilege badge (FR-035, ADR-021). The wording says what the label
     * is derived FROM and what it does NOT do: it is a reading aid of this
     * screen, computed from the permissions listed right below it, and it
     * takes part in no access check. Calling it a security rule here would
     * be the first step towards someone treating it as one.
     */
    privilege: {
      badge: 'Privilegiado',
      badgeAccessibleLabel: (name: string): string =>
        `${name} concede permissões de administração de acesso`,
      explanationLabel: 'O que significa privilegiado',
      explanation:
        'Este papel concede ao menos uma permissão de administração de acesso — papéis, usuários ou estrutura organizacional —, ou seja, permite alterar quem pode o quê na plataforma. É um destaque de leitura desta tela, calculado a partir das permissões listadas; nenhuma verificação de acesso depende dele.',
    },

    /** The detail panel's shell: header, counts and the two tabs (FR-009 to FR-012). */
    panel: {
      regionLabel: 'Detalhes do papel',
      title: 'Detalhes do papel',
      closeLabel: 'Fechar detalhes do papel',
      backLabel: 'Voltar para a lista de papéis',
      loading: 'Carregando detalhes do papel…',
      loadError: 'Não foi possível carregar os detalhes deste papel.',
      descriptionLabel: 'Descrição',
      noDescription: 'Este papel não tem descrição.',
      counts: {
        permissions: 'Permissões',
        users: 'Usuários',
        modules: 'Módulos',
      },
      editAction: 'Editar papel',
      /**
       * F-68 — a system role has nothing an administrator can write, so the
       * panel must not offer "Editar papel" for one: the form behind it would
       * carry no save, and the server refuses every field. This opens the same
       * fields, read-only, as a definition sheet.
       */
      viewDefinitionAction: 'Ver definição',
      /**
       * Companion to the button above: why this role has no edit action, said
       * where the action would have been. Does not repeat "Papel do sistema" —
       * the kind tag says it in the header, and the delete restriction says it
       * again beside "Excluir".
       */
      systemOwnedAction:
        'Nome, descrição e permissões são definidos pela plataforma e não podem ser alterados aqui.',
      tabs: {
        permissions: 'Permissões',
        users: 'Usuários',
      },
    },

    /** The Permissions tab: modules, their permissions, and the statement of how access really works. */
    permissionsTab: {
      expandAll: 'Expandir todos',
      collapseAll: 'Recolher todos',
      /** FR-016 — the identifiers are revealed, never rewritten. */
      showIdentifiers: 'Ver identificadores técnicos',
      hideIdentifiers: 'Ocultar identificadores técnicos',
      identifiersHint:
        'Os identificadores são os nomes técnicos usados pela plataforma e não podem ser alterados.',
      moduleToggleLabel: (moduleLabel: string): string => `Permissões de ${moduleLabel}`,
      modulePermissionCount: (count: number): string =>
        count === 1 ? '1 permissão' : `${count.toLocaleString('pt-BR')} permissões`,
      empty: 'Este papel não concede nenhuma permissão.',
      /**
       * FR-015 — the authorization model, stated by the interface because
       * the interface is where the wrong mental model would form. There is
       * no inheritance between roles anywhere in the platform: resolution
       * is a flat union over the roles directly assigned to the person.
       */
      model: {
        title: 'Como este papel concede acesso',
        directGrant: 'As permissões abaixo são concedidas diretamente por este papel.',
        noInheritance: 'Não há herança entre papéis: um papel nunca recebe permissões de outro.',
        effectiveAccess:
          'O acesso efetivo de uma pessoa é a união das permissões de todos os papéis atribuídos a ela.',
      },
    },

    /** The Users tab (FR-018 to FR-025), including the state where the reader may not see people at all. */
    usersTab: {
      title: 'Pessoas com este papel',
      count: (count: number): string =>
        count === 1
          ? '1 pessoa tem este papel'
          : `${count.toLocaleString('pt-BR')} pessoas têm este papel`,
      empty: 'Nenhuma pessoa tem este papel.',
      loading: 'Carregando pessoas…',
      loadError: 'Não foi possível carregar as pessoas com este papel.',
      columns: {
        fullName: 'Nome',
        email: 'E-mail',
        jobTitle: 'Cargo',
        status: 'Status',
        orgUnit: 'Unidade organizacional',
        otherRoles: 'Outros papéis',
      },
      notSet: '—',
      noOtherRoles: 'Nenhum outro papel',
      /** FR-025 — other roles are real provenance of access, and are never presented as inheritance. */
      otherRolesHint:
        'Os demais papéis atribuídos à mesma pessoa. O acesso dela é a união de todos eles, inclusive deste.',
      /**
       * FR-018 to FR-020 — `role:administer` does not imply `user:administer`,
       * and there is no alternative route around that boundary. Without it
       * the tab shows only the aggregate count that `GET /admin/roles`
       * legitimately provides: no name, e-mail, job title or unit.
       */
      restricted: {
        title: 'Relação de pessoas indisponível',
        description:
          'Ver quem tem este papel exige a permissão de administração de usuários (user:administer), que é separada da permissão de administrar papéis. A quantidade abaixo continua disponível; nenhum dado pessoal é exibido aqui.',
        countLabel: (count: number): string =>
          count === 1
            ? '1 pessoa tem este papel'
            : `${count.toLocaleString('pt-BR')} pessoas têm este papel`,
      },
      /**
       * FR-022/FR-023 — organizational scope is a second dimension, granted
       * per user, never a property of the role assignment. The link is shown
       * only to someone authorized to consult it.
       */
      scopeNotice: {
        title: 'Escopo organizacional',
        description:
          'O escopo organizacional é concedido por usuário, não por este papel. Ter este papel não define quais unidades organizacionais a pessoa enxerga — isso vem das concessões de escopo dela.',
        link: 'Gerenciar escopo organizacional',
      },
    },

    /** Editing inside the panel (FR-026 to FR-033). Server validation stays intact; the client is never the only protection. */
    edit: {
      title: 'Editar papel',
      fields: {
        name: { label: 'Nome' },
        description: { label: 'Descrição' },
        permissions: { label: 'Permissões' },
      },
      /**
       * The permission tree's own controls (Fase 1 de "Novo papel"). The
       * search migrates `PermissionChecklist`'s behaviour verbatim — it
       * matched the pt-BR verb/resource/module vocabulary as well as the raw
       * identifier and the catalogue description, which is the only reason
       * typing "Testar" finds `control:test` (whose `action` is `ASSESS`).
       *
       * Selecting a whole module always means every permission of that
       * module, search or no search: `filteredNotice` says so, because a
       * control labelled "todas as permissões de Riscos" that silently
       * selected only the ones currently on screen would be a trap.
       */
      permissionTree: {
        searchLabel: 'Buscar permissão',
        /** Short on purpose: the panel is 26rem wide and a longer placeholder was measured truncated mid-word on screen. */
        searchPlaceholder: 'Buscar permissão…',
        clearSearch: 'Limpar a busca de permissões',
        searchResultCount: (shown: number, total: number): string =>
          `${shown.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} permissões`,
        searchEmpty: 'Nenhuma permissão corresponde à busca.',
        filteredNotice:
          'A busca filtra o que aparece aqui. Selecionar um módulo inteiro continua valendo para todas as permissões dele.',
        expandAll: 'Expandir todos',
        collapseAll: 'Recolher todos',
        selectedCount: (count: number): string =>
          count === 1
            ? '1 permissão selecionada'
            : `${count.toLocaleString('pt-BR')} permissões selecionadas`,
        empty: 'Nenhuma permissão disponível no catálogo.',
      },
      /** FR-028 — the per-module selector distinguishes all, some and none, in text as well as in shape. */
      moduleSelection: {
        toggleLabel: (moduleLabel: string): string =>
          `Selecionar todas as permissões de ${moduleLabel}`,
        allSelected: 'Todas selecionadas',
        someSelected: (selected: number, total: number): string =>
          `${selected.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} selecionadas`,
        noneSelected: 'Nenhuma selecionada',
      },
      /** FR-029 — what will change, before saving, split into what is added and what is removed. */
      pendingChanges: {
        title: 'Alterações pendentes',
        none: 'Nenhuma alteração pendente.',
        addedTitle: 'Permissões a acrescentar',
        removedTitle: 'Permissões a remover',
        addedCount: (count: number): string =>
          count === 1 ? '1 permissão a acrescentar' : `${count} permissões a acrescentar`,
        removedCount: (count: number): string =>
          count === 1 ? '1 permissão a remover' : `${count} permissões a remover`,
        nameChanged: (previous: string, next: string): string =>
          `Nome: de "${previous}" para "${next}"`,
        descriptionChanged: 'A descrição foi alterada.',
      },
      /** FR-031 — on a system role the reason is written out, not merely enforced by a disabled control. */
      locked: {
        badge: 'Somente leitura',
        nameReason: 'Papel do sistema: o nome não pode ser alterado.',
        permissionsReason:
          'Papel do sistema: o conjunto de permissões não pode ser alterado. As permissões continuam visíveis abaixo.',
        /**
         * F-68 — kept in the catalogue, no longer rendered anywhere: it says
         * the description is editable, and since 2026-09-14 it is not. The
         * notice actually shown is `platformOwnedNotice` below.
         */
        editableFieldsNotice: 'Neste papel, apenas a descrição pode ser editada e salva.',
        /** F-68 — the description has exactly one owner, and it is the platform seed. */
        descriptionReason:
          'Papel do sistema: a descrição não pode ser alterada. Ela é definida pela plataforma e restaurada a cada atualização do sistema.',
        /**
         * F-68 — one sentence covering all three fields, at the top of the
         * definition sheet, so the reader knows before scrolling that nothing
         * here is editable and why.
         */
        platformOwnedNotice:
          'Este papel é definido pela plataforma. Nome, descrição e permissões são mantidos pelo próprio sistema e não podem ser alterados aqui.',
      },
      /** F-68 — the heading of the read-only definition sheet of a system role, where "Editar papel" would be a promise the server refuses. */
      viewTitle: 'Definição do papel',
      /** Leaves the definition sheet. Nothing was editable, so there is nothing to discard and nothing to save. */
      close: 'Voltar',
      save: 'Salvar alterações',
      saving: 'Salvando…',
      cancel: 'Cancelar',
      /** FR-032 — cancelling persists nothing and returns the panel to reading. */
      cancelConfirm: {
        title: 'Descartar as alterações?',
        description: 'As alterações ainda não salvas serão perdidas. Nada será gravado.',
        confirm: 'Descartar alterações',
        keepEditing: 'Continuar editando',
      },
      genericError: 'Não foi possível salvar o papel. Tente novamente.',
    },

    /**
     * Creating a role, in the SAME panel and the same visual language as
     * reading and editing one (Fase 1 de "Novo papel"). The old
     * `RoleCreateDialog` spoke a language this screen no longer uses: a flat
     * checklist inside a modal, with no module state, no composition summary
     * and no statement of what the validation requires.
     *
     * `kindNotice` is a fact of the server, not a reassurance: a role created
     * through the API is ALWAYS custom — `prisma-role.repository.ts:69`
     * forces `isSystem: false` — so the interface says so instead of offering
     * a choice that does not exist.
     */
    create: {
      title: 'Novo papel',
      regionLabel: 'Novo papel',
      /** The panel's subject before it has one. Measured: repeating "Novo papel" under the "NOVO PAPEL" eyebrow said the same thing twice and never changed as the form was filled. */
      unnamed: 'Sem nome ainda',
      closeLabel: 'Fechar o formulário de novo papel',
      intro:
        'Um papel é um conjunto de permissões. Quem recebe o papel passa a ter todas as permissões marcadas abaixo.',
      kindNotice:
        'Papéis criados aqui são sempre personalizados: podem ser renomeados, ter as permissões alteradas e ser excluídos enquanto não estiverem atribuídos a ninguém.',
      submit: 'Criar papel',
      submitting: 'Criando…',
      cancel: 'Cancelar',
      /** Same idiom as `edit.cancelConfirm`: leaving with unsaved work asks first, and nothing is written either way. */
      discardConfirm: {
        title: 'Descartar o novo papel?',
        description: 'O que foi preenchido será perdido. Nenhum papel será criado.',
        confirm: 'Descartar',
        keepEditing: 'Continuar preenchendo',
      },
      /** What the role WILL grant, counted while it is being composed — the create-mode counterpart of the edit mode's pending diff. */
      composition: {
        title: 'O que este papel concederá',
        permissionCount: (count: number): string =>
          count === 1 ? '1 permissão' : `${count.toLocaleString('pt-BR')} permissões`,
        moduleCount: (count: number): string =>
          count === 1 ? 'em 1 módulo' : `em ${count.toLocaleString('pt-BR')} módulos`,
        modulesLabel: 'Módulos alcançados',
        none: 'Nenhuma permissão selecionada — o papel ainda não concede nada.',
      },
      /**
       * What the form requires, stated up front and kept live. Each item
       * carries its state in SHAPE (a check inside a circle when met, an empty
       * circle when not) and in WORDS (`met`/`unmet` as the accessible name),
       * never in colour alone (§18.8, NFR-004).
       */
      requirements: {
        title: 'Para criar o papel',
        met: (requirement: string): string => `Atendido: ${requirement}`,
        unmet: (requirement: string): string => `Pendente: ${requirement}`,
        name: 'Um nome, de até 100 caracteres',
        description: 'Uma descrição, de até 500 caracteres',
        permissions: 'Ao menos uma permissão selecionada',
      },
      /** A 422 on create is the server refusing the request's shape — never the system-role rule, which cannot apply to a role that does not exist yet. */
      invalidError: 'Revise os campos: o servidor recusou os dados informados.',
      genericError: 'Não foi possível criar o papel. Tente novamente.',
    },

    /** List states. The two empty states are distinct on purpose: "nothing matched" and "nothing exists" are different problems with different exits. */
    states: {
      loading: 'Carregando papéis…',
      loadingLabel: 'Carregando a lista de papéis',
      error: {
        title: 'Não foi possível carregar os papéis',
        description:
          'Tente novamente. Se o problema continuar, informe ao suporte o identificador abaixo.',
        correlationIdLabel: 'ID de correlação',
        retry: 'Tentar novamente',
      },
      emptyFiltered: {
        title: 'Nenhum papel encontrado',
        description: 'Nenhum papel corresponde à busca e aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
      emptyNone: {
        title: 'Nenhum papel cadastrado',
        description:
          'Crie o primeiro papel para compor um conjunto de permissões e atribuí-lo às pessoas da organização.',
        createAction: 'Novo papel',
      },
    },
  },
  organization: {
    pageTitle: 'Estrutura organizacional',
    pageDescription: 'Árvore de unidades organizacionais e concessão de escopo de acesso.',
    createRootAction: 'Nova unidade raiz',
    tree: {
      ariaLabel: 'Árvore de unidades organizacionais',
      createChildAction: 'Nova subunidade',
      edit: 'Editar',
      activate: 'Ativar',
      deactivate: 'Desativar',
      collapse: 'Recolher',
      expand: 'Expandir',
      rowActionsLabel: (name: string): string => `Ações para ${name}`,
      childCount: (count: number): string =>
        count === 1 ? '1 subunidade' : `${count} subunidades`,
      inactiveBadge: 'Inativa',
      empty: 'Nenhuma unidade organizacional cadastrada.',
      loadError: 'Não foi possível carregar a estrutura organizacional.',
    },
    form: {
      createRootTitle: 'Nova unidade raiz',
      createChildTitle: (parentName: string): string => `Nova subunidade de ${parentName}`,
      editTitle: 'Editar unidade organizacional',
      fields: {
        code: { label: 'Código' },
        name: { label: 'Nome' },
        parent: {
          label: 'Unidade superior',
          rootOption: 'Nenhuma (unidade raiz)',
        },
      },
      submitCreate: 'Criar unidade',
      submitEdit: 'Salvar alterações',
      submitting: 'Salvando…',
      cancel: 'Cancelar',
      genericError: 'Não foi possível salvar a unidade organizacional. Tente novamente.',
    },
    validation: {
      code: { required: 'Informe o código da unidade.' },
      name: { required: 'Informe o nome da unidade.' },
    },
    feedback: {
      createSuccess: 'Unidade organizacional criada com sucesso.',
      updateSuccess: 'Unidade organizacional atualizada com sucesso.',
      activateSuccess: 'Unidade organizacional ativada.',
      deactivateSuccess: 'Unidade organizacional desativada.',
      loadError: 'Não foi possível carregar a estrutura organizacional.',
      genericError: 'Não foi possível concluir a ação. Tente novamente.',
    },
    /** The reparent blast radius (task brief): rewrites every descendant's path and can change who can see what. */
    reparent: {
      confirmTitle: 'Mover esta unidade organizacional?',
      warning: (unitName: string, descendantCount: number, newParentName: string): string =>
        descendantCount > 0
          ? `"${unitName}" passará a ficar sob "${newParentName}". Isso recalcula o caminho de ${unitName} e de ${descendantCount === 1 ? 'sua 1 subunidade' : `suas ${descendantCount} subunidades`}, e pode ampliar ou reduzir imediatamente o acesso de usuários com escopo nessas unidades — inclusive a riscos e outros registros hoje visíveis a eles.`
          : `"${unitName}" passará a ficar sob "${newParentName}". Isso recalcula o caminho de "${unitName}" e pode ampliar ou reduzir imediatamente o acesso de usuários com escopo nessa unidade.`,
      confirm: 'Mover unidade',
      cycleError:
        'Não é possível mover uma unidade para dentro de uma de suas próprias subunidades.',
    },
    statusDialog: {
      activateTitle: (name: string): string => `Ativar a unidade "${name}"?`,
      activateDescription: 'A unidade voltará a poder ser selecionada em riscos e usuários.',
      deactivateTitle: (name: string): string => `Desativar a unidade "${name}"?`,
      deactivateDescription:
        'A unidade deixará de poder ser selecionada para novos riscos ou usuários. O histórico existente é preservado.',
      confirmActivate: 'Ativar',
      confirmDeactivate: 'Desativar',
      blockedByActiveDescendantError:
        'Não é possível desativar: existe pelo menos uma subunidade ativa. Desative as subunidades primeiro.',
    },
    scopeGrants: {
      title: 'Concessão de escopo organizacional',
      description:
        'Concede a um usuário acesso a uma unidade organizacional (e suas subunidades) ou acesso global.',
      userSearchLabel: 'Buscar usuário',
      userSearchPlaceholder: 'Buscar por nome ou e-mail…',
      noSearchResults: 'Nenhum usuário encontrado.',
      noUserSelected: 'Selecione um usuário para ver e gerenciar seu escopo.',
      grantsTitle: (fullName: string): string => `Escopo de ${fullName}`,
      empty: 'Este usuário não possui nenhuma concessão de escopo.',
      columns: { type: 'Tipo', unit: 'Unidade', grantedBy: 'Concedido por', grantedAt: 'Data' },
      scopeType: { unit: 'Unidade', global: 'Global' },
      notApplicable: '—',
      selectedUnitLabel: (unitName: string): string => `Unidade selecionada na árvore: ${unitName}`,
      form: {
        scopeTypeLabel: 'Tipo de escopo',
        unitOption: 'Unidade organizacional',
        globalOption: 'Global (toda a plataforma)',
        unitLabel: 'Unidade',
        unitPlaceholder: 'Selecione a unidade selecionada na árvore',
        submit: 'Conceder escopo',
        submitting: 'Concedendo…',
      },
      /** FR-028: a grant/revoke takes effect on the user's next request, not immediately for an already-open session. */
      effectNotice:
        'A concessão ou revogação passa a valer na próxima requisição do usuário — sem necessidade de novo login.',
      revokeAction: 'Revogar',
      revokeDialog: {
        title: 'Revogar esta concessão de escopo?',
        description:
          'O usuário deixará de enxergar, na próxima requisição, os registros que dependiam apenas deste escopo. Os registros em si não são afetados — apenas o alcance deste usuário sobre eles.',
        confirm: 'Revogar',
      },
      globalRequiresNoUnit: 'Um escopo global não deve ter uma unidade selecionada.',
      grantSuccess: 'Escopo concedido com sucesso.',
      revokeSuccess: 'Escopo revogado com sucesso.',
      duplicateError: 'Este usuário já possui uma concessão idêntica.',
      loadError: 'Não foi possível carregar as concessões de escopo deste usuário.',
      searchError: 'Não foi possível buscar usuários.',
      genericError: 'Não foi possível concluir a ação. Tente novamente.',
    },
  },
} as const;
