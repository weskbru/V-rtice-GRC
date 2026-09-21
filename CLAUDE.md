# PharosGRC

## 1. Visão do produto

PharosGRC é uma plataforma corporativa de Governança, Riscos e Compliance (GRC).

O produto será desenvolvido inicialmente com foco em Gestão de Riscos, mas sua arquitetura deve permitir a evolução progressiva para outros domínios de GRC.

Módulos planejados:

- Gestão de Riscos
- Gestão de Problemas
- Gestão de Incidentes
- Gestão de Controles
- Gestão de Ativos
- Gestão de Processos
- Compliance
- Auditoria
- Indicadores
- Relatórios

O primeiro módulo funcional será Gestão de Riscos.

Gestão de Planos de Ação não consta desta lista: deixou de ser módulo de negócio e passou a ser a
capacidade compartilhada `Action` do núcleo GRC, decisão registrada em §17.

> Onboarding e estado atual não vivem neste arquivo — vivem em `docs/HANDOVER.md` (roteiro de
> entrada: visão geral, como subir o ambiente, ordem de leitura) e `docs/STATE.md` (fotografia
> datada do que existe, do que é parcial e do que é planejado). Leia os dois antes de assumir que
> este documento sozinho descreve o estado do produto.

---

## 2. Princípios arquiteturais

- Segurança por padrão.
- Separação clara de responsabilidades.
- Baixo acoplamento entre módulos.
- Alta coesão dentro dos módulos.
- APIs com contratos explícitos.
- Domínio independente de infraestrutura sempre que possível.
- Alterações relevantes devem ser auditáveis.
- Histórico deve ser preservado quando necessário para fins de auditoria.
- Não introduzir dependências sem justificativa.
- Não criar abstrações prematuras.
- Não implementar funcionalidades que não estejam especificadas ou aprovadas.
- Compatibilidade futura deve ser considerada nas decisões arquiteturais.

---

## 3. Stack tecnológica inicial

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend

- NestJS
- TypeScript

### Banco de dados

- PostgreSQL
- Prisma

### Infraestrutura

- Docker
- Docker Compose

### Cache e infraestrutura auxiliar

- Redis

### Testes

- Vitest
- Playwright

### API

- REST
- OpenAPI

---

## 4. Arquitetura de módulos

A plataforma deve possuir uma separação entre:

### Core

Responsabilidades transversais da plataforma:

- Authentication
- Authorization
- Users
- Organizations
- Sessions
- Audit
- Files
- Notifications
- Configuration

### Business Modules

Domínios de negócio:

- Risks
- Problems
- Incidents
- Controls
- Assets
- Processes
- Compliance
- Audits
- Reports

Os módulos de negócio não devem possuir dependências diretas desnecessárias entre si.

Relacionamentos entre domínios devem ser explicitamente definidos.

Action Plans não consta desta lista pela mesma razão do §1: não é módulo de negócio, é a
capacidade compartilhada `Action` do núcleo GRC (`grc/action`), decisão registrada em §17.

---

## 5. Identidade e autenticação

A arquitetura de autenticação deve permitir múltiplos provedores.

Provedores previstos:

- Local authentication
- LDAP
- Active Directory
- OIDC
- SAML

LDAP/Active Directory não devem ficar acoplados aos módulos de negócio.

A aplicação deve possuir uma camada de abstração de identidade.

Os módulos devem trabalhar com a identidade interna do usuário e não depender diretamente do mecanismo utilizado para autenticação.

---

## 6. Sessões

A plataforma deve possuir gerenciamento explícito de sessões.

Uma sessão deve permitir, quando aplicável:

- identificação do usuário;
- data de criação;
- expiração;
- última atividade;
- revogação;
- endereço IP;
- user agent;
- método de autenticação.

A plataforma deverá futuramente permitir gerenciamento das sessões do usuário.

---

## 7. Autorização

A autorização deve ser baseada em:

- usuários;
- papéis (roles);
- permissões;
- escopo organizacional.

Não utilizar somente verificações simples de "administrador" versus "usuário".

As permissões devem poder representar operações como:

- visualizar;
- criar;
- editar;
- excluir;
- aprovar;
- administrar.

O modelo deve permitir evolução futura para autorização contextual e por escopo organizacional.

---

## 8. Auditoria

A plataforma deve possuir trilha de auditoria centralizada.

Eventos relevantes devem registrar, quando aplicável:

- usuário;
- data/hora;
- ação;
- entidade;
- identificador da entidade;
- valores anteriores;
- valores posteriores;
- endereço IP;
- user agent;
- contexto da operação.

A auditoria deve ser tratada como capacidade transversal da plataforma.

---

## 9. Gestão de riscos

O módulo de Gestão de Riscos será o primeiro módulo de negócio implementado.

Um risco deverá possuir capacidade de representar, quando aplicável:

- identificador;
- código;
- título;
- descrição;
- categoria;
- tipo;
- origem;
- processo relacionado;
- ativo relacionado;
- unidade organizacional;
- responsável;
- gestor;
- causas;
- consequências;
- probabilidade;
- impacto;
- risco inerente;
- controles relacionados;
- risco residual;
- tratamento;
- plano de tratamento;
- prazo;
- status;
- data de identificação;
- data da avaliação;
- próxima revisão;
- histórico;
- anexos;
- comentários.

O modelo deve permitir avaliações históricas.

Não sobrescrever informações históricas relevantes sem preservar o estado anterior.

---

## 10. Relacionamentos GRC

A arquitetura deve permitir relacionamentos entre entidades.

Exemplos:

Risco -> Processo

Risco -> Ativo

Risco -> Controle

Risco -> Incidente

Risco -> Problema

Risco -> Plano de Ação

Incidente -> Risco

Problema -> Risco

Controle -> Risco

Controle -> Processo

Plano de Ação -> Risco

