# Feature Specification: Convergência e Saneamento de Implementação

**Feature Branch**: `007-implementation-remediation`

**Created**: 2026-09-10

**Status**: Draft

**Input**: `docs/history/implementation-debt-review.md` (diagnóstico C1–C7/V1–V6) mais
`docs/deferred-findings.md` (F-1 a F-52), decompostos em decisões ratificadas pelo coordenador
(Claude Opus) em `decisions-opus.md`, D-R1 a D-R14. Esta especificação é o registro dessas
decisões como comportamento a entregar — **nada aqui foi implementado, testado ou verificado
ainda**. Todo o texto descreve o estado a alcançar, não o estado atual, salvo onde uma tabela é
explicitamente rotulada como medição do HEAD atual.

**Autoridade das decisões**: D-R1 a D-R14 são decisões do **coordenador desta fase de manutenção**,
tomadas sob autoridade delegada pela missão de saneamento. Não são decisões históricas do usuário
do produto, e não devem ser lidas nem citadas como tal em nenhum documento futuro. `research.md`
registra cada uma com sua alternativa rejeitada.

---

## Contexto medido, não presumido

Este projeto já registrou, na sua própria história, três causas plausíveis, escritas com
confiança e **erradas** (`specs/005-audit-findings/STATE.md` §6) — cada uma dispensou o leitor
seguinte de conferir. A tabela abaixo é a medição no HEAD `ecf10c14a96ef420d01f58a9501e37ea1e097909`
(branch `main`, 3 commits à frente de `origin/main`), executada pelo coordenador, não presumida por
este documento.

| Portão | Resultado |
|---|---|
| `pnpm --filter @vertice/api run db:generate` | FALHA com EPERM — ambiental: um processo de API em produção segura a DLL do query-engine do Prisma. O cliente gerado está atual (typecheck passa). Não é defeito de código. |
| `pnpm --filter @vertice/api-types run generate` | sai com código 0, mas deixa 4 arquivos gerados modificados — a saída commitada está desatualizada |
| `pnpm run typecheck` | passa |
| `pnpm run lint` | passa |
| `pnpm run format:check` | passa |
| `pnpm --filter @vertice/api run test:unit` | passa, 47 arquivos / 490 testes |
| `pnpm --filter @vertice/web run test:unit` | passa, 98 arquivos / 532 testes |
| `pnpm --filter @vertice/api run openapi:check` | passa |
| `pnpm --filter @vertice/api run test:contract` | passa, 48 arquivos / 648 testes |
| `pnpm --filter @vertice/api run test:integration` | passa, 39 arquivos / 168 testes |
| `pnpm run build` | NÃO EXECUTADO — um processo `next start` serve `.next` e o coordenador não está autorizado a interrompê-lo. Registrado como impedimento ambiental, não como aprovação. |
| Playwright chromium | **executado pelo coordenador**: projeto Chromium completo, um worker, `retries:0`, limites de taxa reais (conta 5, origem 20, janela 300), contra a stack de produção em execução. **75 aprovados, 3 falhos, 0 pulados, 8 minutos e 42 segundos.** Por parte da execução, uma segunda execução Chromium de outro agente esteve simultaneamente ativa, compartilhando o mesmo orçamento de login por origem — nenhuma das duas produziu falha de limite de frequência, e a segunda foi interrompida assim que percebida. As três falhas **não são** de limite de frequência — ver User Story 9 abaixo. |

Dois fatos adicionais, medidos e não hipotéticos, que esta fase precisa corrigir:

- Um login real executado pelo coordenador em 2026-09-10 22:34:53 produziu uma linha
  `session.created` com `actor_user_id` e `session_id` **NULOS**, enquanto `ip_address` e
  `user_agent` estavam populados — **1466 de 1466** linhas desse tipo no banco de desenvolvimento
  estão sem atribuição de ator (D-R13).
- A senha do administrador de bootstrap do banco de desenvolvimento está permanentemente rotacionada
  para a forma com sufixo `-E2E-1` por `apps/web/e2e/support/admin-session.ts` — fato operacional
  registrado aqui porque condiciona qualquer verificação manual futura contra esse banco, não porque
  esta fase o altera.

`docs/history/implementation-debt-review.md` é o diagnóstico estático (C1–C7, V1–V6) que
origina esta especificação; `docs/deferred-findings.md` é o backlog de 52 achados triados
individualmente em `matrix.md`. Nenhum dos dois documentos é reescrito por esta fase — permanecem
como registro histórico da leitura que motivou a convergência.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Uma autoridade de escrita para trabalho de ação, em todo lugar que hoje há duas (Priority: P1)

Hoje, uma ação de tratamento de risco criada pela tela de Riscos e uma ação criada por
`POST /actions` obedecem a regras de transição diferentes: a primeira aceita transições que a
segunda recusaria (reabrir uma ação `CANCELLED`, saltar de `OPEN` para `COMPLETED`), porque o
espelho de escrita entre `RiskTreatmentAction` e `Action` nunca chama a validação de legalidade que
`Action` já impõe em sua própria rota. Um gestor de riscos e um usuário genérico de Ações, agindo
sobre o **mesmo** trabalho, obtêm garantias diferentes sem saber disso.

**Why this priority**: é o item C1 do diagnóstico e o F-36 do backlog, com prazo explícito no
próprio roadmap (CLAUDE.md §17): esta convergência precisa acontecer **antes** do módulo de
Incidentes, porque Incidentes é o segundo consumidor real de `Action` além de Riscos, e começar
Incidentes sem fechar isto duplicaria o problema por um terceiro caminho.

**Independent Test**: criar uma ação de tratamento pela tela de Riscos, tentar uma transição ilegal
(por exemplo, reabrir sem motivo uma ação concluída) pela rota de Riscos e confirmar que ela é
recusada com o mesmo código e a mesma exigência que `POST /actions/{id}/transitions` já impõe.

**Acceptance Scenarios**:

1. **Given** uma ação de tratamento de risco existente e concluída, **When** um usuário com
   `risk:treat` tenta reabri-la pela rota de Riscos sem informar motivo, **Then** a operação é
   recusada com `422`, exatamente como seria recusada em `POST /actions/{id}/transitions`.
2. **Given** a mesma ação, **When** o motivo é informado, **Then** a reabertura é aceita, registrada
   como um evento `action.*`, e o motivo é preservado como valor novo na trilha de auditoria.
3. **Given** uma ação criada diretamente por `POST /actions` com origem `RISK_TREATMENT` mas sem
   linha de vínculo (as três que já existem no banco de desenvolvimento), **When** a tela de um
   risco lista suas ações de tratamento, **Then** essa ação passa a aparecer — hoje é invisível a
   toda tela, resumo e indicador de Riscos.
4. **Given** um usuário com apenas `action:edit` (sem `risk:treat`), **When** tenta alterar uma ação
   de tratamento pela rota de Riscos, **Then** é recusado; e um usuário com apenas `risk:treat`
   (sem `action:edit`), **When** tenta alterar a mesma ação por `/actions`, **Then** também é
   recusado. As duas autoridades permanecem distintas e nenhuma delas herda a outra.

---

### User Story 2 — Vencimento é uma regra, calculada em um único lugar (Priority: P1)

Hoje "atrasado" tem quatro implementações independentes — duas dentro do mesmo arquivo
(`dashboard-query.service.ts`), uma em `risk-query.service.ts`, uma em TypeScript
(`risk-overdue.ts`) — e uma quinta cópia de "qual é hoje" em `prisma-action.repository.ts`. Uma
mudança de estado elegível a vencimento, aplicada em um lugar e esquecida em outro, faz a listagem e
o painel discordarem sobre o que está atrasado sem que nenhum teste perceba.

**Why this priority**: é o item C2 do diagnóstico e o F-24 do backlog. Está na mesma prioridade da
US1 porque a migração de dados da US1 muda a tabela que três dessas cópias leem — as duas
convergências precisam ser projetadas juntas.

