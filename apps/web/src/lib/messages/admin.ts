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
        orgUnit: 'Unidade organizacional',
        orgUnitHeader: 'Unidade',
        roles: 'Papéis',
        lastLoginAt: 'Último acesso',
      },
      neverLoggedIn: 'Nunca acessou',
      noOrgUnit: '—',
      noRoles: 'Nenhum papel',
    },
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
      withoutRole: {
        label: 'Sem papel',
        hint: 'Nenhum papel atribuído',
      },
      value: (count: number): string => count.toLocaleString('pt-BR'),
      loading: 'Carregando indicadores…',
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
    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },
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
    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver os usuários em cards',
      tableLabel: 'Ver os usuários em tabela',
    },
    card: {
      regionLabel: 'Usuários',
      openLabel: (fullName: string): string => `Abrir usuário ${fullName}`,
      orgUnitLabel: 'Unidade',
      rolesLabel: 'Papéis',
      lastLoginLabel: 'Último acesso',
    },
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
      summary: (total: number, system: number, custom: number): string =>
        `${total === 1 ? '1 papel' : `${total} papéis`} · ${system} do sistema · ${
          custom === 1 ? '1 personalizado' : `${custom} personalizados`
        }`,
      openDetailsLabel: (name: string): string => `Ver detalhes do papel ${name}`,
      assignedUsersLabel: (count: number): string =>
        count === 1 ? '1 usuário atribuído' : `${count} usuários atribuídos`,
    },
    type: {
      system: 'Sistema',
      custom: 'Personalizado',
    },
    permissionOverview: {
      count: (count: number): string => (count === 1 ? '1 permissão' : `${count} permissões`),
      areaCount: (count: number): string => (count === 1 ? '1 área' : `${count} áreas`),
      moreAreas: (count: number): string => `+${count}`,
      areasLabel: (areas: string): string => `Áreas: ${areas}`,
      none: 'Nenhuma permissão',
    },
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

    technicalName: {
      label: 'Nome técnico',
    },
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
      systemRoleNotEditableError:
        'Papéis do sistema são definidos pela plataforma: nome, descrição e permissões não podem ser alterados.',
      deleteBlockedError:
        'Este papel é um papel do sistema ou ainda está atribuído a pelo menos um usuário.',
      loadError: 'Não foi possível carregar os papéis.',
      loadPermissionsError: 'Não foi possível carregar o catálogo de permissões.',
      genericError: 'Não foi possível concluir a ação. Tente novamente.',
    },

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
      usersWithRoles: {
        label: 'Usuários com papéis',
        hint: 'Pessoas com ao menos um papel; quem tem vários conta uma vez',
      },
      value: (count: number): string => count.toLocaleString('pt-BR'),
      activeLabel: 'Filtro aplicado',
      loading: 'Carregando indicadores…',
      loadError: 'Não foi possível carregar os indicadores. A lista de papéis continua abaixo.',
    },

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
      moduleHint: 'Mostra os papéis que concedem ao menos uma permissão do módulo.',
      activeFiltersLabel: 'Filtros ativos',
      searchChipLabel: (term: string): string => `Busca: "${term}"`,
      typeChipLabel: (typeLabel: string): string => `Tipo: ${typeLabel}`,
      moduleChipLabel: (moduleLabel: string): string => `Módulo: ${moduleLabel}`,
      removeFilterLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 papel' : `${total.toLocaleString('pt-BR')} papéis`,
      countLoading: 'Carregando resultados…',
      countOfTotal: (shown: number, total: number): string =>
        `${shown.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} papéis`,
      sortLabel: 'Ordenar por',
      sortOptions: {
        'name:asc': 'Nome (A–Z)',
        'name:desc': 'Nome (Z–A)',
        'permissions:desc': 'Quantidade de permissões',
        'users:desc': 'Quantidade de usuários',
      } satisfies Record<RoleSortOption, string>,
    },

    card: {
      listLabel: 'Papéis da plataforma',
      openLabel: (name: string): string => `Abrir detalhes do papel ${name}`,
      selectedLabel: 'Papel selecionado',
      permissionCount: (count: number): string =>
        count === 1 ? '1 permissão' : `${count.toLocaleString('pt-BR')} permissões`,
      userCount: (count: number): string =>
        count === 1 ? '1 usuário' : `${count.toLocaleString('pt-BR')} usuários`,
      noPermissions: 'Nenhuma permissão',
      noUsers: 'Nenhum usuário',
      modulesLabel: 'Módulos alcançados',
      moreModules: (count: number): string =>
        count === 1 ? '+1 módulo' : `+${count.toLocaleString('pt-BR')} módulos`,
      modulesAccessibleLabel: (modules: string): string => `Módulos alcançados: ${modules}`,
      noModules: 'Não alcança nenhum módulo',
      noDescription: 'Sem descrição.',
    },

    privilege: {
      badge: 'Privilegiado',
      badgeAccessibleLabel: (name: string): string =>
        `${name} concede permissões de administração de acesso`,
      explanationLabel: 'O que significa privilegiado',
      explanation:
        'Este papel concede ao menos uma permissão de administração de acesso — papéis, usuários ou estrutura organizacional —, ou seja, permite alterar quem pode o quê na plataforma. É um destaque de leitura desta tela, calculado a partir das permissões listadas; nenhuma verificação de acesso depende dele.',
    },

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
      viewDefinitionAction: 'Ver definição',
      systemOwnedAction:
        'Nome, descrição e permissões são definidos pela plataforma e não podem ser alterados aqui.',
      tabs: {
        permissions: 'Permissões',
        users: 'Usuários',
      },
    },

    permissionsTab: {
      expandAll: 'Expandir todos',
      collapseAll: 'Recolher todos',
      showIdentifiers: 'Ver identificadores técnicos',
      hideIdentifiers: 'Ocultar identificadores técnicos',
      identifiersHint:
        'Os identificadores são os nomes técnicos usados pela plataforma e não podem ser alterados.',
      moduleToggleLabel: (moduleLabel: string): string => `Permissões de ${moduleLabel}`,
      modulePermissionCount: (count: number): string =>
        count === 1 ? '1 permissão' : `${count.toLocaleString('pt-BR')} permissões`,
      empty: 'Este papel não concede nenhuma permissão.',
      model: {
        title: 'Como este papel concede acesso',
        directGrant: 'As permissões abaixo são concedidas diretamente por este papel.',
        noInheritance: 'Não há herança entre papéis: um papel nunca recebe permissões de outro.',
        effectiveAccess:
          'O acesso efetivo de uma pessoa é a união das permissões de todos os papéis atribuídos a ela.',
      },
    },

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
      otherRolesHint:
        'Os demais papéis atribuídos à mesma pessoa. O acesso dela é a união de todos eles, inclusive deste.',
      restricted: {
        title: 'Relação de pessoas indisponível',
        description:
          'Ver quem tem este papel exige a permissão de administração de usuários (user:administer), que é separada da permissão de administrar papéis. A quantidade abaixo continua disponível; nenhum dado pessoal é exibido aqui.',
        countLabel: (count: number): string =>
          count === 1
            ? '1 pessoa tem este papel'
            : `${count.toLocaleString('pt-BR')} pessoas têm este papel`,
      },
      scopeNotice: {
        title: 'Escopo organizacional',
        description:
          'O escopo organizacional é concedido por usuário, não por este papel. Ter este papel não define quais unidades organizacionais a pessoa enxerga — isso vem das concessões de escopo dela.',
        link: 'Gerenciar escopo organizacional',
      },
    },

    edit: {
      title: 'Editar papel',
      fields: {
        name: { label: 'Nome' },
        description: { label: 'Descrição' },
        permissions: { label: 'Permissões' },
      },
      permissionTree: {
        searchLabel: 'Buscar permissão',
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
      moduleSelection: {
        toggleLabel: (moduleLabel: string): string =>
          `Selecionar todas as permissões de ${moduleLabel}`,
        allSelected: 'Todas selecionadas',
        someSelected: (selected: number, total: number): string =>
          `${selected.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} selecionadas`,
        noneSelected: 'Nenhuma selecionada',
      },
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
      locked: {
        badge: 'Somente leitura',
        nameReason: 'Papel do sistema: o nome não pode ser alterado.',
        permissionsReason:
          'Papel do sistema: o conjunto de permissões não pode ser alterado. As permissões continuam visíveis abaixo.',
        editableFieldsNotice: 'Neste papel, apenas a descrição pode ser editada e salva.',
        descriptionReason:
          'Papel do sistema: a descrição não pode ser alterada. Ela é definida pela plataforma e restaurada a cada atualização do sistema.',
        platformOwnedNotice:
          'Este papel é definido pela plataforma. Nome, descrição e permissões são mantidos pelo próprio sistema e não podem ser alterados aqui.',
      },
      viewTitle: 'Definição do papel',
      close: 'Voltar',
      save: 'Salvar alterações',
      saving: 'Salvando…',
      cancel: 'Cancelar',
      cancelConfirm: {
        title: 'Descartar as alterações?',
        description: 'As alterações ainda não salvas serão perdidas. Nada será gravado.',
        confirm: 'Descartar alterações',
        keepEditing: 'Continuar editando',
      },
      genericError: 'Não foi possível salvar o papel. Tente novamente.',
    },

    create: {
      title: 'Novo papel',
      regionLabel: 'Novo papel',
      unnamed: 'Sem nome ainda',
      closeLabel: 'Fechar o formulário de novo papel',
      intro:
        'Um papel é um conjunto de permissões. Quem recebe o papel passa a ter todas as permissões marcadas abaixo.',
      kindNotice:
        'Papéis criados aqui são sempre personalizados: podem ser renomeados, ter as permissões alteradas e ser excluídos enquanto não estiverem atribuídos a ninguém.',
      submit: 'Criar papel',
      submitting: 'Criando…',
      cancel: 'Cancelar',
      discardConfirm: {
        title: 'Descartar o novo papel?',
        description: 'O que foi preenchido será perdido. Nenhum papel será criado.',
        confirm: 'Descartar',
        keepEditing: 'Continuar preenchendo',
      },
      composition: {
        title: 'O que este papel concederá',
        permissionCount: (count: number): string =>
          count === 1 ? '1 permissão' : `${count.toLocaleString('pt-BR')} permissões`,
        moduleCount: (count: number): string =>
          count === 1 ? 'em 1 módulo' : `em ${count.toLocaleString('pt-BR')} módulos`,
        modulesLabel: 'Módulos alcançados',
        none: 'Nenhuma permissão selecionada — o papel ainda não concede nada.',
      },
      requirements: {
        title: 'Para criar o papel',
        met: (requirement: string): string => `Atendido: ${requirement}`,
        unmet: (requirement: string): string => `Pendente: ${requirement}`,
        name: 'Um nome, de até 100 caracteres',
        description: 'Uma descrição, de até 500 caracteres',
        permissions: 'Ao menos uma permissão selecionada',
      },
      invalidError: 'Revise os campos: o servidor recusou os dados informados.',
      genericError: 'Não foi possível criar o papel. Tente novamente.',
    },

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
