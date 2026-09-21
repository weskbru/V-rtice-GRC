/**
 * PharosGRC — cross-cutting microcopy (pt-BR) shared by more than one area.
 * Area-specific copy lives in that area's own catalog file instead.
 */
import type { SeededRoleName } from '@/features/admin/types';

export const common = {
  /** CLAUDE.md §user status terminology. Reused wherever a user's `status` (`OwnProfile.status`, and future user-management screens) is rendered. */
  userStatus: {
    active: 'Ativo',
    inactive: 'Inativo',
  },
  /**
   * pt-BR display names for the twelve SEEDED roles, and only those
   * (ADR-022, amended 2026-09-14).
   *
   * ## Why this lives in `common` and not in `admin`
   *
   * Two areas print a role's name: Administração (the roles register, the
   * detail panel, the delete dialog, the Users register's chips, the role
   * picker) and Perfil (the "Papéis" line of the identity card). This file's
   * own contract — the first sentence above — is that copy shared by more
   * than one area lives here; `userStatus`, three lines up, is the identical
   * shape for the identical reason (a stored value rendered in pt-BR by
   * whichever screen happens to show it). Leaving the map in `admin.ts` and
   * importing it from Perfil would make a screen that is not Administração
   * depend on Administração's catalogue for its own copy.
   *
   * ## What this is, and what it is not
   *
   * This is the same move `admin.permissionCatalog` makes for `risk:view`
   * and `audit-engagement:scope`: the server's technical identifier is left
   * untouched, and the interface is given a readable pt-BR name for it
   * (CLAUDE.md §11.1 — the interface is pt-BR; the identifier stays English,
   * exactly as every enum value in this product does). `Role.name` is
   * `@unique` and is what `upsertSystemRoles` upserts on: nothing here is
   * persisted, sent to the server, or used to look a role up. Renaming a
   * seeded role remains a data migration nobody is doing from a message
   * catalogue.
   *
   * ## A role absent from this map renders EXACTLY as stored
   *
   * A role created through the admin screens carries the name a person
   * typed. It has no translation and must never acquire one: it falls
   * through `roleDisplayName` (`@/lib/role-display-name`) to its raw value,
   * character for character. That fallback is the correct behaviour here,
   * not a silent gap — which is precisely why the map is keyed by the closed
   * `SeededRoleName` union (exhaustive, checked by the compiler) while the
   * resolver accepts any `string`.
   *
   * ## There is exactly one of these, and there was not always
   *
   * `profile.identity.roleLabels` was a second map of the same kind, live on
   * the Perfil screen since 001 and covering SIX of the twelve seeded roles
   * — so the same platform printed "Gestor de Riscos" for one person and
   * "Compliance Manager" for the next, and no gate saw it, because its
   * lookup fell back to the raw name and a fallback never fails. That map is
   * gone; its six strings are the six adopted verbatim below. The guard that
   * keeps it from coming back is `role-display-name.single-catalogue.test.ts`,
   * which fails if any other production file keys an object by a seeded role
   * name.
   */
  roleDisplayNames: {
    'Platform Administrator': 'Administrador da Plataforma',
    'Risk Manager': 'Gestor de Riscos',
    'Risk Analyst': 'Analista de Riscos',
    'Risk Approver': 'Aprovador de Riscos',
    'Control Owner': 'Responsável por Controle',
    'Control Approver': 'Aprovador de Controle',
    'Compliance Manager': 'Gestor de Compliance',
    // Identical in pt-BR, and listed anyway: the map is exhaustive over the
    // seed, so "absent from the map" always means "not a seeded role".
    Auditor: 'Auditor',
    'Read Only': 'Somente Leitura',
    'Audit Lead': 'Líder de Auditoria',
    'Incident Manager': 'Gestor de Incidentes',
    'Problem Manager': 'Gestor de Problemas',
  } satisfies Record<SeededRoleName, string>,
  /** Generic action verbs shared by every module's forms and lists — a business module names its own screen-specific copy but reuses these instead of re-declaring "Cancelar" a dozen times. */
  actions: {
    save: 'Salvar',
    cancel: 'Cancelar',
    edit: 'Editar',
    create: 'Criar',
    add: 'Adicionar',
    remove: 'Remover',
    back: 'Voltar',
    retry: 'Tentar novamente',
    clearFilters: 'Limpar filtros',
    /** Drops every value selected inside ONE filter control, unlike `clearFilters`, which drops them all. */
    clear: 'Limpar',
  },
  /**
   * The shared register/list chrome (`FilterBar`, `MultiSelectFilter`) —
   * text the design system must never carry itself (§11.1, D-10), and that
   * no module needs to word differently.
   */
  filters: {
    noOptions: 'Nenhuma opção disponível.',
  },
  /**
   * `DataTable`'s chrome text (`@pharos/design-system/components`, T108),
   * also reused by the standalone `PaginationFooter` (e.g. a register's
   * card view paginating the same server-side results). `packages/design-
   * system` does not depend on this catalog (see `messages/index.ts`'s doc
   * comment) — every business module's register screen (risks today,
   * problems/incidents/controls tomorrow) passes this same object as the
   * `labels` prop, so the exact same words (results summary, numbered-page
   * accessible names, the sort-state announcements, ...) are used by every
   * table/pagination control in the platform without a module re-declaring
   * them (SC-011).
   */
  dataTable: {
    loading: 'Carregando dados…',
    /** "Itens", not "Linhas": the same footer paginates a card grid and a table, and a card is not a row. */
    rowsPerPageLabel: 'Itens por página',
    goToPageLabel: 'Ir para a página',
    goToPageToggleLabel: 'Ir para uma página específica',
    /**
     * Names the slice, not the whole: the register's results toolbar right
     * above already states the total ("861 riscos"), so the old "Mostrando
     * 1–50 de 861 resultados" was the same number, in a longer sentence,
     * twice on one screen.
     */
    resultsSummary: (from: number, to: number, total: number): string =>
      total === 0
        ? 'Nenhum resultado'
        : `${from.toLocaleString('pt-BR')}–${to.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`,
    previousPageLabel: 'Página anterior',
    nextPageLabel: 'Próxima página',
    pageNumberLabel: (page: number): string => `Ir para a página ${page}`,
    sort: {
      ascending: '(ordenado de forma crescente)',
      descending: '(ordenado de forma decrescente)',
      none: '(não ordenado — ativar para ordenar)',
    },
  },
  /**
   * `EntityTabs`'s chrome text (`@pharos/design-system/components`, T094,
   * D-10). Shared by every module's detail screen — risk today, a future
   * problem/incident/control detail tomorrow — the same way `dataTable`
   * above is shared.
   */
  entityTabs: {
    sectionsAriaLabel: 'Seções do registro',
    /** Accessible names for `EntityTabs`'s scroll-affordance chevrons (assurance-audit Fix 2) — rendered only when the tab strip actually overflows its container. */
    scrollBack: 'Rolar seções para a esquerda',
    scrollForward: 'Rolar seções para a direita',
  },
  /**
   * `ConfirmDialog`'s chrome text that is the same regardless of which
   * action is being confirmed (`@pharos/design-system/components`, D-10).
   * The confirm action's own label is action-specific and supplied by the
   * caller alongside these.
   */
  confirmDialog: {
    cancel: 'Cancelar',
    close: 'Fechar',
  },
  /**
   * `FormField`'s (`@pharos/design-system/components`, T093) required/
   * optional convention (CLAUDE.md §18, "Forms"): required is the field's
   * own non-color `*` glyph; optional is this shared visible marker, so the
   * two states never depend on one being silently inferred from the
   * absence of the other. One catalog entry, reused by every module's form
   * exactly like `dataTable`/`entityTabs`/`confirmDialog` above — a form
   * that wants the marker passes `optionalIndicator={common.formField
   * .optionalIndicator}`; omitting the prop entirely (as every FormField
   * call site did before this convention existed) still renders no marker
   * at all.
   */
  formField: {
    optionalIndicator: '(opcional)',
  },
  /**
   * `apps/web/src/components/ui/dialog.tsx`'s own generic close ("X") button
   * — shared by every dialog built on it (approval dialogs, admin create/edit
   * dialogs, ...), distinct from `confirmDialog` above which is
   * `@pharos/design-system`'s `ConfirmDialog`. T203: this was a hardcoded
   * English "Close" screen-reader-only label (CLAUDE.md §11.1 — the shadcn
   * scaffold's own default, never localized).
   */
  dialog: {
    closeLabel: 'Fechar',
  },

  /**
   * `components/ui/command.tsx`'s `CommandDialog` default `title`/
   * `description` — the same class of defect `dialog.closeLabel` above
   * already fixed (T203): a hardcoded English shadcn-scaffold default
   * ("Command Palette" / "Search for a command to run..."), never
   * localized (CLAUDE.md §11.1, assurance-audit Fix 4). This primitive has
   * zero importers as of this fix — dormant, but its defaults must still
   * never be English the moment a future screen wires it up without
   * overriding them.
   */
  commandPalette: {
    defaultTitle: 'Paleta de comandos',
    defaultDescription: 'Buscar um comando para executar…',
  },

  /**
   * `@pharos/design-system`'s `SearchablePicker` (Front H, D-17/research.md
   * — the nine link pickers that used to load one unsearched page of a
   * registry and never let the user reach anything past it). These two
   * strings are entity-agnostic on purpose and shared by every call site;
   * everything that names the specific entity type ("Selecione um
   * controle", "Buscar controle por nome ou código", ...) stays in each
   * feature's own catalog, next to that entity's other picker copy.
   */
  searchablePicker: {
    loadingText: 'Buscando…',
    partialResultsText: (shownCount: number): string =>
      `Mostrando os primeiros ${String(shownCount)} resultados — refine a busca para ver mais.`,
  },

  /**
   * S-10 — shared copy for every user-picker built on `SearchablePicker`/
   * `UserMultiSelectFilter` (`components/directory/`), reused by every
   * responsible/gestor/dono field across Ações, Auditoria, Controles,
   * Incidentes, Problemas e Riscos, so the same search affordance reads
   * identically everywhere. Each call site still supplies its own
   * `placeholder`/`triggerAriaLabel` (context-specific, e.g. "Selecionar
   * responsável" vs. "Selecionar gestor") from its own message catalog.
   */
  userPicker: {
    searchPlaceholder: 'Buscar por nome ou e-mail…',
    emptyText: 'Nenhum usuário encontrado.',
    clearLabel: 'Limpar',
  },

  /**
   * `sonner`'s `<Toaster>` (`components/ui/sonner.tsx`, mounted once by
   * `FeedbackProvider` — the platform-wide `feedback.success/.../error`
   * API every screen uses instead of calling `sonner` directly). The same
   * class of defect `dialog.closeLabel`/`commandPalette` above already
   * fixed (T203, CLAUDE.md §11.1): a hardcoded English default from a
   * third-party dependency, never localized — `closeButtonAriaLabel`
   * defaults to `'Close toast'` and `containerAriaLabel` to
   * `'Notifications'` in `sonner`'s own source
   * (`node_modules/sonner/dist/index.mjs`). Both are real, documented
   * props — `containerAriaLabel` directly on `ToasterProps`,
   * `closeButtonAriaLabel` nested under `ToasterProps.toastOptions` (it is
   * a per-toast `ToastOptions` field, not a top-level `Toaster` prop) —
   * passed once here at the `<Toaster>` call site in
   * `feedback-provider.tsx` — every toast in the application inherits the
   * fix, no per-call-site override needed. `hotkey`'s own
   * rendered suffix (a symbolic keyboard-shortcut hint, e.g. "⌥T") is left
   * alone: it is not language text, the same way a shortcut glyph
   * elsewhere in the product is not translated.
   */
  toaster: {
    regionAriaLabel: 'Notificações',
    closeButtonAriaLabel: 'Fechar notificação',
  },
} as const;