**Independent Test**: alterar o status de uma ação de tratamento para `CANCELLED` no dia do seu
vencimento e confirmar que a listagem de riscos, o painel e a contagem SQL concordam, no mesmo
instante, sobre ela não estar mais atrasada.

**Acceptance Scenarios**:

1. **Given** uma ação com `dueOn` igual a ontem e status `OPEN`, **When** consultada pela listagem
   de riscos, pelo painel e por uma leitura SQL direta da mesma condição, **Then** as três respostas
   concordam que ela está atrasada.
2. **Given** a mesma ação transicionada para `COMPLETED`, **When** as três formas são consultadas
   novamente, **Then** as três concordam que ela deixou de estar atrasada, no mesmo instante.
3. **Given** o valor de "hoje" usado pela regra, **When** comparado entre a função TypeScript, o
   fragmento SQL e o predicado Prisma equivalente, **Then** os três produzem o mesmo resultado para
   ontem, hoje e amanhã, para cada status.

---

### User Story 3 — Um contrato descreve todo campo que a API de fato envia, e um gate acusa quando o gerado ficou velho (Priority: P1)

Hoje o gerador de tipos (`packages/api-types`) cobre 5 dos 10 documentos de contrato do produto;
os cinco que faltam (Controles, Conformidade, Auditoria, Ativos, Processos) são consumidos por tipos
escritos à mão no frontend, sem nenhuma verificação de que ainda descrevem o que a API envia. E
mesmo onde o gerador cobre, nada garante que o payload real de uma resposta obedece ao schema —
`openapi:check` compara rotas, não campos.

**Why this priority**: é o item C3 do diagnóstico. Sem isto, uma mudança de campo de resposta em
qualquer um dos cinco domínios não cobertos passa por todo gate verde e quebra o frontend em
produção — exatamente a classe de defeito que F-31 já mostrou acontecer com rotas inteiras.

**Independent Test**: renomear um campo de resposta de qualquer operação implementada e observar o
novo validador de payload falhar; regenerar `packages/api-types` sem commitar a saída e observar o
gate de atualidade falhar.

**Acceptance Scenarios**:

1. **Given** os dez documentos de contrato hoje existentes, **When** `packages/api-types` é gerado,
   **Then** as dez namespaces existem, com um esquema por documento (nenhuma fusão de namespaces
   homônimos com formas diferentes).
2. **Given** o pacote gerado, **When** consumido de fora do workspace, através do artefato
   construído (`dist/`), **Then** a resolução funciona por resolução Node/bundler comum, não apenas
   pelo mapeamento de caminho do TypeScript do monorepo.
3. **Given** uma resposta real de sucesso e uma resposta `application/problem+json` de qualquer
   operação coberta, **When** validadas contra o schema do componente do contrato correspondente,
   **Then** a validação acusa um campo obrigatório ausente, um tipo errado, um valor fora do enum, ou
   uma nulidade não declarada.
4. **Given** o gerador executado contra o estado atual dos dez contratos, **When** a árvore de
   trabalho sob `packages/api-types/src` é comparada ao commitado, **Then** um CI que a encontre suja
   falha — o que não existe hoje.

---

### User Story 4 — Um arquivo de composição é classificado, e uma capacidade GRC não invade a infraestrutura de outra (Priority: P2)

`app.module.ts`, `main.ts`, `permission-catalogue.ts` e todo `*.module.ts` não casam com nenhum dos
14 tipos de elemento que a lint de fronteiras já classifica — a regra nunca é avaliada para eles.
E dentro de `grc/`, uma capacidade pode hoje importar a `infrastructure` ou a `presentation` de
outra, o que nenhuma regra proíbe, embora nenhuma violação real exista ainda.

**Why this priority**: é o item C4 do diagnóstico e o F-25 do backlog. P2 porque, ao contrário das
US1–US3, não corrige um defeito em produção — fecha um ponto cego que o próximo módulo de negócio
(Incidentes) exercitaria primeiro, exatamente como F-22 mostrou acontecer com outro ponto de
extensão.

**Independent Test**: uma importação de um arquivo de composição para qualquer camada de qualquer
área deve ser permitida; uma importação de uma camada classificada para um arquivo que não casa com
nenhum tipo (nem composição, nem camada) deve falhar a lint em vez de passar em silêncio.

**Acceptance Scenarios**:

1. **Given** `risk.module.ts`, **When** importa uma classe concreta de `grc/shared/infrastructure`
   para ligá-la no `providers` do módulo, **Then** a lint permite — é exatamente o trabalho de um
   *composition root*.
2. **Given** um arquivo de `domain` ou `application` dentro de `modules/risk`, **When** importa a
   mesma classe concreta de infraestrutura do núcleo GRC, **Then** a lint recusa.
3. **Given** um módulo de negócio fictício, sem estar em nenhuma lista fixa de nomes conhecidos,
   **When** seu `<nome>.module.ts` importa de qualquer camada de `core/` ou `grc/`, **Then** a regra
   se aplica a ele da mesma forma — a classificação é por padrão de caminho, não por enumeração.
4. **Given** `grc/finding/application/close-finding.usecase.ts`, **When** importa
   `grc/evidence/domain/ports/evidence-link-repository.port.ts`, **Then** a lint continua permitindo
   (domínio↔domínio entre capacidades do núcleo é o desenho aceito).
5. **Given** um arquivo hipotético em `grc/action/infrastructure`, **When** importa uma classe
   concreta de `grc/evidence/infrastructure`, **Then** a lint passa a recusar — hoje passaria.

---

### User Story 5 — Código morto de Controles é removido, e uma leitura de escopo deixa de depender de um JOIN (Priority: P2)

`ControlRegistryPort`/`PrismaControlRegistryRepository` seguem ligados em `RiskModule` sem consumidor
funcional. `findOrgUnitIdUnscoped` existe, byte-idêntico, em dois repositórios de Controles.
`ControlAssessmentRepository.listAssessmentIdsInScope` decide visibilidade de linha por um JOIN até
`control.orgUnitId`, contrariando a regra já ratificada em AGENTS.md de que escopo organizacional
deve estar na própria tabela, nunca só derivável por relação.

**Why this priority**: é o item C5 do diagnóstico. P2 porque não é um vazamento de segurança
confirmado — é dívida estrutural e uma inconsistência com uma regra já escrita.

**Independent Test**: remover a ligação do porte morto e confirmar que o contêiner Nest continua
subindo e que o vínculo de controle continua funcionando; medir `org_unit_id` diretamente em
`control_assessments` sem passar por `control`.

**Acceptance Scenarios**:

1. **Given** `ControlRegistryPort` e sua implementação removidos, **When** a aplicação sobe,
   **Then** nenhum erro de injeção de dependência ocorre, e `LinkControlUseCase` continua
   funcionando através de `ControlDirectoryPort`.
2. **Given** `control_assessments`, **When** consultada para decidir visibilidade por escopo,
   **Then** a consulta lê `org_unit_id` da própria linha, sem JOIN até `controls`.
3. **Given** um controle transferido de unidade organizacional, **When** suas avaliações já
   existentes são lidas, **Then** o `org_unit_id` denormalizado permanece consistente com o do
   controle (mantido em sincronia, não uma cópia que diverge silenciosamente).
4. **Given** o par Controle→Ativo, **When** um ator tenta vinculá-lo a um ativo fora de seu escopo,
   **Then** a recusa é idêntica à de um ativo inexistente — o teste comportamental que o par
   Controle→Processo já tem, hoje ausente para Controle→Ativo.

---

### User Story 6 — Um login deixa um rastro atribuível a alguém (Priority: P1)

Hoje todo evento `session.created` desta plataforma tem `actor_user_id` e `session_id` nulos,
porque o login é uma rota `@Public()` e `SessionGuard` nunca roda nela. `ip_address` e `user_agent`
estão presentes — o contexto da requisição existe — apenas o enriquecimento de identidade nunca
acontece.

