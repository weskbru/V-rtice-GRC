# Research — Auditoria e Achados (Fase 4)

Decisões numeradas (D-1…D-19), cada uma com racional, alternativa descartada e consequência
aceita. Verificação de nomes pré-existentes: toda referência a código, tabela, enum ou permissão já
existente foi confirmada por grep contra `apps/api/src` e `apps/api/prisma/schema.prisma` antes de
ser escrita aqui — os resultados relevantes estão citados inline.

---

## D-1 — Relações declaradas (CLAUDE.md §19.2)

| Domínio | Relação | Mecanismo |
|---|---|---|
| Unidade Organizacional | `AuditEngagement.orgUnitId` (obrigatório, não nulo — mesma forma de `Risk.orgUnitId`/`Finding.orgUnitId`, confirmado em `schema.prisma:2202` e `:869`). | Coluna direta, escopo aplicado por `ScopeResolverService`/`OrgScopeEnforcerService`, os mesmos usados por `CloseFindingUseCase` hoje. |
| Risco | `Finding ↔ Risk` — a relação que a Fase 1 adiou. | Tabela de ligação nova `FindingRiskLink` (D-4), do lado de `grc/finding`. |
| Controle | `Finding ↔ Control` (a mesma dívida), **e** `AuditEngagement`'s escopo pode referenciar `Control` diretamente (FR-005). | `FindingControlLink` (D-4) e `AuditScopeControl` (D-2), duas tabelas distintas — uma liga achado a controle, outra liga engajamento a controle; confundi-las numa só apagaria a diferença entre "o que o exame cobriu" e "o que o achado aponta". |
| Ativo | Nenhuma. | Nem `spec.md` nem o roteiro (`docs/architecture/grc-roadmap.md` §"Fase 4") pedem `Audit↔Asset` ou `Finding↔Asset`. Ativo só se torna domínio na Fase 5; nada aqui o antecipa. |
| Processo | Nenhuma. | Mesma razão do Ativo — nenhum FR desta fase menciona Processo, e a Fase 5 é quem promove esse registro de referência a domínio. Antecipar a relação agora seria abstração prematura (CLAUDE.md §2). |
| Evidência | `Finding` já é um `EvidenceSubjectType` desde a Fase 1 (`finding-evidence-subject-accessor.ts`) — **inalterado**. O que esta fase acrescenta é uma REGRA nova que CONSOME essa relação já existente: fechar um achado passa a exigir ao menos um vínculo de evidência ativo (D-6). | Reuso puro — nenhum novo mecanismo de tipo fechado, apenas uma nova invariante de domínio lida sobre o registro já existente (`EvidenceLinkRepositoryPort`, ver D-6). |
| Ação | `Finding` já é um `ActionOriginType` desde a Fase 1 — **inalterado**, sem nova regra. | Reuso puro. |
| Requisito | `AuditEngagement`'s escopo referencia `Requirement` diretamente (FR-005). `Finding` **não** referencia `Requirement` diretamente — só transitivamente, através do `Control` que o achado aponta (que por sua vez satisfaz requisitos via `RequirementControlLink`, Fase 3). Ligar achado a requisito diretamente duplicaria um caminho que já existe via Controle, sem que nenhum FR peça o atalho. | `AuditScopeRequirement` (D-2) para o engajamento; nenhuma tabela nova para achado→requisito. |
| Auditoria (trilha) | Toda escrita relevante é auditada — seis tipos de entidade novos (D-10). | `AuditRecorder`, o mesmo mecanismo usado por todo módulo existente. |

---

## D-2 — Escopo do engajamento: FK direto para a linha imutável, nunca para o conceito mutável

**A pergunta que a tarefa marca como a mais interessante**: como o escopo sobrevive a uma revisão
da norma (FR-006), sem um segundo mecanismo de snapshot.

**Fatos verificados no código, não presumidos**:

