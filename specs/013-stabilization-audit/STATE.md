# 013 — Auditoria técnica de estabilização: registro operacional

> **Documento histórico — registro de fechamento da fase 013 (auditoria de estabilização
> técnica).** Não descreve necessariamente o estado atual do produto. Fonte vigente:
> [`docs/STATE.md`](../../docs/STATE.md) — pendências desta fase (S-09/F-64, F-65, F-66 e outras)
> são rastreadas em [`docs/deferred-findings.md`](../../docs/deferred-findings.md).

Pedido: auditoria técnica profunda e ativa do Vértice GRC antes da versão final — bugs funcionais,
segurança e autorização, acessibilidade, responsividade, performance (desenvolvimento, build de
produção e percebida) e qualidade dos próprios testes —, seguida de correção dos problemas reais
encontrados, na abstração certa, com teste de regressão que falha sem a correção.

Linha de base: commit `4bb407d`. Execução em três fases: investigação paralela (7 agentes), consolidação
pelo coordenador, correção distribuída (6 pacotes). Os relatórios completos de cada agente não são
versionados (pasta de trabalho da sessão); este registro guarda o que foi decidido, a evidência que
sustenta cada decisão e o que ficou aberto.

---

## §1 — Método

### §1.1 Investigação (fase 1)

| Agente | Escopo |
|---|---|
| A1 | Riscos + Planos de Ação |
| A2 | Incidentes + Problemas (+ evidência, comentário e anexo nessas telas) |
| A3 | Controles + Compliance |
| A4 | Auditoria/Achados + Indicadores + Relatórios + Dashboard |
| A5 | Usuários, Papéis, Estrutura organizacional, Perfil, Ativos, Processos |
| A6 | Segurança e arquitetura transversal (único dono do banco de teste) |
| A7 | Performance (dev × produção × percebida) + componentes compartilhados de UI |

Regras da fase: nenhuma alteração de código; todo achado com reprodução (requisição, medição ou
navegador) ou marcado como hipótese; dados criados com prefixo por agente.

Condições de ambiente registradas para não virarem falso achado:

- **Limitador global elevado só durante a auditoria**: a API de desenvolvimento rodou com
  `THROTTLE_LIMIT=6000` por variável de processo (sem mudança de código nem de `.env`), porque sete
  agentes em `localhost` gerariam `429` que pareceriam defeito. Bloqueio de login mantido. Revertido ao
  final (§6).
- **PostgreSQL local perto do limite de conexões** (83/100 medido por `pg_stat_activity`) com sete
  agentes: falhas de conexão isoladas foram reexecutadas antes de qualquer conclusão.
- **Build de produção num worktree isolado** (`D:/dev/vertice-grc-perf`, portas próprias): `next build`
  no mesmo diretório de um `next dev` ativo corrompe `.next/routes-manifest.json`.

### §1.2 Correção (fase 3)

| Pacote | Achados | Dono único de |
|---|---|---|
| F1 | S-03, S-04, S-05, S-06 | `components/ui/dialog.tsx`, `ConfirmDialog`, `DataTable`, hook compartilhado |
| F2 | S-01, S-11, S-12 | guards de sessão, filtro de problemas, logger, guarda estrutural; banco de teste |
| F3 | S-02 | `apps/web/next.config.ts` |
| F4 | S-07, S-08 | indicadores, execução de relatório, seção de vínculos de achado |
| F5 | S-10 | seletor de usuário compartilhado e seus consumidores |
| F6 | S-13 | avaliação do Turbopack, só no worktree |

Todo pacote precisou provar que o teste de regressão **falha** com a correção revertida (por edição) e
passa com ela.

---

## §2 — O que a auditoria confirmou sem defeito

Registrado porque também é resultado — cada item foi exercitado, não lido:

- **Nenhum IDOR/BOLA** em dez domínios (risco, incidente, problema, controle, ativo, processo,
  evidência, achado, ação, engajamento), com dois usuários reais em unidades isoladas: leitura, edição,
  sub-recursos e comentário fora do escopo devolvem `404`, indistinguível de inexistente.