**Why this priority**: é o item V2 do diagnóstico, confirmado por medição direta (D-R13) contra
1466 de 1466 linhas reais. P1 porque viola diretamente a Constituição, Princípio IV ("todo evento de
autenticação DEVE produzir registro de auditoria" com ator, quando aplicável) — em uma plataforma
cujo produto é demonstrar auditabilidade.

**Independent Test**: autenticar-se com um usuário real e consultar `audit_event` imediatamente
depois; confirmar `actor_user_id` e `session_id` populados, e que a identidade nunca veio de um
valor fornecido pelo cliente.

**Acceptance Scenarios**:

1. **Given** um login bem-sucedido, **When** o evento `session.created` correspondente é lido,
   **Then** `actor_user_id` e `session_id` estão populados com a identidade resolvida pelo servidor.
2. **Given** a mesma via, **When** a identidade é rastreada até sua origem, **Then** ela vem
   exclusivamente da resolução server-side do login (nunca de um cabeçalho, corpo ou parâmetro
   fornecido pelo cliente).
3. **Given** as 1466 linhas históricas já gravadas sem atribuição, **When** esta correção entra em
   vigor, **Then** nenhuma linha histórica é reescrita — a correção vale a partir do próximo login.

---

### User Story 7 — A suíte E2E e a semeadura verificam o que afirmam verificar (Priority: P2)

**Medido** (research.md D-17 a D-20). A versão original desta seção continha um "pendente de
medição"; a medição chegou e é registrada aqui como fato, não como suposição.

**Correção de um achado já registrado, que precisa ser dita como correção**: F-48 media a suíte
completa consumindo o orçamento de login por contar o total de requisições (~20) como se cada uma
fosse uma tentativa que consome o limitador. **Está errado** — só tentativas que **falham** consomem
qualquer uma das duas dimensões do limitador (`login-throttle.service.ts:139-141` incrementa o
contador de origem só em falha; um sucesso zera o contador de conta,
`prisma-user-directory.repository.ts:129-134`). Medido: uma execução completa do Chromium custa
**8 tentativas falhas e 14 sucessos, 22 requisições no total**, contra um teto de **20 falhas por
300 segundos** — uma execução cabe com folga, duas cabem, a terceira (dentro da mesma janela fixa)
estoura. As oito falhas existem porque o auxiliar sempre tenta primeiro a senha **não rotacionada**
em contas que uma execução anterior já rotacionou.

Separadamente, confirmado nesta rodada: o auxiliar de login ainda colapsa `429`, `500`, erro de rede
e senha genuinamente errada na mesma asserção de texto fixo (F-43, verbatim); o pool estático de doze
contas de worker é a mesma causa raiz de F-16 (corrida) e F-34 (órfãos); a cobertura de navegador é
real apenas para Chromium automático — Firefox e WebKit só rodam sob despacho manual, sem evidência,
dentro do repositório, de que esse despacho já tenha sido executado alguma vez (F-4, reafirmado, não
resolvido); e a ausência de semeadura global do banco de teste de integração está **correta, não é
defeito** — cada spec cria sua própria fixture, e uma semeadura global reintroduziria o mesmo estado
mutável compartilhado que já custou F-16 e F-45 (V3 respondida, D-20).

**Achado estrutural novo, do mesmo tamanho dos itens acima**: os quatro jobs de teste que dependem
de banco (`test-integration`, `test-contract`, `test-e2e`, `test-e2e-cross-browser`) declaram as
mesmas cinco dependências (`lint`, `format-check`, `typecheck`, `test-unit`, `audit`); se qualquer
uma delas fica vermelha, os quatro relatam **pulado**, não **falho** — exatamente como F-33 e F-52
se esconderam, com F-50 como precedente concreto (o portão de auditoria de dependência ficou
vermelho e levou os jobs de teste com ele, silenciosamente).

**Why this priority**: nenhum destes é um defeito de produção — são defeitos da própria verificação.
P2 porque um gate que mente sobre o que cobre (ou que se cala quando deveria gritar) é uma classe de
risco que este projeto já pagou várias vezes (F-3, F-28, F-31, F-33, F-50, F-52), mas nenhum item
aqui é, por si, uma falha de segurança ativa em produção.

**Independent Test**: rodar a suíte completa de E2E do Chromium, nos limites locais reais (conta 5,
origem 20, janela 300), um único worker, `retries: 0`, e observar no máximo duas tentativas falhas
relatadas; derrubar deliberadamente o job `audit` e confirmar que o job de agregação novo falha, em
vez de os quatro jobs a jusante relatarem pulado como se fosse aprovação.

**Acceptance Scenarios**:

1. **Given** uma execução completa da suíte E2E do Chromium contra o orçamento de login **padrão**
   (nunca elevado — CLAUDE.md/AGENTS.md proíbem rebaixar controle de segurança para um teste
   passar), **When** o auxiliar de login tenta primeiro a forma rotacionada da senha e recua para a
   forma simples apenas se necessário, **Then** a execução custa zero tentativas falhas num banco já
   tocado por uma execução anterior, e no máximo uma por conta num banco genuinamente novo.
2. **Given** uma resposta `429`, `500`, erro de rede, ou senha genuinamente errada, **When** o
   auxiliar de login interpreta o resultado, **Then** ele distingue as quatro causas e relata qual
   viu — nunca a mesma asserção de texto fixo para todas.
3. **Given** o pool estático de doze contas de worker, **When** substituído por identidade
   provisionada por execução através da API real de administração, **Then** nenhum worker
   compartilha conta com outro, e um login de bootstrap por execução continua sendo a única semente
   de confiança — sequenciado depois dos dois passos acima, nunca antes (são baratos e valiosos
   independentemente).
4. **Given** `signInAsFixtureUser`/`signInAsSeededUser`, **When** um cenário de concessão, revogação
   ou segregação de funções os chama, **Then** nenhum cache de sessão é aplicado a eles — cachear
   ali esconderia exatamente o comportamento que o cenário existe para provar.
5. **Given** a suíte de Playwright, **When** consultada sobre sua cobertura de navegador, **Then** a
   documentação declara exatamente: Chromium roda automaticamente em todo push/PR; Firefox e WebKit
   rodam apenas sob despacho manual, sem evidência dentro do repositório de que esse despacho já
   tenha sido executado.
6. **Given** o banco de teste de integração, **When** a semeadura (`platform.seed.ts`) roda duas
   vezes em sequência contra um banco descartável, **Then** a segunda execução não falha, não
   duplica linha, e a linha de base de permissão é idêntica às duas vezes — provado, não presumido.
   Nenhuma semeadura global é adicionada ao `global-setup.ts` de integração (D-20).
7. **Given** qualquer um dos cinco jobs upstream de CI (`lint`, `format-check`, `typecheck`,
   `test-unit`, `audit`) falhando, **When** o pipeline termina, **Then** um job de agregação final,
   que roda sempre (`if: always()`) e depende de todo outro job, falha explicitamente — nenhum job a
   jusante pode relatar "pulado" e ser lido como aprovação.
5. **Given** qualquer correção desta frente, **Then** nenhum limite de taxa é elevado, nenhum
   controle é desativado, nenhum IP é forjado como confiável, e nenhuma nova tentativa (`retry`)
   substitui uma correção real — restrição explícita, não implícita.

---

### User Story 8 — Uma instalação do zero funciona, e uma chave de armazenamento não vaza entre escopos (Priority: P1)

**Medido** (research.md D-12/D-20 a D-25). Esta seção continha "pendente de medição"; a medição
chegou.

**A deduplicação de anexos por conteúdo é um oráculo real, e a correção segue em frente.** No nível
do provedor, "conteúdo novo" e "já armazenado" não se sobrepõem em nenhum tamanho testado — uma
única observação já separa os dois. Sobre HTTP real, do ponto de vista genuíno de um atacante, a
diferença é impraticável de explorar em arquivos pequenos (dezenas de milhares a centenas de
milhares de amostras seriam necessárias, o que o próprio limitador de taxa da plataforma impede),
mas fica praticamente explorável perto do teto de 25 MiB — cerca de 39 pares de requisição para três
desvios padrão, confortavelmente dentro do limite de taxa, em menos de um minuto. **A correção
particiona a chave de armazenamento pela unidade organizacional já resolvida no servidor**, sem
reescrever nem apagar nenhuma chave histórica. O residual — o mesmo oráculo **dentro** de uma mesma
unidade organizacional — permanece e é nomeado explicitamente, não escondido: alcançar o ponto de
medição já exige acesso de leitura a alguma entidade daquela unidade, então o residual não atravessa
uma fronteira que já não seja imposta em outro lugar.

**Instalação do zero, medida, não presumida**: F-12 (imagem empacotada sem cliente Prisma) e F-14
(`.env` aninhado empacotado) estão **resolvidos** no HEAD medido — a imagem da API foi construída,
subida contra banco e cache reais, e respondeu `{"status":"ok"}` em seu próprio *readiness check*;
as duas imagens foram buscadas de ponta a ponta sem nenhum `.env` presente. F-13 se divide em duas
metades: a falha de boot documentada nunca ocorre num `docker compose up` real, porque o próprio
`docker-compose.yml` já força `SESSION_COOKIE_SECURE=true`; e a segunda metade ("um navegador
recusaria o cookie `Secure` sobre `http://localhost`) está **medida como falsa para Chromium** — um
motor Chromium real armazenou, reconheceu e limpou o cookie de sessão, do login ao logout, através
do formulário renderizado. **Escopo exato: só Chromium**, nunca Firefox/Safari/Chrome publicado. O
que permanece genuinamente aberto: a stack não tem terminador TLS — nada além de `localhost`
funciona sem um. E os dois comandos de migração Docker do quickstart
(`docker compose exec api pnpm exec prisma migrate deploy`/`db seed`) nunca funcionaram — a imagem
de runtime não embarca `pnpm` nem `prisma` — enquanto a forma no host já está verificada.

**Correção registrada, não achado**: a exigência de copiar `.env.example` para `.env` na raiz **já
está documentada** em dois lugares (`quickstart.md:43`, `docs/local-environment.md`) — não é uma
lacuna desta fase.

**Why this priority**: P1 porque uma instalação que não funciona do zero é uma falha do próprio
requisito de "ambientes reproduzíveis a partir do repositório" (Constituição, Restrições de
Tecnologia e Plataforma), e a deduplicação entre escopos, confirmada pela medição como praticamente
explorável em arquivos grandes, é uma falha de autorização (Constituição, Princípio II/III).

**Independent Test**: a partir de um checkout limpo, seguir apenas os comandos documentados
(corrigidos) até obter uma sessão de navegador Chromium autenticada e um logout que a revoga;
separadamente, confirmar que uma chave de armazenamento antiga continua legível depois da partição.

**Acceptance Scenarios**:

1. **Given** um checkout limpo, **When** os comandos documentados (corrigidos por D-25) são
   seguidos em ordem, **Then** as duas imagens de contêiner sobem, migração e semeadura aplicam, e
   `GET /api/v1/health/ready` responde saudável.
2. **Given** as duas imagens construídas conforme documentado, **When** a stack sobe, **Then** um
   navegador Chromium real autentica, `GET /api/v1/auth/me` reconhece a sessão, e o logout limpa o
   cookie — escopo explícito: Chromium, não os demais navegadores.
3. **Given** um upload de arquivo grande (perto do teto de 25 MiB) cujo conteúdo já existe em outro
   escopo organizacional, **When** o particionamento entra em vigor, **Then** a chave de
   armazenamento é derivada da unidade organizacional resolvida no servidor
   (`parentAccess.organizationalUnitId`), fechando o oráculo **entre** escopos — o residual **dentro**
   de uma mesma unidade é nomeado explicitamente na mudança, não apresentado como fechamento total.
4. **Given** qualquer chave de armazenamento antiga (`sha256/...`), **When** o particionamento entra
   em vigor, **Then** ela permanece legível e nunca é reescrita nem apagada.
5. **Given** `ParentRecordAccess.organizationalUnitId` indefinido, **When** um upload ocorre nesse
   caminho, **Then** ele recebe seu próprio compartimento de chave explícito — nunca cai
   silenciosamente no prefixo legado sem escopo nem no compartimento de outro ator.

---

### User Story 9 — Um seletor de vínculo alcança um registro que não está na primeira página (Priority: P1)

**Encontrado rodando a suíte, não lendo o código** — a prova concreta do argumento que CLAUDE.md
§18.1 já fazia em teoria. A execução completa do Chromium (75 aprovados, 3 falhos, 0 pulados)
reprovou três especificações que passavam isoladamente, e nenhuma leitura de código anterior havia
sinalizado o defeito.

Nove pontos de chamada, em seis módulos de frontend (research.md D-22, com arquivo e linha de cada
um), buscam uma primeira página fixa de controles/ativos/processos/riscos com um termo de busca
**vazio**, uma única vez, quando o seletor abre — e nunca buscam de novo enquanto o usuário digita.
Nenhum deles avisa que a lista mostrada é parcial. Toda API por trás já aceita e já honra um
parâmetro de busca no servidor; a lacuna é inteiramente do frontend.

**Why this priority**: P1 porque, numa instalação real, assim que a biblioteca de controles, o
inventário de ativos ou o catálogo de processos de um cliente passar de 25 registros — uma
biblioteca pequena para este produto — o usuário **não consegue vincular nada fora dos primeiros
25**, sem nenhum sinal na tela de que algo está faltando. É a mesma forma de F-29, generalizada de
uma tela para nove pontos de chamada.

**Independent Test**: com um inventário de mais de 25 controles, abrir o seletor de vínculo de
controle em qualquer um dos módulos afetados, digitar o código de um controle que está além da
página 25, e encontrá-lo.

**Acceptance Scenarios**:

1. **Given** um seletor de vínculo (controle, ativo, processo ou risco) com mais de 25 registros
   elegíveis, **When** o usuário digita parte de um código ou nome, **Then** o seletor busca no
   servidor (com *debounce*) usando o parâmetro que a API já aceita, e o registro aparece mesmo que
   não estivesse na primeira página.
2. **Given** a lista mostrada por um seletor for parcial (mais registros existem do que os
   mostrados), **Then** a interface declara isso explicitamente — nunca um silêncio que parece
   completude.
3. **Given** os nove pontos de chamada hoje divergentes, **When** corrigidos, **Then** todos
   consomem **um único primitivo buscável** de `packages/design-system` — nenhuma implementação
   local por módulo (CLAUDE.md §18.3/§18.12).
4. **Given** as três especificações E2E que falharam nesta execução, **When** corrigidas, **Then**
   elas encontram o registro recém-criado buscando pelo próprio código — nunca presumindo que ele
   está na primeira página, e nunca por um aumento do tamanho de página (proibido explicitamente:
   esconderia o defeito em vez de corrigi-lo).
5. **Given** o primitivo novo, **When** verificado contra o portão do §18.11, **Then** funciona por
   teclado, tem nome acessível, e é verificado renderizado nos dois temas antes de ser considerado
   concluído.

---

### Edge Cases

- **Ação de tratamento sem `treatmentDecisionId`**: continua legítima — o vínculo com a decisão de
  tratamento é opcional desde antes desta fase (D-R1).
- **Ação criada por `/actions` sem nunca ganhar linha de vínculo**: permanece assim — o vínculo só é
  criado quando a origem é a tela de Riscos ou quando `treatmentDecisionId` é definido (D-R2).
- **Um `ControlAssessment` cujo controle já mudou de unidade organizacional antes desta fase**: o
  backfill do `org_unit_id` denormalizado usa a unidade **atual** do controle, no momento do
  backfill — não uma reconstrução histórica de qual era a unidade no momento da avaliação.
- **Um contrato sem corpo de resposta (ex.: `204`) ou download binário**: explicitamente fora do
  escopo do novo validador de payload (US3) — listado, não silenciosamente ignorado.
- **Um arquivo que não casa com nenhum tipo de elemento de fronteira, incluindo o novo tipo de
  composição**: passa a falhar `boundaries/no-unknown-files`, em vez de ser ignorado pela lint.

---

## Requirements *(mandatory)*

### Funcionais — convergência de Ação (US1)

- **FR-001**: `Action` (núcleo GRC, `grc/action`) DEVE ser a única autoridade de escrita para
  título, descrição, responsável, prazo, status, conclusão e reabertura de uma ação de tratamento de
  risco. Nenhuma outra tabela armazena esses campos depois da migração.
- **FR-002**: `risk_treatment_actions` DEVE sobreviver como tabela de ligação explícita, mantendo
  toda linha e todo `id` existentes, com exatamente as colunas `id`, `risk_id`,
  `treatment_decision_id` (anulável), `action_id` (não nulo, único), `created_at`, `updated_at`.
- **FR-003**: A identidade exposta pelas rotas `GET/POST /risks/{riskId}/treatment-actions` e
  `PATCH /risks/{riskId}/treatment-actions/{actionId}` DEVE ser `Action.id`. A listagem por essa
  origem DEVE incluir toda `Action` cuja origem seja aquele risco, com ou sem linha de vínculo.
- **FR-004**: Toda transição de status de uma ação DEVE passar pela mesma validação de legalidade e
  pela mesma exigência de motivo de reabertura, **em toda rota de produção**, incluindo a rota de
  Riscos. As transições hoje aceitas pela rota de Riscos e recusadas por `Action` DEVEM passar a ser
  recusadas com `422`.
- **FR-005**: A autorização da rota de Riscos sobre uma ação de tratamento DEVE continuar exigindo
  `risk:view`/`risk:treat`, resolvidos contra o escopo organizacional **atual** da origem (o risco).
  A autorização de `/actions` DEVE continuar exigindo `action:view|create|edit`, independentemente
  da rota de Riscos.
- **FR-006**: Criar uma ação de tratamento pela rota de Riscos DEVE gravar dois eventos de auditoria
  distintos (`risk.treatment_action_created` e `action.created`), refletindo as duas linhas
  efetivamente escritas. Uma mudança de status ou de campo pela rota de Riscos DEVE gravar **apenas**
  o evento `action.*` correspondente — não o par duplicado que existe hoje.
- **FR-007**: `GET /risks/{riskId}/history` (`risk-history.service.ts`) lê hoje, verificado nas
  linhas 314 e 336, apenas `entity_type = 'RISK'` e `entity_type = 'RISK_ASSESSMENT'` — **nunca**
  incluiu eventos de ação de tratamento. Esta fase DEVE deixar este endpoint **inalterado**; incluir
  eventos `action.*`/`RISK_TREATMENT_ACTION` nele seria comportamento novo, não remediação, e fica
  registrado como pergunta de produto em aberto na cauda de `matrix.md`, não como parte desta
  correção.
- **FR-007a**: Toda linha de `audit_event` com `entity_type = 'RISK_TREATMENT_ACTION'` já gravada
  DEVE permanecer legível e resolvível pelo `entity_id` que ela referencia (Constituição, Princípio
  XV — nunca alterar retroativamente o significado de um dado de auditoria já registrado). Verificado
  que nenhum código em `apps/api/src` ou `apps/web/src` lê essas linhas para exibição hoje — a razão
  de preservá-las é a garantia constitucional, não a existência de um consumidor vivo, e deve ser
  registrada dessa forma para que um leitor futuro não as apague sob o argumento de que "ninguém as
  lê".
- **FR-008**: A migração DEVE ser aditiva-depois-destrutiva, nesta ordem: backfill de uma `Action`
  para toda linha ainda sem `action_id`; verificação de zero nulos, unicidade e igualdade de campo a
  campo entre cada linha e sua ação; só então `NOT NULL`/`UNIQUE` em `action_id` e remoção das seis
  colunas substituídas. As consultas de verificação DEVEM estar registradas no comentário da própria
  migração e em `data-model.md`.
- **FR-009**: `prisma/seed/performance.seed.ts` DEVE passar a criar a `Action` correspondente para
  toda `RiskTreatmentAction` que semear, em vez de escrever só a tabela legada por `createMany`.

### Funcionais — vencimento único (US2)

- **FR-010**: DEVE existir exatamente uma implementação de "hoje, em data, sem hora, UTC"
  (`todayDateOnlyUtc`), em `grc/shared/domain/overdue.service.ts`, consumida por toda outra
  localização que hoje a duplica.
- **FR-011**: DEVE existir exatamente um predicado TypeScript de atraso para ação
  (`isActionOverdue(dueOn, status, referenceDate)`, com data de referência obrigatória, sem valor
  padrão) e exatamente um construtor de predicado SQL equivalente, usados por toda consulta que hoje
  calcula atraso de ação (a coluna e o filtro de `risk-query.service.ts`, e as duas consultas de
  `dashboard-query.service.ts`).
- **FR-012**: `isOverdueTreatmentAction` DEVE ser removido junto com as colunas que ele lia.
  `isOverdueReview` (regra distinta, de revisão de risco) permanece, mas perde seu valor padrão de
  data de referência.
- **FR-013**: DEVE existir teste de equivalência entre a forma TypeScript, a forma SQL e a forma
  Prisma-where do predicado de atraso de ação, cobrindo ontem/hoje/amanhã para cada status.

### Funcionais — contratos e tipos (US3)

- **FR-014**: `packages/api-types` DEVE gerar tipos a partir dos dez documentos de contrato
  existentes, um namespace por documento, sem fusão de esquemas homônimos com formas diferentes.
- **FR-015**: DEVE existir um portão de CI que regenera o pacote e falha se a árvore de trabalho sob
  `packages/api-types/src` ficar suja — o que não existe hoje.
- **FR-016**: O pacote DEVE ser comprovadamente resolvível através de seu artefato **construído**
  (`dist/`), não apenas pelo mapeamento de caminho do TypeScript do monorepo.
- **FR-017**: DEVE existir um validador real de payload contra esquema, cobrindo resposta de sucesso
  e `application/problem+json`, campo obrigatório versus opcional, enum e nulidade, para toda
  operação implementada que tenha corpo — com a lista explícita do que fica de fora (sem corpo,
  download binário) documentada, não omitida.
- **FR-017a** *(pré-requisito bloqueante do FR-017, não faxina posterior)*: `grc-foundation.openapi.yaml`
  DEVE ter seus quinze usos de `nullable: true` (sintaxe OpenAPI 3.0) normalizados para
  `type: [x, 'null']` (sintaxe 3.1, já usada nos outros nove contratos), **antes** do validador de
  FR-017 ser aplicado a esse documento — do contrário o validador recusaria payloads legítimos que
  hoje enviam `null` em campos como `Action.completedAt`/`reopenedAt`/`description`,
  `Finding.closedAt` e `Evidence.archivedAt` (research.md D-21). Critério de aceitação próprio:
  regenerar os tipos depois da correção produz **zero diff** em
  `packages/api-types/src/generated/grcfoundation.ts`.

### Funcionais — fronteiras de composição e do núcleo GRC (US4)

- **FR-018**: DEVE existir um tipo de elemento de fronteira `composition`, cobrindo `app.module.ts`,
  `main.ts`, `permission-catalogue.ts` e todo `*.module.ts` de `core/`, `grc/` e `modules/` — incluindo
  submódulos como `control-directory.module.ts`. Um arquivo de composição PODE importar qualquer
  camada de qualquer área.
- **FR-019**: `boundaries/no-unknown-files` DEVE estar habilitado, de modo que um arquivo que não
  case com nenhum tipo classificado falhe a lint em vez de ser ignorado.
- **FR-020**: A importação `modules/* -> grc/*` para arquivos que **não** sejam de composição DEVE
  ficar restrita a `domain` e `application` do lado `grc`.
- **FR-021**: Duas capacidades de `grc/` PODEM importar a `domain` e a `application` uma da outra
  (são um núcleo compartilhado), mas NÃO PODEM importar a `infrastructure` ou a `presentation` uma
  da outra.

### Funcionais — saneamento de Controles (US5)

- **FR-022**: `ControlRegistryPort`, `PrismaControlRegistryRepository` e sua ligação em
  `risk.module.ts` DEVEM ser removidos, com prova de que o contêiner Nest continua subindo e de que
  o caminho de vínculo de controle continua funcionando.
- **FR-023**: `findOrgUnitIdUnscoped`, hoje byte-idêntico em dois repositórios de Controles, DEVE
  ser consolidado em `ControlScopedRepository`. `ControlLookupPort` NÃO DEVE ser fundido em
  `ControlRepositoryPort` — permanecem portes distintos.
- **FR-024**: `control_assessments` DEVE ganhar `org_unit_id` aditivo, preenchido por backfill a
  partir do controle e mantido em sincronia com a unidade do controle. A decisão de visibilidade por
  escopo DEVE passar a ler essa coluna, nunca um JOIN até `controls`.
- **FR-025**: DEVE existir o teste comportamental de recusa fora de escopo para Controle→Ativo,
  simétrico ao que já existe para Controle→Processo.

### Funcionais — atribuição de auditoria na autenticação (US6)

- **FR-026**: O evento `session.created` de um login bem-sucedido DEVE carregar `actor_user_id` e
  `session_id` reais, resolvidos pelo servidor a partir da identidade autenticada — nunca de um
  valor fornecido pelo cliente.
- **FR-027**: Nenhuma linha histórica de `session.created` já gravada sem atribuição PODE ser
  reescrita.
- **FR-028**: A decisão sobre `session.expired` (se recebe o mesmo tratamento) DEVE ser tomada
  explicitamente nesta fase e registrada em `research.md` — não herdada por omissão.

### Funcionais — documentação e reclassificação de achados

- **FR-029**: `docs/deferred-findings.md` DEVE ganhar, para F-18, a correção de escopo registrada em
  D-R14: o achado não reproduz como ausência de `null` no corpo (os mapeadores já emitem `null`
  explícito) — o achado remanescente é que os arrays obrigatórios do contrato subdeclaram uma
  garantia que a implementação já entrega.
- **FR-030**: F-40 DEVE ser marcado como resolvido nos dois arquivos consumidores que hoje o
  corrigem, com a data de fechamento.
- **FR-031**: `docs/deferred-findings.md` DEVE registrar, para cada um dos 52 achados, o veredito
  desta fase (reproduz / não reproduz / resolvido / aceito como custo / capacidade futura), com a
  evidência que sustenta o veredito — consolidado em `matrix.md`, não disperso.
- **FR-031a** *(D-26, achado novo — script, não só frase)*: `pnpm test` na raiz hoje **não** roda os
  532 testes do `apps/web` (o pacote não tem script `test`, só `test:unit`) e o `pnpm test` de
  `apps/api` roda a configuração `vitest.config.ts` **padrão**, cujo `include` varre também os
  specs de integração e contrato **sem** `globalSetup` (migração/reset de banco) nem
  `fileParallelism: false`/`singleFork` — exatamente a corrida que `vitest.integration.config.ts` e
  `vitest.contract.config.ts` existem para evitar, e que o próprio cabeçalho de
  `vitest.integration.config.ts` já descreve a configuração padrão como sendo apenas para "unit
  tests — domínio puro, sem I/O, sem banco". A CI nunca roda `pnpm test`; roda os quatro jobs
  dedicados. Correção: estreitar o `include` de `apps/api/vitest.config.ts` para
  `test/unit/**/*.spec.ts`/`src/**/*.spec.ts`; acrescentar `"test": "vitest run"` a
  `apps/web/package.json`; trocar `specs/001-grc-platform-foundation/quickstart.md:483-484`
  (`pnpm test`) pelos quatro comandos que a CI de fato roda, já listados individualmente acima
  naquele mesmo arquivo. Confirmar antes que nenhum quickstart usa
  `pnpm --filter @vertice/api run test -- <padrão>` mirando um spec **fora** de `test/unit` (005 e
  006 usam essa forma; seus alvos precisam continuar funcionando).
- **FR-031b** *(D-27, corrige uma correção anterior)*: `apps/api/package.json` só tem um script de
  migração, `db:migrate` = `prisma migrate dev`. O próprio cabeçalho de `schema.prisma:57-72` proíbe
  rodar `migrate dev` contra banco real, porque seu diff de sombra não entende o particionamento
  manual de `audit_event` e pode propor apagá-lo e recriá-lo. Os quickstarts de 002, 003 e 005 citam
  um script inexistente (`db:migrate:dev`, F-51); a correção anterior do quickstart de 006 trocou
  para `db:migrate`, que existe mas é a forma errada. **Os quatro** migram para
  `pnpm --filter @vertice/api exec prisma migrate deploy` — a forma que o quickstart 001 já usa e
  que esta sessão verificou funcionando contra o banco do Compose.
- **FR-031c** *(D-28, correção factual, não reescrita histórica)*: `docs/architecture/grc-roadmap.md`
  ainda descreve as Fases 2-5 no futuro, e sua seção de fechamento ainda recomenda Controles como
  próximo módulo — as quatro já foram entregues. `docs/architecture.md` tem três afirmações
  factualmente erradas: sua tabela-resumo diz que `risk` é o único módulo de negócio quando seis
  existem; sua lista de capacidades do núcleo contradiz a própria seção "known gaps" mais adiante no
  mesmo documento (que é a correta); e seu exemplo de "adicionar o módulo número dois" hoje seria o
  módulo número sete. Correção por **adendo datado**, no mesmo padrão já usado no próprio
  `grc-roadmap.md` ("reverificado em 2026-09-07") e em ADR-020/F-37/F-12/F-13/F-14 — o texto original
  permanece, marcado superado, nunca apagado. O exemplo de `architecture.md` é reformulado em torno
  de um módulo que foi de fato construído, não uma renumeração de um hipotético.
- **FR-031d** *(D-29, defeito de registro, não de trabalho)*: `specs/002-shared-grc-foundation`,
  `003-controls-management` e `004-compliance-management` mostram 85/85, 60/60 e 71/71 tarefas
  **desmarcadas**, sem nenhuma nota explicando por quê, enquanto CLAUDE.md §17 lista as três como
  concluídas com seus commits. Treze amostras entre esses arquivos foram conferidas contra o código
  e todas as treze estavam feitas-mas-não-marcadas; nenhuma na direção contrária. Reconciliar as
  caixas de marcação na mesma passagem que cita o commit de fechamento de cada fase, com uma linha
  datada no topo de cada arquivo dizendo quando e contra o quê a reconciliação foi feita — para que
  o próximo leitor distinga um "não marcado" real de um clerical. Nenhuma caixa é marcada por
  inferência: cada uma precisa do arquivo ou commit que a comprova. Uma ambiguidade genuína, a
  resolver e não presumir: o T071 de 004 pedia um relatório sobre onde `ControlEffectivenessPort`
  não se encaixava; o porte existe e está ligado, e nenhuma nota foi registrada em nenhuma direção —
  decidir se "encaixou em todo lugar, nada a relatar" é a resposta, e registrar isso explicitamente,
  do jeito que o T058 irmão de 003 já fez.

### Funcionais — painel (achado novo desta fase, não do backlog original)

- **FR-025a**: O painel GRC hoje anuncia `CONTROLS` como área planejada
  (`core/dashboard/domain/default-planned-areas.ts`), embora o módulo de Controles esteja em
  produção desde a Fase 2 (commit `9912968`) — uma mensagem falsa dizendo ao usuário que uma
  capacidade que já existe ainda não foi construída. Esta fase DEVE remover `CONTROLS` do registro
  padrão de áreas planejadas e atualizar `get-dashboard-planned-areas.spec.ts`, que hoje fixa o
  conjunto errado como esperado. Cartões reais do painel para Controles, Conformidade, Auditoria,
  Ativos e Processos são trabalho da Fase 7 do roadmap (Indicadores e Relatórios) — **não** desta
  correção, que apenas para de anunciar como planejado o que já foi entregue.

### Funcionais — documentação, item C7

- **FR-025b**: O repositório não possui `README.md` na raiz — confirmado ausente no HEAD medido;
  `docs/README.md` existe e está atual. Esta fase DEVE criar o ponto de entrada raiz que C7 pede
  como índice navegável, apontando para `docs/README.md` e para os specs ativos, sem duplicar
  conteúdo que já existe em `docs/`.

### Funcionais — verificação de teste e CI (US7) — medido (research.md D-17 a D-20)

- **FR-025c**: O auxiliar de login E2E DEVE distinguir, na sua própria lógica, um limite de
  frequência (`429`), uma credencial errada e uma falha de backend — nunca tratar as três como o
  mesmo caso de falha (F-43, D-17 passo 2).
- **FR-025d**: a suíte E2E completa DEVE ser executável do início ao fim contra o orçamento de login
  **padrão** (conta 5, origem 20, janela 300 — nunca elevado, nenhum controle desativado, nenhum IP
  forjado). A correção, medida (D-17), é em cinco passos nesta ordem: (1) tentar a senha rotacionada
  primeiro, com recuo para a simples; (2) diagnosticar 429/500/rede/senha errada separadamente; (3)
  aposentar o pool estático de doze contas a favor de identidade provisionada por execução via API
  real; (4) nunca cachear sessão para `signInAsFixtureUser`/`signInAsSeededUser`; (5) isolar
  `auth.spec.ts` em janela de contador própria. Critério: execução completa, um worker, `retries:0`,
  no máximo duas tentativas falhas medidas e relatadas.
- **FR-025e**: A documentação do projeto DEVE declarar explicitamente que Chromium roda
  automaticamente em CI e que Firefox/WebKit rodam sob despacho manual, **sem evidência dentro do
  repositório de que esse despacho já tenha sido executado alguma vez** — nunca implicar cobertura de
  três navegadores pela sola existência de três projetos configurados (F-4, D-19).
- **FR-025f**: a idempotência da semeadura de teste de integração, sua linha de base de permissão e
  sua invalidação de cache DEVEM ser comprovadas por execução repetida contra um banco descartável.
  **A ausência de semeadura global do banco de teste está CORRETA, não é defeito** (D-20) — uma
  semeadura global reintroduziria o estado mutável compartilhado que já custou F-16/F-45; nenhuma
  semeadura global é adicionada.
- **FR-025q** *(achado estrutural novo, D-18/F-64)*: os quatro jobs de CI que dependem de banco
  (`test-integration`, `test-contract`, `test-e2e`, `test-e2e-cross-browser`) hoje relatam "pulado"
  quando qualquer um dos cinco jobs upstream (`lint`, `format-check`, `typecheck`, `test-unit`,
  `audit`) falha — o que já escondeu F-33 e F-52 e tem F-50 como precedente concreto. DEVE existir um
  job de agregação final, `if: always()`, dependente de todo outro job, que falha quando qualquer um
  não é `success` — pulado incluído.

### Funcionais — instalação e armazenamento (US8) — medido (research.md D-12, D-20 a D-25)

- **FR-025g**: os dois comandos de migração Docker do quickstart de `001-grc-platform-foundation`
  (linhas 91-92, `docker compose exec api pnpm exec prisma migrate deploy`/`db seed`) DEVEM ser
  corrigidos para a forma verificada no host
  (`pnpm --filter ./apps/api exec prisma migrate deploy`/`db seed`), com uma nota dizendo qual
  comando serve para uma instalação (`migrate deploy`) e qual para autorar uma migração nova
  (`migrate dev`) — provado, não inferido (D-25, irmão de F-51).
- **FR-025h**: O cookie de sessão emitido pela stack documentada DEVE ser aceito e devolvido por um
  navegador real — medido: Chromium real armazena, reconhece e limpa o cookie `Secure` sobre
  `http://localhost`, do login ao logout. O escopo desta garantia é explicitamente Chromium; a
  ausência de terminador TLS permanece genuinamente aberta para qualquer origem que não seja
  `localhost` (D-24).
- **FR-025i**: A chave de armazenamento de anexo DEVE ser particionada pela unidade organizacional já
  resolvida no servidor (`parentAccess.organizationalUnitId`, em `UploadService.execute`) — medido
  como praticamente explorável perto do teto de 25 MiB (~39 pares de requisição para três desvios
  padrão, dentro do limite de taxa da plataforma). O residual **dentro** de uma mesma unidade
  organizacional permanece e DEVE ser nomeado explicitamente na mudança, não apresentado como
  fechamento total (D-20).
- **FR-025j**: Nenhuma chave de armazenamento existente (`sha256/...`) PODE ser reescrita ou apagada
  pelo particionamento; um escopo indefinido (`organizationalUnitId: undefined`) DEVE receber seu
  próprio compartimento explícito, nunca cair no prefixo legado sem escopo nem no compartimento de
  outro ator.
- **FR-025p**: `docs/deferred-findings.md` DEVE marcar F-12 e F-14 como resolvidos (D-23), e F-13
  DEVE ser dividido em sua metade fechada (boot, pelo próprio Compose) e sua metade medida-falsa
  para Chromium, preservando a ausência de TLS como genuinamente aberta (D-24) — correção da Frente
  G, texto original preservado.

### Funcionais — seletores de vínculo buscáveis (US9, achado novo, D-22)

- **FR-025k**: DEVE existir um único primitivo buscável no Design System (`packages/design-system`),
  que busca no servidor conforme o usuário digita (com *debounce*), usando o parâmetro de busca que
  cada API já aceita.
- **FR-025l**: Os nove pontos de chamada hoje divergentes DEVEM migrar para esse primitivo único —
  `risk-controls-section.tsx` (3 usos), `control-links-section.tsx` (2 usos),
  `requirement-controls-section.tsx`, `audit-scope-control-picker.tsx`, e `finding-links-section.tsx`
  (2 usos, controle e risco). Nenhuma implementação local de busca por módulo.
- **FR-025m**: Quando a lista mostrada por um seletor for parcial, a interface DEVE declarar isso
  explicitamente ao usuário — nunca um silêncio que sugere completude.
- **FR-025n**: Aumentar o tamanho de página padrão de qualquer listagem **NÃO PODE** ser usado como
  correção para este achado — esconderia o defeito de produto em vez de corrigi-lo, e falharia de
  novo assim que o inventário crescesse além do novo tamanho.
- **FR-025o**: As três especificações E2E que falharam nesta execução
  (`assets-processes.spec.ts:296,302`, `risk-treatment.spec.ts:78`) DEVEM ser corrigidas para
  localizar o registro recém-criado buscando pelo seu próprio código, nunca presumindo que ele está
  na primeira página.

### Funcionais — interface

- **FR-032**: Toda string nova voltada ao usuário introduzida por esta fase DEVE entrar nos
  catálogos centralizados (`apps/web/src/lib/messages/`, `apps/api/src/shared/messages/user-messages.ts`),
  em pt-BR, nunca embutida em componente (§11.1). Esta fase é majoritariamente backend e
  infraestrutura de teste; onde tocar interface (por exemplo, uma mensagem de erro nova de
  transição ilegal de ação), a regra se aplica sem exceção.

### Key Entities

- **Action** (`grc/action`, existente): passa a ser a única autoridade de escrita para todo campo de
  trabalho de uma ação de tratamento de risco.
- **RiskTreatmentAction** (existente, forma reduzida): tabela de ligação, sobrevive apenas com
  `id`, `risk_id`, `treatment_decision_id`, `action_id`, `created_at`, `updated_at`.
- **ControlAssessment** (existente): ganha `org_unit_id` aditivo.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nenhuma transição de ação aceita pela rota de Riscos é recusada por
  `POST /actions/{id}/transitions`, e vice-versa — verificado pelo mesmo teste de tabela de
  legalidade, executado contra as duas rotas.
- **SC-002**: As três `Action` com `originType=RISK_TREATMENT` sem linha de vínculo, hoje invisíveis
  a toda tela de Riscos, aparecem na listagem de tratamento do risco correspondente.
- **SC-002a — mudança de comportamento esperada, registrada para que ninguém a relate como
  regressão**: hoje o indicador de ações de tratamento do painel lê `risk_treatment_actions` e
  reporta `{total: 73, open: 73, overdue: 37}`, enquanto `actions` já contém 37 linhas. Depois da
  convergência, a bandeira do registro e o indicador do painel passam a ler `actions` por origem, e
  **os números vão mudar** — inclusive passando a contar as três ações de origem `RISK_TREATMENT`
  que hoje nenhuma tela de Riscos enxerga. Essa mudança de número **é a correção**, não um defeito
  introduzido por ela; qualquer verificação futura que compare contagens antes/depois deve esperar a
  diferença e não tratá-la como sinal de erro.
- **SC-003**: Um predicado de atraso de ação alterado em um único ponto do código muda o resultado
  da listagem de riscos, do painel e de uma consulta SQL direta, simultaneamente — verificado por um
  teste que altera a implementação e observa as três superfícies concordarem.
- **SC-004**: As dez namespaces de `packages/api-types` existem, e o pacote resolve por resolução
  Node/bundler comum contra seu artefato construído, não apenas pelo mapeamento de caminho do
  TypeScript.
- **SC-005**: Renomear um campo de resposta de qualquer operação coberta faz o novo validador de
  payload falhar. Hoje, a mesma mudança passa por `openapi:check` e por `contract-coverage.spec.ts`
  sem ser detectada.
- **SC-006**: Uma importação de `modules/<qualquer-nome-não-listado>/domain` para
  `grc/<qualquer-capacidade>/infrastructure` falha a lint. Hoje passaria — nenhuma regra a proíbe.
- **SC-007**: O contêiner Nest sobe sem `ControlRegistryPort` ligado, e o teste de vínculo de
  Controle→Ativo fora de escopo, hoje ausente, existe e falha contra o código antes da correção.
- **SC-008**: Um login real, executado pelo coordenador, produz uma linha `session.created` com
  `actor_user_id` e `session_id` populados — reprodução exata do cenário que hoje falha (D-R13).
- **SC-009** *(reescrito — uma contagem de teste não é meta; ver nota abaixo)*: para toda guarda de
  segurança ou estrutural nova ou alterada por esta fase, existe um teste que **falha** quando a
  guarantia correspondente é removida do código e **passa** quando ela está presente — provado nos
  dois sentidos, não apenas no sentido em que passa hoje. Nenhum teste é enfraquecido, pulado ou
  removido, exceto onde o comportamento que ele protegia foi deliberadamente alterado por um FR
  nomeado desta especificação — e cada alteração assim cita esse FR explicitamente. O relatório final
  de cada suíte (`STATE.md`) distingue testes executados, falhos e pulados — nunca apenas um total.
  As contagens da linha de base medida (`API unit 490 · contrato 648 · integração 168 · web unit
  532`) permanecem registradas em `STATE.md` como **registro do que rodava**, explicitamente **não**
  como meta a bater — um total que sobe não prova nada por si (a lição de F-28: "0 violações"
  media uma tela cujos gráficos ainda não existiam), e esta fase legitimamente **remove** testes
  junto com o espelho de escrita que ela aposenta (D-3).
- **SC-010**: `pnpm run lint`, `pnpm run typecheck` e `pnpm run format:check` permanecem limpos ao
  final da fase.
- **SC-011** *(US7, medido)*: uma execução completa do Chromium, um worker, `retries:0`, nos limites
  reais (conta 5, origem 20, janela 300), termina com no máximo duas tentativas de login falhas
  medidas e relatadas — contra as 8 falhas/22 requisições que a execução sem correção produz (D-17).
  Um job de agregação de CI falha quando qualquer job upstream falha ou é pulado (FR-025q).
- **SC-012** *(US8, medido)*: uma instalação a partir de um checkout limpo, seguindo os comandos
  documentados corrigidos (FR-025g), produz um login e um logout Chromium reais, e a chave de
  armazenamento de um upload próximo do teto de 25 MiB é particionada por unidade organizacional —
  com o residual dentro da mesma unidade nomeado explicitamente, nunca apresentado como fechamento
  total (FR-025i).
- **SC-013** *(US9)*: contra o banco de desenvolvimento como está (57 controles, 26 ativos numa
  unidade), as três jornadas que falharam na execução completa do Chromium passam, e um teste prova
  que um seletor alcança uma entrada que não está na primeira página — sem qualquer aumento de
  tamanho de página.
- **SC-014** *(pré-requisito do validador de payload)*: regenerar `packages/api-types` depois da
  normalização de `nullable` em `grc-foundation.openapi.yaml` (FR-017a) produz zero diff no arquivo
  gerado — prova de que a correção mudou o contrato para um validador estrito sem mudar nada que um
  consumidor já via.

---

## Out of Scope

- Qualquer novo módulo de negócio (Incidentes, Problemas, Indicadores, Relatórios) — esta fase é
  convergência do que já existe, não avanço de roadmap (CLAUDE.md §17).
- A relação Processo↔Ativo, adiada explicitamente em `specs/006-assets-processes/research.md` D-10.
- Multi-instituição, prova criptográfica de integridade de auditoria, novos provedores de
  identidade, IA/MCP — capacidades futuras, não dívida (`docs/history/implementation-debt-review.md` §5).
- Reescrita de qualquer linha histórica de auditoria, de sessão, ou de `RiskTreatmentAction` além do
  que a migração de FR-008 descreve.
- Cartões reais do painel para Controles, Conformidade, Auditoria, Ativos e Processos — Fase 7 do
  roadmap (Indicadores e Relatórios), não desta correção (research.md D-15).
- F-9 (granularidade de `assessedOn`), F-15 (fixtures que impedem o cenário de SoD), F-17 (Radix
  Select no Firefox), F-27 (comentário que alega um teste inexistente), F-29 (locator sensível a
  volume de dados), F-32 (descrições de papel em inglês) e F-23 item 3 (catálogo pt-BR sem extensão
  por módulo) — achados reais, triados individualmente em `matrix.md`, mas cada um fora das sete
  frentes desta fase (nenhum é C1-C7 nem V1-V6); permanecem no backlog com seu dono já registrado.

**Retificação em relação a uma versão anterior desta seção**: `docker/api.Dockerfile` (F-12), TLS do
Compose (F-13/V4) e `.dockerignore` (F-14) **não** estão fora de escopo — são o objeto da User
Story 8 (Frente F), porque uma instalação reproduzível do zero, com login e logout reais por
navegador, é entregável desta fase. Do mesmo modo, a medição de V1/F-26 é entregável (User Story 8);
o que permanece condicional é apenas a **correção de particionamento**, que só é tarefa desta fase se
a medição confirmar que a diferença de tempo é observável — decisão registrada em `matrix.md` com a
evidência, não presumida neste documento.

---

## Assumptions

- **A-1**: `docs/history/implementation-debt-review.md` e `docs/deferred-findings.md`
  permanecem como estão — esta fase os referencia e os corrige pontualmente (matrix.md, F-18, F-40),
  nunca os reescreve por inteiro.
- **A-2**: Não existem consumidores externos da API (produto de instalação única, v1) — mudanças de
  contrato desta fase (identidade `Action.id` nas rotas de tratamento, novos códigos de status) são
  mudanças de contrato documentadas, não quebras retroativas de cliente externo.
- **A-3**: O ambiente de desenvolvimento local (processo de API em produção segurando a DLL do
  Prisma, `next start` servindo `.next`) é um impedimento ambiental documentado no baseline, não algo
  que esta especificação resolve.
