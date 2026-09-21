# Plataforma (Core) — capacidades transversais

> Inventário das capacidades de `core/**` (CLAUDE.md §4) como módulos: o que existe, onde vive o
> código, e o que ainda é planejado. Cada seção segue o mesmo formato — uma tabela de fatos
> verificáveis seguida de notas curtas. Identificadores técnicos ficam em inglês (CLAUDE.md §11.1).
>
> Para detalhes de autenticação, sessão e autorização (fluxos, cookies, guards, escopo), ver
> [`docs/architecture/security.md`](../architecture/security.md) — este documento não repete esse conteúdo, só referencia.

## Contents

- [1. Usuários](#1-usuários)
- [2. Papéis e Permissões](#2-papéis-e-permissões)
- [3. Organizações / Estrutura Organizacional](#3-organizações--estrutura-organizacional)
- [4. Perfil](#4-perfil)
- [5. Sessões](#5-sessões)
- [6. Trilha de Auditoria](#6-trilha-de-auditoria)
- [7. Arquivos / Anexos](#7-arquivos--anexos)
- [8. Comentários](#8-comentários)
- [9. Notificações](#9-notificações)
- [10. Aprovações](#10-aprovações)
- [11. Configurações](#11-configurações)

---

## 1. Usuários

| | |
|---|---|
| Status | **IMPLEMENTADO** |
| Objetivo | Administrar a identidade interna de cada pessoa que usa a plataforma, independentemente do mecanismo de autenticação. |
| Entidades principais | `User`, `LocalCredential` (segredo separado — ADR-001), `ExternalIdentity` (presente no schema, sem lógica de autenticação — ver `docs/architecture/security.md`) |
| API | `apps/api/src/core/identity/presentation/admin-users.controller.ts` → `@Controller('admin/users')` (CRUD, status, reset de senha, papéis, revogação de sessão); `apps/api/src/core/identity/presentation/directory-users.controller.ts` → `@Controller('users')`, `GET /users` só-leitura, `@NoPermissionRequired()` — diretório reduzido para "escolher um usuário" (ex. atribuir responsável por um risco), nunca ganha handler de escrita |
| Permissões | `user:administer` (administração completa); diretório não exige permissão adicional além de estar autenticado |
| Telas | `apps/web/src/app/(app)/admin/users/page.tsx` |
| Componentes web | `apps/web/src/features/admin/components/users/{user-admin-view,user-admin-columns,user-roles-dialog,user-password-dialog,user-sessions-dialog,user-status-dialog}.tsx` |
| Eventos de auditoria | `user.created`, `user.updated`, `user.deactivated`, `user.password_reset` |
| Testes | `apps/api/test/contract/admin-users.spec.ts`, `apps/api/test/contract/directory-users.spec.ts` |
| Código | API: `apps/api/src/core/identity/**` · Web: `apps/web/src/features/admin/components/users/**`, `apps/web/src/app/(app)/admin/users/` |

Notas:

- Reset de senha administrativo marca `LocalCredential.mustChangePassword = true`, aplicado no
  próximo login pelo `MandatoryPasswordChangeGuard` global (ver `docs/architecture/security.md`).
- Não existe conceito de "organização" (tenant) separado de usuário — cada `User` pertence
  opcionalmente a um `OrganizationalUnit` primário (`primaryOrgUnitId`).

## 2. Papéis e Permissões

| | |
|---|---|
| Status | **IMPLEMENTADO** — `specs/015-roles-permissions-surface/` fechada em 2026-09-14, regressão final verde |
| Objetivo | RBAC com permissões `resource:action` explícitas — nunca um booleano "é admin" (CLAUDE.md §7). |
| Entidades principais | `Role` (6 campos: `id`, `name`, `description`, `isSystem`, `createdAt`, `updatedAt` — sem coluna de "nível"), `Permission`, `RolePermission`, `UserRole` |
| API | `apps/api/src/core/authorization/presentation/admin-roles.controller.ts` → `@Controller('admin/roles')` (CRUD de papel, conceder/revogar permissão, conceder/revogar atribuição de usuário); `admin-permissions.controller.ts` → `@Controller('admin/permissions')` (lista o catálogo) |
| Permissões | `role:administer`, `user:administer` (atribuir papel a usuário passa por este) |
| Telas | `apps/web/src/app/(app)/admin/roles/page.tsx` |
| Componentes web | `apps/web/src/features/admin/components/roles/{role-card,role-delete-dialog,role-detail-panel,role-filtering,role-users-tab}.tsx`; rótulo de exibição pt-BR de um papel semeado resolvido por `apps/web/src/lib/role-display-name.ts` a partir do catálogo único `common.roleDisplayNames` (o nome no banco nunca é renomeado — só o rótulo de tela, CLAUDE.md §11.1); mesmo helper e mesmo catálogo usados pela tela de Perfil (§4 abaixo) |
| Eventos de auditoria | `role.created`, `role.updated`, `role.deleted`, `user_role.granted`, `user_role.revoked`, `role_permission.granted`, `role_permission.revoked` |
| Testes | Contrato: `apps/api/test/contract/{admin-roles,admin-permissions}.spec.ts` · Unidade: `apps/api/test/unit/{get-roles-summary.usecase,role-privilege-classification-boundary,seeded-role-description-content,admin-roles-route-order}.spec.ts` · Web: `apps/web/src/features/admin/components/roles/role-privilege.boundary.test.ts`, `apps/web/src/lib/role-display-name.single-catalogue.test.ts`, `apps/web/src/components/design-system-register-chrome.test.tsx` · E2E: `apps/web/e2e/{admin-roles,admin-access}.spec.ts` (Chromium; `admin-roles` também roda Firefox+WebKit) |
| Código | API: `apps/api/src/core/authorization/**`, `apps/api/src/permission-catalogue.ts` · Web: `apps/web/src/features/admin/components/roles/**` |

Notas:

- Doze papéis semeados hoje (`apps/api/prisma/seed/platform.seed.ts`): Platform Administrator,
  Risk Manager, Risk Analyst, Risk Approver, Control Owner, Control Approver, Compliance Manager,
  Auditor, Read Only, Audit Lead, Incident Manager, Problem Manager.
- Um papel de sistema (`isSystem = true`) é imutável por inteiro — nem `name`, `description` nem
  `permissionIdentifiers` podem ser alterados, e não pode ser excluído (commit `b1632bd`). Ver
  `docs/architecture/security.md` para o detalhe e para ADR-021 (classificação de privilégio é só
  apresentação, nunca autorização).
- Extensão de permissão por módulo de negócio é compile-time (`declare module` sobre
  `PermissionRegistry`) mais agregação estática em `apps/api/src/permission-catalogue.ts` — ver
  `docs/architecture.md`, seção "1. Permissions", para o mecanismo completo.
- Até 2026-09-14 existiam dois catálogos pt-BR do nome de exibição de papel — `admin.roles.displayNames`
  e um segundo em `profile.identity.roleLabels`, cobrindo só seis dos doze papéis, o que deixava
  Perfil imprimir os outros seis em inglês sem nenhum teste acusar. Unificado em
  `common.roleDisplayNames` (`docs/architecture/frontend.md` §5) — ver §4 abaixo.
- O painel de filtro/coluna do índice de papéis (`FilterBar`/`ColumnVisibilityMenu`, herdados do
  Design System) teve, até a mesma data, um defeito de acessibilidade de hidratação corrigido em
  `docs/architecture/frontend.md` §4.3 (F-71/F-74) — comportamento genérico do Design System, não específico desta
  tela.

## 3. Organizações / Estrutura Organizacional

| | |
|---|---|
| Status | **IMPLEMENTADO** |
| Objetivo | Hierarquia de unidades organizacionais e concessão de escopo — a base de todo o filtro de visibilidade da plataforma (ADR-004). |
| Entidades principais | `OrganizationalUnit` (auto-referenciada: `id`, `code`, `name`, `parentId`, `path` materializado, `depth`, `status`), `OrgScopeGrant` (concessão de escopo `UNIT`/`GLOBAL` a um usuário) |
| Precisão de modelo | **Não existe** um modelo `Organization` (tenant) separado — a plataforma é efetivamente single-tenant; "Organizações" em CLAUDE.md §4 corresponde à árvore de `OrganizationalUnit` mais as concessões de escopo, não a um tenant multi-empresa. |
| API | `apps/api/src/core/organizations/presentation/admin-org-units.controller.ts` → `@Controller('admin/org-units')` (CRUD, reparenting, status); `org-unit.controller.ts` → `@Controller('org-units')` (leitura); `admin-user-scope-grants.controller.ts` → `@Controller('admin/users/:userId/scope-grants')` |
| Permissões | `org_unit:administer` |
| Telas | `apps/web/src/app/(app)/admin/organization/page.tsx` |
| Componentes web | `apps/web/src/features/admin/components/organization/{organization-admin-view,org-unit-tree,org-unit-form-dialog,org-unit-status-dialog,scope-grants-panel}.tsx` |
| Eventos de auditoria | `org_unit.created`, `org_unit.updated`, `org_unit.reparented`, `org_scope_grant.granted`, `org_scope_grant.revoked` |
| Testes | Contrato: `apps/api/test/contract/{admin-org-units,org-units,admin-scope-grants,org-scope-denial-audit}.spec.ts` · Unidade: `apps/api/test/unit/scope-resolver.spec.ts` |
| Código | API: `apps/api/src/core/organizations/**` · Web: `apps/web/src/features/admin/components/organization/**` |

Notas:

- `ScopeResolverService` (`apps/api/src/core/organizations/application/scope-resolver.service.ts`)
  é a única fonte de `ScopeFilter` que todo módulo de negócio consome via `ScopedRepository` — ver
  `docs/architecture/security.md` "Escopo organizacional".
- O mecanismo é reaproveitado por todo módulo de negócio adicionado depois de Risco — nenhum
  módulo reimplementa filtro de escopo próprio (CLAUDE.md §19.2).

## 4. Perfil

| | |
|---|---|
| Status | **IMPLEMENTADO**, deliberadamente mínimo |
| Objetivo | Autoatendimento: ver o próprio perfil, trocar a própria senha. |
| Entidades principais | `User`/`LocalCredential` (mesmas de Usuários — não há entidade própria) |
| API | `apps/api/src/core/identity/presentation/auth.controller.ts` → `@Controller('auth')`: `GET /auth/me` (`@NoPermissionRequired()`), `POST /auth/me/password` |
| Permissões | Nenhuma além de sessão válida — endpoints marcados `@NoPermissionRequired()`, ainda exigem ator resolvido |
| Telas | `apps/web/src/app/(app)/profile/page.tsx` |
| Componentes web | `apps/web/src/app/(app)/profile/profile-view.tsx` (busca `GET /auth/me` deliberadamente, não reusa o snapshot em cache do `AuthContext` — comentário do próprio arquivo), `change-password-form.tsx` |
| Eventos de auditoria | `auth.password_changed` |
| Testes | Contrato: `apps/api/test/contract/{auth-change-password,mandatory-password-change}.spec.ts` · Web: `apps/web/src/app/(app)/profile/profile-view.test.tsx` |
| Código | API: `apps/api/src/core/identity/presentation/auth.controller.ts` · Web: `apps/web/src/app/(app)/profile/**` |

Notas:

- O que a tela mostra: nome, e-mail, cargo, status, unidade organizacional primária, papéis,
  `lastLoginAt` — **somente leitura**. Não há edição de nome/cargo pelo próprio usuário.
- Os papéis exibidos usam o mesmo catálogo único pt-BR de [2. Papéis e Permissões](#2-papéis-e-permissões)
  (`common.roleDisplayNames` via `apps/web/src/lib/role-display-name.ts`) — os doze papéis semeados
  renderizam em português, e um papel customizado imprime exatamente como cadastrado.
- A única escrita de autoatendimento é a troca de senha, que **revoga todas as sessões do
  usuário** (inclusive a que fez a troca) — ver `docs/architecture/security.md` "Revogação".
- Não há aba "Configurações" nesta tela — ver [11. Configurações](#11-configurações).
- **Lacuna conhecida (F-75)**: a linha de papéis desta tela tem prova só em teste de componente
  (`profile-view.test.tsx`) — nenhum spec em `apps/web/e2e/` navega até `/profile` e verifica essa
  linha em navegador real. Ver `docs/STATE.md` §8.

## 5. Sessões

| | |
|---|---|
| Status | **IMPLEMENTADO** no backend (todos os campos de CLAUDE.md §6); autoatendimento de listagem/gestão pelo próprio usuário é **PLANEJADO** |
| Objetivo | Rastrear, expirar e revogar sessões autenticadas de forma explícita (CLAUDE.md §6). |
| Entidades principais | `Session` (`userId`, `authenticationMethod`, `createdAt`, `expiresAt`, `lastActivityAt`, `ipAddress`, `userAgent`, `revokedAt`, `revokedReason`) |
| API | Sem `SessionsController` dedicado — sessão é gerida como efeito colateral de `AuthController` (`GET /auth/session`) e de `admin-users.controller.ts` (`DELETE /admin/users/{userId}/sessions`, via `RevokeUserSessionsUseCase`) |
| Permissões | Autogestão: nenhuma além de sessão válida. Revogação administrativa: `user:administer`. |
| Telas | Nenhuma tela própria de "minhas sessões". Painel administrativo dentro de `apps/web/src/app/(app)/admin/users/`. |
| Componentes web | `apps/web/src/features/admin/components/users/user-sessions-dialog.tsx` — apenas "encerrar todas as sessões" de um usuário alvo, sem lista sessão-a-sessão |
| Eventos de auditoria | `session.created`, `session.expired` (mesmo nome cobre expiração natural e revogação — distinguidas por `revokedReason`: `LOGOUT`, `PASSWORD_CHANGED`, `USER_DEACTIVATED`, `ADMIN_REVOKED`) |
| Testes | Integração: `apps/api/test/integration/{session-lifecycle,session-audit}.spec.ts` |
| Código | API: `apps/api/src/core/sessions/**` · Web: `apps/web/src/features/admin/components/users/user-sessions-dialog.tsx` |

Notas:

- Detalhe completo de armazenamento, cookie, expiração idle/absoluta e revogação está em
  `docs/architecture/security.md` "Sessões" — não repetido aqui.
- CLAUDE.md §6 já descreve o autoatendimento de sessão como trabalho **futuro**; o código confirma
  essa leitura — não há regressão, é lacuna conhecida e documentada desde a especificação
  original.

## 6. Trilha de Auditoria

| | |
|---|---|
| Status | Escrita: **IMPLEMENTADO** (capacidade transversal única, usada por todo módulo). Leitura/UI: **PARCIAL** — sem navegador de auditoria em nível de plataforma. |
| Objetivo | Registrar quem fez o quê, quando, com que valores antes/depois — capacidade transversal (CLAUDE.md §8). |
| Entidades principais | `AuditEvent` (`occurredAt`, `actorUserId`, `actorLabel`, `action` livre, `entityType` — enum fechado `AuditEntityType`, `entityId`, `previousValues`/`newValues` JSON filtrados por allow-list, `organizationalUnitId`, `ipAddress`, `userAgent`, `sessionId`, `correlationId`, `outcome`) |
| API | **Sem controller central** em `core/audit/presentation` (esse diretório não existe). Leitura exposta por módulo de negócio: `GET /risks/{riskId}/audit-events` (`apps/api/src/modules/risk/presentation/audit.controller.ts`), `GET /actions/{actionId}/audit-events` (`apps/api/src/grc/action/presentation/action-audit.controller.ts`) |
| Permissões | `audit:view`, sempre **em conjunto com** a permissão de visualização do domínio (ex. `risk:view` + `audit:view` para ver a auditoria de um risco) |
| Telas | Sem tela própria de "trilha de auditoria da plataforma". Seções embutidas nos detalhes de domínio. |
| Componentes web | `apps/web/src/features/risks/components/risk-audit-section.tsx`, `apps/web/src/features/actions/components/action-audit-section.tsx` |
| Eventos de auditoria (amostra) | `role.created/updated/deleted`, `user_role.granted/revoked`, `comment.created/withdrawn`, `attachment.uploaded/withdrawn`, `session.created/expired`, `org_unit.created/updated/reparented`, `org_scope_grant.granted/revoked`, `user.created/updated/deactivated/password_reset`, `auth.login_failed[/_inactive]`, `auth.account_locked`, `auth.password_changed`, `risk.created/assessed/transitioned` |
| Testes | Unidade: `apps/api/test/unit/{audit-recorder,audit-field-allowlist,audit-contract-no-deletion}.spec.ts` · Contrato: `apps/api/test/contract/{risk-audit,action-audit}.spec.ts` |
| Código | API: `apps/api/src/core/audit/**` (escrita), `apps/api/src/modules/risk/presentation/audit.controller.ts` + `apps/api/src/grc/action/presentation/action-audit.controller.ts` (leitura por domínio) · Web: seções por módulo, nenhum ponto central |

Notas:

- Mecanismo completo (transação, allow-list, imutabilidade por trigger + revoke) está em
  `docs/architecture/security.md` "Auditoria de ações" — não repetido aqui.
- A ausência de uma tela/endpoint central de auditoria é uma lacuna real, não um defeito de
  implementação: cada módulo expõe sua própria auditoria porque a permissão de ver auditoria de
  um risco é distinta da de ver auditoria de uma ação — mas isso significa que hoje **não existe
  forma de um administrador ver a trilha de auditoria da plataforma inteira em uma tela só**.

## 7. Arquivos / Anexos

| | |
|---|---|
| Status | **IMPLEMENTADO** |
| Objetivo | Evidência anexada a um registro GRC, nunca soldada a um único tipo de entidade (CLAUDE.md §19.6). |
| Entidades principais | `Attachment` (`entityType` — enum fechado `AttachableEntityType`: `RISK`, `EVIDENCE`, `INCIDENT`, `PROBLEM`; `entityId`, `fileName`, `contentType`, `sizeBytes`, `checksumSha256`, `storageKey` derivado por conteúdo, `uploadedByUserId`, `deletedAt`/`deletedByUserId` — retirada é sempre lógica) |
| API | `apps/api/src/core/files/presentation/attachment.controller.ts` → `@Controller('attachments')` |
| Permissões | `attachment:create`, `attachment:delete` |
| Telas | Sem tela própria — seção embutida em cada tela de detalhe de domínio |
| Componentes web | Um componente **por módulo**, não um componente único compartilhado: `apps/web/src/features/{risks,incidents,problems,evidence}/components/*-attachments-section.tsx` — todos consomem a mesma API `/attachments`; reúso é da **capacidade** (API, permissão, auditoria), não de um componente React compartilhado em `packages/design-system` |
| Eventos de auditoria | `attachment.uploaded`, `attachment.withdrawn` |
| Testes | Contrato: `apps/api/test/contract/{attachments,attachment-access,attachment-storage-partition}.spec.ts` · E2E: `apps/web/e2e/attachment-upload-size.spec.ts` |
| Código | API: `apps/api/src/core/files/**` · Web: `apps/web/src/features/*/components/*-attachments-section.tsx` (por módulo) |

Notas:

- Limite de tamanho, armazenamento, validação de content-type (assinatura de bytes) e controle de
  acesso ao download estão detalhados em `docs/architecture/security.md` "Arquivos e anexos".
- `AttachableEntityType` cresce só por migração aditiva revisada — nunca uma tabela genérica
  `related_entity(type, id)` (CLAUDE.md §19.3).

## 8. Comentários

| | |
|---|---|
| Status | **IMPLEMENTADO** |
| Objetivo | Nota atribuída sobre um registro GRC, texto puro nunca interpretado como marcação. |
| Entidades principais | `Comment` (`entityType` — enum fechado `CommentableEntityType`: `RISK`, `INCIDENT`, `PROBLEM`, `INDICATOR`; `entityId`, `body`, `authorUserId`, `deletedAt`/`deletedByUserId`) |
| API | `apps/api/src/core/comments/presentation/comment.controller.ts` → `@Controller('comments')` |
| Permissões | `comment:create`, `comment:delete` |
| Telas | Sem tela própria — seção embutida em cada tela de detalhe de domínio |
| Componentes web | Um componente por módulo, mesmo padrão de Anexos: `apps/web/src/features/{risks,incidents,problems}/components/*-comments-section.tsx` |
| Eventos de auditoria | `comment.created`, `comment.withdrawn` |
| Testes | Contrato: `apps/api/test/contract/comments.spec.ts` |
| Código | API: `apps/api/src/core/comments/**` · Web: `apps/web/src/features/*/components/*-comments-section.tsx` (por módulo) |

Notas:

- `apps/api/src/core/comments/domain/entity-registry.ts` é o registro de *accessors* por tipo de
  entidade que também Anexos e Notificações reutilizam — a peça central do "registro de tipo
  fechado" do §19.3.
- `Notification.entityType` reutiliza deliberadamente este mesmo enum (`CommentableEntityType`)
  em vez de criar um terceiro quase idêntico (`schema.prisma`, comentário do modelo).

## 9. Notificações

| | |
|---|---|
| Status | **IMPLEMENTADO** — backend, UI e ao menos um produtor real de notificação em produção |
| Objetivo | Mensagem in-app direcionada a um usuário, com deep-link opcional para o registro relacionado. |
| Entidades principais | `Notification` (`recipientUserId`, `type` string livre com namespace por ponto, ex. `risk.approval.requested`, `title`, `body`, `entityType`/`entityId` reusando `CommentableEntityType`, `readAt`) |
| API | `apps/api/src/core/notifications/presentation/notification.controller.ts` → `@Controller('notifications')`: `GET /notifications`, `POST /notifications` (`{action: 'MARK_ALL_READ'}`), `POST /notifications/{id}/read` |
| Permissões | Nenhuma além de sessão válida — notificações são sempre do próprio usuário autenticado |
| Telas | Sino no cabeçalho, montado uma vez no shell autenticado — não é uma rota própria |
| Componentes web | `apps/web/src/components/shell/notifications.tsx` (sino + painel), `notifications-api.ts` |
| Eventos de auditoria | Não aplicável — notificação não é, ela própria, um evento auditado; é produzida por um evento de outro domínio |
| Produtor real | `apps/api/src/modules/indicators/application/create-indicator-measurement.usecase.ts` — dispara notificação quando uma medição de indicador rompe o limiar configurado. Documentado no próprio cabeçalho do arquivo como o primeiro produtor real de `NotificationService`, satisfazendo CLAUDE.md §19.10 (ponto de extensão só conta depois de exercitado por código de produção real) |
| Testes | Contrato: `apps/api/test/contract/notifications.spec.ts` · Unidade: `apps/api/test/unit/create-indicator-measurement-notification.spec.ts` |
| Código | API: `apps/api/src/core/notifications/**` · Web: `apps/web/src/components/shell/notifications*.tsx` |

## 10. Aprovações

| | |
|---|---|
| Status | **IMPLEMENTADO** como capacidade compartilhada — mas **não** organizado como diretório `core/**` próprio |
| Objetivo | Sign-off genérico (segregação entre solicitante e aprovador) reutilizável por qualquer domínio que precise de aprovação, sem motor de workflow (CLAUDE.md §19.4). |
| Entidades principais | `Approval` (`entityType` — enum fechado `ApprovableEntityType`: hoje `RISK`, `CONTROL_ASSESSMENT`; `entityId`, `requestedTransition` texto livre, `requestedByUserId`, `status`, `decidedByUserId`, `decidedAt`, `justification`) |
| Localização | **Não existe** `apps/api/src/core/approvals/**`. É um modelo/enum Prisma compartilhado, consumido diretamente pelos módulos de negócio que o usam — cada um com seus próprios casos de uso e repositório: `apps/api/src/modules/risk/application/approvals/{request-approval,decide-approval}.usecase.ts` + `apps/api/src/modules/risk/infrastructure/approval.repository.ts`; `apps/api/src/modules/controls/application/assessments/{request-control-assessment-attestation,decide-control-assessment-attestation}.usecase.ts` + `apps/api/src/modules/controls/infrastructure/control-assessment-approval.repository.ts` |
| API | Sem controller central — exposto pela rota do próprio domínio, ex. `apps/api/src/modules/risk/presentation/lifecycle.controller.ts` (`@Controller('risks/:riskId')`, `GET/POST /approvals`, `POST /approvals/:approvalId/decision`) |
| Permissões | Por domínio — ex. `risk:transition` (solicitar) vs `risk:approve` (decidir), deliberadamente distintas para viabilizar segregação de funções |
| Telas | Embutidas no fluxo do próprio domínio — não há tela "Aprovações" central |
| Componentes web | `apps/web/src/features/risks/components/approval-dialogs.tsx`, `apps/web/src/features/controls/components/control-assessment-form.tsx` |
| Eventos de auditoria | Por domínio (ex. `risk.approval_approved`, presente na trilha de auditoria do risco) |
| Testes | E2E: `apps/web/e2e/risk-approval.spec.ts` · Contrato: `apps/api/test/contract/risk-lifecycle.spec.ts` |
| Código | API: modelo/enum em `apps/api/prisma/schema.prisma`, consumo em `apps/api/src/modules/risk/**` e `apps/api/src/modules/controls/**` · Web: componentes por módulo |

Notas:

- Extensão para um domínio novo é **acrescentar um valor de enum e um caso de uso**, nunca
  construir um motor de aprovação — exatamente o critério de CLAUDE.md §19.4.
- Segregação de funções tem reforço em duas camadas (aplicação + `CHECK` de banco) — ver
  `docs/architecture/security.md` "Segregação de funções (SoD)".

## 11. Configurações

| | |
|---|---|
| Status | **PLANEJADO** — não existe como capacidade transversal |
| Objetivo (declarado em CLAUDE.md §4) | Configuração da plataforma como responsabilidade central, análoga a Authentication/Authorization/Users/etc. |
| O que existe hoje | Apenas objetos de configuração **por módulo, definidos em tempo de compilação**, injetados via variável de ambiente — não uma capacidade runtime, admin-editável: `apps/api/src/core/identity/domain/identity-settings.ts`, `apps/api/src/core/sessions/domain/session-settings.ts`, `apps/api/src/core/files/domain/attachment-settings.ts` |
| O que não existe | `apps/api/src/core/configuration/**` (não existe o diretório); nenhum mecanismo de *feature flag*; nenhuma tela administrativa de configurações do sistema; a tela de Perfil não tem aba "Configurações" |
| Código | Não aplicável — capacidade não implementada |

Nota: `docs/architecture.md` ("Known gaps and honest limits") já registra este mesmo estado —
`core/configuration` e `core/users` (usuários hoje vivem dentro de `core/identity`, não em um
diretório próprio) seguem "genuinamente ausentes". Este documento confirma a mesma leitura de
forma independente, a partir do código, não copiando aquele documento.