- **CSRF** falha fechada, inclusive em `/auth/login`; **mass assignment** recusado com `400` nomeando o
  campo; **215 de 215** handlers com decorator de acesso.
- **Anexos**: allow-list por tipo e magic bytes, `Content-Disposition: attachment` sempre,
  `nosniff`, `CSP default-src 'none'` no download, chave de armazenamento por hash.
- **Imutabilidade da auditoria** em três camadas: `vertice_app` só tem `INSERT`/`SELECT` em
  `audit_event`, `UPDATE`/`DELETE` reais recusados pelo PostgreSQL, triggers de append-only ativos.
- **Segregação de funções aplicada no servidor**: risco (solicitante × aprovador, com CHECK no banco),
  controle (avaliador × atestador, dono × atestador), problema (quem concluiu a ação corretiva não
  fecha) — reproduzidas com usuários reais.
- **Calculador único**: os mesmos valores de indicador em `GET /dashboard`, `GET /dashboard/summary` e
  execução de relatório, medidos atomicamente.
- **Relatório multi-domínio** respeita a permissão de leitura de cada domínio item a item.
- **"Riscos: 861 total × 136 por nível"** no Dashboard está correto: 735 riscos nunca foram avaliados.
- Migração de mapeamento de compliance idempotente; zero violações de axe em 14 varreduras de
  Controles/Compliance; causas e consequências persistem entre abas.

---

## §3 — Achados e decisões

Severidade: **P0** segurança/integridade; **P1** bug real que deve sair antes da versão final; **P2**
relevante; **P3** dívida.

| ID | Sev. | Módulo | Achado (evidência resumida) | Decisão |
|---|---|---|---|---|
| S-01 | P0 | Identidade/sessões | `mustChangePassword` só era devolvido no login; usuário recém-criado usava a API inteira sem trocar a senha (`GET /risks` → 200) | Corrigido (§4.1) |
| S-02 | P1 | Anexos / proxy web | Upload > 10 MB impossível pela interface: PDF de 15 MB → API direta 201 em 0,09 s; pela origem web 500 em 31 s | Corrigido (§4.2) |
| S-03 | P1 | UI compartilhada | Foco em `<body>` ao fechar diálogo com campo `autoFocus` ou aberto de item de menu | Corrigido (§4.3) |
| S-04 | P1 | UI compartilhada | `ConfirmDialog` sem restauração de foco (F-62, 34 chamadores) | Corrigido (§4.3) |
| S-05 | P1 | UI compartilhada | `DataTable` remontava todas as células quando `columns` mudava de identidade (10 telas) | Corrigido (§4.3) |
| S-06 | P1 | UI compartilhada | `DialogContent` sem altura máxima (25 de 36 diálogos) | Corrigido (§4.3) |
| S-07 | P1 | Indicadores/Relatórios | "Percentual de conformidade" (organização inteira) rotulado "Sua unidade organizacional" | Corrigido (§4.4) |
| S-08 | P1 | Achados | Aba Achados do risco disparava 150–350 requisições ao montar (F-61) | Corrigido (§4.4) |
| S-09 | P1 | Auditoria/Achados | Achado de engajamento sem superfície de gestão quando a unidade não tem risco; `FindingsPanel` lista por coincidência de unidade, não por `FindingRiskLink` | **Adiado para especificação própria** (§5) |
| S-10 | P1 | Transversal | Seletores de usuário com `GET /users?pageSize=100` sem busca; o banco de desenvolvimento já tem mais de 100 usuários | Corrigido (§4.5) |
| S-11 | P2 | API | Mensagem de erro do Prisma com caminho absoluto do servidor no log operacional | Corrigido (§4.1) |
| S-12 | P2 | Testes | Guarda estrutural de escopo em vínculos não varria `incidents`/`problems` | Corrigido (§4.1) |
| S-13 | P2 | Dev | Fast Refresh 0,85–3 s; primeira visita 3–12 s | Turbopack adotado no `dev` (§4.6) |
| S-14 | P2 | Dashboard | `GET /dashboard/summary` = 149 queries por requisição (78 ms local) | Adiado (§5) |
| S-15 | P2 | Admin | `org-unit-tree` sem padrão ARIA tree nem setas | Adiado (§5) |
| S-16 | P2 | Relatórios | CSV: cabeçalho em inglês (contrato), sem BOM, sem neutralização de fórmula | Adiado (§5) |
| S-17 | P2 | Testes | Nenhum teste de componente em `admin/components/users/**` | Parcial: coberto pelos E2E de foco (§4.3); unitários adiados |

