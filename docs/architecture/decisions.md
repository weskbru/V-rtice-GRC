# PharosGRC — Decisões Arquiteturais (ADR-016 em diante)

> ADR-001 a ADR-015 vivem em `specs/001-grc-platform-foundation/research.md` e permanecem
> válidas. Aquela especificação é registro histórico da Fundação; decisões arquiteturais
> posteriores vivem aqui.
>
> ADR-016 a ADR-020 foram **aceitas** em 2026-09-07, após revisão do portão arquitetural.
> Aceitação define o alvo e as regras. **Nenhuma delas autoriza, por si, implementar módulo,
> alterar schema, criar migração ou mudar contrato REST** — cada implementação depende de
> especificação própria (CLAUDE.md §16).
>
> ADR-021 foi **aceita** em 2026-09-13, durante `specs/015-roles-permissions-surface`, e é de
> natureza diferente das cinco anteriores: ela não define um alvo a construir, define uma
> **fronteira a não atravessar**. Pela mesma regra acima, ela também não autoriza, por si, nenhuma
> implementação.
>
> ADR-022 foi **aceita** em 2026-09-14, na mesma especificação, e é da mesma natureza de ADR-021:
> separa um rótulo de apresentação (o nome pt-BR de um papel) do identificador que o sustenta
> (`Role.name`), e proíbe que o primeiro adquira autoridade sobre o segundo.
>
> ADR-023 e ADR-024 foram **aceitas** em 2026-09-14, registradas durante este trabalho de
> documentação para formalizar duas decisões que já estavam implementadas e guardadas por lint/teste
> no código, mas nunca tinham sido escritas como ADR: a abstração de navegação do frontend
> (`specs/014-institutional-loader/`) e a geração de `packages/api-types` a partir dos contratos
> hand-authored, não do documento OpenAPI refletido (`docs/local-environment.md` D-14). Nenhuma das
> duas introduz mudança de comportamento — cada uma descreve código já em produção.

## Índice de decisões

Status verificado contra o código em 2026-09-14. **Vigente** = a decisão descreve o comportamento
real hoje. **Substituída parcialmente** = parte do texto original não corresponde mais ao código,
mas o núcleo da decisão permanece — a nota diz o quê e por quê. Nenhuma ADR listada abaixo foi
**Substituída** por completo.

| ADR | Título | Local | Status |
|---|---|---|---|
| ADR-001 | Provider-agnostic authentication | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-002 | Server-side opaque sessions, not JWT | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-003 | RBAC com permissões `resource:action` e um único caminho de decisão | `specs/001-grc-platform-foundation/research.md` | Vigente — nota: as permissões `risk:*` foram realocadas de `core/authorization` para `modules/risk/domain/risk-permissions.ts` (007-implementation-remediation, "A3 remediation") para respeitar ADR-011; o mecanismo de `resource:action` e o caminho único de decisão (`PermissionGuard`) não mudaram |
| ADR-004 | Escopo organizacional por caminho materializado, aplicado no repositório | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-005 | Auditoria transacional, append-only | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-006 | Cálculo de risco e ciclo de vida pertencem ao domínio | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-007 | Dado histórico como registro de domínio append-only | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-008 | Modelagem relacional explícita; enum para conjunto fechado, tabela para configurável | `specs/001-grc-platform-foundation/research.md` | Vigente — estendida por ADR-020 (padrão de relacionamento entre módulos) |
| ADR-009 | Contratos REST — versionados, limitados por DTO, problem+json, paginação por offset | `specs/001-grc-platform-foundation/research.md` | Vigente com ressalva — o texto original descreve `packages/api-types` gerado do documento OpenAPI refletido; isso não corresponde ao código (ver ADR-024 abaixo, que registra a decisão real e por quê) |
| ADR-010 | Armazenamento de arquivo atrás de porta; anexo servido só por autorização | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-011 | Limites de módulo aplicados por ferramenta (lint) | `specs/001-grc-platform-foundation/research.md` | Vigente — estendida por ADR-016 (regras `grc/`) e ADR-020 (padrão de relacionamento entre módulos) |
| ADR-012 | Observabilidade separada de auditoria | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-013 | Concorrência otimista em riscos | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-014 | Origem única — Next.js faz proxy da API | `specs/001-grc-platform-foundation/research.md` | Vigente com ressalva — o texto original nomeia TanStack Query como biblioteca de client-fetching; o código usa um wrapper `fetch` escrito à mão (`apps/web/src/lib/api-client.ts`), nunca TanStack Query nem SWR (busca no código não encontra nenhum dos dois). O mecanismo central da decisão — origem única via `rewrites()` do Next.js, cookie httpOnly first-party, sem CORS — permanece exatamente como decidido |
| ADR-015 | Nenhuma infraestrutura assíncrona nesta versão | `specs/001-grc-platform-foundation/research.md` | Vigente |
| ADR-016 | Núcleo GRC compartilhado, com admissão validada caso a caso | neste documento | Vigente |
| ADR-017 | Requisito e Controle são entidades distintas; framework é versionado | neste documento | Vigente |
| ADR-018 | Evidência e Ação anexam-se por registro de tipo fechado | neste documento | Vigente |
| ADR-019 | Toda superfície de automação atravessa os mesmos serviços, autorização e auditoria | neste documento | Vigente |
| ADR-020 | Padrão oficial de relacionamento entre módulos | neste documento | Vigente — exercitada e verificada em código para cinco pares de módulo (Risco↔Controle, Compliance↔Controle, Risco↔Ativo, Risco↔Processo, Controle↔Ativo/Processo), com as correções registradas no próprio corpo da ADR |
| ADR-021 | Classificação de privilégio de papel é apresentação, e nunca autorização | neste documento | Vigente |
| ADR-022 | Nome de papel tem rótulo pt-BR de apresentação; `Role.name` continua sendo o identificador | neste documento | Vigente — emendada em 2026-09-14 (`09d9e50`/`329d4c9`): o catálogo canônico é `common.roleDisplayNames`, não mais `admin.roles.displayNames`; ver "Emenda 2026-09-14" ao fim da ADR |
| ADR-023 | Navegação do frontend passa por abstração própria, nunca pela API nativa do Next.js diretamente | neste documento | Vigente (nova, 2026-09-14) |
| ADR-024 | `packages/api-types` gera dos contratos hand-authored; o documento OpenAPI refletido é só detector de deriva de rota | neste documento | Vigente (nova, 2026-09-14) |

---

## ADR-016: Núcleo GRC compartilhado, com admissão validada caso a caso

**Estado**: Aceita · 2026-09-07
**Contexto**: `docs/history/probo-benchmark.md` §13, §31; revisão do portão arquitetural (A2)

### Contexto

A arquitetura tinha duas camadas: `core/` (plataforma transversal) e `modules/` (domínios),
com fronteira aplicada por `eslint-plugin-boundaries` (ADR-011) — `core` nunca importa
`modules`, e módulo nunca importa módulo.

Alguns conceitos GRC não cabem em nenhuma das duas: específicos de GRC demais para `core/`,
compartilhados demais para pertencer a um único módulo. O benchmark mostrou o custo de não
resolver isso: no Probo, `Evidence` tem FK obrigatória para `Measure` e `Task` alcança apenas
`Measure`, de modo que achado de auditoria e incidente não têm onde registrar prova nem
trabalho.

### Decisão

Reconhecer uma terceira camada, `grc/`, entre plataforma e domínios.

**Critério de admissão, com dois testes que precisam passar juntos:**

1. **Posse** — nenhum domínio de negócio pode ser dono exclusivo do conceito.
2. **Ciclo de vida** — o ciclo de vida do conceito é independente do ciclo de vida de quem o
   originou.

O segundo teste é o decisivo, e é o que separa "vários módulos usam" de "não pertence a
nenhum". Um conceito que vários módulos leem, mas cujo ciclo de vida um deles governa, **não**
entra: ele é domínio daquele módulo, exposto por porta.

### Validação individual dos quatro candidatos

| Candidato | Posse | Ciclo de vida | Veredito |
|---|---|---|---|
| **Evidence** | nenhum domínio é dono — nasce de Controles, Auditoria, Conformidade e Risco | próprio: coletada, validada, vence, é substituída; independente de quem a pediu | **ENTRA** |
| **Action** | nenhum domínio é dono — nasce de tratamento de risco, achado, incidente e remediação | próprio: aberta → em andamento → concluída/cancelada, com responsável e prazo; sobrevive à origem | **ENTRA** |
| **Finding** | nasce sobretudo em Auditoria, mas também em teste de controle e monitoramento de conformidade | próprio, e **sobrevive à origem**: o engajamento de auditoria encerra e o achado continua aberto até remediação | **ENTRA** |
| **Control** | um módulo de Controles **pode** ser dono exclusivo: cria, testa, declara efetivo, aposenta | governado pelo próprio módulo de Controles | **NÃO ENTRA** |

**`Control` fica fora, e isto corrige a proposta original.** Controle é domínio de negócio com
dono natural único. Risco, Conformidade e Auditoria o **referenciam**, e referência não é posse
— é exatamente o caso que ADR-020 resolve por porta. Colocá-lo no núcleo transformaria a camada
em depósito de tudo que é muito referenciado, que é como um núcleo compartilhado deixa de
significar alguma coisa.

Permanecem fora, com a razão registrada: `Assessment` (só o Risco tem hoje — um consumidor não
justifica generalização), motor de workflow (a infraestrutura de aprovação existente basta,
ver §19.4), `Tag` e relacionamento genérico (proibidos por ADR-008 e ADR-020).

### Regras de dependência

Estendem ADR-011, e são aplicadas por lint, não por revisão:

```
modules  → grc, core, shared        (permitido)
grc      → core, shared             (permitido)
core     → shared                   (permitido)
core     → grc                      PROIBIDO
grc      → modules                  PROIBIDO
modules  → modules                  PROIBIDO (inalterado)
```

`grc/` segue a mesma estrutura interna em camadas dos demais: `domain/`, `application/`,
`infrastructure/`, `presentation/`, com importação apontando para dentro.

### Consequências

Positivas: três conceitos ganham casa antes que o primeiro módulo os invente localmente; o
critério de dois testes é aplicável a candidatos futuros sem debate; `Control` permanece um
domínio íntegro em vez de virar entidade sem dono.

Negativas: uma camada a mais; a fronteira precisa ser aplicada por lint desde já, senão vira
convenção. As regras acima foram adicionadas ao `eslint.config.mjs` da API junto com esta ADR,
para que a primeira violação seja erro de lint e não uma revisão que alguém esqueceu de fazer.