Esses relacionamentos devem ser modelados explicitamente e não através de estruturas genéricas sem justificativa arquitetural.

---

## 11. Frontend

A aplicação deve possuir uma interface corporativa consistente.

Estrutura inicial:

- Login
- Dashboard
- Navegação principal
- Cabeçalho
- Menu lateral
- Perfil do usuário
- Configurações

O Dashboard deve ser concebido como Dashboard GRC e não como Dashboard exclusivo de riscos.

O design deve permitir que novos módulos sejam adicionados sem alterar a estrutura fundamental da interface.

### 11.1 Idioma da interface

A interface de usuário da v1 é definitivamente em português do Brasil (pt-BR).

- Toda string nova voltada ao usuário deve ser criada em pt-BR, nos catálogos centralizados
  (`apps/web/src/lib/messages/` e `apps/api/src/shared/messages/user-messages.ts`) — nunca embutida
  diretamente no componente.
- Texto em inglês voltado ao usuário não pode ser reintroduzido.
- Permanecem em inglês, por serem identificadores técnicos e não interface: nomes de variáveis,
  tipos TypeScript, nomes de arquivo, identificadores de banco (tabelas, colunas, valores de enum,
  nomes de papel semeados), identificadores de API (rotas, campos de DTO, URIs `type` do RFC 9457),
  nomes de ação de auditoria, mensagens de log operacional, comentários de código e nomes de teste.
- Terminologia GRC profissional em português (Risco, Risco inerente, Risco residual, Probabilidade,
  Impacto, Nível de risco, Tratamento, Controle, Avaliação, Aprovação, Trilha de auditoria, Unidade
  organizacional, Plano de ação). "Dashboard" e "Compliance" permanecem como estão — são termos
  consagrados no vocabulário corporativo brasileiro.
- Esta regra deve ser considerada no planejamento, na execução de tarefas, na revisão de código e
  na validação de UI, e vale para todos os subagentes, sem necessidade de repetição a cada
  instrução.

---

## 12. Segurança

Segurança deve ser considerada desde a arquitetura inicial.

Devem ser observados:

- princípio do menor privilégio;
- validação de entrada;
- autorização no backend;
- proteção contra injection;
- proteção contra XSS;
- proteção contra CSRF quando aplicável;
- gerenciamento seguro de sessões;
- proteção de secrets;
- logs de segurança;
- auditoria;
- tratamento seguro de erros;
- controle de acesso a arquivos;
- proteção de informações sensíveis.

Nunca armazenar secrets no código-fonte.

---

## 13. Qualidade

Toda implementação deve:

1. possuir testes adequados;
2. passar lint;
3. passar type-check;
4. possuir tratamento de erros;
5. respeitar a arquitetura definida;
6. considerar segurança;
7. considerar auditabilidade;
8. evitar duplicação desnecessária;
9. possuir documentação quando a decisão for arquiteturalmente relevante.

---

## 14. Processo de desenvolvimento

Antes de implementar:

1. entender o requisito;
2. consultar a especificação;
3. avaliar impacto arquitetural;
4. definir abordagem;
5. decompor em tarefas;
6. identificar testes necessários.

Durante a implementação:

- realizar mudanças pequenas;
- manter o código coeso;
- evitar alterações não relacionadas;
- não modificar contratos sem avaliação;
- não introduzir dependências desnecessárias.

Após a implementação:

- executar testes;
- executar lint;
- executar type-check;
- revisar alterações;
- verificar impactos de segurança;
- verificar impactos de auditoria.

---

## 15. Regra para agentes

O agente principal deve atuar prioritariamente como arquiteto/Tech Lead.

Quando uma tarefa puder ser delegada, utilizar subagentes especializados.

Subagentes devem possuir responsabilidades claras.

Exemplos:

- backend developer;
- frontend developer;
- database engineer;
- QA engineer;
- security reviewer;
- architecture reviewer.

O agente principal deve revisar o resultado das tarefas delegadas.

---

## 16. Regra fundamental

Não começar a implementação simplesmente a partir de uma ideia informal.

Primeiro:

Requisito
-> Especificação
-> Arquitetura
-> Plano
-> Tarefas
-> Implementação
-> Testes
-> Revisão

A especificação é a fonte de verdade do comportamento esperado do produto.

---

## 17. Evolução do produto

A arquitetura deve permitir a implementação incremental dos módulos.

**Concluído:**

1. Fundação da plataforma
2. Identidade e autenticação
3. Usuários, papéis e permissões
4. Organizações
5. Sessões
6. Auditoria
7. Gestão de Riscos
8. **Núcleo GRC compartilhado** — Evidência, Ação e Achado (ADR-016)
9. **Gestão de Controles** (`specs/003-controls-management/`, commit `9912968`)
10. **Compliance** — framework versionado, requisito, mapeamento N:M e estado de conformidade
    (`specs/004-compliance-management/`, commit `8f0452d`)
11. **Auditoria e Achados — completo** (`specs/005-audit-findings/`, backend em `f9e5e5b`,
    interface e fechamento em `99a2417`/`7096821`/`51de0e3`). Engajamento de auditoria, escopo em
    três variantes, ciclo de vida de quatro estados, achado produzido pelo engajamento,
    remediação, fechamento com evidência (FR-010) e vínculos achado↔controle/risco — com E2E,
    escopo organizacional e acessibilidade nos dois temas. `STATE.md` registra os defeitos que a
    verificação renderizada encontrou e as guardas que os prendem.