Achados de teste identificados durante a própria correção:

- **Um cenário do pacote de correção era vazio**: "`/admin/users` → Encerrar sessões → Escape" passa com
  e sem a correção de `ConfirmDialog`, porque o `DropdownMenu` do Radix já devolve o foco ao próprio
  gatilho. F1 acrescentou um cenário a partir de um botão comum (Ativo → Desativar), que falha sem a
  correção; o original ficou marcado no próprio teste como cobertura de consumidor, não prova.
- **Um E2E de 012 deixava papel no banco quando falhava** — corrigido em `4bb407d`, reconfirmado aqui.

---

## §4 — Correções

### §4.1 S-01, S-11, S-12 — API

**S-01.** `MandatoryPasswordChangeGuard` global, entre `SessionGuard` e `PermissionGuard`: nega por
padrão quando a sessão tem troca pendente, com uma lista mínima marcada por
`@AllowedDuringMandatoryPasswordChange()` (sessão atual, `me`, troca de senha, logout). Recusa `403`
com tipo próprio `…/password-change-required`. O flag vem da validação de sessão, sem migração. Sem
evento de auditoria por chamada recusada (decisão registrada no guard: rotina de onboarding, não
anomalia; o `403` já vai para o log de segurança). A web redireciona para
`/profile?mustChangePassword=true` ao receber o tipo novo.

Verificado ao vivo pelo coordenador: usuário novo → `GET /risks` **403** `password-change-required`,
`GET /auth/session` e `/auth/me` **200**; troca → a sessão antiga passa a **401**; novo login →
`GET /risks` **403 forbidden** (o usuário não tem papel — recusa de permissão, não de troca). No
navegador: a tela de troca estabiliza em `/profile?mustChangePassword=true` sem laço (2 recusas de
`/notifications` do shell, efeito duplo do modo de desenvolvimento), sem erro visível, e a troca pela
interface leva ao login.

**S-11.** `redactAbsoluteFilePaths` aplicado à `message` registrada por `logException`; a `stack`
continua no log operacional, exceção já documentada em `information-disclosure.spec.ts`.

**S-12.** A guarda descobre todo `modules/*/application/links` em disco em vez de lista fixa;
exceção única e justificada: `compliance` (controle com `orgUnitId` nulo, verificação equivalente
inline).

**Não-vacuidade, executada pelo coordenador:**

| Correção | Reversão temporária | Resultado sem | Com |
|---|---|---|---|
| S-01 | registro do guard comentado em `app.module.ts` | `mandatory-password-change.spec.ts` 1 falha / 3 | 3/3 |
| S-11 | `redactAbsoluteFilePaths` devolvendo o texto intacto | `logger-redact-absolute-paths.spec.ts` 3 falhas / 4 | 4/4 |
| S-12 | `isOrgUnitWithinScope` trocado por `false` em `link-incident-asset.usecase.ts` | guarda falha nomeando `LinkIncidentAssetUseCase` | verde |

### §4.2 S-02 — Anexos pela origem web