Aceita: `RiskTreatmentAction` deve migrar para `Action`. **Não nesta etapa** — migração de
domínio é mudança de dados e exige especificação própria.

---

## ADR-017: Requisito e Controle são entidades distintas; framework é versionado

**Estado**: Aceita · 2026-09-07
**Contexto**: `docs/history/probo-benchmark.md` §6, §10, §11; portão arquitetural (A1)

### Contexto

Um controle único — "exigir MFA no acesso administrativo" — satisfaz simultaneamente cláusulas
da ISO 27001, do NIST e de norma interna. Modelado como entidade única presa a um framework, ele
se duplica por norma, e com ele duplicam-se evidência, ações, dono e histórico.

O Probo separou cláusula de salvaguarda, ligadas N:M, e seu histórico de migrações prova que a
alternativa ingênua foi tentada primeiro — um campo `standards TEXT[]` guardando
`"ISO27001:2022-A.5.16;SOC2-CC6.1"` — e substituída por tabela de ligação real poucos meses
depois. O Probo também demonstra o custo de não versionar framework: reimportar uma revisão cria
um framework desconectado, e todo mapeamento precisa ser refeito à mão.

### Decisão

Dois conceitos, com **vocabulário GRC convencional** — não a nomenclatura invertida do Probo,
onde `Control` significa cláusula e `Measure` significa salvaguarda.

**`Requirement` — cláusula normativa**

- Pertence a exatamente uma `FrameworkVersion`. Nunca ao framework diretamente.
- Descreve uma exigência; não descreve o que a organização faz a respeito.
- **Duplica-se entre normas, e isso é correto**: a mesma prática pode ser aplicável sob uma
  norma e excluída sob outra, com justificativas diferentes e donos diferentes.
- Ciclo de vida: nasce e morre com a versão do framework. Não é editável fora dela.
- Origem: importado do texto da norma ou redigido para norma interna.

**`Control` — salvaguarda organizacional**

- **Não pertence a framework algum.** Existe porque a organização decidiu fazer algo.
- Tem dono, unidade organizacional, estado de implementação e efetividade verificável.
- Ciclo de vida próprio, governado pelo módulo de Controles: proposto → implementado → testado
  → efetivo → aposentado.
- Reutilizável: um controle serve quantas normas satisfizer.

**`RequirementControlLink` — N:M**

- Ligação explícita e nomeada, com tipo de entidade de auditoria próprio (ADR-008, ADR-020).
- Vincular e desvincular são ações auditadas, com os dois identificadores no evento.
- A ligação carrega o significado do mapeamento; não é tabela técnica.

**Versionamento**: `Framework` → `FrameworkVersion` → `Requirement`. A migração de mapeamentos
entre versões é operação de primeira classe, com trilha de auditoria própria — nunca recadastro
manual.

**Semântica de conformidade**: o estado de um requisito é **calculado** a partir do estado dos
controles ligados e da evidência que os sustenta, por um calculador único (CLAUDE.md §19.7).
Nunca campo editável em paralelo ao que o sustenta.

### Consequências

Positivas: uma norma revisada não invalida o trabalho de implementação; um controle serve muitas
normas sem duplicação; a duplicação que resta é a correta.

Negativas: duas entidades onde produtos imaturos têm uma; a interface precisa deixar claro qual é
qual, em pt-BR, sem ambiguidade — "Requisito" e "Controle" são termos GRC consagrados em
português e devem ser usados exatamente assim.

Risco registrado: a inversão de vocabulário do Probo é a armadilha número um deste benchmark.
Quem consultar aquele código deve traduzir antes de comparar.

---

## ADR-018: Evidência e Ação anexam-se por registro de tipo fechado

**Estado**: Aceita · 2026-09-07
**Contexto**: ADR-008; `docs/history/probo-benchmark.md` §5, §13, §29

### Contexto

ADR-008 exige modelagem relacional explícita e proíbe estruturas genéricas de relacionamento. O
benchmark validou fortemente a regra: o Probo tentou mecanismos semi-genéricos quatro vezes —
campo texto de normas, M:N auto-referencial, array de controles em campanha, e um subsistema de
snapshot com cerca de 18 tabelas — e **reverteu todas**, sempre em favor de estrutura explícita.

Mas Evidência e Ação precisam anexar-se a muitos tipos de sujeito. Uma tabela por par possível
cresce combinatoriamente; soldar cada uma a um único tipo torna-as indisponíveis para os demais
domínios, que é o defeito do Probo.

### Decisão

Dois casos distintos, com mecanismos distintos:

| Caso | Mecanismo |
|---|---|
| Dois domínios GRC se relacionam e o vínculo tem significado próprio | Tabela de ligação explícita e nomeada, com tipo de entidade de auditoria próprio (ADR-020) |
| Uma capacidade transversal anexa-se a muitos tipos de sujeito | **Registro de tipo fechado**: coluna de tipo com enum verificado em compilação, mais registro em tempo de composição |

Evidência e Ação usam o segundo, seguindo exatamente o padrão que este projeto já provou quatro
vezes: `AttachableEntityType`, `CommentableEntityType`, `ApprovableEntityType` e `Notification`.

Permanece proibido: `related_entity(type, id)` genérico, discriminador em string livre,
meta-modelo, sistema arbitrário de relacionamento entre entidades.

### Consequências

Positivas: não há explosão combinatória; o discriminador é fechado e verificado em compilação, de
modo que adicionar um tipo de sujeito sem tratá-lo é erro de compilação, não falha silenciosa; a
trilha de auditoria continua distinguindo tipos de vínculo.

Negativas: adicionar um tipo de sujeito exige alterar o enum e a migração — atrito deliberado,
que é o ponto.

Esta ADR **não enfraquece ADR-008**: relacionamento entre domínios continua explícito e tipado.
Evidência e Ação não são relacionamento entre domínios; são capacidades transversais anexadas a
um sujeito, como comentário e anexo já são.

---

## ADR-019: Toda superfície de automação atravessa os mesmos serviços, autorização e auditoria

**Estado**: Aceita · 2026-09-07
**Contexto**: `docs/history/probo-benchmark.md` §23, §24

### Decisão

Toda superfície de automação — integração, CLI, adaptador MCP, IA — chama os **mesmos serviços de
aplicação** e atravessa a **mesma autorização e a mesma auditoria** da interface web. Nunca um
caminho de dados paralelo, nunca acesso direto ao banco.

REST permanece a arquitetura de API aprovada. Um eventual adaptador MCP é adaptador sobre os
serviços existentes, não segunda porta para o banco.

Quando houver IA: chama serviços de aplicação, nunca o banco nem o modelo; identidade vem do
contexto do servidor, nunca da saída do modelo; ação de IA é auditável com **tipo de ator
distinto**; escrita iniciada por IA passa por portão de revisão humana **construído e ligado**;
campo escrito por IA carrega proveniência e nunca sobrescreve edição humana em silêncio.

O benchmark deu os dois lados: o MCP do Probo respeita a fronteira (mesmo autorizador, mesmo
serviço), enquanto o `proboctl` a viola (fala direto com o PostgreSQL, sem escopo, sem
autenticação, sem auditoria). E o Probo construiu portão de aprovação e guardrail de IA e **não
ligou nenhum dos dois** — o erro a não repetir.

### Consequências

As garantias de autorização, escopo e auditoria valem para toda superfície por construção, não
por disciplina repetida em cada adaptador. Em troca, um adaptador não pode tomar atalho pelo
repositório, e manutenção precisa de caminho auditado.

Nada nesta ADR autoriza implementar MCP ou IA.

---

## ADR-020: Padrão oficial de relacionamento entre módulos

**Estado**: Aceita · 2026-09-07
**Contexto**: ADR-008, ADR-011; `docs/architecture.md` §8; portão arquitetural (A5)

### Contexto

`docs/architecture.md` reconhecia honestamente que o vínculo entre dois módulos de negócio era
**inferência, não código**: o padrão de ligação explícita está provado dentro do módulo de Risco,
onde `RiskControlLink`, `RiskProcessLink` e `RiskAssetLink` apontam para registros de referência
— não para entidades de outro módulo. A questão real, quando Controles virar módulo, é como
`modules/risk` se relaciona com `modules/controls` sem importá-lo, já que ADR-011 proíbe.

### Decisão

**Um único padrão, com cinco partes obrigatórias.**

**1. A ligação é uma tabela explícita e nomeada, do lado que a registra.**

`RiskControlLink` pertence ao Risco: é o Risco que decide registrar que aquele controle trata
aquele risco. O nome descreve o vínculo; nunca `entity_link` genérico. Cada tipo de ligação tem
**tipo de entidade de auditoria próprio** — uma trilha que não distingue vínculo de controle de
vínculo de processo desfaz, no ponto onde mais importa, a modelagem explícita que ADR-008 exige.

**2. A integridade referencial é real, no banco.**

A chave estrangeira aponta para a tabela do outro domínio, com `onDelete: Restrict`. Fronteira de
módulo é conceito de **código**, não de banco: o PostgreSQL não conhece módulos e não deve ser
enfraquecido para fingir que conhece. Não existe "FK lógica" mantida por aplicação.

**3. A dependência de código passa por porta declarada na camada compartilhada.**

O tipo da porta e seu token de injeção vivem em `src/shared/` (ou em `src/grc/` quando o conceito
for do núcleo GRC). Ambos os módulos importam a **porta**; nenhum importa o outro. O módulo dono
fornece o adaptador; o *composition root* faz a ligação.

Isto funciona porque `shared/**` é importável por tudo e não importa nada — propriedade já
garantida pelo lint hoje. O lint continua cego a arquivos de composição (F-25), e é por isso que
este padrão precisa estar escrito: é a única parte que a ferramenta não protege.

**4. A porta expõe escopo organizacional, e o vínculo o verifica.**

A porta de consulta **precisa** devolver a unidade organizacional da entidade-alvo. O módulo que
registra o vínculo verifica que o alvo está dentro do escopo do ator **antes** de gravar. Sem
isso, seria possível ligar um risco a um controle fora do escopo de quem opera, e o vínculo
viraria canal de vazamento — um identificador válido é informação. Alvo fora de escopo responde
como inexistente (FR-030), nunca como proibido.

**5. Autorização exige permissão dos dois lados; vincular e desvincular são auditados.**

Criar o vínculo exige permissão de escrita no lado que o registra **e** permissão de leitura no
lado referenciado. Desvincular preserva histórico com atribuição (`unlinkedAt`,
`unlinkedByUserId`), nunca exclusão física.

