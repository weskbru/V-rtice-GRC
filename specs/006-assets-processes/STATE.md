# Estado do trabalho — retomada a partir do repositório

> **Documento histórico — registro de fechamento da fase 006 (Ativos e Processos).** Não descreve
> necessariamente o estado atual do produto. Fonte vigente: [`docs/STATE.md`](../../docs/STATE.md)
> e [`docs/modules/assets-processes.md`](../../docs/modules/assets-processes.md).

Este arquivo existe para que outro contexto possa continuar **sem depender de nenhuma conversa
anterior**. Registra o que está feito, o que falta, as decisões que não podem ser reabertas e o
próximo passo exato.

**Última atualização**: 2026-09-10.

---

## 1. Onde a fase está

| Fase | Estado | Commit |
|---|---|---|
| Design completo (Spec Kit) | entregue | `2854642` |
| 1–2 — migração, permissões, portes, dois módulos | entregue, verde | `3252776` |
| 3 — as 12 operações (US1) | entregue, verde | `50f30f6` |
| 4–5 — cutover de propriedade e os dois vazamentos (US2, US3) | entregue, verde | `ee64cfb` |
| 6 — telas, verificadas no navegador | entregue, verde | `9c1b048` |
| 7 — validação | T053, T058–T061 | `e5cc72f` |
| 7 — validação | T054–T057 (E2E, escopo E2E, axe, ausência de exclusão) — **concluída** | esta sessão |

Contagens verificadas por execução em 2026-09-10, com a fase fechada:
`API unit 490 · contrato 648 · integração 168 · web unit 532`, mais os E2E do Chromium
(`assets-processes` 2/2, `assets-processes-scope` 1/1, `accessibility` 56/56, nenhum pulado).
`audit`, `typecheck`, `lint`, `openapi:check`, `format:check` e `build` limpos.

**61 de 61 tarefas concluídas.**

---

## 2. O que esta fase corrigiu além do que foi pedido

Cinco defeitos reais, nenhum previsto por requisito, todos encontrados durante a implementação ou a
validação, e todos com guarda de regressão **reprovada contra o código defeituoso antes de ser
aceita**. Os três primeiros vieram da implementação; os dois últimos, da Fase 7.

### 2.1 `?flag=false` era lido como `true` em toda a plataforma

O `ValidationPipe` global roda com `enableImplicitConversion: true`, que converte um campo
refletido como `boolean` via `Boolean(rawString)` **antes** de qualquer `@Transform`. `'false'` é
string não vazia, logo `true`.

**Sete DTOs** compartilhavam a forma vulnerável — notificações, ações, vínculos de evidência,
achados, riscos, ações de tratamento e o registro de referência — copiados uns dos outros, cada um
com um comentário dizendo que "espelha" um irmão. `GET /findings?withoutRemediation=false`
filtrava como `true`; `?includeInactive=false` incluía inativos. Sempre errando na direção de
mostrar **mais** do que o usuário pediu.

Guarda: `apps/api/test/unit/query-boolean-coercion.spec.ts`, percorrendo **todos** os DTOs com
campo booleano de query. A checagem de não-vacuidade fez trabalho real — pegou cinco nomes de campo
errados na própria tabela do teste.

### 2.2 Identificador interno vazando para a tela

O catálogo de Ativos exibia `Situação inativa — sem novos vínculos (FR-012)`. A varredura achou
**cinco** ocorrências, uma delas **já em produção** em `risks.ts`
(`...risco residual (FR-078)`), visível na tela de detalhe de risco.

Passou porque toda string estava corretamente nos catálogos centralizados em pt-BR (§11.1) — a
regra de idioma estava satisfeita, e nada verificava o **conteúdo** da string.

Guarda: `apps/web/src/lib/messages/no-internal-identifiers.test.ts`, varrendo todos os catálogos e
distinguindo literal de comentário (citar requisito em JSDoc continua certo).

### 2.3 A parte 5 do ADR-020 quase repetiu o F-46 dentro desta fase