Causa confirmada no código do Next 15.5.25: todo corpo proxiado por um rewrite externo passa por
`getCloneableBody` com teto `experimental.middlewareClientMaxBodySize` (10 MB por padrão), **mesmo sem
`middleware.ts`**. Acima do teto o clone termina cedo, o `Content-Length` original segue para a API, que
espera bytes que nunca chegam; o proxy desiste aos 30 s com `500` em texto puro.

Correção: `middlewareClientMaxBodySize: 32 MB` em `next.config.ts`. A API continua sendo a autoridade do
limite (25 MB). O agente F3 propôs 100 MB; o coordenador reduziu para 32 MB depois de ler
`body-streams.js`: o clone empurra cada pedaço também para um segundo `PassThrough` que ninguém lê
durante o proxy, então até o teto de bytes de cada requisição fica em memória no servidor web **antes
de qualquer autenticação**. 100 MB não eliminava a falha lenta, só a deslocava para arquivos maiores.

Medido pela origem web depois da correção: 15 MB → **201 em 0,16 s**; 27 MB → **413 RFC 9457 em
0,13 s**. F3 repetiu a matriz (9, 15, 25, 27, 50 MB) em `next build` + `next start` no worktree com o
mesmo resultado antes/depois. Regressão: `e2e/attachment-upload-size.spec.ts` (falha com a configuração
revertida: 500 em 50 s).

**Troca consciente:** arquivo acima de 32 MB ainda falha do jeito lento (truncado, 30 s, 500). Evitar
isso exige verificação de tamanho no cliente conhecendo o limite do servidor — registrado em §5.

### §4.3 S-03 a S-06 — Diálogos e tabelas compartilhados

Um único mecanismo, `useDialogFocusRestore` (`packages/design-system/src/lib/use-restore-focus.ts`),
usado por `components/ui/dialog.tsx` e por `ConfirmDialog`:

- captura o elemento anterior **na fase de render** de um componente âncora montado dentro do
  `Content` — antes do commit que aplica qualquer `autoFocus` (a captura em `onOpenAutoFocus` rodava
  depois e pegava o próprio campo do diálogo);
- se o elemento capturado estiver dentro de `[role="menu"]`, substitui pelo gatilho do menu via
  `aria-labelledby` (Radix `DropdownMenuContent`, confirmado em
  `@radix-ui/react-dropdown-menu/dist/index.mjs:110`).

`DataTable` chama `cell`/`header` diretamente como função de render quando é uma função simples, e
mantém `flexRender` para classes, `memo`/`forwardRef` e strings. Não há closure obsoleta — cada render
lê a definição atual — e nenhuma coluna do repositório chama hook dentro de `cell` (regra já garantida
por `react-hooks/rules-of-hooks`). Isso corrige as dez telas sem tocá-las; as correções locais de
`role-admin-view.tsx`/`role-admin-columns.tsx` ficaram redundantes e inofensivas.

`DialogContent` ganhou `max-h-[90vh] overflow-y-auto` por padrão, sobrescrevível; o `cn` usado faz merge
de classes Tailwind (verificado com as classes reais de cada diálogo que já tinha layout próprio). Sem
rolagem dupla em `role-details-dialog` e `report-run-dialog`, medido em 1280×720 e 390×844 nos dois
temas. Nenhum diálogo real ultrapassava a viewport hoje — o risco fechado era latente; o teste mede o
CSS computado (`maxHeight` era `"none"` antes).

Não-vacuidade (F1): `dialog.test.tsx` 3/3 falham sem; `design-system-confirm-dialog-focus.test.tsx` 2/2;
`data-table-cell-identity.test.tsx` 1/1; E2E `dialog-focus-and-size.spec.ts` — (a) `autoFocus` em
transição de Incidente, (b) menu → Editar em Usuários, (c) Executar em Relatórios, (d1) `ConfirmDialog`
de Ativo, (e) altura — cada um falha sem a correção.

Pendência de verificação: `mapping-migration-dialog.tsx` e `command.tsx` só por leitura e pelo teste do
`cn` (o primeiro exige cadeia de fixture de compliance; o segundo não tem consumidor).