### O que este padrão proíbe explicitamente

Tabela `EntityRelationship` genérica; discriminador em string livre; FK mantida só pela
aplicação; porta que devolva a entidade inteira do outro domínio (a porta expõe o mínimo:
identificador, código, nome, escopo e estado ativo — não o modelo de domínio alheio);
`modules/a` importando `modules/b` por qualquer caminho, inclusive tipo.

### Consequências

Positivas: semântica, integridade referencial, RBAC, escopo organizacional e auditoria
preservados simultaneamente; a fronteira de módulo permanece verificável por lint em tudo que o
lint alcança; a parte que ele não alcança está escrita.

Negativas: cada relação entre módulos custa uma porta e um adaptador. É atrito deliberado — é o
que impede o grafo GRC de virar acoplamento direto entre domínios.

Ponto honesto: este padrão continua **sem prova em código** até existir um segundo módulo de
negócio. Ele é a forma decidida, não a forma verificada. O primeiro módulo que o exercitar deve
reportar onde ele não coube (CLAUDE.md §19.10).

### Verificação em código — 2026-09-08, módulo de Controles

O parágrafo acima deixou de valer: o padrão foi exercitado, **nas duas direções**, e este é o
relatório que ele mesmo pediu.

- **Risco → Controle**: `shared/grc-ports/control-directory.port.ts`, adaptador fornecido por
  `modules/controls`. Substituiu a leitura direta da tabela `controls` que `modules/risk` fazia.
- **Controle → Risco**: `shared/grc-ports/risk-control-link-read.port.ts`, adaptador fornecido por
  `modules/risk`. Serve `GET /controls/{id}/risks`, que lê o `RiskControlLink` sem criar um segundo
  vínculo.

Nenhum dos dois módulos importa o outro, em nenhuma direção, e há teste que falha se isso mudar
(`test/unit/controls-risk-module-boundary.spec.ts`).

**Onde as cinco partes couberam, e onde uma não coube literalmente:**

| Parte | Resultado |
|---|---|
| 1. Tabela explícita e nomeada, do lado que registra | Coube. `RiskControlLink` permaneceu do lado do Risco, sem migração. |
| 2. Integridade referencial real, `onDelete: Restrict` | Coube, inclusive nos vínculos novos com processo e ativo. |
| 3. Porta em `shared/`, adaptador do módulo dono | Coube — nas duas direções, simetricamente. |
| 4. Porta expõe escopo, vínculo verifica antes de gravar | **Não se aplica literalmente à direção de leitura.** |
| 5. Permissão dos dois lados; vincular/desvincular auditados | Coube. A listagem é somente leitura por desenho (FR-021) e exige só `control:view`. **Correção de 2026-09-08 (fechamento de gap de segurança): esta linha respondia apenas pela listagem — o caminho de escrita (`LinkControlUseCase`/`POST /risks/{riskId}/controls`) não verificava `control:view` no lado referenciado, e esta linha não dizia isso. Ver "Verificação em código — 2026-09-08 (correção)" ao final desta ADR.** |

A parte 4 está escrita para uma porta que **habilita uma escrita**: ela existe para impedir que um
vínculo seja gravado contra um alvo fora do escopo do ator. `RiskControlLinkReadPort` não registra
nada — é uma listagem. Exigir dela o campo de escopo seria carregar um dado que nenhuma decisão
consome, e o caminho de escrita desse mesmo vínculo já atravessa `ControlDirectoryPort`, que o
carrega. A parte 4 vale, portanto, para **portas de registro**, não para toda porta. Isso é
interpretação, não exceção — e está registrado aqui porque a diferença só apareceu quando alguém
tentou aplicar a regra a uma porta de leitura.

**Uma observação sobre o processo, não sobre a arquitetura.** A direção Controle → Risco nasceu
como desvio: a porta no módulo errado e o adaptador do lado errado. A causa não foi o padrão — foi
o limite de propriedade de arquivo entre dois agentes trabalhando em paralelo, um deles proibido de
editar `modules/risk`. O desvio foi corrigido assim que um único agente pôde tocar os dois módulos.
Vale registrar porque um desvio arquitetural cuja causa real é organizacional se parece, no
código, com um desvio cuja causa é a arquitetura — e as duas pedem respostas opostas.

### Verificação em código — 2026-09-08, módulo de Compliance (Fase 3, User Story 1)

`modules/compliance` é o terceiro consumidor real do padrão, e o segundo na direção
Compliance → Controle. Dois pontos, um reaproveitado e um novo (research.md D-9 de
`004-compliance-management`):

- **`ControlDirectoryPort.findManyById`** — método aditivo sobre a porta já existente
  (`findById` permanece intocado), para resolver em lote os controles de um conjunto de vínculos.
  Implementado no mesmo adaptador (`PrismaControlDirectoryAdapter`) que já serve `modules/risk`.
- **`ControlEffectivenessPort`** (novo) — expõe o veredito de efetividade **derivado** de
  Controle, não a identidade/escopo que a porta acima já cobre. Fornecido por
  `PrismaControlEffectivenessAdapter`, reaproveitando o único calculador de Controles
  (`calculateControlEffectiveness`) — nunca uma segunda regra.

Nenhum arquivo de `modules/compliance` importa `modules/controls`, em nenhuma direção — há teste
que falha se isso mudar (`test/unit/compliance-controls-risk-module-boundary.spec.ts`).

**Onde as cinco partes couberam, e onde uma ainda não foi exercitada:**

| Parte | Resultado |
|---|---|
| 1. Tabela explícita e nomeada, do lado que registra | Coube — `RequirementControlLink` do lado de Compliance (schema já criado nesta fase). Não escrita ainda: o caso de uso de vínculo é da Fase 4 (User Story 2), fora do escopo desta entrega. |
| 2. Integridade referencial real, `onDelete: Restrict` | Coube — FK real de `requirement_control_links.control_id` para `controls`, já na migração desta fase. |
| 3. Porta em `shared/`, adaptador do módulo dono | Coube, para os dois portes acima. |
| 4. Porta expõe escopo, vínculo verifica antes de gravar | **Ainda não exercitada.** `ControlDirectoryPort` já expõe `orgUnitId`; o código que verificaria o escopo antes de gravar um `RequirementControlLink` é o caso de uso da Fase 4, que esta entrega não constrói. Reportado aqui, não escondido, para que a Fase 4 não repita a decisão — apenas a implemente. |
| 5. Permissão dos dois lados; vincular/desvincular auditados | Não exercitada nesta fase, pela mesma razão da parte 4. |

`ControlEffectivenessPort` em si também cai sob CLAUDE.md §19.10 até a Fase 5 (User Story 3)
existir: o porte compila, está ligado no *composition root* (`ControlsModule` importa
`ControlEffectivenessModule`), e é chamado por `RequirementComplianceReaderService` — mas todo
requisito desta fase computa sobre um conjunto vazio de vínculos, porque nenhum vínculo pode
existir ainda (parte 4 acima). O ponto de extensão está exercitado em código real, não apenas
declarado — mas ainda não sobre um dado real que só a Fase 4 introduz.

### Verificação em código — 2026-09-08 (continuação), Fase 4/5 de Compliance (T032-T057)

As duas partes que a entrega da Fase 3 relatou como "ainda não exercitadas" foram implementadas
nesta entrega, e este é o relatório que aquele registro pediu.

- **Parte 4 (porta expõe escopo, vínculo verifica antes de gravar)**: `LinkRequirementToControlUseCase`
  (`modules/compliance/application/links/link-requirement-control.usecase.ts`) resolve o escopo do
  ator (`ScopeResolverService`), consulta `ControlDirectoryPort.findById` e recusa a gravação —
  `ValidationDomainError`, 422 — quando o controle não existe, está inativo, ou seu `orgUnitId` está
  fora do escopo do ator (um controle com `orgUnitId: null` é tratado como visível apenas a escopo
  `GLOBAL`, nunca a escopo de unidade). A checagem termina — inclusive toda leitura que pode lançar —
  **antes** de `transactionRunner.run` abrir; não existe caminho de código deste arquivo que alcance
  `linkRepository.create` para um alvo que a checagem tenha rejeitado. `test/integration/requirement-control-link.spec.ts`
  prova as duas metades juntas: um controle fora de escopo e um controle inexistente produzem o
  **mesmo** erro (mesma mensagem, mesmos `errors[]`) — SC-005/FR-022 — e a contagem de
  `requirement_control_links` antes e depois da tentativa rejeitada é idêntica, exercitando
  literalmente o "nada é gravado" que a parte 4 exige, não apenas o status HTTP.
- **Parte 5 (permissão dos dois lados; vincular/desvincular auditados)**: vincular exige
  `compliance:map` na rota (`RequirementControlLinkController`); o lado referenciado (o controle) não
  tem uma segunda permissão própria verificada aqui — a leitura do controle passa por
  `ControlDirectoryPort`, que não impõe `control:view`, a mesma forma que `modules/risk`'s
  `LinkControlUseCase` já usa para o par Risco→Controle (o relatório de 2026-09-08 acima já registra
  essa mesma leitura para aquele par). Vincular e desvincular são auditados com o tipo próprio
  `REQUIREMENT_CONTROL_LINK`, cada operação com seu próprio `action` (`compliance.requirement_control_linked`/
  `compliance.requirement_control_unlinked`).

**Onde as cinco partes couberam, nesta segunda exercitação:**

| Parte | Resultado |
|---|---|
| 1. Tabela explícita e nomeada, do lado que registra | Coube — `RequirementControlLink` escrito pela primeira vez nesta entrega. |
| 2. Integridade referencial real, `onDelete: Restrict` | Coube, sem mudança desde a Fase 3. |
| 3. Porta em `shared/`, adaptador do módulo dono | Coube — `ControlDirectoryPort` (identidade/escopo) e `ControlEffectivenessPort` (efetividade derivada), os dois já ligados desde a Fase 3, agora ambos com consumidores reais. |
| 4. Porta expõe escopo, vínculo verifica antes de gravar | **Coube, exercitada.** Ver acima — a checagem termina antes de qualquer escrita, comprovado com "zero linhas gravadas" no teste, não apenas pelo status HTTP da resposta. |
| 5. Permissão dos dois lados; vincular/desvincular auditados | **Coube, parcialmente pela mesma razão do par Risco→Controle**: só o lado que registra tem permissão própria verificada (`compliance:map`); o lado referenciado não tem uma segunda permissão exigida — mesma forma aceita para Risco→Controle, não uma divergência nova. Vincular/desvincular auditados, sim. **Correção de 2026-09-08 (fechamento de gap de segurança): "mesma forma aceita" tratava a lacuna como decisão, não como defeito — o texto da parte 5 é uma exigência ("exige... e"), não uma preferência. O papel semeado `Compliance Manager` (`compliance:map` sem `control:view`) provava, em produção, o risco real: podia vincular a controles que não podia ver. Ver "Verificação em código — 2026-09-08 (correção)" ao final desta ADR.**