12. **Gestão de Ativos e Gestão de Processos — completo** (`specs/006-assets-processes/`,
    implementação em `3252776`/`50f30f6`/`ee64cfb`/`9c1b048`, validação em `e5cc72f` e no
    fechamento desta fase). Promoção dos dois registros de referência a domínios próprios, com
    módulo, contrato REST, autorização, escopo organizacional e auditoria — sem conceito paralelo e
    sem recriar os quatro vínculos que já existiam. Fechou os dois vazamentos de escopo que a
    especificação mediu antes de ser escrita: a leitura sem escopo nenhum do inventário inteiro, e
    a escrita de vínculo contra alvo fora do escopo. 61 de 61 tarefas, com E2E, escopo
    organizacional e acessibilidade nos dois temas. `STATE.md` §2 registra os **cinco** defeitos
    que a fase corrigiu além do pedido, incluindo dois que a própria validação encontrou nas suas
    guardas.

13. **Gestão de Incidentes e Gestão de Problemas** (`specs/008-incidents-problems/`, commits
    principais `4b18978` — painel de Evidência/Comentário/Anexo nas telas —, `2a39b52` — leitura
    reversa dos cinco vínculos a partir de Risco/Ativo/Processo, com os dois contratos entrando no
    portão `contract-coverage.spec.ts` — e `d1bc2cb` — contraste dos toasts). Dois ciclos de vida
    completos, os cinco vínculos Incidente/Problema nas duas direções, ação corretiva, colaboração
    (evidência, comentário e anexo) e os papéis "Incident Manager"/"Problem Manager" no seed.
    Continua aberto: não existe E2E de escopo organizacional em navegador para os cinco vínculos
    desta fase — `7674efb` entregou a prova apenas no nível de integração de API
    (`apps/api/test/integration/incident-problem-links-source-scope.spec.ts`), e `apps/web/e2e/`
    não tem nenhum spec de escopo de Incidente/Problema; a divisão do job cross-browser (`22021d2`)
    nunca foi verificada por um `workflow_dispatch` real; o commit `44e1e04` deixou em
    `.github/workflows/ci.yml` uma flag diagnóstica TEMPORÁRIA de worker único para WebKit, ainda
    não revertida; e F-56 (`docs/deferred-findings.md`) segue aberta. `STATE.md` §2 é o registro
    operacional desses pontos.