### §4.4 S-07 e S-08

**S-07.** `metricScopeLabel`/`reports.run.scopeLabel` recebem o `scopeApplicability` de cada item:
`ORGANIZATION_WIDE` sempre "Organização inteira". No diálogo de relatório o rótulo passou a ser por item.
Verificado com usuário real de escopo UNIT, nos dois temas.

**S-08.** `FindingLinksSection` só busca vínculos quando entra (ou está a 200 px de entrar) na viewport,
e nunca busca de novo ao rolar para longe e voltar; sem `IntersectionObserver`, busca imediatamente
(comportamento anterior). Medido em `RSK-2026-0871`: **150–350 → 2 requisições** no carregamento, 6
depois de rolar até o fim. Os vínculos continuam aparecendo sem clique.

### §4.5 S-10 — Seletor de usuário

Um componente só, `UserPicker` (`apps/web/src/components/directory/`), adaptador fino sobre o
`SearchablePicker` do design system — busca no servidor por `q`, e-mail como linha secundária para
distinguir nomes idênticos (o banco de desenvolvimento tem dezenas de "E2E Auth Journey") — e
`UserMultiSelectFilter` para os filtros multi-valor, com os mesmos primitivos. Substituíram
`GET /users?pageSize=100` sem busca em Ações, Auditoria (formulário, filtro, criar achado), Controles
(formulário, filtro, remediação), Evidência, Achados (criar, editar, ação corretiva), Incidentes e
Problemas (formulário, ação corretiva) e Riscos (formulário, filtro, ações de tratamento).
**Nenhuma mudança de contrato**: `GET /users` sempre aceitou `q`. A restrição `assignableForOrgUnitId`
de dono de controle e gestor/responsável de risco foi preservada; ao trocar de unidade, a revalidação
busca a primeira página e, se preciso, faz uma busca dirigida pelo nome — nunca baixa a lista inteira.
O diálogo de papéis do usuário passou a paginar até `totalPages` (A5-F02).

Defeito introduzido pela própria correção e corrigido pelo coordenador: nos diálogos de criar
achado, criar achado de engajamento e criar evidência, o seletor mostra o estado `owner`, mas o
fechamento só executava `form.reset()` — reaberto, o diálogo exibia a escolha anterior e enviaria o
responsável padrão. Os três passaram a restaurar `owner` junto com o formulário;
`evidence-create-dialog.test.tsx` falha sem a correção.

Não-vacuidade: `action-edit-form.test.tsx` (usuário fora da primeira página só é encontrável por
busca — 2 falhas sem), `user-roles-dialog.test.tsx` ("Papel 101" — 2 falhas sem),
`evidence-create-dialog.test.tsx` (1 falha sem). E2E real `user-picker-search.spec.ts`: um usuário
`[FIX-F5]` recém-criado **não aparece** no seletor sem busca, é encontrado por busca, salvo como
responsável de um controle e confirmado no detalhe; o usuário é desativado ao final.

Três E2E existentes quebraram pela correção — mesma causa: localizavam o usuário na primeira página
não buscada e usavam `exact: true` contra o nome acessível da opção, que o `SearchablePicker` compõe
como "nome e-mail". Passaram a buscar e a casar pelo início do nome.

Limitações conscientes: `risk-audit-section.tsx` resolve id → nome da trilha de auditoria com uma
página de 100 usuários (não há endpoint por id sem permissão administrativa — usuário fora dela
aparece como id, como antes); o rótulo de um filtro vindo da URL usa as linhas já carregadas.

### §4.6 S-13 — Turbopack no desenvolvimento

Medido no worktree isolado, mesmo protocolo e alvos da investigação, 4 repetições:

| Alvo | webpack mediana / máx | Turbopack mediana / máx |
|---|---|---|
| `header.tsx` (shell) | 846 / 1154 ms | 601 / 659 ms |
| `lib/messages/shell.ts` | 1036 / 1742 ms | 606 / 614 ms |
| `status-badge.tsx` (design system via `paths`) | 937 / 1005 ms | 574 / 595 ms |

