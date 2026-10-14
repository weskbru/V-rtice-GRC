# Estado do trabalho — retomada a partir do repositório

> **Documento histórico — registro de fechamento da fase 005 (Auditoria e Achados).** Não descreve
> necessariamente o estado atual do produto. Fonte vigente: [`docs/STATE.md`](../../docs/STATE.md)
> e [`docs/modules/audit-engagements.md`](../../docs/modules/audit-engagements.md).

Este arquivo existe para que outro contexto possa continuar **sem depender de nenhuma conversa
anterior**. Ele registra o que está feito, o que falta, as decisões que não podem ser reabertas e o
próximo passo exato.

**Última atualização**: 2026-09-08, com o módulo **concluído** (Fases 6 e 7).

---

## 1. Onde o produto está

| Fase do roadmap | Estado | Commit |
|---|---|---|
| Correção bloqueante — seletor "Gestor do risco" (F-34) | entregue, CI verde | `e2cd0e0`, `9fa039f` |
| Fase 2 — Gestão de Controles | entregue, CI verde | `9912968` |
| Fase 3 — Compliance | entregue, CI verde | `8f0452d` |
| Fase 4 — Auditoria e Achados (backend) | entregue, completado nesta sessão | `f9e5e5b`, `99a2417` |
| Fase 6 — Interface de Auditoria e Achados | entregue, verificada no navegador | `99a2417` |
| Fase 7 — Validação e fechamento | entregue, T082–T091 completos | `7096821`, `51de0e3` |
| Fase 5 do roadmap — Ativos e Processos como módulos | não iniciada | — |
| Incidentes, Problemas, Indicadores e Relatórios | não iniciadas | — |

Contagens verificadas por execução (não estimadas):
`API unit 444 · contrato 577 · integração 168 · web unit 463`, com `typecheck`, `lint`,
`format:check` e `openapi:check` limpos nos dois pacotes.

---

## 2. Próximo passo exato

**Este módulo está concluído.** Todas as 91 tarefas de `tasks.md` estão marcadas e verificadas por
execução. O próximo trabalho do roadmap é o item 12 do CLAUDE.md §17 — a **Fase 5** do
`docs/architecture/grc-roadmap.md`: promover Ativos e Processos de registros de referência a
domínios. O roadmap trata os dois como **uma única fase**, um só nó no grafo de dependências.

Uma pendência de infraestrutura de teste fica aberta e registrada: **F-48** — a suíte E2E completa
não cabe no orçamento local de 20 logins por 5 minutos. Cada spec passa isolado, a suíte de
acessibilidade passa 38/38 em série, e CI é verde por causa de `retries: 2`. Duas saídas possíveis
estão escritas em `docs/deferred-findings.md`; **aumentar o limite não é uma delas.**

---

## 3. O que esta sessão encontrou — leia antes de confiar em qualquer registro

A versão anterior deste arquivo afirmava, com confiança: *"as 19 operações do contrato existem como
rotas HTTP reais"*. **Era falso, em dois sentidos.**

1. **O contrato declara 20 operações, não 19.** `cancelAuditEngagement` entrou por FR-004a e
   nenhum total foi atualizado. `tasks.md` chegou a rotular o grupo US1 como "operações 1–10"
   quando são 11.
2. **Duas dessas operações não existiam.** `GET /audits/{auditId}/findings` e
   `POST /audits/{auditId}/findings` (T042, T043, metade de T057/T058) não tinham use case,
   controller, DTO nem teste de contrato — **e estavam marcadas `[x]`**.

**Por que a CI ficou verde**: `apps/api/test/contract/contract-coverage.spec.ts` é exatamente o
portão que existe para pegar "operação contratada e nunca construída" (foi escrito depois de F-31,
onde dois endpoints contratados e chamados pelo frontend nunca haviam sido implementados). O
contrato `005-audit-findings/contracts/audit.openapi.yaml` **nunca foi acrescentado ao
`CONTRACT_SOURCES` dele**. O portão nunca olhou para este contrato.

**Reforço do mesmo padrão**: `assertAuditEngagementAcceptsFindings` existia no domínio com um teste
verde em `test/integration/audit-engagement-lifecycle.spec.ts` — que **chamava a função
diretamente**, com um comentário admitindo que o consumidor era "Fase 4, out of this task's scope".
Regra provada isoladamente, nenhum caminho de produção a executando: CLAUDE.md §19.10 exatamente.

Tudo isso está corrigido. O contrato agora está no portão espelho, as duas operações existem, e
o `information-disclosure.spec.ts` foi estendido para varrê-las.

**A lição operacional continua valendo, e é a mesma do arquivo anterior**: um registro que afirma
que algo já é verificado **não é** verificação. Confirme no código antes de construir em cima.
Esta seção é a quarta entrada dessa lista, depois de F-34, D-4 de `003-controls-management` e F-45.

---

## 4. Defeitos encontrados pela verificação renderizada (§18.1), não por nenhum portão verde