14. **Indicadores e Relatórios — completo** (`specs/009-indicators-reports/`, commits principais
    `8135915` — onze provedores de métrica atrás de um único calculador —, `6e66e2c` — valor atual
    de qualquer indicador do catálogo, servido por HTTP, o MVP —, `5c24606` — guarda estrutural
    provando que nenhuma tabela desta fase duplica coluna de tarefa/arquivo/aprovação em paralelo
    ao núcleo GRC (SC-005) —, `311549c` — as cinco operações contratadas que faltavam,
    implementadas antes de os dois contratos entrarem em `contract-coverage.spec.ts` — e `d31e140`
    — as telas saindo de `status: 'planned'`, com varredura de acessibilidade e captura renderizada
    sobre dado real). Catálogo fechado de onze métricas atravessando Risco, Controle, Conformidade,
    Auditoria, Achado, Ativo, Processo, Ação, Incidente e Problema; limiar e notificação de
    rompimento; série histórica organização-inteira; `Action` com origem `INDICATOR`; e Relatório
    multi-domínio com exportação CSV — todo cálculo passando pelo mesmo
    `IndicatorCalculationService`, nunca uma segunda implementação (CLAUDE.md §19.7). 70 de 71
    tarefas marcadas; a tarefa restante (T064) está obsoleta em prosa, porque o que ela pedia já
    tinha sido entregue por um commit anterior a esta fase começar (`spec.md`, "Achados fora do
    escopo desta especificação", achado 1). Medição de fechamento, em série, no commit `d31e140`:
    contrato 55 arquivos/807 testes, unidade da API 57/569, integração 52/258, unidade da web
    123/663 — nenhum teste removido; typecheck, lint, format:check, openapi:check e audit limpos
    (F-57 abaixo do limiar); E2E Chromium **129 de 129**, mas só com um único worker Playwright —
    com o padrão de quatro, o `ThrottlerGuard` global devolvia `429` até no login (F-59, atualizado
    com a evidência das três execuções). Continua aberto: F-57 (aviso moderado, abaixo do limiar,
    em dependência de teste), F-59 (limitador global sob concorrência) e uma exposição de
    contraste idêntica à corrigida no formulário de Processos, latente e deliberadamente não
    corrigida às cegas no formulário de Ativos. `STATE.md` §14 é o registro de fechamento completo.

**Ordem seguinte, orientada por dependência arquitetural** (aprovada em 2026-09-07; substitui a
ordem conceitual anterior, que listava Problemas e Incidentes antes de Controles). Esta ordem foi
executada até o fim: os itens 9-14 acima esgotam as Fases 2-7 de
`docs/architecture/grc-roadmap.md` §2, e a Fase 7 foi a **última** fase desse roteiro (que vai da
Fase 0 à Fase 7).

~~14. **Indicadores e Relatórios**~~ — concluído; ver item 14 na lista "Concluído" acima.

15. **Superfície de Plano de Ação — correção de uma lacuna que o fechamento da Fase 7 não viu**
    (`specs/010-action-plan-surface/`, commits `940c5e3` — trilha de auditoria por ação — e
    `3b8c90a` — as quatro superfícies de interface). Esta entrada existe para registrar uma
    discrepância, não para celebrar uma fase: **o roteiro foi declarado concluído em `ba3a211`
    enquanto a capacidade `Action` — o Plano de Ação do produto, item 8 desta lista — estava
    completa no servidor e inutilizável na interface**, de uma forma que nenhuma guarda deste
    repositório detectava. O que estava medido no disco naquele commit: não existia página de
    detalhe de ação (todo outro domínio tem rota `[id]`); `getAction` e `updateAction` estavam no
    cliente desde a fase 002 **sem nenhum chamador em lugar algum** — a oitava ocorrência do padrão
    que §19.10 diz que este projeto já pagou sete vezes; o detalhe do risco tinha **duas** abas de
    ação, com a tabela funcional em "Tratamento" e um marcador de indisponível na aba chamada
    "Planos de Ação"; o painel de achados exibia uma contagem de ações abertas calculada no
    servidor, sem caminho até elas; e não havia trilha de auditoria por ação, embora Risco tenha a
    sua desde a fase 001. A correção não modelou nada de novo: `Action` continua sendo a autoridade
    única, sem entidade paralela, sem tabela de plano de ação, sem segundo ciclo de vida. R-009
    (`specs/002-shared-grc-foundation/research.md`) recebeu emenda datada registrando que aquela
    decisão era sobre **quantas entradas de menu** as capacidades do núcleo teriam, e foi executada
    como se fosse também sobre **profundidade de superfície**; a decisão de uma entrada permanece em
    vigor. O fechamento da Fase 7 **não foi apagado nem reescrito** — ele descrevia corretamente as
    fases que cobria. Continua aberto: E2E dos fluxos entre origens, F-61 (o painel de achados
    dispara duas requisições por achado ao montar e o limitador global recusa parte delas na tela) e
    a extração do painel de ações por origem, hoje em três cópias quase idênticas.
    `specs/010-action-plan-surface/STATE.md` é o registro operacional completo, incluindo os três
    defeitos que a própria revisão encontrou e a falsa detecção que o coordenador produziu.

    **Atualização datada (2026-09-14), sem apagar o parágrafo acima**: F-61 foi **corrigido em
    2026-09-13** (`docs/deferred-findings.md`, F-61, saída F4/S-08) — o texto acima registra quando
    a lacuna foi aberta, não o estado atual dela. `apps/web/e2e/action-plan.spec.ts` também já
    existe hoje, cobrindo o fluxo de ação entre origens em navegador. Confirmar contra
    `docs/STATE.md` §6/§9 antes de tratar qualquer um dos dois como pendente.

16. **Trabalho pós-roteiro — cinco fases de refinamento, nenhuma delas um módulo de negócio novo**
    (`specs/011-dashboard-platform-view/` a `specs/015-roles-permissions-surface/`). Adicionado a
    esta lista em 2026-09-14, durante uma revisão documental — nenhuma destas fases tinha entrada
    própria aqui antes, só nos seus próprios `STATE.md`.
    - **011 — Dashboard como visão de plataforma.** Dashboard de risco virou visão GRC de
      plataforma de verdade: `GET /dashboard/summary` (módulo novo `modules/dashboard`, sem violar
      "`core/` nunca importa `modules/`"), painel "Requer atenção", visão geral de oito domínios,
      logo do tema escuro corrigido. Fechada, sem pendência registrada além de decisão de produto
      adiada (clique-through de aprovações pendentes).
    - **012 — Refinamento visual de Admin → Papéis.** Trocou uma tabela de 5 colunas por um índice
      de papéis navegável; encontrou e corrigiu, fora do escopo pedido, um defeito real (toda
      edição de papel de sistema falhava com 422) e dois defeitos de foco em diálogo compartilhados
      com o resto do produto. Substancialmente refeita pela fase 015 a pedido do usuário.
    - **013 — Auditoria de estabilização técnica.** Sete frentes de investigação paralelas mais
      seis pacotes de correção; achou e corrigiu um P0 de segurança real (usuário novo podia usar a
      API inteira sem trocar a senha obrigatória) e um mecanismo de restauração de foco
      compartilhado por ~30 diálogos. Adotou Turbopack em desenvolvimento. Débito de desempenho e
      acessibilidade deliberadamente adiado, registrado na própria `STATE.md`.
    - **014 — Loader institucional de navegação.** Indicador de carregamento com a marca do farol,
      ligado ao sinal real de navegação pendente do Next.js (`useLinkStatus`/`useTransition`), não
      ao `loading.tsx` nativo (avaliado e rejeitado — pisca e substitui a tela). Cobertura por regra
      de lint, não convenção (ADR-023). Fechada sem pendência registrada.
    - **015 — Superfície de Papéis e Permissões — fechada em 2026-09-14.** Reconstrução mais
      profunda da tela de Papéis, parcialmente revertendo decisões da fase 012 a pedido explícito
      do usuário. Encerrou com regressão final verde e zero bloqueadores, incluindo a correção
      completa do achado que havia reaberto F-71 (a incompatibilidade de hidratação do
      `FilterBar`) e do seu defeito irmão em `MultiSelectFilter`/`ColumnVisibilityMenu` (F-74). Em
      uma frase, o que segue em aberto: gap de E2E na linha de papéis do Perfil (F-75), uma
      referência morta de comentário em `admin-roles.spec.ts:40` (F-76), e o mecanismo latente —
      não corrigido, troca deliberada — de `DisclosureGroup`. `docs/STATE.md` §8/§10 e
      `specs/015-roles-permissions-surface/STATE.md` são o registro completo.

    `docs/STATE.md` é o registro vigente do que cada uma destas cinco fases deixou aberto —
    consultar antes de assumir que qualquer uma delas está inteiramente resolvida.

> **Estado do roteiro, 2026-09-12**: o roteiro arquitetural planejado (Fases 0 a 7 de
> `docs/architecture/grc-roadmap.md` §2) está **concluído**. Não existe Fase 8 especificada, e este
> documento não inventa uma — CLAUDE.md §16 exige requisito → especificação → arquitetura → plano
> antes de qualquer implementação, e nenhum desses passos foi dado para um trabalho seguinte.
>
> **Ressalva registrada no mesmo dia, item 15 acima**: "roteiro concluído" nunca significou
> "produto completo", e o item 15 é a prova disso — uma capacidade inteira, especificada e
> construída no servidor, ficou quatro fases sem superfície utilizável, e o fechamento da Fase 7
> passou por cima dela porque media tarefas de fase, não capacidade entregue ao usuário. Antes de
> declarar qualquer coisa concluída daqui em diante, pergunte o que o **usuário** consegue fazer,
> não quantas tarefas foram marcadas.
>
> **Próximo passo real**: uma decisão de produto sobre o que vem depois do roteiro planejado —
> evolução de um módulo existente, uma integração, ou um domínio GRC novo fora da lista de
> `CLAUDE.md` §1 — não uma tarefa de implementação a começar direto. Antes de decidir, leia
> `specs/010-action-plan-surface/STATE.md` §7 (o que esta correção deixou aberto),
> `specs/009-indicators-reports/STATE.md` §14 (fechamento da Fase 7, o que ficou aberto e
> conhecido) e `docs/deferred-findings.md` F-57/F-59/F-60/F-61.
>
> **Atualização, 2026-09-19 (rodada 023, saneamento de findings)**: os quatro achados citados acima
> como "o que ficou aberto e conhecido" **não estão mais abertos**. F-57 (vulnerabilidades
> moderadas do `vitest`), F-59 (limitador global sob concorrência) e F-60 (seed não reposiciona
> unidade de usuário existente) foram corrigidos nesta rodada, com evidência em
> `docs/deferred-findings.md`; F-61 já estava corrigido desde 2026-09-13 (item 15 acima já registra
> isso). O restante do inventário de `docs/deferred-findings.md` foi saneado na mesma rodada — um
> achado, F-56 (padrão `Controller` do formulário compartilhado perdendo valor digitado antes da
> hidratação), permanece deliberadamente aberto, investigado e pronto para decisão, porque a
> correção alcança 34+ pontos de chamada no Design System e a rodada foi instruída a não decidir
> mudança desse alcance sozinha. Ver o próprio registro para o estado atual de cada achado, não esta
> lista, que descrevia um estado de 2026-09-12 já superado.
>
> **Atualização, 2026-09-19, mais tarde no mesmo dia**: F-56 também **não está mais aberto**. O
> coordenador decidiu com uma regra de corte por exposição real, não por reescrever os 34+ pontos de
> chamada: medição campo a campo mostrou que sete das dez telas de criação desabilitam todo campo
> até uma busca assíncrona resolver (a janela de digitação pré-hidratação nunca fica acessível
> nelas), e só duas — `compliance/new` e `reports/new` — tinham um campo genuinamente digitável
> desde o primeiro paint. As duas foram corrigidas com a mesma wiring que o login já usa. **O
> ledger de `docs/deferred-findings.md` tem, a partir desta rodada, zero achados abertos.**
>
> **Nota sobre o item 13 acima, mesma data**: a frase "o commit `44e1e04` deixou... uma flag
> diagnóstica TEMPORÁRIA de worker único para WebKit, ainda não revertida" descreve corretamente o
> estado em que a fase 008 fechou (histórico, não reescrito) — mas lida isoladamente, hoje, soa como
> pendência esquecida. Não é. `.github/workflows/ci.yml` já traz, na própria linha da flag, uma
> revisão datada de 2026-09-14 que a mantém deliberadamente (a pergunta que ela existe para responder
> continua em aberto, e a evidência que chegou desde então aponta PARA concorrência, não contra) e
> agora também uma de 2026-09-19: a flag permanece porque **F-58 bloqueia** o único jeito de
> respondê-la de verdade — um `workflow_dispatch` comparativo contra CI remota, indisponível enquanto
> o faturamento do GitHub bloquear a CI remota. Não é reversão pendente; é decisão datada, com o que
> a desbloqueia nomeado (F-58 cair) e quem a revisita (quem restaurar acesso à CI remota). `STATE.md`
> §8 tem o mesmo raciocínio.

> **Próximo passo (histórico — o item 14 abaixo já está concluído; bloco superado pelo acima, não
> apagado)**: o item 13 está concluído. O trabalho seguinte é o item 14 — Indicadores e
> Relatórios, especificado em `specs/009-indicators-reports/` (spec, plano, tarefas, pesquisa,
> modelo de dados e contratos completos, 71 tarefas, nenhuma iniciada). Antes de começar, leia
> `specs/008-incidents-problems/STATE.md` §2 — registra o que a fase anterior deixou aberto. Leia
> também `specs/006-assets-processes/STATE.md` §2.4 e §2.5: registram duas guardas desta casa que
> passavam verdes sem proteger nada, e um roteiro de validação que afirmava estar correto sem ter
> sido executado na linha que estava errada. Leia também `specs/005-audit-findings/STATE.md` §3 e
> §6, que registram por que dois registros "concluídos" deste repositório eram falsos e como
> confirmar contra a realidade em vez de contra o documento.

A razão da mudança está registrada em `docs/architecture/grc-roadmap.md` §1, com a evidência em
`docs/history/probo-benchmark.md`. Em resumo: Controle é o conceito que mais domínios
futuros referenciam, e Evidência e Ação são exatamente as capacidades que, quando nascem dentro
de um módulo, ficam indisponíveis para todos os outros. Construir Incidentes e Problemas antes
deles significa ligá-los depois.

**Planos de Ação deixa de ser módulo**: é a capacidade compartilhada `Action` do item 8,
consumida por tratamento de risco, achado, incidente e remediação de conformidade. Cinco
sistemas independentes de tarefa é o defeito que esta ordem existe para evitar.

---

## 18. Política de UI/UX

Esta política é **permanente**. Ela não vale apenas para a fase de refinamento visual que a introduziu:
vale para toda a interface do PharosGRC, hoje e no futuro — telas existentes, telas novas, todos os
módulos GRC planejados (§1), refatoração de frontend, trabalho responsivo, acessibilidade, evolução do
Design System, dashboards, telas administrativas, visualização de dados, formulários, tabelas, diálogos,
navegação e qualquer fluxo voltado ao usuário.

Ela vale igualmente para **todo subagente de implementação**. Quando o agente principal delegar trabalho
de frontend, esta política deve ir junto no contexto da delegação, ou ser herdada e respeitada de outra
forma. Especificações, planos e tarefas futuros que envolvam interface devem considerá-la. O usuário não
precisa repeti-la a cada módulo.

### 18.1 Fluxo de desenvolvimento de UI

```
REQUISITO
  -> DESIGN SYSTEM DO PHAROSGRC
  -> CRÍTICA / ORIENTAÇÃO DE UX (Impeccable)
  -> IMPLEMENTAÇÃO
  -> APLICAÇÃO RENDERIZADA
  -> INSPEÇÃO E VERIFICAÇÃO (Playwright)
  -> CRÍTICA VISUAL
  -> CORREÇÃO
  -> VALIDAÇÃO DE REGRESSÃO
```

A ordem pode ser adaptada quando houver razão técnica. O princípio não: **trabalho de interface é
projetado, renderizado, inspecionado e verificado.**

Uma mudança visual **não** está concluída porque o TypeScript compila, porque a aplicação constrói,
porque os testes unitários passam, porque o componente renderiza sintaticamente, ou porque o agente que
a implementou acredita que ficou correta. Mudanças significativas de interface precisam ser inspecionadas
**na aplicação renderizada**.

Este projeto já pagou esse preço mais de uma vez. A varredura de acessibilidade do dashboard reportou
honestamente zero violações porque esperava a tabela acessível do gráfico, que renderiza **antes** do
SVG — mediu uma tela cujos gráficos ainda não existiam (F-28). E causas e consequências salvavam
corretamente no banco enquanto sumiam da tela ao trocar de aba, com todos os testes verdes. Evidência de
navegador renderizado não é formalidade; é a única coisa que teria pego os dois.

O laço esperado é: **implementar -> executar -> inspecionar no navegador -> capturar/verificar com
Playwright -> criticar -> corrigir -> verificar de novo.**

### 18.2 Ferramentas

- **Impeccable** — instalado em `.claude/skills/impeccable/`, invocado como `/impeccable <comando>`
  (23 comandos: `critique`, `audit`, `polish`, `distill`, `clarify`, `harden`, `adapt`, `layout`,
  `typeset`, `colorize`, `animate`, `bolder`, `quieter`, `shape`, `craft`, `delight`, `optimize`,
  `overdrive`, `onboard`, `live`, `document`, `extract`, `init`). É a capacidade primária de crítica e
  refinamento de UI/UX. **Não substitui a arquitetura de componentes aprovada.**
- **Playwright** — já existente como infraestrutura de E2E (`apps/web/e2e/`, `playwright.config.ts`) e
  também o mecanismo primário de verificação em navegador renderizado: navegação, captura de tela,
  múltiplos viewports, comportamento responsivo e acessibilidade via `@axe-core/playwright`.
  **Não substitui a arquitetura da aplicação nem o Design System.** Não introduzir um segundo framework
  de teste de navegador.

### 18.3 Autoridade do Design System

O Design System do PharosGRC (`packages/design-system`) é a camada de implementação autoritativa da
interface. Prefira melhorar tokens, primitivos, componentes e padrões reutilizáveis — layout, navegação,
tabelas, formulários, representação de status e de risco — a criar estilo isolado por página. Módulos
futuros reutilizam os padrões estabelecidos; divergência visual entre módulos sem justificativa é
defeito, não liberdade.

Lembrar da regra que já vale para esse pacote: ele não contém **nenhuma** string voltada ao usuário —
todo texto entra por prop (§11.1).

### 18.4 Arquitetura de frontend aprovada

Next.js, TypeScript, Tailwind CSS, shadcn/ui, primitivos Radix onde apropriado, Lucide React,
TanStack Table e Recharts.

**Não introduzir outro framework de componentes** — Material UI, Ant Design, Chakra UI, Bootstrap,
Mantine ou equivalentes. Estender o Design System existente.

Exceção registrada: seis primitivos shadcn em `apps/web/src/components/ui/` (`dialog.tsx`,
`select.tsx`, `avatar.tsx`, `sheet.tsx`, `checkbox.tsx`, `table.tsx`) estão deliberadamente
modificados por acessibilidade e não podem ser regenerados às cegas — lista completa e motivo de
cada um em D-15, `docs/local-environment.md`.

### 18.5 Caráter visual do produto

O PharosGRC é uma plataforma corporativa de GRC, usada em ambientes institucionais, empresariais e de
setor público. A interface precisa comunicar confiança, governança, controle, segurança, precisão,
rastreabilidade, maturidade institucional e profissionalismo.

Direção visual: moderna, sóbria, institucional, tecnológica, de alta confiança, densa em informação onde
apropriado, acessível e adequada a trabalho sério de GRC.

Evitar estética genérica de SaaS gerado por IA, e em particular: gradientes em excesso, glassmorphism,
cartões excessivamente arredondados, cartão dentro de cartão sem necessidade, ruído visual decorativo,
animação desnecessária, tipografia de tamanho publicitário, espaço em branco excessivo, ilustrações
decorativas competindo com informação operacional, e efeitos que reduzam densidade informacional.

**Isto não é um site de marketing.** É um sistema operacional de GRC. Estética nunca pode reduzir
usabilidade, legibilidade ou clareza da informação.

### 18.6 Marca

Referência visual autoritativa: **`docs/brand/pharos-brand.jpg`**.

Contém o símbolo do farol com arcos de sinal, o wordmark "PharosGRC", tratamento positivo em azul
institucional sobre branco, versão invertida em branco sobre azul-marinho, e variantes de ícone contendo
apenas o símbolo.

- Não usar a imagem raster completa como logotipo da aplicação.
- Ativos da aplicação devem ser vetoriais, limpos e escaláveis.
- O farol/sinal é o **símbolo compacto primário**.
- Onde apropriado, o shell pode compor **[símbolo] + o texto "PharosGRC" renderizado pela interface**,
  em vez de embutir o wordmark inteiro numa imagem — isso preserva dimensionamento responsivo, colapso
  da barra lateral, acessibilidade, adaptação ao tema e nitidez.

### 18.7 Idioma

Vale integralmente o §11.1, sem repetição aqui: interface em pt-BR, nos catálogos centralizados, nunca
embutida no componente; identificadores técnicos em inglês. Isso inclui rótulos de acessibilidade,
textos de gráficos, estados vazios e de carregamento.

### 18.8 Acessibilidade

Refinamento visual deve **preservar ou melhorar** as garantias existentes.

Cor nunca pode ser o único indicador de severidade de risco, status, estado de aprovação, aviso, erro,
estado de conformidade ou qualquer outra condição semântica.

Preservar ou melhorar: navegação por teclado, foco visível, HTML semântico, rótulos acessíveis, uso
adequado de ARIA, contraste WCAG AA, comportamento com leitor de tela, hierarquia de títulos, tamanho de
alvo e legibilidade de visualização de dados.

**Testes de acessibilidade existentes não podem ser enfraquecidos para acomodar mudança visual.** Se um
teste passa contra o código correto e contra o incorreto, ele não protege nada — foi assim que o defeito
de foco em todos os diálogos e a violação nos gráficos passaram.

### 18.9 Proteção funcional e de segurança

Refinamento visual **não** pode alterar silenciosamente: regras de negócio, ciclo de vida do risco,
semântica de aprovação, segregação entre solicitante e aprovador, autorização, RBAC, escopo
organizacional, auditoria e sua imutabilidade, sessões, contratos de API, modelo de dados, garantias de
segurança ou rastreabilidade histórica.

Se uma melhoria de interface parecer exigir mudança em qualquer um desses pontos, ela **deixa de ser
cosmética** e passa a ser mudança funcional ou arquitetural — sujeita a §14, §16 e à ordem de precedência
de decisão do projeto. Não fazer isso em silêncio dentro de um trabalho visual.

### 18.10 Módulos futuros

Esta política se aplica automaticamente a Problemas, Incidentes, Controles, Ativos, Processos, Planos de
Ação, Compliance, Auditoria, Indicadores, Relatórios, Administração e demais capacidades GRC futuras.

Módulos novos **não inventam linguagem visual própria**: estendem o Design System e os padrões de
interação já estabelecidos.

### 18.11 Portão de aceitação visual

Antes de considerar concluída qualquer implementação substancial voltada ao usuário, o agente — Opus ou
subagente — precisa responder a estas perguntas **olhando a aplicação renderizada**, não o código:

- O usuário identifica imediatamente a ação primária?
- Campos obrigatórios são inconfundíveis? E os opcionais, compreensíveis?
- Estados editável, somente-leitura e desabilitado são distinguíveis entre si?
- Erros são compreensíveis sem depender só de cor?
- O usuário identifica imediatamente o que é interativo?
- Estados de hover são claros? E o foco por teclado, ao menos tão descobrível quanto o hover?
- Seleção ativa é visível? Filtros ativos são visíveis?
- A informação importante domina os metadados secundários?
- Listas e tabelas são estruturadas de propósito, não por acidente?
- O espaçamento comunica agrupamento?
- A tela tem identidade visual reconhecível do PharosGRC?
- A interface é moderna sem ser decorativa? Densa sem ser confusa?
- Funciona nas larguras de viewport suportadas, sem rolagem horizontal acidental na página?
- A acessibilidade permanece intacta?
- O resultado renderizado parece um produto maduro, ou um conjunto de componentes padrão?

**Se qualquer resposta importante for NÃO, o trabalho de interface não está concluído.** Continue
refinando. Este portão não é checklist de fim de tarefa: é a definição de pronto.

### 18.12 Herança pelos módulos futuros

Módulos futuros **não estabelecem linguagem própria**. É proibido criar, por módulo, convenções
independentes de formulário, hierarquia de botões, padrões de interação de tabela, semântica de cor,
padrões de navegação, estilos de status, sistemas de espaçamento ou linguagem visual.

Eles **estendem** o Design System do PharosGRC. Divergência visual entre módulos, sem justificativa
registrada, é defeito.

Planos e tarefas futuros que envolvam trabalho substancial de interface devem incluir critérios de
aceitação explícitos para hierarquia visual, estados de interação, responsividade, acessibilidade, reuso
do Design System e verificação renderizada com Playwright.

**Qualidade de interface não é polimento final opcional.** Tratá-la como algo que se faz "depois" é o
que produz um sistema funcional que parece um conjunto de telas CRUD independentes.

### 18.13 Ferramenta de captura renderizada

`apps/web/scripts/ui-capture.mjs` dirige a aplicação em execução com Playwright e grava capturas em um
diretório de revisão. É o instrumento padrão do laço do §18.1.

```
node scripts/ui-capture.mjs <dir-de-saida> [--theme=light|dark] [--width=1440]
```

Duas armadilhas já pagas, registradas para não se repetirem:

- Use `waitUntil: 'networkidle'` antes de preencher formulários. Com `domcontentloaded` o React ainda
  não hidratou, o preenchimento não adere e o clique não faz nada — falha que parece credencial errada.
- Rótulos exatos, nunca expressão regular ampla: `getByLabel('Senha')` funciona, `/senha/i` casa também
  com "Senha atual", "Nova senha" e "Confirmar nova senha", e o modo estrito do Playwright rejeita.

- Passe uma `--height` maior que a página quando a tela for mais alta que uma janela. O `fullPage`
  do Playwright costura a rolagem, e em páginas altas isso pode produzir uma faixa em branco no lugar
  do conteúdo abaixo da dobra. **Isso é artefato de captura, não defeito de layout** — o coordenador
  chegou a atribuir esse branco a um layout preso à altura do viewport antes de descobrir a causa.
  Na dúvida, confira numa sessão interativa antes de reportar um problema visual.

Capturas de revisão vivem em `docs/reviews/ui/` e **não** são ativos de produção.

---

## 19. Política permanente de arquitetura de domínio GRC

Esta política é **permanente** e vale para todo módulo GRC futuro e todo subagente de
implementação. Ela existe para impedir que o PharosGRC vire um conjunto de aplicações CRUD
independentes com pouca relação entre si.

Análise de origem e evidência: `docs/history/probo-benchmark.md`.
Alvo arquitetural: `docs/history/grc-domain-blueprint.md`.
Sequenciamento: `docs/architecture/grc-roadmap.md`.

### 19.1 Benchmark externo é evidência, não especificação

O Probo (e qualquer outro produto GRC) é **referência de domínio**, nunca a especificação do
PharosGRC. Diferença em relação a um benchmark **não é**, por si, defeito nosso.

Todo padrão externo é classificado antes de qualquer introdução estrutural: **ADOTAR**,
**ADAPTAR**, **JÁ SUPERIOR**, **REJEITAR** ou **ADIAR**, com justificativa registrada.

Quando uma garantia nossa for mais forte que a do benchmark, ela **permanece**. Não se rebaixa
segurança, auditabilidade ou rastreabilidade para ficar parecido com ninguém.

### 19.2 Um módulo novo declara suas relações

Antes de implementar, todo módulo de negócio precisa declarar explicitamente como se relaciona,
quando fizer sentido semântico, com: Unidade Organizacional, Risco, Controle, Ativo, Processo,
Evidência, Ação, Achado e Auditoria.

"Não se relaciona com nada" é resposta possível, mas precisa ser escrita e justificada — não
resultar de esquecimento.

### 19.3 Dois mecanismos de relacionamento, e só dois

| Situação | Mecanismo |
|---|---|
| Dois domínios GRC se relacionam e o vínculo tem significado próprio | **Tabela de ligação explícita e nomeada**, com tipo de entidade de auditoria próprio (ADR-008) |
| Uma capacidade transversal se anexa a muitos tipos de sujeito | **Registro de tipo fechado** — enum verificado em compilação, como `AttachableEntityType`, `CommentableEntityType`, `ApprovableEntityType` |

**Proibido**: tabela genérica `related_entity(type, id)`, discriminador em string livre, sistema
arbitrário de relacionamento entre entidades, meta-modelo. O benchmark reforçou a proibição: o
Probo tentou mecanismos semi-genéricos quatro vezes e reverteu todas.

### 19.4 Reutilizar antes de criar

Antes de introduzir conceito novo, verificar o que já existe. Não recriar por módulo:
autorização, escopo organizacional, auditoria, sessões, arquivos, comentários, notificações,
aprovações, histórico.

**Aprovação já é genérica** (`ApprovableEntityType`). Estender sign-off a um domínio novo é
acrescentar valor de enum e caso de uso — **não** construir motor de workflow. Um motor BPM é
overengineering explícito.

Antes de criar uma capacidade compartilhada nova, aplicar o critério de admissão do núcleo GRC:
**pelo menos três domínios precisam dela e nenhum pode ser seu dono exclusivo.** Não passou nos
dois testes, fica no domínio que a usa.

### 19.5 Requisito e Controle são conceitos distintos

- **`Requirement`** — cláusula de uma versão de framework. Pertence a exatamente uma
  `FrameworkVersion`. Duplica-se entre normas, e isso é correto.
- **`Control`** — salvaguarda que a organização implementa. **Não pertence a framework algum.**
- Ligação **N:M**: um controle satisfaz muitos requisitos, de muitas normas.

Nunca duplicar controle por framework. Framework é versionado, e o mapeamento
requisito↔controle precisa sobreviver à revisão de uma norma.

### 19.6 Evidência e Ação são compartilhadas

**Evidência** nunca é soldada a um único tipo de entidade. **Ação/tarefa** é uma capacidade só,
consumida por tratamento de risco, achado, incidente e remediação de conformidade — não cinco
sistemas independentes de tarefa.

Ambas usam o registro de tipo fechado de §19.3.

### 19.7 Estado derivado é calculado, com um calculador único

Estado de conformidade, nível de risco, vencimento e qualquer outro estado derivado são
**calculados** a partir dos dados que os sustentam, por **um único** ponto no código — como o
`RiskScoringService` é hoje o único classificador de nível de risco.

Não armazenar como campo editável em paralelo ao que o sustenta. Não duplicar a regra.

### 19.8 Superfícies de automação passam pelo mesmo caminho

Qualquer superfície futura — integração, automação, CLI, adaptador MCP, IA — chama os **mesmos
serviços de aplicação** e atravessa a **mesma autorização e a mesma auditoria** da interface
web. Nunca um caminho de dados paralelo, nunca acesso direto ao banco.

REST permanece a arquitetura de API aprovada.

### 19.9 IA opera dentro das fronteiras normais

Quando houver IA no produto:

1. chama serviços de aplicação — nunca o banco nem o modelo diretamente;
2. identidade vem do contexto do servidor, **nunca** da saída do modelo;
3. ação de IA é auditável e atribuível, com **tipo de ator distinto**;
4. escrita iniciada por IA passa por portão de revisão humana **construído e ligado**;
5. campo escrito por IA carrega proveniência e nunca sobrescreve edição humana em silêncio.

IA nunca faz parte da correção de uma regra de negócio.

### 19.10 Ponto de extensão só conta depois de executado

Mecanismo de extensão que compila mas nunca foi chamado **não é** capacidade — é intenção. Antes
de um módulo depender de um ponto de extensão, ele precisa ter sido exercitado ao menos uma vez
por código de produção real.

Esta regra existe porque o projeto já pagou sete vezes pelo mesmo padrão: algo que parecia
coberto porque existia, e que nunca havia sido executado.