Ganho de 1,4–1,7× na mediana e 1,75–2,8× no pior caso, com variação muito menor. A investigação tinha
estimado 2–5× numa sessão mais longa; o registro fica com o número mais conservador. `auth.spec.ts`,
que compila várias rotas pela primeira vez: **8,3 s × 20,7 s**. Varredura de 30 verificações × 2 temas
(17 rotas, 10 detalhes, abas, diálogo, gráfico): zero erro de console, `pageerror`, HTTP ≥ 400 ou
regressão visual. `next build` continua em webpack, com bundles idênticos.

Decisão: **adotado** — `apps/web/package.json` `"dev": "next dev --turbopack"`; `build` inalterado.
O CI não usa `next dev` (todo job E2E sobe `next start`). A ressalva de F6 (suíte E2E completa não
executada sob Turbopack) foi fechada na validação final, que rodou toda a suíte Chromium contra o
servidor de desenvolvimento com Turbopack (§6).

---

## §5 — Pendências conscientes

- **S-09 (P1), `docs/deferred-findings.md` F-64** — superfície de gestão de achado de engajamento e listagem por vínculo real. Mesma classe
  de `specs/010-action-plan-surface`: capacidade no servidor sem caminho na interface. Exige
  especificação (§16), não correção de estabilização.
- **Upload acima de 32 MB, F-65** — falha lentamente (§4.2). Precisa de verificação de tamanho no cliente com o
  limite exposto pelo servidor.
- **S-14** 149 queries no resumo do Dashboard; **A7-F07** `admin/roles` 17 queries; **A7-F08** contagens
  dos cards via listagem (5–8 requisições em Controles, Auditorias, Ativos, Processos); **A7-F09**
  notificações duplicadas no Dashboard; **A7-F05** First Load JS de 290–411 kB por rota de detalhe.
  Medidos, sem efeito visível hoje em localhost.
- **S-15** árvore organizacional sem padrão ARIA tree — revisão da tela Estrutura organizacional.
- **S-16** CSV: cabeçalho é contrato (`reports.openapi.yaml:211`, `reports.spec.ts:401`); BOM e
  neutralização de fórmula são defesa em profundidade (hoje nenhum texto livre chega ao CSV).
- **S-17** testes unitários da tela de Usuários.
- **F-66** transbordo horizontal a 390 px em sete telas (três causas anteriores a esta auditoria, §6).
- P3: busca em `/actions` (contrato); testes unitários das tabelas de transição de Incidente, Problema
  e Engajamento; sanitização de `fileName`; fixtures de SoD de Controles em unidades irmãs; seed de
  senha só-criação; `bumpOrgTreeVersion` em `setStatus`; testes de casos de uso de administração e de
  queda de sessão no reset de senha; isolamento do Vitest (44% do tempo em ambiente jsdom);
  documentar a dependência de `paths` do design system.
- **E2E de F1 cria fixtures novas a cada execução** (incidentes, relatórios e ativos `[FIX-F1]`, sem
  exclusão por regra de negócio) — resíduo no banco de desenvolvimento, como outros specs já produzem.

---

## §6 — Validação final

Condições: limitador global de volta ao valor real (100/min — o override da auditoria foi removido),
servidor web de desenvolvimento em Turbopack, em série.

| Verificação | Linha de base (`4bb407d`) | Final |
|---|---|---|
| Unidade da API | 57 arquivos / 569 testes (fase 009) | **66 / 611** |
| Integração | 55 / 266 (A6, sob contenção de conexões) | **55 / 266** |
| Contrato | 57 / 824 | **58 / 827** |
| Unidade da web | 138 / 803 | **145 / 825** |
| E2E Chromium, suíte inteira, `--workers=1` | — | **153 / 153** em duas execuções (ver abaixo) |
| `format:check`, `lint`, `typecheck` (repositório), `openapi:check` | limpos | limpos |
| Build de produção | web 74–78 s, API 20 s | web 76 s, API 23 s, design system 4 s |
| First Load JS | 103 kB compartilhado; `/risks/[id]` 411 kB; `/admin/users` 364 kB | 103 kB; 415 kB; 366 kB |