`ControlEffectivenessPort` também deixa de estar apenas "declarado, não exercitado sobre dado real"
(CLAUDE.md §19.10): com `RequirementControlLink` agora escrevível, `RequirementComplianceReaderService`
computa `RequirementComplianceState` sobre vínculos reais — os cinco valores do estado, cada um
alcançado por um caminho de dado real e distinto, estão provados em
`test/integration/requirement-compliance-state-reachability.spec.ts`. O ponto de extensão está,
agora sim, exercitado por dado de produção real, não apenas por código que roda sobre um conjunto
vazio.

### Verificação em código — 2026-09-08 (correção), parte 5 fechada para os dois pares

Este registro corrige, sem apagar, os dois relatórios acima. Ambos tratavam a parte 5 como
satisfeita — um em silêncio (a linha de Controles falava só da listagem, nunca do caminho de
escrita), outro nomeando a lacuna e mesmo assim rotulando-a "Coube, parcialmente" (a linha de
Compliance). O texto da própria parte 5 não admite gradação: **"Criar o vínculo exige permissão
de escrita no lado que o registra e permissão de leitura no lado referenciado."** Nenhum dos dois
relatórios foi mentira — cada um descreveu corretamente o código que examinou — mas nenhum dos
dois executou a segunda metade da regra, e a revisão que a teria pego não aconteceu entre um
relatório e o outro. Dois consumidores consecutivos citaram a parte 5 como cumprida; nenhum
código a impunha.

**O que provou o gap, na prática, não só na leitura da ADR**: o papel semeado `Compliance Manager`
possuía `compliance:map` sem `control:view` (`prisma/seed/platform.seed.ts`) — o exemplo concreto
de que a lacuna não era teórica. Com esse papel, `POST /requirements/{requirementId}/controls`
aceitava um `controlId` que o próprio ator não conseguia ler em `GET /controls`, e o seletor de
controle da interface recusaria a ele a própria lista da qual estava vinculando — a mesma
combinação `test/unit/control-link-permission-pairing.spec.ts` já provava, na direção inversa,
como defeito silencioso quando um papel tem `risk:treat` sem `control:view`.

**O que fechou o gap:**

- `LinkControlUseCase` (`modules/risk/application/links/control-link.usecase.ts`) e
  `LinkRequirementToControlUseCase`
  (`modules/compliance/application/links/link-requirement-control.usecase.ts`) agora resolvem
  `control:view` via `PermissionResolverService` — o mesmo mecanismo de decisão único (ADR-003)
  que `GetDashboardUseCase`/`GetRiskLifecycleUseCase` já usam para variar comportamento por
  permissão — e dobram a checagem na MESMA condição que já produzia a recusa de controle
  inexistente/inativo (Risco→Controle) ou inexistente/inativo/fora de escopo (Compliance→Controle).
  Uma checagem sem `control:view`, um controle inexistente e (para Compliance) um controle fora de
  escopo produzem o mesmo `ValidationDomainError`, com a mesma mensagem — nunca três caminhos que
  poderiam divergir.
- A checagem roda antes de qualquer escrita, e há teste que prova "nada é gravado" pela contagem
  de linhas, não só pelo tipo do erro — para os dois pares
  (`test/integration/risk-control-link.spec.ts`, `test/integration/requirement-control-link.spec.ts`).
- `Compliance Manager` ganhou `control:view` no seed. `test/unit/control-link-permission-pairing.spec.ts`
  passou a cobrir `compliance:map` além de `risk:treat`, e a exigir que ambas as listas de
  ofensores estejam vazias E que ambos os pares tenham ao menos um papel que as combine — a
  mesma dupla garantia que já valia só para `risk:treat`.
