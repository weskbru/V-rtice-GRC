# Plano de Implementação — Superfície de Papéis e Permissões

**Feature**: `015-roles-permissions-surface`
**Criado**: 2026-09-13
**Fonte de verdade**: `spec.md` neste diretório. Decisões de pesquisa em `research.md`. Fronteira da
classificação de privilégio no ADR registrado por `research.md` R-001.

---

## 1. Regra de coordenação

O agente principal (Opus) **não escreve código**. Ele decide, escreve e revisa documentos, atribui
ownership, revisa diffs, coordena validação e devolve correções. Toda implementação é executada por
subagentes Sonnet.

**Ownership é disjunto por arquivo, não por assunto.** Dois agentes nunca editam o mesmo arquivo.
Quando um trabalho é pré-requisito de outro, ele roda **antes**, não em paralelo.

Cada agente recebe, no contexto da delegação: CLAUDE.md §11.1 (pt-BR nos catálogos), §18 inteira
(política de UI/UX, incluindo o portão de aceitação visual §18.11), §19 (arquitetura de domínio
GRC), este plano, `spec.md` e `research.md`.

---

## 2. Ondas e ownership

```
Onda 0 (Sonnet-A)  ─┐
                    ├─ paralelas: zero sobreposição de arquivo
Onda 1 (Sonnet-B)  ─┘
        │
        ├─ Onda 2 (Sonnet-C)    depende do formato do DTO da Onda 1 (fixado neste plano, §4)
        │
        └─ Onda 3 (Sonnet-D)    depende de 0, 1 e 2 — SEQUENCIAL
                  │
                  └─ Onda 4 (Sonnet-E)  depende de 3 — SEQUENCIAL
```

### Onda 0 — Pré-requisitos compartilhados · **Sonnet-A**

Roda **antes** de qualquer consumidor. É a onda mais perigosa do plano: toca primitivos usados por
dezenas de telas.

**Arquivos que este agente possui, e ninguém mais toca:**

- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/components/ui/checkbox.tsx`
- `packages/design-system/src/components/detail-panel.tsx` *(novo)*
- `packages/design-system/src/components/disclosure-group.tsx` *(novo)*
- `packages/design-system/src/components/index.ts` *(apenas as linhas de export novas)*
- `apps/web/src/components/design-system.test.tsx` *(apenas blocos novos)*
- `docs/local-environment.md` *(apenas a entrada D-15)*

**Entregas:**

1. **`sheet.tsx` recebe `useDialogFocusRestore`.** Importar o hook de
   `packages/design-system/src/lib/use-restore-focus.ts`, montar `FocusRestoreAnchor` como primeiro
   filho de `SheetContent`, compor `onCloseAutoFocus` na mesma ordem de `dialog.tsx:105-108`.
   **Preservar** a modificação D-15 já existente no arquivo (label de fechar vindo de
   `common.dialog.closeLabel`). Teste de não-vacuidade: removendo a âncora, o teste falha.
2. **`checkbox.tsx` passa a suportar estado indeterminado.** Ramo para
   `checked === 'indeterminate'` no `Indicator`, com glifo próprio — não o mesmo `CheckIcon`, porque
   cor e forma não podem ser o único sinal (NFR-004). `aria-checked="mixed"` corretamente
   propagado pelo Radix. **Regressão obrigatória dos consumidores existentes**: localizar todos os
   chamadores de `Checkbox` e provar por teste que nenhum mudou de comportamento.
3. **`DetailPanel`** no design system: casca estrutural do painel, **sem nenhuma string própria**
   (D-10 — todo texto por prop obrigatória). Responsabilidade: cabeçalho fixo, corpo rolável,
   rodapé fixo, e os dois modos de apresentação (não-modal em `xl`+, overlay via `Sheet` abaixo).
   **Não** importa nada de domínio; **não** conhece papéis.
4. **`DisclosureGroup`** no design system: grupo expansível com `aria-expanded`/`aria-controls`
   manuais, no idioma de `filter-bar.tsx:196-219`. Sem string própria. Sem dependência nova.
5. **D-15 atualizado**: `checkbox.tsx` passa a ser o **sexto** primitivo deliberadamente
   modificado; a entrada de `sheet.tsx` ganha a modificação de foco.

**Restrições:** nenhuma dependência nova em `package.json`. Não criar test runner no design system
(D-9) — os testes vivem em `apps/web/src/components/design-system.test.tsx`. Ao terminar,
re-executar `e2e/accessibility.spec.ts` (NFR-009).

### Onda 1 — Backend · **Sonnet-B**

Paralela à Onda 0: **zero** sobreposição de arquivo (`apps/api` contra `apps/web`/`packages`).

**Arquivos que este agente possui:**

- `apps/api/src/core/authorization/**` (caso de uso, controller, DTO, mapper, repositório)
- `apps/api/openapi.json` *(regenerado, nunca editado à mão)*
- `specs/001-grc-platform-foundation/contracts/admin.openapi.yaml` *(emenda datada)*
- `apps/api/test/contract/contract-coverage.spec.ts` *(apenas a contagem fixa)*
- `apps/api/test/**` para os testes desta onda

**Entregas:**

1. `GET /admin/roles/summary`, somente leitura, `@RequirePermission('role:administer')`,
   atravessando o `PermissionGuard` e o caminho normal de aplicação.
2. Repositório: `totalRoles`, `systemRoles`, `customRoles` por agregação sobre `roles`;
   `usersWithRoles` por **`COUNT(DISTINCT user_id)`** sobre `user_roles`. Nenhuma consulta por
   linha.
3. Emenda datada em `admin.openapi.yaml`, junto das demais operações de papéis, apontando para
   `specs/015-roles-permissions-surface/` (R-008).
4. Regenerar `openapi.json` pelo comando do projeto; `openapi:check` limpo.
5. **A contagem fixa de `contract-coverage.spec.ts:384` sobe.** O número novo DEVE ser **lido da
   execução que falha**, nunca somado de cabeça — a disciplina está escrita no próprio arquivo.
6. Testes: autorização (com e sem `role:administer`), cálculo dos quatro campos, e o caso que prova
   SC-004 — **uma pessoa com dois papéis conta uma vez** em `usersWithRoles`.

**Proibido:** alterar `Role`, criar tabela, criar migration, tocar escopo, auditoria ou resolução de
permissões. Nenhuma rota alternativa de usuários protegida só por `role:administer` (FR-019).

### Onda 2 — Contrato de cliente e catálogo pt-BR · **Sonnet-C**

Começa assim que a Onda 1 fixar o DTO — cujo formato já está congelado em §4 deste plano, então o
agente não espera o código, só o formato.

**Arquivos que este agente possui:**

- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/api.ts`
- `apps/web/src/features/admin/components/roles/role-privilege.ts` *(novo)* + seu teste
- `apps/web/src/lib/messages/admin.ts`

**Entregas:**

1. Tipo `RolesSummary` e `adminApi.getRolesSummary()`.
2. `isPrivilegedRole(role)` — função pura, sem I/O, com teste próprio cobrindo: papel com
   `role:administer` ⇒ verdadeiro; com `user:administer` ⇒ verdadeiro; com `org_unit:administer` ⇒
   verdadeiro; com `risk:administer` mas nenhuma das três ⇒ **falso**; papel sem permissões ⇒ falso.
3. **Todas** as strings pt-BR desta fase, de uma vez, em `admin.roles.*`, derivadas de `spec.md`.
   As ondas seguintes apenas consomem — ninguém mais edita este arquivo. Inclui rótulos dos quatro
   indicadores, dos filtros, do cartão, do painel, das abas, do bloco que explica o modelo de
   autorização (FR-015), do estado degradado da aba Usuários (FR-020), do resumo de alterações
   pendentes e das razões de campo travado.
4. Reusar `permissionCatalog.{areas,resources,verbs}` como está. **Proibido** criar segunda
   taxonomia (FR-013).

### Onda 3 — A tela · **Sonnet-D** · SEQUENCIAL

Só começa com 0, 1 e 2 mescladas e verdes.

**Arquivos que este agente possui:** `apps/web/src/features/admin/components/roles/**` (exceto
`role-privilege.ts`, da Onda 2) e `apps/web/src/app/(app)/admin/roles/page.tsx`.

**Entregas, nesta ordem:** indicadores → filtros → lista em cartões → painel (aba Permissões) → aba
Usuários → modo de edição. Detalhamento por tarefa em `tasks.md`.

**Restrições duras:**

- Navegação por `@/components/navigation/link` e `useNavigate`. `next/link` e `useRouter` são
  proibidos por lint (NFR-007). Escrita de query string de filtro **não** é navegação: segue o
  padrão dos hooks de catálogo, com `eslint-disable` explicando.
- Nenhuma requisição por linha, por usuário ou por permissão (NFR-006).
- A aba Usuários só consome `GET /admin/users?roleId=` com `user:administer` (FR-018); sem ela,
  nenhum dado pessoal chega ao DOM (FR-020) — não basta ocultar com CSS.
- Papel do sistema: `PATCH` envia **somente** `description` (FR-031).
- Não reusar o agrupamento `flex items-center gap-3` da barra de resultados: é a causa 1 de F-66
  (NFR-005).
- Não tocar `role-create-dialog.tsx` (FR-034) nem `role-permissions-summary.tsx`, consumido pela
  tela de Usuários.

### Onda 4 — Prova · **Sonnet-E** · SEQUENCIAL

**Arquivos que este agente possui:** `apps/web/e2e/admin-roles.spec.ts`, o bloco de
`apps/web/e2e/accessibility.spec.ts` referente a papéis, os testes de unidade dos componentes da
Onda 3, e a remoção verificada dos arquivos antigos.

**Entregas:**

1. **Remoção comprovada (D-07/FR — item 9 do usuário).** Para cada um de
   `role-admin-columns.tsx`, `role-details-dialog.tsx`, `role-edit-dialog.tsx`: listar consumidores
   por `grep`, confirmar ausência de dependência externa, provar que cada comportamento que ele
   guardava tem teste equivalente na implementação nova, migrar a cobertura e **só então** remover.
   Um arquivo sem substituto provado **não é removido**.
2. E2E reescrito e ampliado, com os treze cenários de regressão de segurança de §3.
3. Varredura axe nos dois temas, esperando o elemento **efetivamente renderizado** (lição de F-28).
4. Captura renderizada por `apps/web/scripts/ui-capture.mjs` em `docs/reviews/ui/`, claro e escuro,
   nas larguras 1920/1440/1280/1024/768/390.

---

## 3. Cobertura de regressão de segurança obrigatória

Treze cenários, pedidos explicitamente. Cada um precisa de um teste que **falhe** se a proteção for
removida.

| # | Cenário | Camada |
|---|---|---|
| 1 | `role:administer` sem `user:administer` — nenhum dado pessoal na tela | web unit + E2E |
| 2 | `user:administer` presente — aba Usuários funciona | web unit + E2E |
| 3 | Papel do sistema — nome e permissões travados, razão visível | web unit + E2E |
| 4 | Papel personalizado — edição completa funciona | web unit + E2E |
| 5 | Alterar **nome** de papel do sistema é recusado | API integration |
| 6 | Alterar **permissionIdentifiers** de papel do sistema é recusado | API integration |
| 7 | `usersWithRoles` com pessoa de múltiplos papéis conta uma vez | API unit + integration |
| 8 | Classificação Privilegiado **sem efeito** sobre autorização | API + web unit |
| 9 | Ausência de herança entre papéis — permissão efetiva é união plana | API unit |
| 10 | Acesso por teclado ao painel e ao overlay | E2E |
| 11 | Restauração de foco ao fechar painel, overlay e edição | web unit + E2E |
| 12 | `Esc` fecha o overlay | E2E |
| 13 | Estados desktop e responsivo sem rolagem horizontal | E2E + captura |

O cenário 8 merece nota: prova-se que a classificação é inerte mostrando que um papel classificado
como privilegiado e um não classificado produzem **a mesma** decisão do `PermissionGuard` para a
mesma permissão — a classificação não existe no servidor, e o teste registra isso.

---

## 4. Formato congelado do DTO

Fixado aqui para que a Onda 2 não espere a Onda 1.

```
GET /api/v1/admin/roles/summary        →  200
Requer: role:administer

{
  "totalRoles":     number,   // COUNT(*) em roles
  "systemRoles":    number,   // COUNT(*) em roles WHERE is_system = true
  "customRoles":    number,   // COUNT(*) em roles WHERE is_system = false
  "usersWithRoles": number    // COUNT(DISTINCT user_id) em user_roles
}
```

`totalRoles = systemRoles + customRoles` é invariante e deve ter teste.
`usersWithRoles` **não** é a soma de `assignedUserCount`.

---

## 5. Portões de validação

Executados em série ao fim, e reportados com o número real — nunca "passou".

`lint` · `typecheck` (web, API e design system) · `format:check` · `openapi:check` · unidade da web
· unidade da API · integração · contrato · E2E Chromium · varredura axe nos dois temas · captura
renderizada.

**Condições operacionais conhecidas** (D-22/D-23, F-59): exportar `SEED_ADMIN_EMAIL` e
`SEED_ADMIN_PASSWORD` — sem eles a suíte reporta saída 0 com quase tudo `skipped` — e rodar
Playwright com **1 worker**. **Nunca** alterar `THROTTLE_LIMIT` para fazer teste ou tela passar.

Nenhum teste pode ser removido, nenhum `skip` acrescentado, nenhuma asserção enfraquecida. A
medição de fechamento registra o número de arquivos e de testes antes e depois, como fizeram as
fases anteriores.

---

## 6. Armadilhas já pagas por este repositório, aplicáveis aqui

- **F-28** — varredura de acessibilidade que mede um substituto renderizado antes do elemento real
  e reporta zero violações honestamente sobre algo que não viu.
- **`accessibility.spec.ts` roda em `mode: 'serial'`**: uma falha aborta os testes seguintes do
  arquivo e mascara o resultado.
- **F-45/F-54** — marcador de teste com prefixo de **exatamente dois caracteres** gera 43 caracteres
  e colide com o padrão de token de sessão de `information-disclosure.spec.ts`. Usar prefixo de
  outro comprimento.
- **F-29** — localizar usuário por `getByText(email)` numa lista paginada falha conforme o
  diretório cresce; casar pelo padrão que 013 §6 adotou.
- **013 §4.3** — `DataTable` passou a chamar `cell`/`header` diretamente; os `useMemo` de
  `role-admin-view.tsx` ficaram redundantes. Não são mais o mecanismo de identidade de célula.
- **F-30** — `text-primary` sobre `--card` falha AA no tema escuro. Usar `--primary-on-surface`.
- **D-16** — nunca rodar o build da web com o dev server de pé.
- **ui-capture** — `waitUntil: 'networkidle'` antes de preencher formulário; rótulos exatos, nunca
  expressão regular ampla; `--height` maior que a página em telas altas.