- `FrameworkVersion` é imutável após publicação **na sua composição de requisitos**:
  `CreateRequirementUseCase` recusa `422` a criação de um novo `Requirement` assim que a versão-pai
  deixa de ser `DRAFT` (`create-requirement.usecase.ts`: "Permitted only while the parent version
  is `DRAFT` — refused with `422` once `PUBLISHED`"). Não existe caminho de código que adicione ou
  edite um `Requirement` de uma versão já publicada.
- `Requirement` em si é imutável após a publicação da sua versão, garantido por **trigger de
  banco** (`requirements_immutable_after_publish`, `schema.prisma:2394` e
  `specs/004-compliance-management/research.md` D-4) — não apenas pela camada de aplicação.
- `FrameworkVersionStatus` é de mão única (`DRAFT → PUBLISHED`, terminal) — não existe operação de
  "despublicar" (`schema.prisma:2306-2313`). Uma "revisão da norma" no sentido em que o edge case
  de `spec.md` a usa é sempre uma **nova** `FrameworkVersion` (nova norma, `2023` em vez de `2022`),
  nunca uma reescrita da versão antiga.
- `Control` **não** tem essa imutabilidade — nome, descrição, dono e demais campos descritivos são
  editáveis durante toda a vida operacional do controle, independente de status.

**Decisão**: o escopo do engajamento é uma FK direta para a linha específica —
`AuditScopeFrameworkVersion.frameworkVersionId`, `AuditScopeRequirement.requirementId`,
`AuditScopeControl.controlId` — nunca para `Framework` (o conceito mutável, "a norma" em
abstrato). Isso já é suficiente para sobreviver a uma revisão: como `FrameworkVersion` e
`Requirement` nunca mudam de conteúdo depois de escritos (o primeiro por convenção de caso de uso, o
segundo por trigger de banco), apontar para a versão/requisito específico **é** o snapshot — não
existe necessidade de duplicar título, `externalRef` ou qualquer outro campo numa tabela de escopo,
porque a linha apontada nunca vai divergir do que foi de fato examinado.

O "FK ingênuo" que a tarefa avisa não sobreviver é apontar para `frameworkId` (o conceito
version-agnostic): aí sim uma "revisão" — a próxima versão publicada — mudaria silenciosamente qual
conjunto de requisitos o escopo resolve, porque "a versão atual do framework X" é uma noção que se
move no tempo. Este desenho rejeita essa forma desde a primeira linha: `frameworkId` não existe como
FK em nenhuma tabela de escopo, só `frameworkVersionId`.

Para `Control`, cujo conteúdo descritivo *pode* mudar depois de vinculado, este desenho não introduz
snapshot algum — segue exatamente o precedente já estabelecido por `RiskControlLink` e
`RequirementControlLink`, nenhum dos quais congela o nome do controle no momento do vínculo. Um
achado ou escopo aponta para a IDENTIDADE do controle (o mesmo controle, independente de renomeação
posterior), não para uma fotografia do seu texto — a mesma distinção que `Risco → Controle` já faz.

**Regra adicional, não pedida por FR mas necessária para a garantia acima se sustentar**: vincular
escopo a uma `FrameworkVersion` exige que ela esteja `PUBLISHED`. Uma versão `DRAFT` ainda pode
receber novos `Requirement` e tê-los editados — auditar contra uma norma que ainda está sendo
escrita não é uma operação coerente, e admiti-la quebraria a premissa de imutabilidade que sustenta
toda esta decisão. Recusado com `422` (`ValidationDomainError`), mesma forma de toda outra recusa de
regra de negócio nesta API. **Consequência aceita**: um engajamento não pode ser escopado contra uma
norma ainda em elaboração — julgado correto, não uma limitação lamentável.

**Alternativa descartada**: escopo como snapshot textual (copiar `label`/`externalRef`/`title` para
colunas próprias de `AuditScope*`). Rejeitada porque duplicaria dados que já são, por construção,
imutáveis — exatamente a duplicação desnecessária que CLAUDE.md §13 pede para evitar, sem nenhum
ganho de garantia sobre o que a FK direta já entrega.

**Alternativa descartada**: escopo apontando para `frameworkId` com resolução "versão vigente no
momento da leitura". Rejeitada explicitamente — é o "FK ingênuo" que este próprio D-2 existe para
recusar.

---

## D-3 — Ciclo de vida do engajamento: três estados, dois avanços, cada um com consequência observável

| Estado | Como se chega | O que ele HABILITA | O que ele PROÍBE |
|---|---|---|---|
| `PLANNING` (inicial) | `POST /audits` | Editar campos descritivos (`PATCH`); adicionar vínculos de escopo (as três variantes, D-2). | **Registrar achado** — não existe operação que crie `Finding` a partir de um engajamento `PLANNING` (FR-007 exige "engajamento em execução"). |
| `IN_PROGRESS` | `POST /audits/{id}/start` — recusado (`422`) se nenhum vínculo de escopo existir (FR-003, SC-002-equivalente para engajamento). | Registrar achados a partir do engajamento (`POST /audits/{id}/findings`); os achados assim criados carregam `auditEngagementId`. | Editar campos descritivos e adicionar escopo — **decisão, não FR explícito**: uma vez em execução, o que está sendo examinado (o escopo) e os termos do exame (objetivo/período) não mudam sob o pé de quem está sendo auditado; ver "consequência aceita" abaixo. |
| `COMPLETED` (terminal) | `POST /audits/{id}/complete` | Nada de escrita — permanece integralmente legível (FR-004). | Registrar achado novo (FR-004, verificado por `assertLegalFindingTransition`-equivalente no lado do engajamento — ver `assertAuditEngagementAcceptsFindings` em data-model.md §7); editar; adicionar escopo. |

**Consequência aceita, não pedida literalmente por FR mas decidida por precedente**: bloquear
`PATCH`/escopo assim que `IN_PROGRESS` come inicia espelha exatamente a regra já aprovada para
`Requirement` ("editável só enquanto a versão-pai é `DRAFT`") e para `Framework`/`FrameworkVersion`.
Um FR explícito não pede isso; a alternativa (permitir editar objetivo/período/escopo durante a
execução) tornaria o registro do que foi examinado uma miragem — exatamente o problema que D-2 acaba
de fechar do lado do dado, reaberto do lado do processo se a edição continuasse liberada. Reportado
aqui, não decidido em silêncio.

**Sem tabela de transição dedicada** (ao contrário de `ControlLifecycleTransition`). Duas arestas,
cada uma disparando no máximo uma vez por engajamento, cada uma capturada como mudança de campo no
próprio evento `AUDIT_ENGAGEMENT` — a mesma forma que `FrameworkVersionStatus` já usa (research.md
D-3 de `004-compliance-management`) e pela mesma razão: `Control` precisou de uma tabela dedicada
porque tem 4 estados e 6 pares de transição legal, consultados por um endpoint de histórico
dedicado (`getControlLifecycle`) que nenhum FR desta fase pede para engajamento. Duas arestas
lineares não justificam esse custo.

**Alternativa descartada**: um quarto estado `CANCELLED`. Nenhum FR ou cenário de aceitação
menciona cancelamento de engajamento; adicioná-lo seria funcionalidade não especificada (CLAUDE.md
§2).

---

## D-4 — `Finding ↔ Control` e `Finding ↔ Risk`: duas tabelas de ligação, um porte novo

Fase 1 adiou esta decisão deliberadamente. `Control` e um produtor real de achado (o engajamento)
agora existem — a decisão pode ser tomada com a informação que faltava.

**Decisão**: duas tabelas explícitas e nomeadas, do lado que registra (`grc/finding`, ADR-020 parte
1) — `FindingControlLink` e `FindingRiskLink` — cada uma com FK real (`onDelete: Restrict`) para
`controls`/`risks` (ADR-020 parte 2), e tipo de entidade de auditoria próprio para cada uma
(`FINDING_CONTROL_LINK`, `FINDING_RISK_LINK` — D-10). Mesma forma exata de `RiskControlLink`:
`unlinkedAt`/`unlinkedByUserId` preservam o desvínculo (FR-016) em vez de apagar a linha.

**O lado Controle já tem porte pronto — verificado, não presumido**: `ControlDirectoryPort`
(`apps/api/src/shared/grc-ports/control-directory.port.ts`) já expõe exatamente
`{ id, code, name, orgUnitId, isActive }` e já tem `findById`. `grc/finding` pode depender dele
diretamente sem nenhuma mudança — este módulo é apenas o **quarto** consumidor
(`modules/risk`, `modules/compliance`, e agora `grc/finding`), e o **primeiro caso em que um
módulo do NÚCLEO GRC (`grc/**`), não um módulo de negócio, consome um porte de
`shared/grc-ports/`**. Isso é permitido pela fronteira já existente: a regra do lint é "`grc/**`
nunca importa de `modules/**`" (`apps/api/eslint.config.mjs:417`) — o sentido contrário, e
importar de `shared/**`, não tem restrição (`shared/**` é importável por tudo,
`eslint.config.mjs:39-41`). Não há problema estrutural; é um caso novo, registrado aqui porque é o
primeiro.

**O lado Risco não tem porte — confirmado por grep, não presumido**: buscando `RiskDirectoryPort`/
`riskDirectory` em `apps/api/src` não há nenhum resultado. Só existe a direção inversa
(`RiskControlLinkReadPort`, Controle lendo o vínculo que Risco já registrou). Este é o primeiro
porte de LEITURA DE IDENTIDADE de `Risk` para um consumidor externo (`grc/finding`). Introduzido
aqui: `shared/grc-ports/risk-directory.port.ts`, espelhando `ControlDirectoryPort` exatamente —
`{ id, code, title, orgUnitId, isActive }`, com `isActive` definido como `archivedAt IS NULL`
(nunca `status`) — ver a nota de forma mínima abaixo. Adaptador fornecido por `modules/risk`
(o módulo dono), ligado no *composition root*.

**Forma mínima da exposição (ADR-020 parte 4)**: nem `ControlDirectoryPort` nem o novo
`RiskDirectoryPort` expõem `status`/`ownerUserId`/`probability`/`impact` ou qualquer outro campo de
domínio — apenas identidade, rótulo, escopo e uma flag de "ainda relevante operacionalmente". Para
`Risk`, essa flag é deliberadamente **mais permissiva** que a de `Control`: `isActive` de `Control`
exige `status === 'ACTIVE'` (exclui `DRAFT`, `SUSPENDED` e `RETIRED`), mas `Risk` não tem um único
estado "operacional" — seu ciclo de vida (`DRAFT → IDENTIFIED → ASSESSED → UNDER_TREATMENT →
UNDER_REVIEW → ACCEPTED → CLOSED → ARCHIVED`) tem vários estados legitimamente referenciáveis por
um achado (um achado pode apontar para um risco `ACCEPTED` ou `CLOSED` sem que isso seja incoerente
— é exatamente o histórico que uma auditoria precisa preservar). Só `ARCHIVED` — o único estado que
`schema.prisma` documenta como "nunca hard-deletado; `CLOSED → ARCHIVED` é o único caminho que
grava esta coluna" (`schema.prisma:897-899`) — é excluído. `isActive = (archivedAt === null)`.

**Pré-condição de escrita (ADR-020 partes 4 e 5, desde o primeiro vínculo)**:
`LinkFindingToControlUseCase`/`LinkFindingToRiskUseCase` recusam (`422`,
`ValidationDomainError`) quando o alvo não existe, não está ativo, ou seu `orgUnitId` está fora do
escopo resolvido do ator — a MESMA checagem, na MESMA condição, que `LinkControlUseCase`/
`LinkRequirementToControlUseCase` já aplicam hoje (ver o relatório "Verificação em código —
2026-09-08 (correção 2)" no ADR-020). E exigem, além de `finding:link` (o lado que registra),
`control:view`/`risk:view` (o lado referenciado) — a parte 5 completa, corrigida em 2026-09-08 para
os dois pares já existentes e aplicada aqui **desde a primeira linha**, não descoberta depois.

**Desvincular** (`DELETE .../controls/{linkId}`, `.../risks/{linkId}`) não repete a checagem de
`control:view`/`risk:view` — o mesmo raciocínio que já isenta `UnlinkControlUseCase`: o `linkId`
só é obtido pela própria listagem (`GET /findings/{id}/controls`, sob `finding:view`), que já expôs
identificador, código e nome do alvo por completo. Exigir a permissão de novo não fecharia nenhum
oráculo novo.

**Vincular exige que o achado não esteja `ARCHIVED`** — mesma razão de `assertFindingEditable`
(um achado arquivado é terminal); esta é uma aplicação da invariante já existente, não uma nova.

**Alternativa descartada**: uma tabela genérica `FindingRelatedEntityLink(entityType, entityId)`.
Proibida explicitamente por CLAUDE.md §19.3.

**Alternativa descartada**: `Finding.controlId`/`Finding.riskId` como colunas simples (1:1). Um
achado pode legitimamente apontar para mais de um controle (uma falha sistêmica que atravessa
vários controles) ou mais de um risco — a mesma razão pela qual `RiskControlLink` é uma tabela e
não uma coluna em `Risk`.

---

## D-5 — Origem do achado no engajamento: FK nova, não um valor novo de `FindingOrigin`

**Verificado**: `FindingOrigin` hoje tem exatamente três valores —
`INTERNAL_ASSESSMENT | CONTROL_TESTING | MANAGEMENT_REVIEW` (`schema.prisma:2145-2149`,
confirmado também em `create-finding-request.dto.ts`'s `FINDING_ORIGIN_VALUES`). Nenhum descreve
"veio de um engajamento de auditoria" — e não deveriam: `origin` é uma classificação de NATUREZA do
achado (como foi descoberto), ortogonal a "qual engajamento o produziu" (uma referência a um
registro específico). Colapsar as duas coisas num enum perderia a rastreabilidade individual que
FR-007 pede ("a origem fica visível no próprio achado" — no sentido de QUAL engajamento, não apenas
QUE TIPO de exame).

**Decisão**: `Finding` ganha uma coluna nova, `auditEngagementId` — `uuid`, nula (achados manuais
continuam sem ela, FR-008), FK para `audit_engagements` (`onDelete: Restrict`). `origin` continua
sendo escolhido pelo auditor entre os três valores já existentes — nada nesta fase estende esse
enum. Esta é uma extensão de `Finding` que este módulo faz (permitido: o roteiro registra
explicitamente que "esta fase deve ser lida como estendendo `Finding`, não o criando").

**Consequência que este arquivo não resolve sozinho, reportada**: o schema de resposta `Finding` em
`contracts/grc-foundation.openapi.yaml` (owned por `002-shared-grc-foundation`, fora dos cinco
arquivos desta tarefa) precisará ganhar a propriedade `auditEngagementId` (nullable, `readOnly`)
para que a UI veja a origem — este documento não edita aquele arquivo; fica registrado aqui como
trabalho de acompanhamento necessário, não resolvido em silêncio.

**Alternativa descartada**: adicionar `AUDIT_ENGAGEMENT` a `FindingOrigin`. Descartada pela
confusão de conceitos explicada acima — e porque um achado sem engajamento já usa os três valores
existentes livremente; forçar um quarto valor exclusivo do caminho automático quebraria essa
liberdade sem necessidade.

---

## D-6 — Fechar um achado passa a exigir evidência: nova invariante, aditiva sobre a existente

**Conflito real encontrado, não presumido**: `finding.entity.ts`'s `assertFindingCloseRequirementMet`
(Invariante F1, já em produção desde a Fase 1) exige **ação concluída vinculada OU justificativa** —
nunca evidência. `CloseFindingUseCase` (`close-finding.usecase.ts`) confirma: a única consulta que
faz antes de fechar é `findCompletedLinkedActionResponsibles`; não há leitura de `EvidenceLink` em
lugar algum do caminho de fechamento hoje. `spec.md` FR-010/SC-003 e o edge case "Fechar achado cuja
evidência foi arquivada" exigem o oposto: evidência é obrigatória, e a especificação nem menciona
justificativa como alternativa.

**Decisão**: a exigência de evidência é **aditiva**, não substitutiva. Fechar um achado passa a
exigir **as duas coisas**: (a) Invariante F1 continua valendo tal como está (ação concluída OU
justificativa) — não é enfraquecida, não é removida; **e** (b) uma nova Invariante F5: existe ao
menos um `EvidenceLink` ATIVO (`unlinkedAt IS NULL`) com `subjectType = FINDING` e
`subjectId = <esta finding>`, verificado por um método novo em `EvidenceLinkRepositoryPort`
(`hasActiveLinkForSubject(subjectType, subjectId): Promise<boolean>` — aditivo, nenhum método
existente muda de assinatura). O status do `Evidence` referenciado pelo vínculo **não** é
verificado — o próprio edge case do spec confirma que evidência arquivada ainda sustenta o
fechamento; só a AUSÊNCIA de vínculo ativo recusa.

**Por que aditiva, e não substitutiva**: `finding.entity.ts`'s próprio cabeçalho já registra a
filosofia deste código — "rejecting [an edge] would be an undocumented NARROWING of the approved
model, a bigger risk than an edge no current caller exercises". Substituir F1 por F5 estreitaria
silenciosamente um comportamento já aprovado e testado (achados fechados por justificativa, sem
evidência, desde a Fase 1); a via aditiva preserva F1 integralmente e soma a exigência nova que
FR-010 pede — literalmente satisfeita ("DEVE exigir ao menos uma evidência", não "APENAS
evidência").

**Consequência aceita, e reportada como mudança de comportamento real**: um achado manual da Fase 1
que antes podia ser fechado só com justificativa (sem evidência nenhuma) deixa de poder, a partir
desta fase — em qualquer caminho, manual ou por engajamento, porque `CloseFindingUseCase` é uma
peça só, sem ramificação por origem. FR-010 não se limita a achados produzidos por engajamento; o
enunciado é sobre "achado", sem qualificação. Isso É uma mudança de contrato para o caminho já
existente, não apenas uma regra nova para o caminho novo — reportado explicitamente porque um
consumidor futuro (ou um teste de regressão da Fase 1) pode presumir o comportamento antigo.

**Alternativa descartada**: substituir F1 por F5 (evidência no lugar de ação/justificativa).
Descartada pela razão de estreitamento acima.

**Alternativa descartada**: exigir evidência só quando o achado tem `auditEngagementId` preenchido
(condicionar a regra à origem). Descartada porque FR-010 não faz essa distinção, e porque duas
regras de fechamento diferentes para a MESMA entidade, diferenciadas por um campo de proveniência,
seria exatamente o tipo de regra bifurcada que o calculador único de §19.7 existe para evitar —
aqui aplicado por analogia a uma invariante de domínio, não a um estado derivado, mas pelo mesmo
espírito: uma entidade, uma regra.

---

## D-7 — Permissões: colisão de nome encontrada e evitada; papel `Auditor` existente estendido, não duplicado

**Colisão real, confirmada por grep**: `audit:view` **já existe** — é uma permissão CORE
(`core/authorization/domain/permissions.ts:118,149`), que governa a leitura da TRILHA DE AUDITORIA
(`core/audit`), consumida hoje por `modules/risk/application/list-risk-audit-events.usecase.ts`.
Nomear as permissões deste módulo `audit:*` colidiria semanticamente com uma capacidade totalmente
diferente (a trilha, não o engajamento) — mesmo namespace, dois conceitos. `spec.md` FR-019 pede
"permissões próprias de auditoria" sem prever essa colisão; ela só aparece ao verificar o código.

**Decisão**: o recurso de permissão deste módulo é `audit-engagement`, nunca `audit`. Também por
isso o módulo em si vive em `modules/audit-engagements/`, não `modules/audit/` — que colidiria
visualmente com `core/audit/` (a trilha), já existente (`apps/api/src/core/audit`, confirmado).

Permissões novas (arquivo futuro `modules/audit-engagements/domain/audit-engagement-permissions.ts`,
seguindo `risk-permissions.ts`/`finding-permissions.ts` exatamente):

| Identificador | Ação | Cobre |
|---|---|---|
| `audit-engagement:view` | `VIEW` (reuso) | `GET /audits`, `GET /audits/{id}`, `GET /audits/{id}/scope`, `GET /audits/{id}/findings`. |
| `audit-engagement:create` | `CREATE` (reuso) | `POST /audits`. |
| `audit-engagement:edit` | `EDIT` (reuso) | `PATCH /audits/{id}` (só em `PLANNING`, D-3). |
| `audit-engagement:scope` | `LINK` (reuso) | `POST /audits/{id}/scope/*` (as três variantes). |
| `audit-engagement:transition` | `TRANSITION` (reuso) | `POST /audits/{id}/start`, `POST /audits/{id}/complete`. |

Extensões a `grc/finding` (arquivo existente `finding-permissions.ts`, aditivo):

| Identificador | Ação | Cobre |
|---|---|---|
| `finding:remediate` | `TRANSITION` (reuso) | `POST /findings/{id}/start-remediation` — a aresta `OPEN → IN_REMEDIATION`. |
| `finding:link` | `LINK` (reuso) | `POST`/`DELETE /findings/{id}/controls` e `.../risks`; `GET` usa `finding:view`, já existente. |

**Nenhum valor novo de `PermissionAction`** — `LINK` e `TRANSITION` já existem
(`schema.prisma:111-130`: `LINK` desde a Fase 1, para `evidence:link`; `TRANSITION` desde o módulo
de Risco, para `risk:transition`). Reutilizados aqui exatamente pelo mesmo motivo que os
introduziu: um verbo de domínio que os cinco padrões de CRUD não nomeiam, mas que já existe. Evita
uma migração `ADR-008`-style de crescimento de enum que nenhum verbo novo justifica —
`finding:remediate` é, semanticamente, uma transição de estado igual a `risk:transition`; `link` de
controle/risco a achado é, semanticamente, igual a `evidence:link`.

**FR-019 — "papel de auditor com leitura escopada"**: o papel `Auditor` **já existe**, semeado
(`prisma/seed/platform.seed.ts:331-345`), com `['risk:view', 'audit:view', 'evidence:view',
'action:view', 'finding:view']` e `globalScope: true`, descrito exatamente como "leitura... em toda
a organização". Este é precisamente o papel que FR-019 pede — apenas sem a permissão do módulo
novo. **Decisão**: estender o papel existente com `audit-engagement:view`, em vez de criar um
segundo papel de leitura (§19.4, "reutilizar antes de criar" — um papel de leitura global sobre GRC
já existe; duplicá-lo seria exatamente a proliferação que a regra proíbe).

Um segundo papel, novo — **"Audit Lead"** (nome a definir em pt-BR nos catálogos de UI, não neste
documento técnico) — recebe a autoridade de ESCRITA: `audit-engagement:create`,
`audit-engagement:edit`, `audit-engagement:scope`, `audit-engagement:transition`,
`finding:create` (já existe — reusado, não duplicado, o mesmo identificador que o caminho manual já
usa, FR-008), `finding:remediate`, `finding:link`, e `finding:close` (para fechar os achados que o
próprio engajamento produziu, uma vez remediados por outra pessoa — a segregação de funções de F2
continua sendo o que impede o mesmo ator de remediar e fechar, não a ausência da permissão).

**Consequência aceita**: `Read Only` e `Compliance Manager`, papéis existentes, não recebem nenhuma
permissão nova — nenhum FR pede isso, e estendê-los seria escopo não solicitado.

---

## D-8 — Código gerado: prefixo `AUD`, reusando o alocador existente

**Verificado**: `EntityCodePrefix` (`grc/shared/domain/entity-code.service.ts`) já é
`'EVD' | 'ACT' | 'FND' | 'CTL' | 'FMK'`, e seu próprio cabeçalho já registra o precedente de
extensão para conceitos de MÓDULO DE NEGÓCIO (`CTL` para `Control`, `FMK` para `Framework`), não só
para o núcleo GRC. `AuditEngagement` (`modules/audit-engagements`, um domínio de negócio) segue o
mesmo precedente: união estendida para incluir `'AUD'`, formato `AUD-2026-0001`, mesmo
`GrcCodeSequence` (contador por `(prefix, year)`) — nenhuma tabela de sequência nova.

**Alternativa descartada**: alocador de código dedicado para `AuditEngagement`. Rejeitada pela
mesma razão que already levou `CTL`/`FMK` a reusar este alocador — três (agora quatro) cópias do
mesmo contador seriam a duplicação que CLAUDE.md §13 pede para evitar.

---

## D-9 — Seis tipos de entidade de auditoria novos, um por fato de negócio distinto

Seguindo o crescimento aditivo já estabelecido (`AuditEntityType`, ADR-008, migração revisada) e a
mesma razão dada para `RISK_CONTROL_LINK`/`RISK_PROCESS_LINK`/`RISK_ASSET_LINK` e para os sete
valores da Fase 3: cada relação é um fato de negócio distinto, com sua própria lista de campos
auditáveis (`grc-audit-allowlist.ts`/`compliance-audit-allowlist.ts`'s próprio padrão).

| Valor novo | Cobre |
|---|---|
| `AUDIT_ENGAGEMENT` | Criação, edição, e as duas transições de ciclo de vida (D-3) — um evento por intenção (`audit_engagement.created`, `.updated`, `.started`, `.completed`), nunca um genérico `.updated` cobrindo tudo (FR-020). |
| `AUDIT_SCOPE_FRAMEWORK_VERSION` | Vínculo de escopo a uma versão de framework. |
| `AUDIT_SCOPE_REQUIREMENT` | Vínculo de escopo a um requisito. |
| `AUDIT_SCOPE_CONTROL` | Vínculo de escopo a um controle. |
| `FINDING_CONTROL_LINK` | Vincular/desvincular achado↔controle. |
| `FINDING_RISK_LINK` | Vincular/desvincular achado↔risco. |

**Sem tipo dedicado para "achado registrado a partir de engajamento"** — esse evento é
`finding.created` (o já existente, `AuditEntityType.FINDING`), com `auditEngagementId` no
`newValues` — não é um FATO diferente de "achado criado", só um achado criado com uma proveniência
específica; não justifica um sétimo valor.

**Sem tipo dedicado para "achado movido para remediação"** — é `finding.status` mudando via o
`AuditEntityType.FINDING` já existente (`finding.remediation_started`, um `action` novo, mesmo tipo
de entidade), a mesma forma que `finding.closed`/`finding.reopened`/`finding.archived` já usam.

---

## D-10 — A aresta `OPEN → IN_REMEDIATION`: já é legal na tabela; falta só a operação

**Verificado, não redesenhado**: `LEGAL_TRANSITIONS.OPEN` em `finding.entity.ts` já contém
`IN_REMEDIATION` (`OPEN: new Set<FindingStatus>(['IN_REMEDIATION', 'CLOSED'])`). O gap nomeado pelo
cabeçalho do arquivo não é de MODELO — é de OPERAÇÃO: nenhum caso de uso jamais chama
`assertLegalFindingTransition('OPEN', 'IN_REMEDIATION')`. Este módulo fecha o gap acrescentando
exatamente essa chamada, num novo `StartFindingRemediationUseCase`/`POST
/findings/{findingId}/start-remediation` — **sem tocar a tabela de transições**, que já está
correta e não muda.

Pré-condição: `assertLegalFindingTransition(current.status, 'IN_REMEDIATION')` (aceita a partir de
`OPEN`; a partir de `CLOSED` já existe por outro caminho, `reopenFinding` — este novo caso de uso
não duplica aquele, e não aceita `CLOSED` como origem, porque "iniciar remediação" de algo já
fechado não é a operação; reabrir é). Nenhuma outra invariante — sem segregação de funções, sem
exigência de evidência (essas pertencem ao FECHAMENTO, D-6, não ao início da remediação). Auditado
como `finding.remediation_started`, com `status: OPEN → IN_REMEDIATION` em `previousValues`/
`newValues`.

**Consequência para SC-002**: a prova exigida ("verificável pelo teste que a exercita, não pela
tabela de transições") é exatamente um teste de integração que chama esta operação sobre um achado
`OPEN` e confirma `IN_REMEDIATION` — este documento não escreve esse teste (fora do escopo de
`quickstart.md` como roteiro manual, não suíte automatizada), mas `quickstart.md` §4 inclui o
cenário equivalente executável manualmente.

---

## D-11 — As cinco partes do ADR-020, aplicadas desde o primeiro vínculo desta fase

A tarefa exige que este módulo aplique as cinco partes "desde o primeiro vínculo", não as
redescubra depois — as partes 4 e 5 só ficaram genuinamente fechadas, para os dois pares
anteriores, depois de duas correções relatadas na própria ADR. Tabela de conformidade, por par:

| Par | 1. Tabela nomeada | 2. FK real, `Restrict` | 3. Porte em `shared/` | 4. Porte expõe escopo; vínculo verifica antes de gravar | 5. Permissão dos dois lados; vincular/desvincular auditados |
|---|---|---|---|---|---|
| `Finding → Control` | `FindingControlLink` | Sim | `ControlDirectoryPort` (já existente, reusado) | Sim — `orgUnitId` de `ControlDirectoryPort` verificado antes de `create` (D-4) | `finding:link` + `control:view`, checado antes de qualquer escrita; desvincular só exige `finding:link` (mesma isenção já aceita para os pares anteriores) |
| `Finding → Risk` | `FindingRiskLink` | Sim | `RiskDirectoryPort` (**novo**, D-4) | Sim — mesma forma | `finding:link` + `risk:view`, mesma forma |
| `Audit → FrameworkVersion` (escopo) | `AuditScopeFrameworkVersion` | Sim | Nenhum porte cruzando módulo — `FrameworkVersion` é lido diretamente por `modules/compliance`'s próprio repositório quando `modules/audit-engagements` **importaria** compliance, o que ADR-011 proíbe. Ver nota abaixo. | **Não se aplica literalmente** — `FrameworkVersion`/`Requirement` não têm `orgUnitId` (catálogo global, D-2 de `004-compliance-management`); não há escopo organizacional para verificar. | `audit-engagement:scope` + `compliance:view`, checado antes de gravar |
| `Audit → Requirement` (escopo) | `AuditScopeRequirement` | Sim | idem acima | Não se aplica (mesma razão) | `audit-engagement:scope` + `compliance:view` |
| `Audit → Control` (escopo) | `AuditScopeControl` | Sim | `ControlDirectoryPort` (reusado) | Sim | `audit-engagement:scope` + `control:view` |

**Nota sobre o porte que falta para `Audit → FrameworkVersion`/`Audit → Requirement`**: como
`Framework`/`FrameworkVersion`/`Requirement` são domínio de `modules/compliance`, e
`modules/audit-engagements` não pode importar `modules/compliance` (ADR-011), este módulo precisa
de portes de leitura análogos a `ControlDirectoryPort`, mas para `FrameworkVersion` e `Requirement`
— **`FrameworkVersionDirectoryPort`** e **`RequirementDirectoryPort`**, ambos novos, em
`shared/grc-ports/`, adaptador fornecido por `modules/compliance`. Expondo o mínimo:
`{ id, label, status }` para o primeiro (sem `orgUnitId` — não existe); `{ id, externalRef, title,
frameworkVersionId }` para o segundo. Este é o **primeiro** consumidor desses dois conceitos fora
de `modules/compliance`, exatamente como `Finding → Control`/`Finding → Risk` são os primeiros
consumidores novos de `ControlDirectoryPort` fora do par original — reportado aqui como a mesma
classe de evento que a ADR-020 pede para ser relatado, não descoberto depois.

---

## D-12 — Sem endpoint de remoção do vínculo de escopo do engajamento

`FR-016` ("Desfazer um vínculo DEVE preservar o registro com autor e data") está na seção
"Functional Requirements — relações", que a leitura de FR-013 a FR-016 junto ao User Story 3 deixa
claro que trata de `Finding ↔ Control`/`Finding ↔ Risk` — não do escopo do engajamento (User Story
1). Nenhum cenário de aceitação do User Story 1 pede remover um vínculo de escopo, e o próprio
espírito de FR-006 ("o escopo registrado preserva o que foi examinado") empurra contra permitir
remoção mesmo em `PLANNING`: um vínculo de escopo adicionado e depois removido, se REMOVIDO de
verdade (não apenas marcado), apagaria um fato ("alguém decidiu examinar isto, e depois
reconsiderou") que uma auditoria também poderia querer preservar.

**Decisão**: nenhuma operação de remoção de vínculo de escopo nesta fase. Um vínculo adicionado por
engano permanece — corrigido adicionando o vínculo certo, nunca removendo o errado. **Isto é mais
estreito que `Finding ↔ Control`/`Finding ↔ Risk`, deliberadamente** — reportado explicitamente
porque poderia parecer inconsistência; é, na verdade, a mesma filosofia de D-2 (preservar o que foi
decidido) aplicada de forma mais estrita porque nenhum FR pede o relaxamento que FR-016 concede ao
outro par.

**Se esta leitura estiver errada** — se o espírito de `spec.md` realmente quis um `DELETE` também
para o escopo — está sinalizado aqui, não decidido silenciosamente contra a intenção do autor da
especificação.

---

## D-13 — `PATCH /audits/{id}`: inferido por precedente, não pedido literalmente por nenhum FR

Nenhum FR desta fase pede edição pós-criação de objetivo/período/responsável. Toda outra entidade
raiz nova de fases anteriores (`Framework`, `FrameworkVersion`, `Requirement`, `Control`) tem uma
operação de edição enquanto em estado inicial/rascunho — a ausência aqui pareceria uma lacuna, não
uma decisão. **Decisão**: incluir `PATCH /audits/{id}`, editável só em `PLANNING` (D-3), pelo mesmo
precedente. **Reportado como inferência de design, não como requisito rastreável a um FR** — se a
intenção da especificação for "engajamento é imutável desde a criação", este documento erra por
excesso, não por omissão, e a operação deveria ser removida em revisão.

---

## D-14 — Nenhuma leitura desta fase expõe estado derivado no momento da leitura

Toda propriedade em toda resposta desta API é uma coluna gravada por uma escrita anterior explícita
— `AuditEngagement.status`, `Finding.status` (já assim desde a Fase 1), os campos de vínculo
(`linkedAt`/`unlinkedAt`). Nenhuma operação desta fase computa, no momento da leitura, um valor a
partir de um join com estado de OUTRO módulo que possa mudar sem que este módulo seja escrito — a
diferença exata que fez `RequirementComplianceReaderService`/`getRequirement` (Fase 3) precisarem
de `Cache-Control: no-store` sem `ETag` de versão (aquele defeito, corrigido em 2026-09-08 depois
de já ter sido publicado: `apps/api/src/modules/compliance/presentation/requirement.controller.ts`,
"Deliberately never sets an explicit, VERSION-based `ETag`").

Este módulo não tem equivalente a `complianceState`. `GET /audits/{id}/findings` lista achados por
`auditEngagementId` — um filtro, não um cálculo; cada acha do listado carrega seu próprio `status`
gravado, não um estado agregado do engajamento. **Nenhum endpoint desta fase declara
`Cache-Control: no-store`**, e nenhum é dispensado dessa obrigação por omissão silenciosa — é
declarado aqui, explicitamente, que a condição que ativaria a regra não ocorre neste módulo.

Se uma fase futura adicionar um resumo agregado ao engajamento (contagem de achados por
severidade, por exemplo — não pedido por nenhum FR desta fase), essa leitura passará a precisar da
mesma proteção, e este parágrafo deixará de valer para ela especificamente.

---

## D-15 — Nomeação do módulo: `modules/audit-engagements/`, não `modules/audit/`

Já registrado em D-7: `core/audit/` existe e é a trilha de auditoria transversal da plataforma —
capacidade completamente diferente de "conduzir um engajamento de auditoria". Nomear o módulo de
negócio novo `modules/audit/` colidiria visualmente e crescentemente com `core/audit/` em toda
importação, log e mensagem de erro. `modules/audit-engagements/` é mais longo mas inequívoco —
consistente com o recurso de permissão `audit-engagement:*` (D-7) e com o prefixo de código `AUD`
(D-8, que não sofre a mesma colisão porque prefixos de três letras não colidem com "trilha").

---

## D-16 — Exibição recíproca do lado do Risco (US3, cenário de aceitação 2): sinalizado, não resolvido aqui

O cenário de aceitação 2 do User Story 3 diz: "e o risco passa a mostrar que um achado o
referencia". Interpretado literalmente, isso pede uma leitura do LADO DO RISCO (por exemplo,
`GET /risks/{riskId}/findings`) — uma rota que pertenceria ao contrato de `modules/risk`
(`specs/001-grc-platform-foundation` ou uma revisão futura dele), não a
`contracts/audit.openapi.yaml`, pela mesma razão que `GET /controls/{controlId}/risks` vive em
`controls.openapi.yaml` e não em `risks.openapi.yaml` — a leitura recíproca pertence ao contrato do
lado que a expõe, lido através de um porte novo (`FindingReferenceReadPort`, mesma forma de
`RiskControlLinkReadPort`) que `grc/finding` forneceria e `modules/risk` consumiria.

**Este documento não cria essa rota** — está fora dos cinco arquivos que esta tarefa possui, e
adicioná-la ao arquivo errado (`audit.openapi.yaml`) contrariaria o próprio precedente que a
justifica. **Sinalizado explicitamente, não resolvido em silêncio**: a Fase 4, ao ser implementada,
precisa de uma tarefa que edite o contrato de Risco (ou o substitua por uma revisão), acrescentando
`GET /risks/{riskId}/findings`, apoiada num porte novo que este documento já nomeia
(`FindingReferenceReadPort`, em `shared/grc-ports/`, adaptador fornecido por `grc/finding`) para que
quem construir essa tarefa não precise redescobrir a forma — só implementá-la.

O mesmo vale, por simetria, para o lado do Controle: `GET /controls/{controlId}/findings` no
contrato de Controles.

---

## D-17 — `docs/deferred-findings.md`: nenhum item novo registrado por este documento

Nenhuma decisão acima introduz uma dívida nova e silenciosa — D-5, D-12 e D-16 já são, elas mesmas,
o registro da dívida (respectivamente: schema de resposta de `Finding` em `grc-foundation.openapi.yaml`
pendente de um campo; ausência deliberada de remoção de escopo; rota recíproca do lado de Risco/
Controle). Como este documento não edita código, não há entrada de `deferred-findings.md` para
abrir — essa entrada, se necessária, pertence à tarefa de implementação que primeiro constatar a
lacuna em código real (CLAUDE.md §19.10: um ponto de extensão só conta depois de executado; o mesmo
vale, por analogia, para uma dívida documentada — só é dívida real quando o código existe e ainda
não a fecha).

---

## D-18 — `AuditEngagement` usa concorrência otimista; `Finding` continua sem ela

`Risk`, `Control`, `Framework`, `FrameworkVersion` e `Requirement` — toda entidade raiz introduzida
desde a Fase 2 — têm uma coluna `version` e usam `ETag`/`If-Match` no contrato. `Finding`
(Fase 1) não tem `version` — confirmado no schema (`model Finding`, `schema.prisma:2202-2240`, sem
campo `version`) — e nenhuma operação do contrato existente (`grc-foundation.openapi.yaml`) usa
`ETag`/`If-Match` para ela; a proteção contra escrita concorrente ali é inteiramente a tabela de
transições (`assertLegalFindingTransition`), que rejeita uma segunda escrita incompatível em vez de
detectar uma versão obsoleta.

**Decisão**: `AuditEngagement`, sendo uma entidade raiz nova, segue a convenção ATUAL (a que
`Control`/`Framework` estabelecem), não a forma mais antiga de `Finding` — `version` int,
`ETag`/`If-Match` em `PATCH`/`start`/`complete`, `409` em conflito. As operações NOVAS sobre
`Finding` que este módulo acrescenta (`start-remediation`, `controls`, `risks`) seguem a forma que
`Finding` já tem — sem `ETag`, mesma proteção por tabela de transição — para não introduzir uma
mistura de convenções DENTRO da mesma entidade (`Finding` só teria `ETag` em ALGUMAS operações,
mais confuso que não tê-lo em nenhuma). **Consequência aceita**: `Finding` continua sem
concorrência otimista nesta fase; corrigir isso, se necessário, é uma decisão de uma fase futura
que tocaria o contrato de 002, fora do escopo desta.

---

## D-19 — Resumo do que este módulo NÃO constrói (limites explícitos)

- Nenhum motor de correspondência ou sugestão automática (mesma disciplina de D-6 de
  `004-compliance-management`, aplicada aqui por princípio, não por reuso de código).
- Nenhuma tabela de transição dedicada para o ciclo de vida do engajamento (D-3).
- Nenhuma remoção de vínculo de escopo (D-12).
- Nenhum quarto estado de engajamento (`CANCELLED`) (D-3).
- Nenhuma alteração ao enum `FindingOrigin` (D-5).
- Nenhuma alteração à tabela de transições de `Finding` (D-10) — o gap era de operação, não de
  modelo.
- Nenhuma importação de programa de auditoria externo (`spec.md`, Assumptions).
- Nenhum indicador ou relatório de auditoria (`spec.md`, Assumptions — fase posterior).