- Desvincular (`UnlinkControlUseCase`/`UnlinkRequirementFromControlUseCase`) foi deliberadamente
  **excluído** desta checagem: nenhum dos dois recebe um `controlId` do chamador — resolvem
  `linkId` contra um vínculo que a própria listagem (`GET .../controls`, sob `risk:view`/
  `compliance:view`, nunca `control:view`) já expôs por completo, identificador e nome do
  controle incluídos. Exigir `control:view` para desvincular não fecharia nenhum oráculo que o
  chamador não já tivesse pela lista de onde tirou o `linkId` — a própria letra da parte 5 ("Criar
  o vínculo exige...") já restringe a exigência dupla à criação.

**Onde as cinco partes valem, agora genuinamente, para os dois pares:**

| Parte | Risco → Controle | Compliance → Controle |
|---|---|---|
| 1. Tabela explícita e nomeada, do lado que registra | Coube (inalterado). | Coube (inalterado). |
| 2. Integridade referencial real, `onDelete: Restrict` | Coube (inalterado). | Coube (inalterado). |
| 3. Porta em `shared/`, adaptador do módulo dono | Coube (inalterado). | Coube (inalterado). |
| 4. Porta expõe escopo, vínculo verifica antes de gravar | Não se aplica à direção de leitura (inalterado); a direção de escrita nunca verificou escopo do controle até esta correção — ver "Verificação em código — 2026-09-08 (correção 2)" abaixo, que fecha o item. | Coube, exercitada (inalterado). |
| 5. Permissão dos dois lados; vincular/desvincular auditados | **Coube, agora genuinamente** — `control:view` exigido e testado, indistinguível de controle inexistente. | **Coube, agora genuinamente** — mesma forma. |

A parte 4 para Risco→Controle era, neste ponto do histórico, um gap conhecido e deliberadamente
fora do escopo desta correção (ela era sobre a parte 5) — `docs/deferred-findings.md` registrou o
item como F-46. Fechado logo em seguida; ver abaixo.

### Verificação em código — 2026-09-08 (correção 2), parte 4 fechada para Risco → Controle (F-46)

`docs/deferred-findings.md` F-46 registrou, no mesmo dia da correção acima, o gap que ela deixou
aberto: `LinkControlUseCase` resolvia o controle referenciado via `ControlRegistryPort.findById` —
uma leitura que nunca carregava `orgUnitId` — e nunca comparava a unidade organizacional do
controle contra o escopo do ator. Um ator com escopo na unidade A podia vincular um risco da
unidade A a um controle da unidade B; `GET /risks/{riskId}/controls` devolvia então o id, código e
nome daquele controle fora de escopo — o vazamento que a parte 4 existe para impedir ("um
identificador válido é informação").

**O que fechou o item**: `LinkControlUseCase`
(`apps/api/src/modules/risk/application/links/control-link.usecase.ts`) passou a resolver o
controle diretamente via `ControlDirectoryPort` (não mais `ControlRegistryPort`, que nunca expunha
`orgUnitId` e permanece ligado/não utilizado em vez de removido, reportado por §19.10) e a verificar
`control.orgUnitId` contra o escopo do ator antes de gravar, reaproveitando `isOrgUnitWithinScope`
(`grc/shared/domain/org-scope.ts`) — o mesmo predicado que `LinkControlToProcessUseCase`/
`LinkControlToAssetUseCase` (`modules/controls`) já usam, não um segundo helper. Um controle com
`orgUnitId: null` é visível apenas a um ator com escopo `GLOBAL`, replicando exatamente o
tratamento de nulo de `LinkRequirementToControlUseCase`. A checagem está dobrada na MESMA condição
que já recusava controle inexistente/inativo/sem `control:view` — quatro causas, uma única
`ValidationDomainError`/mensagem, nunca distinguíveis.

`test/integration/risk-control-link.spec.ts` prova, com a mesma forma que
`requirement-control-link.spec.ts` já prova para Compliance → Controle: um controle fora de escopo
e um controle inexistente produzem o mesmo erro; a contagem de `risk_control_links` antes e depois
da tentativa recusada é idêntica (não apenas depois); e um ator cujo escopo cobre o controle tem
sucesso genuíno. Fixtures pré-existentes em `risk-control-link.spec.ts`,
`test/contract/risk-relationships.spec.ts` e `test/contract/risk-detail.spec.ts` que criavam
controles sem `orgUnitId` e esperavam sucesso no vínculo foram corrigidas para criar o controle
dentro da unidade do próprio ator do teste — elas só passavam porque a checagem que este item
fecha estava ausente.

`UnlinkControlUseCase` **não** recebeu a mesma checagem, deliberadamente — o controle por trás de
um `linkId` já foi totalmente exposto (id, código e nome) pela própria listagem
(`GET /risks/{riskId}/controls`, só `risk:view`) que o chamador precisou ler para obter esse
`linkId`; não há oráculo novo a fechar nesse caminho, e recusar o desvínculo por escopo criaria uma
armadilha operacional — um vínculo que uma reorganização move para fora do escopo do ator ficaria
permanentemente preso. Ver o cabeçalho de `control-link.usecase.ts` para o raciocínio completo.

**Registros corrigidos junto com este item**: `specs/003-controls-management/research.md` D-4
continha a afirmação — nunca verificada contra o código — de que o módulo de Riscos "já" checava
escopo do controle antes deste refactor. Era falsa, e sobreviveu a duas fases sem correção; D-4 foi
corrigida no lugar, mantendo a afirmação original visível.

**Onde as cinco partes valem agora, para os dois pares, sem ressalva pendente:**

| Parte | Risco → Controle | Compliance → Controle |
|---|---|---|
| 1. Tabela explícita e nomeada, do lado que registra | Coube (inalterado). | Coube (inalterado). |
| 2. Integridade referencial real, `onDelete: Restrict` | Coube (inalterado). | Coube (inalterado). |
| 3. Porta em `shared/`, adaptador do módulo dono | Coube (inalterado). | Coube (inalterado). |
| 4. Porta expõe escopo, vínculo verifica antes de gravar | **Coube, agora genuinamente** — verificado e testado, indistinguível de controle inexistente. | Coube, exercitada (inalterado desde a Fase 4). |
| 5. Permissão dos dois lados; vincular/desvincular auditados | Coube, genuinamente (inalterado desde a correção anterior). | Coube, genuinamente (inalterado desde a correção anterior). |

As cinco partes de ADR-020 agora valem, verificadas em código e testadas, para os dois pares
Risco → Controle e Compliance → Controle, em ambas as direções de leitura e escrita onde cada parte
se aplica.

### Verificação em código — 2026-09-09, 006-assets-processes (Fase 4/5) — quarto e quinto pares, e F-49 fechado

`Asset` e `Process` deixam de ser as duas tabelas de referência mínimas que `modules/risk` e
`modules/controls` liam direto e passam a ser domínios de negócio próprios (`modules/assets`,
`modules/processes`), cada um com seu `AssetDirectoryPort`/`ProcessDirectoryPort`
(`shared/grc-ports/`) — o quarto e o quinto par a exercitar o padrão desta ADR, e a
pré-condição técnica que finalmente torna a parte 4 verificável para `Risco → Ativo` e
`Risco → Processo` (sem porta com escopo, não havia o que comparar).

**O que fechou** (`docs/deferred-findings.md` F-49): `LinkAssetUseCase`/`LinkProcessUseCase`
(`modules/risk/application/links/`) liam o alvo via `AssetRegistryPort`/`ProcessRegistryPort` — a
mesma forma sem `orgUnitId` que `ControlRegistryPort` tinha antes do F-46 — e nunca verificavam
escopo. Passaram a resolver o alvo via `AssetDirectoryPort`/`ProcessDirectoryPort` e a checar
`orgUnitId` contra o escopo do ator com o mesmo `isOrgUnitWithinScope`, dobrado na mesma condição
que já recusava alvo inexistente/inativo. A parte 5 também avançou aqui: os dois casos de uso
passaram a exigir `asset:view`/`process:view` no lado referenciado — permissões que **não
existiam** antes desta fase (criadas por ela), então isto não é correção de regressão, é o
primeiro ponto em que a exigência da parte 5 podia ser satisfeita para este par.

**Guarda estrutural, não apenas os dois casos relatados**: `test/unit/
link-usecase-target-scope-guard.spec.ts` falha se **qualquer** classe `Link*UseCase` em
`modules/risk/application/links/` ou `modules/controls/application/links/` deixar de chamar
`isOrgUnitWithinScope` — não só `LinkAssetUseCase`/`LinkProcessUseCase`. Confirmado, antes de
aceitar a guarda, que ela falha contra o estado anterior a esta correção, nomeando as duas classes
por nome — o mesmo requisito do AGENTS.md que toda correção de segurança já cita nesta ADR.

**Deliberadamente não estendido a `Controle → Ativo`/`Controle → Processo`**: esses dois pares já
tinham a parte 4 (escopo verificado antes de gravar, desde a Fase 3 de 003-controls-management).
A parte 5 permanece, para eles, na mesma forma aceita nesta ADR para `Risco → Controle` antes da
correção 2 — ou seja, **sem** a segunda permissão (`asset:view`/`process:view`) exigida do lado
referenciado. Isto é lacuna registrada, não decisão definitiva: `specs/006-assets-processes/
data-model.md` §10 nomeia os dois pares como "control:edit + asset:view (hoje sem a segunda)", e
`docs/deferred-findings.md` F-49 reporta explicitamente por que esta entrega não a fecha (T034/T035
nomeiam só os dois arquivos de `modules/risk`) — um candidato para uma tarefa futura,
separadamente revisada, não um "coube, parcialmente" silencioso como os dois relatórios que a
correção 2 desta ADR já teve que corrigir uma vez.

`modules/risk` e `modules/controls` também pararam de ler `prisma.client.asset`/
`prisma.client.process` diretamente — `reference-registry-lookup.repository.ts`
(`modules/controls`) foi apagado, e o `findById` de ativo/processo saiu de
`prisma-registry.repository.ts` (`modules/risk`) — a mesma migração que `Control` já fez para
`ControlRegistryPort` no F-46. `test/unit/asset-process-table-access-boundary.spec.ts` prova,
estruturalmente, que nenhum arquivo fora de `modules/assets`/`modules/processes` acessa essas duas
tabelas (SC-005).

**Onde as cinco partes valem, para os quatro pares, ao final desta entrega:**

| Parte | Risco → Ativo | Risco → Processo | Controle → Ativo | Controle → Processo |
|---|---|---|---|---|
| 1. Tabela explícita e nomeada | Coube (`RiskAssetLink`, inalterada). | Coube (`RiskProcessLink`, inalterada). | Coube (`ControlAssetLink`, inalterada). | Coube (`ControlProcessLink`, inalterada). |
| 2. FK real, `onDelete: Restrict` | Coube (inalterado). | Coube (inalterado). | Coube (inalterado). | Coube (inalterado). |
| 3. Porta em `shared/`, adaptador do dono | **Coube, agora** — `AssetDirectoryPort`, substituiu leitura direta. | **Coube, agora** — `ProcessDirectoryPort`, substituiu leitura direta. | **Coube, agora** — mesma porta, substituiu `AssetRegistryLookupPort`. | **Coube, agora** — mesma porta, substituiu `ProcessRegistryLookupPort`. |
| 4. Porta expõe escopo, vínculo verifica antes de gravar | **Coube, agora genuinamente** (F-49 fechado). | **Coube, agora genuinamente** (F-49 fechado). | Coube, exercitada desde a Fase 3 de 003 (inalterado). | Coube, exercitada desde a Fase 3 de 003 (inalterado). |
| 5. Permissão dos dois lados | **Coube, agora genuinamente** — `asset:view` exigido e testado. | **Coube, agora genuinamente** — `process:view` exigido e testado. | ~~**Não coube ainda** — sem segunda permissão exigida~~ — **superado, 2026-09-11** (007-implementation-remediation): `control-asset-link.usecase.ts:91` resolve `asset:view` via `permissionResolver.hasPermission`, citando ADR-020 parte 5 no próprio comentário. | ~~**Não coube ainda** — mesma lacuna~~ — **superado, 2026-09-11**: `control-process-link.usecase.ts:91` resolve `process:view` da mesma forma. |

---

## ADR-021: Classificação de privilégio de papel é apresentação, e nunca autorização

**Estado**: Aceita · 2026-09-13
**Contexto**: ADR-003; `specs/015-roles-permissions-surface/spec.md` FR-035 a FR-038, SC-005;
`specs/015-roles-permissions-surface/research.md` R-001

### Contexto

A superfície de Papéis e Permissões (`specs/015-roles-permissions-surface`) apresenta ao
administrador uma lista de papéis e, para cada um, o que ele concede. Entre doze papéis semeados,
alguns podem reescrever o próprio ambiente de controle da plataforma — conceder permissões,
atribuir papéis, alterar a estrutura organizacional — e a maioria não pode. A tela precisa dizer
isso ao leitor, porque é a informação mais consequente do inventário.

O servidor **não tem, hoje, conceito algum de papel privilegiado, elevado ou especial**, e isso é
uma propriedade deliberada da plataforma, não uma lacuna:

- `PermissionGuard` não possui ramo de bypass
  (`apps/api/src/core/authorization/presentation/permission.guard.ts:144-209`). Só `@Public()` e
  `@NoPermissionRequired()` alteram o caminho, e o segundo continua exigindo ator presente.
- A resolução efetiva de permissões é um `JOIN` plano sobre os papéis diretos do usuário,
  deduplicado por `Set`
  (`apps/api/src/core/authorization/infrastructure/prisma-permission.repository.ts:33-48`). Não há
  herança entre papéis, recursão, CTE nem expansão transitiva em nenhuma camada.
- O modelo `Role` tem seis campos — `id`, `name`, `description`, `isSystem`, `createdAt`,
  `updatedAt` (`apps/api/prisma/schema.prisma:711-723`). Não existe `isPrivileged`, `isAdmin`,
  `level`, `tier` nem equivalente.
- O próprio seed declara que o papel "Platform Administrator" não é especial: ele é um papel comum
  que por acaso detém as permissões administrativas.

O risco que esta ADR existe para fechar é conhecido e barato de materializar: um rótulo de tela
que, com o tempo, é lido por alguém como se fosse um fato do modelo de segurança. A partir do
momento em que uma decisão de autorização consulta "este papel é privilegiado?", a plataforma passa
a ter **dois** eixos de autorização — o conjunto de permissões e uma classificação paralela — e o
segundo não tem trilha de auditoria, não tem migração, não tem contrato e não tem guarda.

### Decisão

**`isPrivilegedRole` é exclusivamente uma derivação de apresentação.**

1. **O que é.** Uma função pura, no cliente web, sobre a lista de permissões que
   `GET /admin/roles` já devolve. Ela é verdadeira quando o papel concede ao menos uma de:

   ```
   role:administer
   user:administer
   org_unit:administer
   ```

   Os três identificadores existem, com esses nomes exatos, em
   `apps/api/src/core/authorization/domain/permissions.ts:119-121` (registro de identificadores) e
   `:155`, `:161`, `:167` (definições). São as três permissões que permitem alterar quem pode o
   quê — o critério não é "contém `ADMINISTER`", que marcaria seis dos doze papéis semeados e não
   distinguiria nada (`research.md` R-001).

2. **O que ela não é.** A classificação **não** é persistida, **não** altera o schema, **não**
   cria coluna, tabela nem migração, e **não** entra no `RoleResponse` do contrato
   (`apps/api/src/core/authorization/presentation/dto/role-response.mapper.ts:15-22` permanece com
   os seis campos que já tem).

3. **Onde ela é proibida.** Nenhuma das seguintes pode consultá-la, direta ou indiretamente:

   - `PermissionGuard` e qualquer guarda, interceptador ou middleware de autorização;
   - a resolução de permissões (`PermissionResolverService`, `PermissionRepositoryPort` e
     implementações);
   - qualquer verificação de segregação de funções (a separação entre solicitante e aprovador que
     a plataforma já aplica em risco e conformidade);
   - qualquer regra de negócio, filtro de escopo organizacional, decisão de visibilidade de
     registro ou cálculo que produza uma resposta diferente conforme o valor;
   - qualquer decisão de segurança, sob qualquer outro nome.

4. **Quem continua sendo a fonte de verdade.** As *permission definitions* — e somente elas — são
   a fonte de verdade da autorização. Uma pessoa pode o que a união dos papéis atribuídos a ela
   concede, e nada mais. Esta ADR não altera ADR-003 nem nenhuma garantia existente; ela impede
   que um rótulo passe a competir com elas.

5. **Nada aqui autoriza a ausência que já está registrada.** Não existe hoje checagem
   anti-escalação de privilégio: quem tem `role:administer` pode colocar qualquer permissão do
   catálogo em qualquer papel e atribuí-lo a si mesmo — ausência documentada no próprio serviço
   (`apps/api/src/core/authorization/application/role-admin.service.ts`) e declarada fora de escopo
   em `specs/015-roles-permissions-surface/spec.md`. A classificação desta ADR **não é** essa
   checagem, não a substitui e não deve ser confundida com ela. Se um dia a plataforma implementar
   anti-escalação, ela o fará lendo permissões, com especificação própria — não lendo este rótulo.

### O que aconteceria se alguém violasse esta fronteira

A violação concreta é curta de escrever e cara de descobrir: um campo `isPrivileged` no
`RoleResponse`, ou uma cópia do predicado no servidor, consultado num ponto de decisão. As
consequências, na ordem em que apareceriam:

- **Autorização passaria a ter dois eixos.** O conjunto de permissões continuaria valendo, e uma
  classificação derivada passaria a valer também — sem que nenhum documento, contrato ou trilha
  dissesse qual vence em caso de divergência.
- **A divergência seria silenciosa.** A classificação é derivada de três identificadores. Basta
  acrescentar um quarto identificador de governança ao catálogo, ou renomear um dos três, para que
  um papel deixe de ser "privilegiado" sem que ninguém tenha alterado permissão alguma. Se a
  autorização dependesse disso, seria uma mudança de acesso sem evento de auditoria
  correspondente — a plataforma audita alteração de papel e de permissão, não a alteração de uma
  regra de apresentação.
- **Uma decisão de segurança dependeria de código de interface.** O predicado nasce no cliente
  web. Um guard que dependesse dele passaria a ter, na prática, parte da política de segurança
  fora do servidor — o oposto de CLAUDE.md §12 ("autorização no backend") e de ADR-019 (toda
  superfície atravessa a mesma autorização).
- **Persistir a classificação seria pior ainda.** Uma coluna `is_privileged` ficaria desatualizada
  no instante seguinte a um `PATCH /admin/roles/{roleId}` que trocasse o conjunto de permissões —
  estado derivado armazenado em paralelo ao que o sustenta, exatamente o que CLAUDE.md §19.7
  proíbe, e com o agravante de ser sobre acesso.

### Qual teste guarda a fronteira

A fronteira é verificável por construção, e a fase que introduz a classificação é responsável por
construir as duas guardas abaixo (`spec.md` SC-005). Nenhuma delas existe antes desse trabalho —
esta ADR descreve o que precisa passar a existir, não algo já medido:

1. **Guarda estrutural, no servidor**: um teste que varre `apps/api/src` e falha se o predicado, o
   nome `isPrivilegedRole` ou uma reimplementação do critério dos três identificadores aparecer em
   qualquer arquivo de autorização — garantindo que `PermissionGuard` e a resolução de permissões
   não têm como alcançá-lo. O padrão já é idioma desta casa: veja
   `apps/api/test/unit/asset-process-table-access-boundary.spec.ts` (nenhum arquivo fora de dois
   módulos toca duas tabelas) e
   `apps/api/test/unit/audit-engagement-permission-namespace.spec.ts` (colisão de namespace de
   permissão impedida em teste, não em revisão).
2. **Guarda de comportamento, no cliente**: um teste que prova que a classificação é função pura
   da lista de permissões — os três identificadores, e somente eles, a tornam verdadeira — e que
   nenhuma requisição, nenhum estado e nenhuma decisão de renderização de dado sensível dependem
   dela. Um papel classificado como privilegiado e um papel comum com o mesmo conjunto de
   permissões efetivas obtêm exatamente a mesma resposta do servidor.

A segunda guarda importa por uma razão registrada em CLAUDE.md §18.8 e paga mais de uma vez neste
repositório: um teste que passa tanto contra o código correto quanto contra o incorreto não
protege nada. A guarda estrutural é a que falha de verdade no dia em que alguém levar o predicado
para o lado errado da fronteira.

### Consequências

Positivas: o administrador ganha o sinal que a tela precisa dar, sem que a plataforma ganhe um
segundo eixo de autorização; a regra fica escrita antes da implementação, que é o que
`spec.md` FR-038 exige e o que evita a discussão acontecer depois, sobre código já escrito; as
permission definitions permanecem, sem competidor, a única fonte de verdade de acesso.

Negativas: um conceito que o usuário lê na tela não existe no modelo, e essa assimetria precisa ser
respeitada por quem vier depois — inclusive resistindo à tentação, sempre razoável à primeira
vista, de "só expor o campo na API, já que ele é calculado mesmo". É por isso que a proibição está
escrita aqui e guardada por teste, e não confiada à memória de quem revisa.

Aceito e registrado: se algum dia a plataforma precisar de fato de um conceito de papel elevado com
efeito de autorização — por exemplo, para uma checagem anti-escalação real —, isso será uma ADR
nova, com especificação, modelo, auditoria e migração próprios. Não será esta classificação
promovida em silêncio.

---

## ADR-022: Nome de papel tem rótulo pt-BR de apresentação; `Role.name` continua sendo o identificador

**Estado**: Aceita · 2026-09-14
**Contexto**: CLAUDE.md §11.1, §19.7; ADR-021;
`specs/015-roles-permissions-surface/spec.md` NFR-001, FR-016

### Contexto

A interface do PharosGRC é definitivamente em pt-BR (CLAUDE.md §11.1). A tela
Administração → Papéis e permissões, porém, mostrava "Platform Administrator", "Control Approver" e
"Risk Analyst" — os `name` dos doze papéis que `apps/api/prisma/seed/platform.seed.ts` semeia.

Esses doze valores **não podem ser renomeados**, e a razão é do modelo, não de gosto:

- `Role.name` é `@unique` (`apps/api/prisma/schema.prisma`) e é a chave sobre a qual
  `upsertSystemRoles` faz o `upsert`. Renomear um deles no seed **cria um papel novo** na próxima
  execução em vez de renomear o existente, deixando o antigo com suas atribuições `UserRole` e o
  novo sem nenhuma.
- Seria, portanto, migração de dados com efeito direto sobre RBAC — quem tem qual papel —, o que
  §18.9 e §12 colocam fora de qualquer trabalho de interface.
- E §11.1 lista "nomes de papel semeados" entre os **identificadores de banco** que permanecem em
  inglês, ao lado de tabelas, colunas e valores de enum.

Ao mesmo tempo, a primeira regra do próprio §11.1 é que toda string voltada ao usuário nasce em
pt-BR, nos catálogos centralizados. O título de um papel numa lista de papéis é string voltada ao
usuário.

As duas exigências não se contradizem — é exatamente a mesma situação de todo enum deste produto.
`RiskStatus`, `ControlStatus` e `PermissionAction` são armazenados em inglês e renderizados em
pt-BR; `permissionCatalog.resources` e `permissionCatalog.verbs`
(`apps/web/src/lib/messages/admin.ts`) fazem isso para identificadores de permissão, que §11.1
também manda manter em inglês. "Permanece em inglês" descreve **o valor armazenado**, não o que a
tela imprime.

Havia ainda um fato medido que decidiu o formato desta ADR: **o produto já fazia isto, mal.**
`profile.identity.roleLabels` (`apps/web/src/lib/messages/profile.ts`, na tela Perfil desde a fase
001) mapeia nome de papel semeado para pt-BR — e cobre **6 dos 12**. Os outros seis passaram a ser
semeados depois e nunca foram acrescentados, então a mesma plataforma mostrava "Gestor de Riscos"
para um usuário e "Compliance Manager" para outro, sem que nenhum portão notasse. O risco de
dessincronização não era hipotético: já tinha se materializado.

### Decisão

**O nome exibido de um papel é um rótulo de apresentação derivado de `Role.name`, por um único
ponto no código, sem qualquer efeito sobre autorização.**

1. **Onde vive.** `admin.roles.displayNames`, no catálogo pt-BR
   (`apps/web/src/lib/messages/admin.ts`), ao lado de `permissionCatalog` e no mesmo estilo.
   Resolvido por `roleDisplayName`
   (`apps/web/src/features/admin/components/roles/role-display-name.ts`), função pura, **único**
   ponto de tradução de nome de papel na aplicação (CLAUDE.md §19.7).

   > **Corrigido por emenda em 2026-09-14** (`09d9e50`/`329d4c9`): esta localização é histórica. O
   > catálogo canônico é hoje `common.roleDisplayNames`
   > (`apps/web/src/lib/messages/common.ts`), e o resolvedor é `apps/web/src/lib/role-display-name.ts`.
   > Ver "Emenda 2026-09-14" ao fim desta ADR para o porquê e o que mudou.

2. **O mapa é exaustivo sobre os papéis semeados, e nada mais.** É tipado
   `satisfies Record<SeededRoleName, string>` sobre uma união fechada de doze literais
   (`apps/web/src/features/admin/types.ts`), de modo que uma entrada faltante ou sobrando é **erro
   de compilação**.

3. **Papel personalizado não tem tradução, e nunca terá.** O nome de um papel criado pelas telas de
   administração é o que a pessoa digitou; `roleDisplayName` o devolve **exatamente como está**,
   caractere por caractere. Aqui o fallback é o comportamento correto, não uma lacuna — e é por
   isso que o mapa é exaustivo sobre a união fechada enquanto o resolvedor aceita `string`. A
   consulta é por propriedade própria (`Object.hasOwn`), nunca `mapa[nome] ?? nome`: um papel
   legitimamente chamado `constructor` ou `toString` faria a segunda forma imprimir uma função.

4. **O que NÃO muda.** `Role.name` permanece o identificador que o servidor conhece, a chave
   `@unique`, o valor que o campo "Nome" do editor lê e escreve, e o que trafega em todo `POST` e
   `PATCH`. Nada aqui é persistido, enviado ao servidor ou usado para localizar um papel. O seed, o
   schema, o contrato REST, `PermissionGuard`, a resolução de permissões, a segregação de funções e
   `OrgScopeGrant` ficam intocados — a mesma fronteira que ADR-021 traça em torno da classificação
   de privilégio, pela mesma razão.

5. **Rastreabilidade é obrigação, não cortesia.** Um administrador precisa poder nomear, a partir da
   tela, o valor que verá numa resposta da API ou num evento de auditoria. Por isso:
   - o painel de detalhe exibe **"Nome técnico: `Role.name`"** sob o mesmo controle
     "Ver identificadores técnicos" que revela `risk:view` ao lado de cada permissão (FR-016) — uma
     única modalidade de divulgação técnica, não duas;
   - a busca casa **os dois** nomes, o exibido e o armazenado, na tela de Papéis e na coluna de
     papéis da tela de Usuários: quem digita "Administrador" e quem digita "Platform" chegam ao
     mesmo papel;
   - o campo "Nome" do editor mostra sempre o valor armazenado, legível e travado em papel do
     sistema (FR-031), o que já era verdade e continua sendo.

6. **A ordenação por nome usa o nome exibido.** "Nome (A–Z)" sobre uma lista em pt-BR precisa ser
   alfabética nas palavras que a lista imprime.

7. **Coerência entre telas é requisito.** Onde quer que um nome de papel apareça — cartão, painel,
   confirmação de exclusão, linha "Outros papéis", etiquetas da tela de Usuários, diálogo de
   atribuição de papéis — ele aparece pelo mesmo resolvedor. Um papel com dois nomes em duas telas é
   defeito.

### O que aconteceria se alguém violasse esta fronteira

- **Traduzir `Role.name` na origem** (renomear no seed, ou mapear no servidor antes de responder)
  quebraria o `upsert` por chave única e a atribuição existente, e faria o identificador depender de
  idioma — exatamente o que §11.1 evita ao mandar mantê-lo em inglês.
- **Um segundo mapa** — outro catálogo, outro componente "que só precisa de um rótulo" — recria o
  defeito que já existe em `profile.identity.roleLabels` e que esta ADR encontrou: dois lugares, um
  deles desatualizado, nenhum erro. CLAUDE.md §19.7 proíbe o segundo calculador; aqui a proibição é
  literal.
- **Usar o rótulo para localizar um papel** (comparar
  `roleDisplayName(x) === 'Administrador da Plataforma'` para decidir alguma coisa) colocaria uma
  decisão sobre um valor de apresentação traduzível. Identificação de papel é por `id`, e autoridade
  de acesso é por permissão.

### Qual teste guarda a fronteira

> **Esta seção descreve o estado original da ADR (2026-09-14, antes da emenda do mesmo dia).** Os
> dois catálogos que o item 2 descrevia como "não podem discordar" foram unificados em um só nas
> horas seguintes, pelos commits `09d9e50`/`329d4c9`. A tabela abaixo é preservada como registro
> histórico do que a fase original entregou; a seção "Emenda 2026-09-14", ao fim desta ADR, descreve
> o que existe hoje e por quê. Os caminhos de arquivo abaixo (`admin.roles.displayNames`, e os dois
> arquivos de teste no caminho antigo) estão desatualizados e não corrigidos inline — a emenda é o
> registro correto.

1. **Sincronia com o seed** — `role-display-name.seed-sync.test.ts` lê
   `apps/api/prisma/seed/platform.seed.ts` do disco, extrai os `name` de
   `SYSTEM_ROLE_DEFINITIONS` e falha nos **dois** sentidos: papel semeado sem rótulo, e rótulo sem
   papel semeado. É uma leitura de arquivo, não um `import`: nenhuma dependência nova entre
   workspaces. A guarda inclui asserções de não-vacuidade (doze nomes, nenhuma fixture), porque um
   extrator que silenciosamente devolve lista vazia faria toda comparação passar.
2. **Divergência entre catálogos** — `role-display-name.test.ts` falha se
   `profile.identity.roleLabels` e `admin.roles.displayNames` discordarem sobre um papel que ambos
   nomeiam. A regra afirmada é a verdadeira hoje: os dois não podem **discordar**. Exigir que
   `profile` fosse completo seria afirmar uma correção que esta fase não fez.
3. **Fallback do papel personalizado** — o mesmo arquivo prova que um nome desconhecido volta
   intacto, inclusive nos casos que quebrariam uma consulta ingênua (`constructor`, `toString`,
   `__proto__`).

### Consequências

Positivas: a tela fica em pt-BR como §11.1 exige, sem tocar em RBAC; o nome técnico continua a um
clique, no controle que já existia para isso; busca e ordenação passam a operar sobre o que o leitor
vê **e** sobre o que o servidor guarda; e a dessincronização que já existia entre dois catálogos
passa a ser detectada por teste.

Negativas: um papel passa a ter dois nomes, e a correspondência entre a tela e uma resposta de API
deixa de ser literal — mitigado pelo item 5, não eliminado. Um papel personalizado pode ser criado
com um nome igual ao rótulo de um papel semeado e ficar visualmente ambíguo; a etiqueta
Sistema/Personalizado ao lado do nome é o que os distingue, e o servidor continua permitindo os dois
porque `Role.name` de fato difere. E qualquer teste de ponta a ponta que localizava um papel pelo
nome em inglês na interface passa a localizá-lo pelo rótulo pt-BR.

### Emenda 2026-09-14 — catálogo único (`09d9e50`, `329d4c9`)

A decisão original resolveu **onde a tradução acontece** (um único resolvedor,
`roleDisplayName`) mas deixou **dois catálogos de dados** de pé: `admin.roles.displayNames`
(completo, doze papéis) e `profile.identity.roleLabels` (`apps/web/src/lib/messages/profile.ts`,
existente desde a fase 001, cobrindo apenas seis dos doze — os seis papéis semeados depois nunca
foram acrescentados a ele). A tela de Perfil usava o segundo, então seis papéis — Audit Lead,
Compliance Manager, Control Owner, Control Approver, Incident Manager, Problem Manager — apareciam em
**inglês** na tela de Perfil e em pt-BR na tela de Papéis, na mesma plataforma, sem que nenhum portão
notasse: um `Record<string, string>` com fallback silencioso nunca falha por ter metade das entradas
ausente.

**O que mudou:**

1. **Catálogo canônico**: `common.roleDisplayNames`
   (`apps/web/src/lib/messages/common.ts`), não mais `admin.roles.displayNames`. O critério foi o
   contrato já escrito do próprio arquivo `common.ts`: microcópia transversal, usada por mais de uma
   área, vive em `common`; copy específica de área vive no arquivo da área. Duas áreas imprimem nome
   de papel (Administração e Perfil), então deixou de ser copy exclusiva de Administração —
   `common.userStatus`, três linhas acima no mesmo arquivo, já era o mesmo formato pela mesma razão.
   Rejeitado: Perfil importar de `admin.ts` (reapontaria o acoplamento em vez de removê-lo) e um
   `messages/roles.ts` novo (poria `roles.*` ao lado de `admin.roles.*` para um mapa de doze
   entradas).
2. **Resolvedor movido**: `roleDisplayName` saiu de
   `apps/web/src/features/admin/components/roles/role-display-name.ts` para
   `apps/web/src/lib/role-display-name.ts`, ao lado de `lib/permissions.ts` — o precedente já
   existente para um helper transversal puro sobre o modelo de identidade. Continua o único ponto de
   tradução e continua resolvendo por `Object.hasOwn`, então um papel personalizado chamado
   `constructor` ainda imprime como digitado.
3. **`profile.identity.roleLabels` foi removido, não aliado.** Suas seis strings já tinham sido
   adotadas literalmente pelo catálogo canônico, então nenhum texto mudou para o usuário; um
   comentário ficou no lugar antigo, nomeando o defeito que existia ali.
4. **A guarda de divergência foi substituída, não apagada.** A versão original (item 2 de "Qual
   teste guarda a fronteira", acima) afirmava a regra mais fraca e verdadeira à época: os dois
   catálogos não podem **discordar** — exigir que `profile` fosse completo teria afirmado uma
   correção que a fase original não tinha feito. Essa regra deixou de fazer sentido porque o segundo
   catálogo deixou de existir; o mesmo arquivo (`apps/web/src/lib/role-display-name.test.ts`, movido
   junto) agora afirma que **o segundo mapa não existe** (`Object.hasOwn(profile.identity,
   'roleLabels')` é `false`), com uma checagem de que o resto do cartão de identidade continua ali,
   para que um objeto esvaziado não passe pela razão errada. Duas guardas novas, ambas estruturais,
   porque o defeito original era invisível a qualquer teste comportamental — um mapa com fallback
   silencioso nunca falha por ter metade das entradas ausente:
   - `apps/web/src/lib/role-display-name.single-catalogue.test.ts` — lê a árvore de produção inteira
     e falha se qualquer arquivo fora do catálogo canônico indexar um objeto por nome de papel
     semeado. Seu próprio detector é provado rodando-o **contra** `common.ts` e exigindo exatamente
     doze ocorrências — um regex que decaísse para zero varreria uma árvore cheia de segundos
     catálogos e reportaria verde.
   - `apps/web/src/app/(app)/profile/profile-view.test.tsx` — monta a tela real de Perfil e afirma
     que os seis papéis que antes apareciam em inglês agora aparecem em pt-BR, que nenhum nome
     armazenado em inglês aparece em lugar nenhum, e que um papel personalizado imprime exatamente
     como digitado. Não havia teste nenhum nesta tela antes — o que explica como ela foi ao ar
     meio-traduzida por quatorze fases sem que nada acusasse.
5. **`role-display-name.seed-sync.test.ts`** (item 1 de "Qual teste guarda a fronteira", acima)
   passou a ler de `common.roleDisplayNames` em vez de `admin.roles.displayNames` — mesma regra,
   novo caminho.

**O que NÃO mudou**: `Role.name`, o seed, o schema, o contrato REST, `PermissionGuard` e
`OrgScopeGrant` continuam intocados — a emenda é sobre onde a copy pt-BR vive, não sobre RBAC. Nada
fora de `apps/web/src` foi aberto.

**Discrepância registrada, para que não se repita**: em algum ponto desta sessão de documentação
circulou a afirmação de que o catálogo teria se movido "de `common.chrome` para `lib`". Isso é
**falso** e foi verificado contra o histórico: não existe, nem existiu, uma propriedade
`common.chrome` em `apps/web/src/lib/messages/common.ts`. A palavra "chrome" aparece nesse arquivo
apenas dentro de comentários descrevendo texto de **interface de usuário** ("the shared register/list
chrome", "`DataTable`'s chrome text") — "chrome" no sentido de moldura/armação de UI, não um
namespace de dados. O movimento real, confirmado pelo diff de `09d9e50`, foi de
`admin.roles.displayNames` (`apps/web/src/lib/messages/admin.ts`) para `common.roleDisplayNames`
(`apps/web/src/lib/messages/common.ts`); o resolvedor moveu de
`apps/web/src/features/admin/components/roles/role-display-name.ts` para
`apps/web/src/lib/role-display-name.ts`.

**Correção de um erro de commit, sem reabrir a decisão**: `09d9e50` moveu dois arquivos de teste por
`git mv` e não teve suas edições de conteúdo staged — a árvore de trabalho estava correta (por isso a
suíte rodou verde antes do commit), mas o commit em si carregava os dois arquivos, no caminho novo,
ainda importando o catálogo que aquele mesmo commit tinha acabado de apagar. `329d4c9`, minutos
depois, corrigiu os dois arquivos sem emendar `09d9e50`. Nenhum dos dois altera a decisão desta ADR.

---

## ADR-023: Navegação do frontend passa por abstração própria, nunca pela API nativa do Next.js diretamente

**Estado**: Aceita · 2026-09-14 (formaliza uma decisão já implementada e guardada por lint desde
`specs/014-institutional-loader/`, sem mudança de comportamento)
**Contexto**: `specs/014-institutional-loader/STATE.md`; CLAUDE.md §18.1, §18.12

### Contexto

PharosGRC precisa de um indicador de carregamento institucional (o símbolo do farol com arcos de
sinal, `PharosLoader` em `packages/design-system`) que reaja a navegação genuinamente pendente — nem
a todo clique, nem a nada. `next/link` e `useRouter()` nativos não expõem esse sinal por si; um
componente que os usa diretamente não tem como o loader institucional saber que uma navegação está
em curso.

A alternativa mais simples — `app/(app)/loading.tsx` nativo do Next.js — foi construída, medida e
**rejeitada**: pisca em navegações rápidas e apaga a tela anterior em navegações lentas
(`STATE.md` §2.1.1). A decisão registrada aqui não é "ter um loader"; é *como todo o produto navega*,
porque o loader só funciona se **toda** navegação passar pelo mesmo sinal.

### Decisão

**Dois pontos únicos de navegação, os dois lendo o sinal nativo de transição pendente do React
(`useTransition`/`useLinkStatus`), nunca um mecanismo paralelo (sem listener global de clique, sem
patch de `history`, sem estado de rota próprio):**

1. **`Link`** (`apps/web/src/components/navigation/link.tsx`) — substituto de `next/link` para
   navegação iniciada por clique do usuário. Mesmas props, mesma `<a>` real (clique do meio, "abrir
   em nova aba", "copiar link" continuam funcionando), lendo `useLinkStatus()` de dentro do link que
   iniciou a navegação.
2. **`useNavigate()`** (`apps/web/src/components/shell/navigation-pending.tsx`) — substituto de
   `useRouter().push/replace/back/refresh` para navegação que o próprio produto inicia (não um clique
   direto do usuário em um link), usando `useTransition()` dentro de um provider do shell que nunca
   desmonta.

`NavigationPendingOverlay` renderiza `PharosLoader` como overlay `absolute inset-0` dentro do
wrapper do `AppShell` ao redor de `<main>` — nunca cobrindo cabeçalho ou barra lateral —, com
`useDelayedVisibility` (200ms de atraso, 400ms de visibilidade mínima) evitando o mesmo problema de
"pisca" que derrubou `loading.tsx`.

Todos os 59 arquivos que importavam `next/link` foram migrados para `Link`. A tela de login é a
única exceção deliberada e registrada: continua chamando `useNavigate()`, não `router.push`
diretamente (`apps/web/src/app/(public)/login/login-form.tsx`) — mas por estar fora do
`AppShell`/`NavigationPendingProvider` (montado só em `apps/web/src/components/shell/app-shell.tsx`),
`useContext(NavigateContext)` volta `null` e o próprio hook **degrada** para `router.push`/
`router.replace` puro (`apps/web/src/components/shell/navigation-pending.tsx`, função `useNavigate`,
comentário próprio: "Outside the authenticated shell... this degrades to a plain `router.push`"). A
navegação acontece; só não há overlay do loader institucional para mostrar.

### O que aconteceria se alguém violasse esta fronteira

Um componente que voltasse a importar `next/link`/`useRouter` diretamente continuaria funcionando —
a navegação em si não quebra — mas o loader institucional nunca apareceria para ela: a transição
ficaria visualmente inconsistente com o resto do produto, sem nenhum erro de tipo ou de execução
para denunciar isso. É exatamente o tipo de regressão silenciosa que CLAUDE.md §18.12 chama de
"divergência visual entre módulos sem justificativa".

### Qual teste guarda a fronteira

`no-restricted-imports` em `eslint.config.mjs` (raiz do monorepo, não um config próprio de
`apps/web`) bloqueia o import default de `next/link` e o import nomeado `useRouter` de
`next/navigation`, cada um com uma mensagem apontando para `specs/014-institutional-loader/STATE.md`
§2.3 e para o substituto correto. É uma guarda de build (falha o lint, não apenas um aviso de
revisão) — mas vale só para import direto; nada impede reescrever a mesma lógica sem importar esses
dois símbolos por nome, então a guarda protege o caso comum (import direto), não todo desvio
concebível.

### Consequências

Positivas: um único sinal de navegação pendente, reutilizável por todo módulo futuro sem reinventar
loading state; a exceção do login é a única, registrada e pequena.

Negativas: `useRouter` continua disponível para atualização de query string na mesma tela (via
`useNavigate(href, { replace: true })` ou, quando genuinamente necessário, com
`eslint-disable` explicando o motivo) — ou seja, a regra tem uma válvula de escape documentada, não
uma proibição absoluta, e isso exige disciplina de revisão para não virar rota de fuga de facto.

---

## ADR-024: `packages/api-types` gera dos contratos hand-authored; o documento OpenAPI refletido é só detector de deriva de rota

**Estado**: Aceita · 2026-09-14 (formaliza `docs/local-environment.md` D-14, decisão já implementada;
supera parcialmente o texto de ADR-009 quanto à origem dos tipos gerados)
**Contexto**: `docs/local-environment.md` D-5, D-11, D-14; `docs/deferred-findings.md` F-3;
`specs/001-grc-platform-foundation/research.md` ADR-009

### Contexto

ADR-009 (`specs/001-grc-platform-foundation/research.md`) descreve um documento OpenAPI gerado por
reflexão dos decoradores do NestJS como a fonte de `packages/api-types`. Isso nunca funcionou como
escrito: nenhum DTO deste código carrega `@ApiProperty`, então todo esquema de componente do
documento gerado (`apps/api/openapi.json`) é `{"type":"object","properties":{}}` — hoje **80**
esquemas, todos vazios, crescido a partir dos 6 que F-3 mediu originalmente. O gerador descreve
rotas, não campos. Regenerar `packages/api-types` a partir desse documento produziria um pacote que
compila e não entrega nada.

### Decisão

**Os contratos hand-authored são a fonte de verdade de campo; o documento refletido é só detector de
deriva de rota — nunca de campo.**

1. `packages/api-types` gera, via `openapi-typescript`, a partir dos 14 contratos hand-authored em
   `specs/<fase>/contracts/*.openapi.yaml` — um namespace TypeScript por documento (não fundidos:
   vários contratos compartilham nome de esquema, como `UserRef`/`OrgUnitRef`, com formas
   genuinamente diferentes). Esses contratos já são tratados como autoritativos quando divergem da
   implementação (D-5).
2. `apps/api/openapi.json` e `openapi:check` (`apps/api/scripts/check-openapi.ts`) permanecem
   exatamente como estão, descritos honestamente pelo que são: um detector de deriva **de rota**.
   Pegam rota adicionada, removida ou renomeada. Não veem campo de DTO renomeado, retipado ou
   removido, e não devem ser lidos como se vissem.
3. **Rejeitado deliberadamente**: anotar cada DTO com `@ApiProperty` para tornar o documento
   refletido autoritativo. Isso declararia a forma de cada campo duas vezes — uma para
   `class-validator`, uma para o Swagger — no mesmo arquivo, para sempre, sem nada mantendo as duas
   honestas entre si. É exatamente o convite à deriva que o contrato hand-authored existe para
   evitar.

### O que aconteceria se alguém violasse esta fronteira

- **Reintroduzir `@ApiProperty` em massa e regenerar `api-types` a partir de `apps/api/openapi.json`**
  pareceria uma simplificação ("um documento só") e reintroduziria exatamente a dupla declaração
  que a decisão rejeita — cada DTO precisaria manter duas descrições de campo sincronizadas à mão,
  para sempre, sem nada detectando a primeira vez que divergissem.
- **Um controlador que diverge do contrato** produz tipos que mentem — `packages/api-types` descreve
  o contrato, não a implementação. O que pega essa divergência é a suíte de teste de contrato (D-11),
  que exercita a superfície HTTP real contra os mesmos contratos — não este mecanismo de geração de
  tipos, e não `openapi:check`.

### Qual teste guarda a fronteira

`openapi:check` continua sendo a guarda de rota (falha o build se uma rota for adicionada, removida
ou renomeada sem atualizar `apps/api/openapi.json`). **Não existe hoje uma guarda dedicada que prove
que `packages/api-types` foi de fato gerado a partir dos contratos hand-authored e não do documento
refletido** — a garantia depende de `packages/api-types/scripts/generate.mjs` apontar para
`specs/*/contracts/*.openapi.yaml`, o que qualquer um pode alterar sem um teste falhando por isso.
Isso é uma lacuna honesta, não uma guarda que existe e este documento deixou de mencionar; um
candidato natural de guarda futura é um teste que leia `generate.mjs` do disco e falhe se sua fonte
deixar de ser `specs/*/contracts/*.openapi.yaml` — o mesmo padrão de "ler o arquivo de configuração
e afirmar contra ele" que `role-display-name.seed-sync.test.ts` (ADR-022) já usa.

### Consequências

Positivas: o frontend recebe tipos reais, com forma de campo completa, sem duplicar a declaração de
cada DTO; `openapi:check` continua útil pelo que genuinamente prova (superfície de rota), sem ser
tratado como prova de mais do que isso; a suíte de contrato (D-11) é quem efetivamente impede o
controlador de divergir do contrato que os tipos descrevem.

Negativas: dois documentos descrevem a API — o contrato hand-authored (fonte de verdade de campo) e
o documento refletido (fonte de verdade de rota) — e mantê-los conceitualmente alinhados depende da
suíte de teste de contrato, não de uma checagem estrutural única. `apps/web/src/lib/api-client.ts`
ainda não consome `@pharos/api-types` amplamente — a maioria das chamadas usa tipos locais e
estreitos — então o pacote existe e está correto, mas ainda não é a única fonte de forma de
requisição/resposta do frontend; isso é lacuna aberta, não algo que esta ADR resolve.