Os pares `Controle→Ativo`/`Controle→Processo` tinham sido deixados de fora da parte 5 com a
justificativa de que "já tinham a parte 4". É **literalmente** a justificativa que fez o F-46
fechar `Risco→Controle` e deixar `Risco→Ativo` e `Risco→Processo` abertos — mesmo diretório, mesmo
dia. Deixá-los teria fechado dois irmãos e deixado dois, pela segunda vez, dentro da feature
escrita para corrigir a primeira. Também contradizia o próprio `data-model.md` §10, que lista
`control:edit` + `asset:view` e marca a segunda como faltando.

Guarda: `link-usecase-target-scope-guard.spec.ts` ganhou uma segunda asserção cobrindo a **parte
5** em todo `Link*UseCase` dos dois módulos. A guarda só da parte 4 ficou verde durante todo o
adiamento.

### 2.4 A própria guarda do T057 era vácua no ponto que mais importava

A asserção de nível Prisma do `assets-processes-contract-no-deletion.spec.ts` nasceu com o padrão
`prisma.<model>.delete`, copiado literalmente do grep manual que o `quickstart.md` §6 recomenda
rodar à mão. **Esse padrão nunca reprovaria contra código real deste repositório**: os repositórios
seguram `PrismaService` e chamam `this.prisma.client.<model>.<op>`, de modo que a substring
`prisma.asset.delete` simplesmente não ocorre em `this.prisma.client.asset.delete(...)`. Provado
plantando exatamente essa chamada e vendo os 12 testes passarem incólumes.

Corrigido para `\b<model>\.delete(?:Many)?\b`. O `deleteMany` entrou numa segunda rodada de
revisão: a primeira correção o excluía deliberadamente, como "operação distinta e hoje legítima" —
mas `asset.deleteMany(...)` apaga ativos exatamente como `asset.delete(...)`, FR-012 não isenta a
forma, e **nenhum dos dois módulos usa `deleteMany` em lugar nenhum**. A exclusão não protegia uso
real e deixava o buraco aberto para amanhã: a mesma forma do erro registrado em §2.3.

Falsos positivos verificados por execução, não por leitura: `riskAssetLink.delete`,
`controlAssetLink.deleteMany`, `riskProcessLink.delete` e `controlProcessLink.deleteMany` não casam,
porque o padrão é sensível a maiúsculas e o camelCase dos vínculos carrega `Asset`/`Process`.

### 2.5 O `quickstart.md` desta fase mandava rodar um script que não existe