Os quatro foram achados **olhando a aplicação em execução**, com `typecheck`, `lint` e todos os
testes verdes antes e depois. Cada um tem correção e guarda de regressão.

1. **Data do período deslocada em um dia.** `audit-engagement-detail-view.tsx` renderizava
   `periodStart`/`periodEnd` (`format: date`) com `new Date(...).toLocaleDateString('pt-BR')`.
   `new Date('2026-01-01')` é meia-noite UTC → em UTC-3 imprime o dia anterior. O cabeçalho dizia
   "31/12/2025 a 30/03/2026" enquanto a visão geral, logo abaixo, dizia "01/01/2026 a 31/03/2026" —
   **duas datas diferentes para o mesmo campo, na mesma tela**. O padrão foi copiado de
   `control-detail-view.tsx`, onde é CORRETO (`createdAt`/`retiredAt` são `date-time`).
2. **Precondição de início presa em estado velho.** Adicionar um item ao escopo grava
   `audit_scope_*`, nunca `audit_engagements`, então o `version`/`ETag` do engajamento **não muda**.
   O efeito que lê a contagem de escopo era keyed em `[id, status, etag]` e nunca reexecutava:
   "Iniciar engajamento" ficava **desabilitado**, sob o aviso "adicione ao menos um item ao escopo",
   numa tela cuja própria tabela de escopo logo abaixo já listava o item salvo. Só um reload
   resolvia. É a forma exata do defeito que AGENTS.md nomeia em "Frontend state".
3. **Data de identificação padrão no futuro.** `new Date().toISOString().slice(0, 10)` em
   `engagement-finding-create-dialog.tsx` pré-preenchia **amanhã** durante toda a noite em qualquer
   fuso atrás de UTC (09/09 às 20h41 de 08/09).
4. O mesmo defeito 3 existia, pré-existente, em
   `features/findings/components/finding-create-dialog.tsx` (de onde o nosso foi copiado) e em
   `features/evidence/components/evidence-create-dialog.tsx` — o diálogo para o qual a exigência de
   evidência da FR-010 manda o usuário. **Os três foram corrigidos**, porque AGENTS.md exige que a
   correção generalize a todo call site com o mesmo padrão, não só ao reportado. Os dois fora desta
   feature estão registrados aqui como correção fora de escopo, não escondidos.

Guarda: `apps/web/src/features/audit-engagements/date-call-sites.test.ts` (grep estrutural,
reprovado contra o código defeituoso antes de ser aceito) e um teste de regressão em
`audit-engagement-lifecycle-actions.test.tsx` que afirma o **estado habilitado do botão**, não a
contagem de fetches — um teste que só contasse fetches passaria mesmo se o botão nunca reabilitasse,
que é justamente a metade que o usuário sente.

---

## 5. Defeito de autorização encontrado na semeadura

O papel semeado **"Audit Lead"** tinha `audit-engagement:{create,edit,scope,transition}` e
`finding:{create,close,remediate,link}` — e **nenhuma das duas permissões de leitura**. Como
semeado, ele abria um engajamento e nunca mais o lia: `GET /audits`, `GET /audits/{id}`,
`GET /audits/{id}/findings` e `POST /audits/{id}/findings` todos o recusavam (o último dobrando a
falta de `audit-engagement:view` num `404`, que nem nomeia permissão), e a entrada "Auditoria" do
menu — gated em `audit-engagement:view` — nunca aparecia para ele. A própria descrição semeada
promete o contrário: "Conduz engajamentos de auditoria de ponta a ponta".

Passou despercebido porque **todo** teste de contrato e integração deste módulo constrói o próprio
papel-fixture com exatamente as permissões do caso sob teste; nenhum exercitava o papel SEMEADO. O
código de autorização sempre esteve correto — o defeito era só na semeadura.

Corrigido, com guarda estrutural em `apps/api/test/unit/audit-engagement-write-implies-read.spec.ts`,
escrita como regra geral ("todo papel semeado que ESCREVE um recurso consegue LÊ-lo"), não como
lista fixa de um papel — e reprovada contra a semeadura defeituosa antes de ser aceita, nomeando
"Audit Lead".

---

## 6. Decisões que **não** devem ser reabertas

Inalteradas em relação à versão anterior deste arquivo:

- **`Finding` não é criado nesta fase.** Existe desde a Fase 1 como capacidade do núcleo GRC. Esta
  fase lhe deu produtor, relações e a aresta que faltava.
- **`OPEN → IN_REMEDIATION` é alcançável** por operação real, com teste que a exercita.
- **Fechar achado exige evidência** (FR-010), somando à regra anterior, não substituindo. Se
  encontrar um teste da Fase 1 alterado **sem** citar FR-010, desconfie.
- **`audit-engagement:*`, nunca `audit:*`.** `audit:view` já existe no núcleo com outro significado.
  O módulo é `modules/audit-engagements/`.
- **O engajamento tem quatro estados**, incluindo `CANCELLED`, com justificativa obrigatória.
- **ADR-020 vale integralmente, nas cinco partes**, desde o primeiro vínculo.
- **Escopo não é removível** (research.md D-12). A interface diz isso explicitamente em vez de
  oferecer um botão que não funcionaria.