**E2E.** A primeira execução completa deu 90 aprovados, 2 falhas e 61 não executados (o restante do
bloco serial de acessibilidade, interrompido pela primeira falha). As duas falhas foram de teste, com
causa verificada, nenhuma de produto:

1. `admin-access.spec.ts` — quebrado pela própria S-10: localizava "Platform Administrator" na
   primeira página não buscada e com `exact: true` contra um nome acessível que agora é
   "nome e-mail". Passou a buscar e a casar por `^Platform Administrator \S+@\S+$`, o que ainda exclui
   "Fixture — Platform Administrator" e "Platform Administrator (recovery)".
2. `accessibility.spec.ts`, formulário de novo ativo — a exposição que `specs/009` §14 deixou
   registrada e "deliberadamente não corrigida às cegas": o botão de envio fica desabilitado e
   semiopaco até as unidades carregarem, e a varredura mediu a cor no meio da transição (2,96:1).
   Agora reproduzida, recebeu a mesma espera que o formulário de processo já tinha.

Na reexecução do arquivo de acessibilidade apareceu uma terceira falha de teste: o registro de
Incidentes não mostrava o incidente da fixture na primeira página — a ordenação padrão é por
"Reportado em", uma data, e o banco de desenvolvimento acumulou 73 incidentes, vários do mesmo dia. As
quatro varreduras de registro de Incidentes e Problemas passaram a abrir o registro já buscado pelo
título da fixture (`?search=`, o estado real de URL da tela). Resultado final:
`accessibility.spec.ts` **104 / 104**, `admin-access.spec.ts` **1 / 1**, demais specs aprovados na
primeira execução.

**Smoke final** — 15 módulos × 2 temas × 6 larguras (1920, 1440, 1366, 1280, 1024, 390), cada rota
carregada uma vez e redimensionada sem recarregar:

- Nenhuma resposta HTTP ≥ 400 da API.
- Nenhum transbordo horizontal de 1920 a 1024 px em nenhum módulo.
- Avisos de hidratação (id do Radix `useId` divergente no menu da conta) em 8 combinações — medidos
  como artefato de compilação sob demanda do servidor de desenvolvimento: aparecem na primeira visita e
  somem na segunda (0 em 9 rotas); no **build de produção**, 0 em 9 rotas × 2 execuções.
- A 390 px, transbordo horizontal em Riscos, Controles, Ativos, Processos, Auditoria, Dashboard e
  Estrutura organizacional — três causas, todas em arquivos que esta auditoria não alterou, registradas
  como F-66.
- "Sem h1" em Compliance foi falso positivo do script (o título é "Biblioteca normativa").

---

## §7 — Incidentes de processo

- **`git stash` numa árvore compartilhada.** Um agente de correção executou `git stash` sem caminho para
  isolar a causa de uma falha de teste, revertendo para HEAD arquivos de três outros agentes em
  andamento; recuperou o conteúdo por `git checkout stash@{0} -- <arquivos>` e confirmou `git diff
  stash@{0}` vazio antes do `drop`. Os demais agentes reconferiram seus arquivos. A regra passou a
  proibir qualquer comando git que altere arquivos ou índice, com ou sem caminho.
- **Reversão temporária deixada aplicada.** Um agente foi interrompido por limite do modelo no meio da
  prova de não-vacuidade, deixando `action-edit-form.tsx` com o bloco revertido (hooks dentro de função
  de render). Encontrado e restaurado pelo coordenador antes de qualquer validação.
- **Limites de capacidade do modelo** interromperam agentes repetidamente; o coordenador passou a manter
  no máximo quatro agentes ativos e assumiu diretamente a validação do pacote F2.