§0, primeira linha: `pnpm --filter @vertice/api run db:migrate:dev`. Esse script **não existe** —
`apps/api/package.json` tem `db:generate`, `db:migrate` (que é `prisma migrate dev`), `db:seed` e
`db:seed:performance`. O comando falha com `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.

Isto **contradiz a afirmação do T053**, registrada no commit `e5cc72f`, de que "o `quickstart.md`
está correto". Passou porque a execução manual partiu de um banco já migrado e, na prática, pulou o
§0. É a lição do §18.1 aparecendo de novo, agora na documentação: um roteiro só está verificado nas
linhas que alguém realmente executou.

Corrigido nesta fase. Os quickstarts de 002, 003 e 005 herdaram a mesma linha errada e ficaram
**deliberadamente fora de escopo** — registrados em `docs/deferred-findings.md` F-51.

---

## 3. Os dois vazamentos que a fase existia para fechar

Ambos medidos antes de escrever a especificação, ambos fechados.

| Vazamento | Antes | Depois |
|---|---|---|
| **Leitura** | `GET /assets`/`GET /processes` em `RegistryController`, exigindo `risk:view`, **sem escopo organizacional nenhum** — qualquer ator recebia o inventário inteiro da organização | Servidos pelos módulos donos, exigindo `asset:view`/`process:view`, com `ScopeFilter` aplicado |
| **Escrita** | `isOrgUnitWithinScope`: 5 em `control-link.usecase.ts`, **0** em `asset-link` e `process-link` | 3 e 2 respectivamente; alvo resolvido pelos portes de diretório, com `asset:view`/`process:view` do lado referenciado |

---

## 4. Decisões que **não** devem ser reabertas

- **`orgUnitId` continua anulável na coluna, obrigatório no DTO** (research.md D-2). Segue o único
  precedente do projeto (`Control`). O backfill para a raiz foi **rejeitado por ser menos seguro**:
  `NULL IN (...)` já torna a linha invisível a escopo por unidade; atribuí-la à raiz a tornaria
  visível. O texto rejeitado está preservado em D-2.
- **Dois estados, não um ciclo de quatro** (D-3). `isActive` já tem consequência verificada em dois
  call sites. Um terceiro estado sem consequência é o defeito que este projeto quase enviou três
  vezes.
- **Sem `If-Match`, sem `ETag`, sem `409`** nestes recursos. As tabelas não têm coluna `version` e
  a fase não as migra. Os contratos dizem isso explicitamente, em vez de omitir — a lição do §0.1
  do quickstart da fase anterior, aplicada na direção inversa.
- **Os quatro vínculos existentes são reusados, nunca recriados** (FR-013).
- **Nenhuma exclusão** (FR-012). Saída de operação é desativação.
- **Simetria entre Ativo e Processo é requisito** (FR-020), verificada arquivo a arquivo em T060 —
  API e web, ambas simétricas.

---

## 5. Confirmações registradas, não presumidas

- **T059 — `Cache-Control`**: nenhuma resposta desta fase carrega valor derivado de estado mutável
  de outro módulo. Toda propriedade é coluna gravada, rótulo de referência, ou leitura filtrada de
  tabela de vínculo. `descriptionExcerpt` é derivado da **própria** coluna do registro, não da
  classe D-14. **Nenhum endpoint declara `no-store`.**
- **T058 — regressão**: três arquivos de teste de módulos irmãos mudaram
  (`risk-detail.spec.ts`, `risk-relationships.spec.ts`, `control-relationship-links.spec.ts`), e os
  três citam **FR-011** no próprio teste — a única exceção que a SC-006 permite.
- **T061 — ADR-020**: as cinco partes conferidas **no código**, não relendo a tabela. Quatro pares,
  FK `Restrict` em todos, os dois portes em `shared/`, verificação de escopo do alvo em todos, e
  permissão do lado referenciado em todos.
- **T053 — roteiro manual**: executado contra a aplicação em execução. Código gerado
  (`AST-2026-0006`), nome não é identidade, `code` do cliente recusado, unidade obrigatória,
  desativar → vínculo recusado `422` → continua legível → reativar, e nenhuma rota `DELETE`.
  O erro de execução foi de um script ad-hoc que usou `assetId` em vez de `id`; seguir o documento
  literalmente teria evitado. **Correção posterior**: a afirmação original desta linha, de que "o
  `quickstart.md` está correto", **era falsa** — ver §2.5. O §0 do roteiro nomeava um script
  inexistente, e a execução manual não o exerceu porque partiu de um banco já migrado.
- **T054 — E2E do caminho completo**: `assets-processes.spec.ts`, Chromium, **2/2**, nenhum pulado.
  Uma jornada parametrizada rodada duas vezes, Ativo e Processo (FR-020): cadastrar → buscar por
  nome → filtrar por unidade → abrir pelo cartão → editar → desativar → **vínculo novo recusado** →
  reativar → **vínculo agora aceito**. O último passo é controle positivo: sem ele, a recusa
  poderia ser qualquer outro defeito em vez da desativação.
- **T055 — E2E de escopo organizacional**: `assets-processes-scope.spec.ts`, Chromium, **1/1**. Ator
  `Risk Manager` escopado só a `DIV-A-TEAM-1`, provisionado pela interface real de administração,
  nunca pelo pool compartilhado. Cobre as três superfícies: listagem (nem em `data`, nem em
  `meta.total`), leitura direta (`404`, nunca `403`) e escrita de vínculo (`422` nomeando o campo,
  nunca `403`, e **nenhuma linha gravada**, relida pelo mesmo endpoint que a interface usa).
- **T056 — acessibilidade**: `accessibility.spec.ts`, Chromium, **56/56**, nenhum pulado. Dezoito
  varreduras novas, nove de cada lado, simétricas: catálogo, formulário de cadastro e detalhe nos
  dois temas, mais as abas de vínculo e o formulário de edição. O `beforeAll` cria um ativo e um
  processo reais e **vincula os dois ao risco de fixture**, para que a aba "Riscos vinculados"
  varra tabela populada e não o estado vazio — a lição do F-28.
- **T057 — ausência de exclusão**: `assets-processes-contract-no-deletion.spec.ts`, **12/12**, e
  **provado não-vácuo**: cada família de asserção reprovou contra defeito plantado, dos dois lados,
  incluindo as próprias checagens internas de não-vacuidade (parser do contrato quebrado e
  diretório de módulo vazio). Duas vacuidades reais foram encontradas e corrigidas no processo
  (§2.4).

---

## 6. Como verificar sem se enganar

```bash
pnpm --filter @vertice/api run typecheck && pnpm --filter @vertice/api run lint
pnpm --filter @vertice/api run test:unit          # 490
pnpm --filter @vertice/api run test:contract      # 648
pnpm --filter @vertice/api run test:integration   # 168
pnpm --filter @vertice/web  run test:unit         # 532
pnpm --filter @vertice/api run openapi:check
pnpm run format:check
```

**Servidores locais rodam build de produção**, não `dev --watch`. Depois de mudar código eles
servem o build ANTIGO até serem reconstruídos e reiniciados:

```bash
pnpm --filter @vertice/api run build   # depois reinicie o processo da 3001
pnpm --filter @vertice/web run build   # depois reinicie o processo da 3000
```

**E2E** exige `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` no ambiente — sem eles os specs **pulam em
silêncio** em vez de rodar. Confirme que a saída diz "passed", nunca "skipped". E veja **F-48**: a
suíte completa não cabe no orçamento local de 20 logins por 5 minutos; rode specs isolados e espace
as execuções. **Aumentar o limite não é uma saída** — rebaixar controle de segurança para um teste
passar é o que o AGENTS.md proíbe.

Quatro variáveis precisam estar **no shell**, não só no `.env`: o `playwright.config.ts` lê
`process.env` e **não** carrega o `.env` de `apps/web`. Sem `API_INTERNAL_URL` e `APP_ORIGIN` a
config nem carrega, e a mensagem de erro fala de configuração de ambiente inválida, não de teste.

```bash
cd apps/web
export SEED_ADMIN_EMAIL="$(grep '^SEED_ADMIN_EMAIL=' ../api/.env | cut -d= -f2- | tr -d '')"
export SEED_ADMIN_PASSWORD="$(grep '^SEED_ADMIN_PASSWORD=' ../api/.env | cut -d= -f2- | tr -d '')"
export API_INTERNAL_URL=http://localhost:3001
export APP_ORIGIN=http://localhost:3000
export PLAYWRIGHT_SKIP_WEB_SERVER=true    # aponta para servidores já de pé
npx playwright test e2e/<um-spec>.spec.ts --project=chromium --reporter=list
```

**Verificação renderizada**: `apps/web/scripts/ui-capture.mjs` foi estendido com as telas de Ativos
e Processos (`80`–`85g`). Rode nos dois temas e **olhe as imagens**.

---

## 7. Pendências

| Item | Onde | Situação |
|---|---|---|
| F-48 | `docs/deferred-findings.md` | Suíte E2E completa não cabe no orçamento local de login. Duas saídas escritas; aumentar o limite não é uma delas |
| Relação Processo↔Ativo | research.md D-10 | Deliberadamente fora desta fase — nenhum requisito a pede e nenhum consumidor a consumiria. Candidata explícita para Incidentes (Fase 6 do roadmap) |
| `isActive` + `status` redundantes em `Control` | research.md D-3 | Anotado, fora de escopo desta fase |
| F-51 — `db:migrate:dev` inexistente | quickstarts de 002, 003 e 005 | Mesma linha errada herdada; corrigida só na 006. Fora do escopo desta fase, registrada para quem tocar naqueles roteiros |
| 2 advisories `moderate` | `pnpm audit` | Abaixo do limiar `--audit-level=high` que o gate impõe. Visíveis no log, para triagem humana no próximo toque em dependências — o que o cabeçalho do `ci.yml` já prevê |

**Nenhuma tarefa da fase permanece aberta.** As linhas acima são itens deliberadamente adiados, com
razão escrita, não trabalho inacabado.
