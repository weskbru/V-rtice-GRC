/**
 * PharosGRC — application shell chrome (pt-BR): sidebar, header, user menu.
 *
 * `navigation.modules` holds the label shown for every entry in
 * `components/shell/navigation-registry.ts` — the single source for what a
 * module is called in the UI, whether it is implemented or still planned.
 * "Dashboard" and "Compliance" are deliberately left as-is: both are
 * consecrated loanwords in Brazilian GRC/corporate usage (CLAUDE.md itself
 * writes "Dashboard GRC" and "Compliance" in its own Portuguese text).
 */
export const shell = {
  /** Header breadcrumb fallback when no path segment is even present — the brand name, not translated. */
  brandFallback: 'PharosGRC',
  /**
   * Skip link (T203, WCAG 2.4.1 "Bypass Blocks") — the first focusable
   * element in the authenticated shell, visually hidden until it receives
   * keyboard focus, jumping straight to `<main>` so a keyboard or
   * screen-reader user does not have to tab through the sidebar and header
   * on every single page.
   */
  skipToContent: 'Pular para o conteúdo principal',
  /** Institutional loader shown over the current screen while a navigation is still in flight (`components/shell/navigation-pending.tsx`). */
  navigationPending: 'Carregando página…',
  sidebar: {
    ariaLabel: 'Navegação principal',
    plannedBadge: 'Planejado',
    plannedTitle: (label: string): string =>
      `${label} é um módulo planejado — ainda não disponível`,
    collapse: 'Recolher menu lateral',
    expand: 'Expandir menu lateral',
  },
  /**
   * Section headings — a purely presentational grouping over
   * `navigationRegistry` (`components/shell/navigation-sections.ts`), shared
   * by the sidebar's section labels and the header's context eyebrow so both
   * surfaces describe the same grouping the same way.
   */
  sections: {
    grc: 'Módulos de GRC',
    administration: 'Administração',
  },
  navigation: {
    modules: {
      dashboard: 'Dashboard',
      /** 002-shared-grc-foundation, US2, R-009 — the ONE new sidebar entry
       * this phase adds; Evidence and Finding stay inside their domain
       * contexts (see `navigation-registry.ts`'s own entry for the full
       * reasoning). Reframed from "Minhas ações" to "Planos de Ação" once
       * the screen became the platform's central Plano de Ação surface
       * (detail, edit and history), not a personal work list — the `id`/
       * key stays `my-actions`/`myActions` (CLAUDE.md §11.1). The disabled
       * `status: 'planned'` entry that used to carry these same words
       * (`navigation-registry.ts`, `id: 'action-plans'`) was REMOVED when this
       * screen took the name: Plano de Ação is not an unbuilt module, it is
       * the shared `Action` capability (CLAUDE.md §1/§4/§17), and two rows
       * on one label — one live, one marked "Planejado" — told the user the
       * opposite. */
      myActions: 'Planos de Ação',
      risks: 'Riscos',
      problems: 'Problemas',
      incidents: 'Incidentes',
      controls: 'Controles',
      assets: 'Ativos',
      processes: 'Processos',
      compliance: 'Compliance',
      audits: 'Auditoria',
      indicators: 'Indicadores',
      reports: 'Relatórios',
    },
    /** Administration entries (US8, T181–T183) — added to the SAME registry as every other module, per its own extension-point contract (docs/architecture.md §2). */
    administration: {
      users: 'Usuários',
      roles: 'Papéis e permissões',
      organization: 'Estrutura organizacional',
    },
  },
  header: {
    breadcrumbAriaLabel: 'Trilha de navegação',
    fallbackLabels: {
      profile: 'Perfil',
    },
  },
  themeToggle: {
    /** Static action label — the paired sun/moon icons (CSS-driven by the
     * `.dark` class, per the toggle's own comment) already communicate the
     * current state, so this reads as "toggle theme" rather than a state
     * that would need to track which theme is active before hydration. */
    label: 'Alternar entre tema claro e escuro',
  },
  userMenu: {
    accountMenuAriaLabel: (fullName: string): string => `Menu da conta de ${fullName}`,
    profile: 'Perfil',
    signOut: 'Sair',
    signingOut: 'Saindo…',
  },
  /**
   * Notification bell and list (T196, US9, FR-101). `GET /notifications`
   * has no producer wired yet in this release — no lifecycle event in the
   * platform creates a notification today (`docs/architecture.md` §6's own
   * honesty applies here too: the capability exists and is tested, but
   * nothing calls it) — so `empty` is the ordinary, expected state for
   * every real user, not an error to apologize for.
   */
  notifications: {
    bellAriaLabel: 'Notificações',
    bellAriaLabelWithUnread: (unreadCount: number): string =>
      `Notificações (${unreadCount.toLocaleString('pt-BR')} não lidas)`,
    panelTitle: 'Notificações',
    loading: 'Carregando notificações…',
    loadError: 'Não foi possível carregar as notificações.',
    empty: 'Nenhuma notificação por enquanto.',
    markAllRead: 'Marcar todas como lidas',
    markAllReadSuccess: 'Todas as notificações foram marcadas como lidas.',
    markAllReadError: 'Não foi possível marcar as notificações como lidas.',
    markOneReadLabel: 'Marcar como lida',
    markOneReadError: 'Não foi possível marcar a notificação como lida.',
    unreadIndicatorLabel: 'Não lida',
  },
} as const;