- **Os sete clientes HTTP com raiz `/findings/{id}`** vivem em `features/findings/api.ts`, não em
  `features/audit-engagements/` — o recurso nomeado no caminho é o dono, mesma regra que
  `controls/api.ts` já aplica a `GET /controls/{id}/risks`.

---

## 7. T087 — confirmação registrada, não presumida

Conferido campo a campo contra os mappers: toda propriedade de toda resposta desta fase é coluna
gravada por escrita anterior (`AuditEngagement.*`, `AuditScopeEntry.*`, e cada `FindingSummary`
carregando o próprio `status`). `GET /audits/{id}/findings` é **filtro** por `auditEngagementId`,
não agregação. Não existe equivalente ao `complianceState` da Fase 3. **Nenhum endpoint desta fase
precisa de `Cache-Control: no-store`.**

Nuance registrada em vez de escondida: `orgUnit.name`, `leadAuditor.fullName` e
`AuditScopeEntry.target.label` **são** joins de leitura a linhas externas mutáveis — renomear a
unidade muda a resposta sem este módulo ser escrito. Não são a classe D-14: são **rótulos de
referência** desnormalizados, iguais aos que `control-response.mapper.ts` já devolve, e a
plataforma não põe `no-store` em nenhum deles. Tratar rótulo como estado derivado forçaria
`no-store` em praticamente toda leitura do produto.

---

## 8. Como verificar sem se enganar

```bash
pnpm --filter @vertice/api run typecheck && pnpm --filter @vertice/api run lint
pnpm --filter @vertice/api run test:unit          # 438
pnpm --filter @vertice/api run test:contract      # 577
pnpm --filter @vertice/api run test:integration   # 168
pnpm --filter @vertice/web  run test:unit         # 463
pnpm --filter @vertice/api run openapi:check
pnpm run format:check
```

**Sobre falhas intermitentes (F-45).** A suíte de contrato é sequencial em fork único
(`fileParallelism: false`, `singleFork: true`) contra um banco truncado uma única vez no início.
Arquivos posteriores veem dados dos anteriores. Antes de tratar como regressão, rode o arquivo
isolado:

```bash
pnpm --filter @vertice/api exec vitest run --config vitest.contract.config.ts test/contract/<arquivo>.spec.ts
```

Se passar isolado e falhar em conjunto, é contaminação de estado — **não** corrida, e **não**
resolve serializando (já está serializado).

**Ambiente.** API em 3001, web em 3000, PostgreSQL em 5432 (`postgres`/`admin`). Os dois servidores
locais rodam **build de produção** (`node dist/src/main.js` e `next start`), não `dev --watch`:
depois de mudar código eles servem o build ANTIGO até serem reconstruídos e reiniciados. Foi
exatamente isso que fez `/api/v1/audits` responder `404` enquanto `/api/v1/risks` respondia `401`
no início desta sessão. Sempre:

```bash
pnpm --filter @vertice/api run build   # depois reinicie o processo da 3001
pnpm --filter @vertice/web run build   # depois reinicie o processo da 3000
```

**Alterações no design system** (`packages/design-system`) só aparecem no navegador depois de
`pnpm --filter @vertice/design-system run build` — `apps/web` consome de `dist`.

**Verificação renderizada**: `apps/web/scripts/ui-capture.mjs` foi estendido com as telas de
Auditoria (`70`–`79`). Rode nos dois temas e **olhe as imagens**:

```bash
cd apps/web
node scripts/ui-capture.mjs ../../docs/reviews/ui/005-audit-findings-light --theme=light --height=2200
node scripts/ui-capture.mjs ../../docs/reviews/ui/005-audit-findings-dark  --theme=dark  --height=2200
```

Armadilhas já pagas nesse roteiro, nesta sessão: as três variantes de escopo estão **dentro** da
aba "Escopo" do detalhe — clicar a aba da variante sem abrir a seção não encontra nada e o bloco
guardado pula em silêncio; e o botão de submissão do escopo é **"Adicionar"**, não "Adicionar ao
escopo" (esse é o título da seção).

---

## 9. Pendências conhecidas, com dono

| Item | Onde | Situação |
|---|---|---|
| T082–T086, T088 | Fase 7 | Não iniciadas — ver §2 |
| F-44 (dívida da Fase 2) | `docs/deferred-findings.md` | Três itens, cada um com portão. Não bloqueia. |
| F-43 (auxiliar de login do E2E confunde throttle com senha errada) | idem | Não bloqueia. |
| F-45 (contaminação entre arquivos no banco de teste) | idem | Causa corrigida; ver §8. |
| Mojibake em dados semeados pelo E2E | dados, não código | "E2E Proof � Evidence Risk Manager" aparece nas capturas. É o CONTEÚDO gravado pelo auxiliar de E2E, não defeito de renderização — o resto do pt-BR acentuado renderiza corretamente na mesma tela. Não bloqueia; vale limpar quando alguém tocar nesse auxiliar. |
