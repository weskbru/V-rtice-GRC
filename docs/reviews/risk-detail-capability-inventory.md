# Inventário de capacidades — Detalhe do Risco (pré-redesenho)

> Onda 1 do AGENTE 2. Este documento é só medição — não propõe design nem solução. Todo item
> carrega `arquivo:linha`. Onde uma linha exata não é aplicável (ex.: um endpoint documentado no
> corpo de `risksApi`), o arquivo é sempre indicado.
>
> Arquivo sob inventário: `apps/web/src/app/(app)/risks/[id]/risk-detail-view.tsx` (472 linhas).
> Todas as referências de linha abaixo foram lidas diretamente do código nesta data (2026-09-15).

---

## 0. Visão geral estrutural

`RiskDetailView` (`risk-detail-view.tsx:81-472`) monta, nesta ordem:

1. `EntityHeader` (linhas 192-250) — código, título, badges de status/aprovação/nível, metadados
   (gestor, responsável, unidade, identificação, próxima revisão) e a ação "Editar".
2. `RiskLifecycleActions` (linha 252-258) — barra de ações de ciclo de vida, **fora** do sistema de
   abas, sempre montada independentemente da aba ativa.
3. `EntityTabs` (linhas 260-469) — 14 abas candidatas, das quais 2 (`audit`, `evidence`... na
   verdade `evidence` e `findings`) carregam `visible` condicional.

`EntityTabs` (`packages/design-system/src/components/entity/entity-tabs.tsx:146-252`) filtra por
`tab.visible !== false` (linha 153) e **omite inteiramente** — nunca desabilita — uma aba invisível,
tanto da lista quanto do conteúdo montado (comentário da própria interface, linhas 16-26). O
comentário de cabeçalho do componente (linha 135) ainda diz "a risk detail screen now has twelve"
— **desatualizado**: são 14 abas candidatas hoje (`incidents`/`problems` foram adicionadas depois
desse comentário ter sido escrito, sem atualizá-lo).

---

## 1. Seções (abas) atuais

Rótulos vêm de `risks.detail.sections` (`apps/web/src/lib/messages/risks.ts:665-689`).

| # | `id` | Rótulo pt-BR | Linha do rótulo em `risks.ts` | Componente(s) | `visible` |
|---|------|--------------|-------------------------------|----------------|-----------|
| 1 | `overview` | "Visão geral" | 667 | `RiskForm` (modo edição) OU `RiskOverview` (`risk-detail-view.tsx:268-284`) | sempre |
| 2 | `causes-consequences` | "Causas e Consequências" | 669 | `RiskCausesConsequences` (285-312) | sempre |
| 3 | `assessment` | "Avaliação" | 668 | `RiskAssessmentSection` + `RiskReviewSchedule` + `AssessmentForm` (condicional) + `AssessmentHistory` (313-340) | sempre |
| 4 | `controls` | "Controles" | 670 | `RiskControlsSection` (341-353) — na verdade três subseções: Controles, Processos, Ativos | sempre |
| 5 | `incidents` | "Incidentes" | 687 | `RiskIncidentLinksSection` (354-358) | sempre |
| 6 | `problems` | "Problemas" | 688 | `RiskProblemLinksSection` (359-363) | sempre |
| 7 | `treatment` | "Tratamento" | 671 | `RiskTreatmentSection` + aviso de ponteiro para "Planos de Ação" (364-384) | sempre |
| 8 | `action-plans` | "Planos de Ação" | 672 | `TreatmentActionsTable` (385-399) | sempre |
| 9 | `history` | "Histórico" | 673 | `RiskHistorySection` (400-404) | sempre |
| 10 | `audit` | "Auditoria" | 674 | `RiskAuditSection` (405-410) | `canViewAudit` = `hasPermission('audit:view')` (linha 154, 409) |
| 11 | `attachments` | "Anexos" | 675 | `RiskAttachmentsSection` (411-421) | sempre |
| 12 | `comments` | "Comentários" | 676 | `RiskCommentsSection` (422-432) | sempre |
| 13 | `evidence` | "Evidência" | 680 (com comentário 677-679) | `EvidencePanel` (`@/features/evidence/components/evidence-panel`) (433-450) | `canViewEvidence` = `hasPermission('evidence:view')` (159, 449) |
| 14 | `findings` | "Achados" | 685 (com comentário 681-684) | `FindingsPanel` (`@/features/findings/components/findings-panel`) (451-467) | `canViewFindings` = `hasPermission('finding:view')` (163, 466) |

**Dados por seção (o que cada uma apresenta):**

1. **Visão geral** (`risk-overview.tsx:48-153`) — descrição (card próprio, texto completo), bloco de
   classificação (categoria/tipo/origem, estilo "muted"), bloco de responsabilidade e datas (unidade,
   gestor, responsável, identificado em, última avaliação, próxima revisão), dois cards de nível de
   risco (inerente/residual) com estado honesto "ainda não avaliado" (linhas 118-128, 135-145) quando
   não há avaliação. Em modo edição, `RiskForm` (870 linhas) substitui todo o conteúdo — não é uma
   sobreposição, é troca total do painel (linha 270-283).
2. **Causas e Consequências** (`risk-causes-consequences.tsx`) — duas listas independentes
   (`useFieldArray`), cada uma salva com seu próprio `PUT`.
3. **Avaliação** — `RiskAssessmentSection` (avaliação vigente, somente leitura, matriz com destaque
   inerente/residual), `RiskReviewSchedule` (data da próxima revisão + indicador de atraso),
   `AssessmentForm` (só se `canAssess`, formulário completo de nova avaliação com matriz interativa),
   `AssessmentHistory` (tabela paginada de todo o histórico de avaliações, nunca sobrescreve).
4. **Controles** — três subseções sob o mesmo componente: Controles (`risk.controls`), Processos
   (`risk.processes`), Ativos (`risk.assets`) — cada uma com tabela de vínculos atuais + picker de
   vínculo (`risk-controls-section.tsx:337-407`).
5. **Incidentes** — tabela somente leitura de incidentes vinculados a este risco
   (`risk-incident-problem-links-section.tsx:72-155`).
6. **Problemas** — tabela somente leitura de problemas vinculados a este risco (mesma arquivo,
   157-244).
7. **Tratamento** — decisão de tratamento vigente (somente leitura), formulário de nova decisão (só
   se `canTreat`), aviso textual de que as ações desta decisão vivem na aba "Planos de Ação"
   (`risks.treatment.actionsMovedNotice`, linha 1403 de `risks.ts`; usado em `risk-detail-view.tsx:379-381`),
   histórico de decisões paginado (`TreatmentHistory`, dentro de `risk-treatment-section.tsx:104-249`).
8. **Planos de Ação** — `TreatmentActionsTable` (853 linhas): tabela paginada de ações de tratamento,
   contador total/atrasadas, criação, edição, transições de ciclo de vida (via menu por linha) e
   reabertura com motivo.
9. **Histórico** — `RiskHistorySection`: cronologia mesclada (avaliações, decisões de tratamento,
   transições, aprovações, mudanças de responsável), com filtro por tipo de evento
   (`MultiSelectFilter`), distinção explícita "Registrado em" vs. "Data informada" (F-9).
10. **Auditoria** — `RiskAuditSection`: trilha bruta de auditoria, paginada, com resolução de
    IDs→nomes para campos alterados (categoria/tipo/origem/unidade/usuário), tratamento explícito de
    403 (`risks.audit.forbidden`).
11. **Anexos** — `RiskAttachmentsSection`: lista paginada, upload (com allow-list visível antes do
    envio), remoção com confirmação.
12. **Comentários** — `RiskCommentsSection`: lista paginada, novo comentário, remoção com confirmação.
13. **Evidência** — `EvidencePanel`: evidências **vinculadas a este risco especificamente**
    (`GET /evidence?subjectType=RISK&subjectId={riskId}`, via `evidenceApi.listBySubject`,
    `evidence-panel.tsx:93-94`) — criação, vínculo/desvínculo, arquivamento, upload de anexo por
    evidência.
14. **Achados** — `FindingsPanel`: **ATENÇÃO** — lista achados da **unidade organizacional do risco
    inteira** (`GET /findings?orgUnitId=`, `findings-panel.tsx:184-185`), **não** achados vinculados
    especificamente a este risco. O vínculo achado↔risco (`FindingRiskLink`) é renderizado por
    finding via `FindingLinksSection` dentro de cada card, não como filtro da listagem em si
    (comentário do próprio arquivo, linhas 13-24). Isto é comportamento deliberado e documentado no
    código, não um defeito — mas é uma armadilha real para um redesenho: qualquer leitor que assuma
    "a aba Achados desta tela = achados deste risco" está errado, e uma reestruturação que passe a
    filtrar por `riskId` mudaria comportamento observável.

---

## 2. Inventário de ações

Convenção: "Endpoint" é sempre chamado através de `risksApi` (`apps/web/src/features/risks/api.ts`)
salvo indicação contrária. Toda permissão é uma checagem `hasPermission(...)` client-side apenas
consultiva (`apps/web/src/lib/permissions.ts:1-29`) — o servidor reforça de forma independente em
toda chamada (ADR-003).

| Ação | Controle (arquivo:linha) | Permissão | Endpoint | Pré-condição de dado |
|---|---|---|---|---|
| Editar risco (abrir formulário) | `risk-detail-view.tsx:243-249` (botão "Editar" no header) | `canEdit = hasPermission('risk:edit')` (150) | — (troca de estado local `editing`) | nenhuma |
| Salvar edição do risco | `risk-form.tsx:390` (`updateRisk`) | `risk:edit` (server) | `PATCH /risks/{riskId}` | título, descrição, unidade, gestor, data de identificação obrigatórios (`risk-form.tsx:551-831`); categoria/tipo/origem/responsável/próxima revisão opcionais |
| Criar risco (form em modo `create`) | `risk-form.tsx:378` | `risk:create` (server) | `POST /risks` | mesmos campos obrigatórios acima |
| Transição imediata de ciclo de vida | `risk-lifecycle-actions.tsx:358-377` (botão por `transition` disponível) | vem filtrada do servidor (`GET .../lifecycle`); componente não reimplementa regra (doc, linhas 7-18) | `POST /risks/{riskId}/transitions` (`api.ts:492-503`) | `transition.preconditionsMet`; se falso, botão fica `disabled` e lista `unmetPreconditions` (linhas 361, 378-389) |
| Solicitar aprovação (transição `requiresApproval`) | `risk-lifecycle-actions.tsx:363-367` abre `RequestApprovalDialog` | vem filtrada do servidor (o botão só existe se o servidor incluiu a transição); dialog em si não checa permissão | `POST /risks/{riskId}/approvals` (`api.ts:512-523`) | mesma — `preconditionsMet` |
| Aprovar/Rejeitar aprovação pendente | `risk-lifecycle-actions.tsx:334-343` | `canApprove = hasPermission('risk:approve')` (153) **E** `!isOwnRequest` (linha 293, 328-346) — auto-aprovação bloqueada no cliente (FR-029a) | `POST /risks/{riskId}/approvals/{approvalId}/decision` (`api.ts:531-543`) | existência de `pendingApproval`; rejeição pede justificativa como nudge client-side, não bloqueio real (`approval-dialogs.tsx:244-247`) |
| Registrar avaliação | `assessment-form.tsx:437-442` (botão "Registrar avaliação") | `canAssess = hasPermission('risk:assess')` — condiciona a MONTAGEM do formulário inteiro (`risk-detail-view.tsx:327`) | `POST /risks/{riskId}/assessments` (`api.ts:171-182`) | seleção obrigatória de célula inerente E residual na matriz (`assessment-form.tsx:211-220`); `methodologyVersionId` fixado no load, gera 422 explícito se mudar (linhas 158-166) |
| Agendar/editar próxima revisão | `risk-review-schedule.tsx:127-132` | nenhuma checagem de permissão própria no componente — sempre visível; servidor reforça `risk:edit` via `PATCH /risks/{riskId}` | `PATCH /risks/{riskId}` (`api.ts:105-114`, chamado com `{ nextReviewOn }`) | nenhuma |
| Adicionar/remover causa | `risk-causes-consequences.tsx:134` (`append`)/`120` (`remove`) dentro de `RowsEditor` | nenhuma checagem própria — a aba inteira está sempre visível; servidor reforça em `PUT` | `PUT /risks/{riskId}/causes` (`api.ts:116-127`) | linha em branco bloqueia salvamento (`rowRequired`, linhas 174-185) |
| Adicionar/remover consequência | mesmo arquivo, mesma UI (kind='consequence') | idem | `PUT /risks/{riskId}/consequences` (`api.ts:129-140`) | idem |
| Vincular controle | `risk-controls-section.tsx:285-309` (`RelationshipSubsection`, instância "controls") | `canTreatControls = hasPermission('risk:treat')` — **não** `risk:edit` (contrato explícito, doc 32-36) | `POST /risks/{riskId}/controls` (`api.ts:322-333`) | conflito 409 tratado como "já vinculado" (`risk-controls-section.tsx:183-187`) |
| Desvincular controle | `risk-controls-section.tsx:242-253` (botão "Desvincular" por linha) + `ConfirmDialog` (315-332) | mesma (`canTreatControls`) | `DELETE /risks/{riskId}/controls/{linkId}` (`api.ts:336-341`) | confirmação obrigatória antes do envio |
| Vincular processo | `risk-controls-section.tsx:374-388` | `canEditRelationships = hasPermission('risk:edit')` — permissão DISTINTA de controles (doc 32-36) | `POST /risks/{riskId}/processes` (`api.ts:343-354`) | nenhuma além da 409 |
| Desvincular processo | mesma subseção, mesmo padrão de `ConfirmDialog` | `canEditRelationships` | `DELETE /risks/{riskId}/processes/{linkId}` (`api.ts:356-361`) | confirmação |
| Vincular ativo | `risk-controls-section.tsx:390-404` | `canEditRelationships` | `POST /risks/{riskId}/assets` (`api.ts:363-374`) | 409 |
| Desvincular ativo | mesma subseção | `canEditRelationships` | `DELETE /risks/{riskId}/assets/{linkId}` (`api.ts:376-381`) | confirmação |
| Registrar decisão de tratamento | `risk-treatment-section.tsx:528-535` (botão "Registrar decisão", formulário 384-538) | `canTreat = hasPermission('risk:treat')` — **condiciona a montagem do formulário inteiro** (linha 384, não apenas o botão) | `POST /risks/{riskId}/treatments` (`api.ts:219-230`) | estratégia e descrição obrigatórias (`risk-treatment-section.tsx:305-313`); prazo opcional; se já existe decisão vigente, aviso de supersessão é mostrado ANTES do envio (linhas 404-413) — **verificado no código**: não há checagem de "decisão de tratamento vigente" como pré-condição para REGISTRAR uma nova — qualquer decisão nova sempre pode ser registrada, supersedendo a anterior se existir |
| Criar ação de tratamento (Plano de Ação) | `treatment-actions-table.tsx:711-714` (botão "Adicionar ação") | `canTreat = hasPermission('risk:treat')` — único gate para criar/editar/transicionar (doc, linhas 65-70) | `POST /risks/{riskId}/treatment-actions` (`api.ts:254-265`) | **verificado**: `treatmentDecisionId: currentTreatmentId` é enviado automaticamente (linha 298) mas pode ser `null` — **não há bloqueio no formulário se não existir decisão de tratamento vigente**; título, responsável e prazo são obrigatórios (`validateForm`, linhas 187-193) |
| Editar ação de tratamento | `treatment-actions-table.tsx:544-546` (item de menu "Editar") | `canTreat` | `PATCH /risks/{riskId}/treatment-actions/{actionId}` (`api.ts:272-284`) | mesmos campos obrigatórios do formulário de criação |
| Concluir/Iniciar/Cancelar ação (transição sem motivo) | `treatment-actions-table.tsx:547-560` (itens de menu dinâmicos via `availableTransitions`) | `canTreat` | `PATCH /risks/{riskId}/treatment-actions/{actionId}` com `{ status }` (linha 388) | transição precisa constar em `availableTransitions(action.status)` (`features/actions/status.ts`) |
| Reabrir ação (transição com motivo) | `treatment-actions-table.tsx:551-552` abre `ReopenActionDialog` | `canTreat` | `PATCH /risks/{riskId}/treatment-actions/{actionId}` com `{ status: 'OPEN', reopenReason }` (linha 428) | motivo obrigatório (reforçado no servidor, `action.entity.ts#assertReopenReasonProvided`, doc 407-414) |
| Registrar evidência (criar) | `evidence-panel.tsx:176-179` (botão "Nova evidência") abre `EvidenceCreateDialog` | `canCreate = hasPermission('evidence:create')` (161, prop `canCreate`) | `POST /evidence` (dentro de `EvidenceCreateDialog`, não lido neste inventário — fora do escopo do arquivo de detalhe do risco) | vínculo automático ao `subjectId=risk.id` no mesmo fluxo |
| Desvincular evidência | `evidence-panel.tsx:232-236` + `ConfirmDialog` (303-320) | `canLink = hasPermission('evidence:link')` (161) **E** `item.status === 'ACTIVE'` **E** existência de `linkIdByEvidenceId[item.id]` (linha 232) | `evidenceApi.unlinkEvidence(evidenceId, linkId)` → `DELETE` sobre o vínculo | evidência precisa estar `ACTIVE`; link precisa ter sido resolvido (chamada extra `evidenceApi.listLinks` por item, linhas 103-119) |
| Arquivar evidência | `evidence-panel.tsx:238-243` + `ConfirmDialog` (282-301) | `canAdminister = hasPermission('evidence:administer')` (162) **E** `item.status === 'ACTIVE'` | `evidenceApi.archiveEvidence(id)` | evidência precisa estar `ACTIVE` |
| Anexar arquivo a uma evidência | `evidence-panel.tsx:258-263` (`EvidenceAttachmentsSection`) | `canUploadAttachment = hasPermission('attachment:create')` (157) **E** `item.status === 'ACTIVE'` (linha 261) | não lido em detalhe (componente separado `evidence-attachments-section.tsx`, fora do arquivo de detalhe do risco) | evidência `ACTIVE` |
| Retirar anexo de evidência | mesma seção | `canWithdrawAttachment = hasPermission('attachment:delete')` (158) | idem | — |
| Criar achado | `findings-panel.tsx:283-286` (botão "Novo achado") | `canCreate = hasPermission('finding:create')` (164, prop `canCreate`) | `POST /findings` (dentro de `FindingCreateDialog`) | vinculado à `orgUnitId` do risco, **não** ao risco especificamente |
| Editar achado | `findings-panel.tsx:363-366` | `canEdit = hasPermission('finding:edit')` (165) **E** `item.status !== 'ARCHIVED'` (linha 362) | `FindingEditDialog` → `PATCH /findings/{id}` (não lido em detalhe) | achado não arquivado |
| Fechar achado | `findings-panel.tsx:372-375` | `canClose = hasPermission('finding:close')` (166) **E** `status` em `OPEN`/`IN_REMEDIATION` (371) | `FindingCloseDialog` | justificativa de fechamento exigida pelo próprio diálogo (não lido em detalhe) |
| Reabrir achado | `findings-panel.tsx:378-381` | `canClose` **E** `status === 'CLOSED'` (377) | `FindingReopenDialog` | — |
| Remediar achado | `findings-panel.tsx:369` (`FindingRemediationAction`) | `canRemediate = hasPermission('finding:remediate')` (168, prop `canRemediate`) — componente próprio, mais gate `item.status === 'OPEN'` (doc linha 81) | não lido em detalhe (`finding-remediation-action.tsx`) | achado `OPEN` |
| Arquivar achado | `findings-panel.tsx:384-387` + `ConfirmDialog` (453-472) | `canAdminister = hasPermission('finding:administer')` (167) **E** `status === 'CLOSED'` (383) | `findingsApi.archiveFinding(id)` | achado `CLOSED` |
| Vincular/desvincular achado↔controle e achado↔risco | `findings-panel.tsx:402-406` (`FindingLinksSection`) | `canLinkFindings = hasPermission('finding:link')` (169, prop `canLinkPermission`) **E** achado não `ARCHIVED` (comentário próprio, `finding-links-section.tsx:26-29`) | `POST`/`DELETE /findings/{findingId}/controls\|risks/{linkId}` (não lido linha a linha — fora do escopo do arquivo de detalhe) | achado não arquivado |
| Comentar | `risk-comments-section.tsx:179-181` (`CommentThread`, `onSubmit`) | `canComment = hasPermission('comment:create')` (155) | `POST /comments` (`api.ts:610-612`) | corpo não-vazio (trim, linha 132) |
| Retirar comentário | `risk-comments-section.tsx:182` (`onWithdraw`) + `ConfirmDialog` (186-201) | `canWithdraw = hasPermission('comment:delete')` (156) — **sem restrição de autoria no servidor** (doc, linhas 30-34) | `DELETE /comments/{commentId}` (`api.ts:615-617`) | confirmação |
| Anexar arquivo ao risco | `risk-attachments-section.tsx:193-196` (`AttachmentList`, `onUpload`) | `canUploadAttachment = hasPermission('attachment:create')` (157) | `POST /attachments` multipart (`api.ts:635-642`) | allow-list de tipo (PDF/PNG/JPEG/texto simples) e tamanho reforçados pelo servidor via magic-bytes (doc 15-28) |
| Retirar anexo do risco | `risk-attachments-section.tsx:197-200` + `ConfirmDialog` (204-223) | `canWithdrawAttachment = hasPermission('attachment:delete')` (158) | `DELETE /attachments/{attachmentId}` (`api.ts:645-647`) | confirmação |
| Paginação — Histórico de avaliações | `assessment-history.tsx:184-195` ("Carregar mais") | nenhuma — sempre visível | `GET /risks/{riskId}/assessments?page=N` (`api.ts:153-157`) | `page < totalPages` |
| Paginação — Histórico de tratamento | `risk-treatment-section.tsx:228-243` | nenhuma | `GET /risks/{riskId}/treatments?page=N` (`api.ts:200-209`) | `page < totalPages` |
| Paginação — Ações de tratamento | `treatment-actions-table.tsx:571-586` | `canTreat` não afeta paginação, só ações de escrita | `GET /risks/{riskId}/treatment-actions?page=N` (`api.ts:232-251`) | `page < totalPages` |
| Paginação — Histórico (aba) | `risk-history-section.tsx` (`onLoadMore` passado a `ActivityHistory`, linha 175) | nenhuma | `GET /risks/{riskId}/history?page=N` (`api.ts:558-571`) | `page < totalPages` |
| Paginação — Auditoria | `risk-audit-section.tsx` (`onLoadMore`, linha 220) | condicionado por já ter passado o `visible={canViewAudit}` da aba | `GET /risks/{riskId}/audit-events?page=N` (`api.ts:584-588`) | `page < totalPages` |
| Filtro de tipo — Histórico | `risk-history-section.tsx:160-165` (`MultiSelectFilter`) | nenhuma | mesmo endpoint de histórico, com `type=` (`api.ts:567-569`) | — |
| Paginação — Comentários | `risk-comments-section.tsx` (`onLoadMore`, linha 176) | nenhuma | `GET /comments?entityType=RISK&entityId=...&page=N` (`api.ts:603-607`) | `page < totalPages` |
| Paginação — Anexos | `risk-attachments-section.tsx` (`onLoadMore`, linha 192) | nenhuma | `GET /attachments?entityType=RISK&entityId=...&page=N` (`api.ts:620-624`) | `page < totalPages` |

**Total de ações distintas inventariadas na tabela acima: 45** (contando cada linha da tabela como
uma ação/controle funcionalmente distinto; transições de ciclo de vida contam como 3 categorias —
imediata/solicitar aprovação/decidir — não uma por status possível, já que a lista de status é
dinâmica e vem do servidor; as 9 paginações/filtro contam individualmente por serem gestos distintos
do usuário, mesmo sem gate de permissão próprio).

**Achado relevante de pré-condição (item explicitamente pedido pela tarefa):** o código **não**
impõe "existir decisão de tratamento vigente" como pré-condição para criar uma ação de tratamento.
`TreatmentActionsTable` sempre permite abrir o formulário "Adicionar ação" quando `canTreat` é
verdadeiro, independentemente de `currentTreatmentId` ser `null` ou não
(`treatment-actions-table.tsx:196-204`, prop `currentTreatmentId: string | null`, usada apenas para
preencher `treatmentDecisionId` no corpo da requisição, nunca para condicionar a exibição do botão
ou do formulário). Isto contraria uma suposição razoável (uma ação de tratamento deveria pressupor
uma decisão de tratamento) — vale confirmar com o back-end se isso é intencional antes do
redesenho assumir o contrário.

---

## 3. Permissões

Lidas em `risk-detail-view.tsx:150-169`, mais as lidas dentro dos componentes de seção que não
recebem a permissão via prop do pai (poucas — a maioria é resolvida no próprio `risk-detail-view.tsx`
e passada por prop).

| Permissão | Onde é lida (arquivo:linha) | O que habilita nesta tela |
|---|---|---|
| `risk:edit` | `risk-detail-view.tsx:150` | Botão "Editar" no header (243); vínculo/desvínculo de processo e ativo (`canEditRelationships`, 349) |
| `risk:assess` | `risk-detail-view.tsx:151` | Monta (ou não) `AssessmentForm` inteiro na aba Avaliação (327) |
| `risk:treat` | `risk-detail-view.tsx:152` | Vínculo/desvínculo de controle (`canTreatControls`, 348); formulário de decisão de tratamento (372); toda escrita em Planos de Ação — criar/editar/transicionar/reabrir ação (392) |
| `risk:approve` | `risk-detail-view.tsx:153` | Botões Aprovar/Rejeitar na barra de ciclo de vida (256), condicionado também a não ser o próprio solicitante |
| `audit:view` | `risk-detail-view.tsx:154` | Existência da própria aba "Auditoria" (409) |
| `comment:create` | `risk-detail-view.tsx:155` | Campo/botão de novo comentário (428) |
| `comment:delete` | `risk-detail-view.tsx:156` | Botão "Remover" por comentário (429) |
| `attachment:create` | `risk-detail-view.tsx:157` | Upload de anexo do risco (417) e upload de anexo por evidência (445) |
| `attachment:delete` | `risk-detail-view.tsx:158` | Retirar anexo do risco (418) e retirar anexo de evidência (446) |
| `evidence:view` | `risk-detail-view.tsx:159` | Existência da própria aba "Evidência" (449) |
| `evidence:create` | `risk-detail-view.tsx:160` | Botão "Nova evidência" (442) |
| `evidence:link` | `risk-detail-view.tsx:161` | Botão "Desvincular" por evidência (443) |
| `evidence:administer` | `risk-detail-view.tsx:162` | Botão "Arquivar" por evidência (444) |
| `finding:view` | `risk-detail-view.tsx:163` | Existência da própria aba "Achados" (466) |
| `finding:create` | `risk-detail-view.tsx:164` | Botão "Novo achado" (458) |
| `finding:edit` | `risk-detail-view.tsx:165` | Botão "Editar" por achado (459) |
| `finding:close` | `risk-detail-view.tsx:166` | Botões "Fechar"/"Reabrir" por achado (460) |
| `finding:administer` | `risk-detail-view.tsx:167` | Botão "Arquivar" por achado (461) |
| `finding:remediate` | `risk-detail-view.tsx:168` | `FindingRemediationAction` por achado (462) |
| `finding:link` | `risk-detail-view.tsx:169` | Vínculo/desvínculo achado↔controle e achado↔risco (463) |

Nenhuma outra seção lê `hasPermission` diretamente para decidir visibilidade de conteúdo — todas as
17 permissões acima fluem do pai por prop. Exceção conceitual: as transições de ciclo de vida
(`RiskLifecycleActions`) não usam `hasPermission` para decidir QUAIS botões existem — isso "vem
filtrada do servidor" (`GET .../lifecycle`, doc do próprio componente, linhas 7-18) — só
`risk:approve` é lido no cliente, e apenas para decidir se as ações de decisão (Aprovar/Rejeitar)
aparecem.

---

## 4. Endpoints

Todos abaixo estão em `apps/web/src/features/risks/api.ts`, salvo indicação contrária.

**No mount da página (sempre, independente de aba):**
- `GET /risks/{riskId}` — `risksApi.getRisk` (linha 95-98), disparado pelo `useEffect` de
  `risk-detail-view.tsx:96-130`.
- `GET /risks/{riskId}/lifecycle` — `risksApi.getLifecycle` (linha 483-485), disparado pelo
  `useEffect` de `risk-lifecycle-actions.tsx:226-245` — **não é condicionado por aba**, monta junto
  com o header.

**Ao selecionar a aba "Visão geral" (modo edição):**
- `GET /risk-categories`, `GET /risk-types`, `GET /risk-origins`, `GET /org-units` — carregados por
  `risk-form.tsx:223-226` quando `editing` vira `true`.
- `GET /users?assignableForOrgUnitId=...` — busca de gestor/responsável dentro do formulário
  (`risk-form.tsx:286-299,718,769`).

**Ao selecionar a aba "Avaliação":**
- `GET /risk-methodology` — duas vezes, independentemente uma da outra (por design, doc de
  `risk-assessment-section.tsx:14-20`): uma vez em `RiskAssessmentSection` (linha 47-58) e outra em
  `AssessmentForm` (linha 108-121, só se `canAssess`).
- `GET /risks/{riskId}/assessments?page=1` — `AssessmentHistory` (linha 89-110).

**Ao selecionar a aba "Controles":** nenhum fetch adicional — os três subblocos (controles,
processos, ativos) leem de `risk.controls`/`risk.processes`/`risk.assets`, já presentes no payload
de `GET /risks/{riskId}` (doc `risk-controls-section.tsx:16-30`). Busca por `GET /controls`,
`GET /processes`, `GET /assets` só dispara quando o picker de vínculo é aberto/digitado
(`handleSearch`, `risk-controls-section.tsx:154-172`).

**Ao selecionar a aba "Incidentes":** `GET /risks/{riskId}/incidents` —
`risk-incident-problem-links-section.tsx:81-100`.

**Ao selecionar a aba "Problemas":** `GET /risks/{riskId}/problems` — mesma arquivo, linhas 170-189.

**Ao selecionar a aba "Tratamento":** `GET /risks/{riskId}/treatments?page=1` —
`TreatmentHistory` dentro de `risk-treatment-section.tsx:121-142`.

**Ao selecionar a aba "Planos de Ação":** `GET /risks/{riskId}/treatment-actions?page=1` —
`treatment-actions-table.tsx:242-262`.

**Ao selecionar a aba "Histórico":** `GET /risks/{riskId}/history?page=1` —
`risk-history-section.tsx:110-131`.

**Ao selecionar a aba "Auditoria"** (só se `canViewAudit`): `GET /risks/{riskId}/audit-events?page=1`
— `risk-audit-section.tsx:161-189` — **e, em paralelo, independentemente**, cinco chamadas de dados
de referência para resolver nomes em diffs de auditoria: `GET /risk-categories`, `GET /risk-types`,
`GET /risk-origins`, `GET /org-units`, `GET /users?pageSize=100` (linhas 112-131). Uma falha nesse
segundo grupo é silenciosa (doc 101-108) e não afeta o carregamento da trilha em si.

**Ao selecionar a aba "Anexos":** `GET /attachments?entityType=RISK&entityId=...&page=1` —
`risk-attachments-section.tsx:104-125`.

**Ao selecionar a aba "Comentários":** `GET /comments?entityType=RISK&entityId=...&page=1` —
`risk-comments-section.tsx:92-113`.

**Ao selecionar a aba "Evidência"** (só se `canViewEvidence`): `GET /evidence?subjectType=RISK&subjectId=...`
(`evidence-panel.tsx:91-131`) — seguido de **N chamadas** `GET /evidence/{id}/links` (uma por item
retornado, linhas 103-115, para resolver o `linkId` de desvínculo por evidência). Este é um padrão
N+1 client-side explícito no próprio código (comentário 99-102 explica a razão, não nega o custo).

**Ao selecionar a aba "Achados"** (só se `canViewFindings`): `GET /findings?orgUnitId=...`
(`findings-panel.tsx:182-200`) — seguido de `GET /audit-engagements/{id}` por engajamento distinto
não resolvido em cache (linhas 202-229, para exibir o código do engajamento de origem). Cada finding
renderizado monta um `FindingLinksSection`, cujas próprias duas chamadas (`GET .../controls`,
`GET .../risks` do achado) são adiadas até estar perto do viewport (`useLoadWhenNearViewport`,
doc do arquivo `finding-links-section.tsx:38-52`) — mitigação de um problema de N+1 já medido
anteriormente (150-350 requisições em uma unidade populosa, mesmo doc).

**Sob demanda (qualquer aba, ao agir):** todos os `POST`/`PATCH`/`DELETE` listados na Seção 2.

---

## 5. Estados de interface

| Seção/tela | Carregando | Erro | Vazio | Desabilitado |
|---|---|---|---|---|
| Página inteira | `LoadingState variant="block"` (`risk-detail-view.tsx:132-134`) | `ErrorState` genérico se `getRisk` falha com algo que não seja 404 (146-148) | — | — |
| Página inteira — 404/fora de escopo | — | `EmptyState variant="empty"` com título "Risco não encontrado" e descrição que **funde deliberadamente** "não existe" e "fora do escopo" (137-144, doc 26-28) | mesmo caminho do 404 | — |
| Ciclo de vida (barra) | texto "Carregando…" dentro do próprio `Card` (`risk-lifecycle-actions.tsx:264-275`) | `Card` com mensagem de erro em `role="alert"` (277-290) | "Nenhuma transição disponível" quando `availableTransitions.length === 0` e não há aprovação pendente (350-353) | botão de transição `disabled` quando `!transition.preconditionsMet` (361), com lista de pré-condições não satisfeitas (378-389) |
| Avaliação (form) | "Carregando…" enquanto metodologia não resolve (330-333) | banner vermelho de erro de metodologia (320-327); alerta específico de "metodologia mudou" (422, 257-274); alerta de conflito 409 (276-318) | — | botão "Registrar avaliação" `disabled` enquanto `submitting || loadingMethodology || !methodology` (232, 437) |
| Histórico de avaliação/tratamento/Planos de Ação/Histórico/Auditoria/Anexos/Comentários | texto "Carregando…" (padrão idêntico em todos, `resolvedRequestKey !== requestKey`) | mensagem `role="alert"` só quando `error && items.length === 0` — um erro em "carregar mais" não substitui a lista já visível | mensagem "Nenhum(a) … registrado(a) ainda" por seção | botão "Carregar mais" `disabled` durante `loadingMore` |
| Incidentes/Problemas vinculados | "Carregando…" (`risk-incident-problem-links-section.tsx:109-110`, 198-199) | `role="alert"` (111-114, 200-203) | "Nenhum incidente/problema vinculado" (115-116, 204-205) | — (somente leitura, sem controle a desabilitar) |
| Causas/Consequências | — (sem estado de loading — dados já vêm do risco) | banner vermelho por lista (`risk-causes-consequences.tsx:212-219`) | "Nenhuma causa/consequência registrada ainda" (93) | botões "Salvar"/"Adicionar" `disabled` durante `saving` |
| Controles/Processos/Ativos | — (dados já no risco) | mensagem por subseção ao vincular (`linkError`, 263-267) | "Nenhum … vinculado" por subseção (`messages.empty`, 215) | botão "Vincular" `disabled` sem seleção ou durante `linking` (289) |
| Anexos — upload | — | `uploadErrorDetail` mostrado tanto inline quanto como toast (152-159 de `risk-attachments-section.tsx`) | "Nenhum anexo enviado ainda." | controle de upload gerido por `AttachmentList` via `isUploading` |
| Evidência | "Carregando…" (`evidence-panel.tsx:183-184`) | `ErrorState` (185-186) | `EmptyState` "Nenhuma evidência…" (187-188) | ações de vincular/arquivar condicionadas a `item.status === 'ACTIVE'` (232, 238) |
| Achados | "Carregando…" (`findings-panel.tsx:290-291`) | `ErrorState` (292-293) | `EmptyState` (294-295) | ações por status (`ARCHIVED`/`OPEN`/`IN_REMEDIATION`/`CLOSED`, ver Seção 2) |

---

## 6. Comportamento de teclado e foco

Mecanismo compartilhado: `packages/design-system/src/lib/use-restore-focus.ts` (`useDialogFocusRestore`,
linhas 119-131), consumido por `apps/web/src/components/ui/dialog.tsx` e por `ConfirmDialog`
(`packages/design-system/src/components/confirm-dialog.tsx`) — documentado em D-15,
`docs/local-environment.md:521-545`. Captura `document.activeElement` **durante a fase de render**
(antes de qualquer `autoFocus` de campo interno tomar o foco) e resolve o alvo de restauração mesmo
quando o diálogo foi aberto a partir de um item de `DropdownMenu` que já desmontou
(`resolveDialogRestoreTarget`, linhas 24-35, via `menu.closest('[role="menu"]')` +
`aria-labelledby`).

Diálogos usados nesta tela e cobertura de foco:

| Diálogo | Arquivo | Aberto a partir de | Foco restaurado? |
|---|---|---|---|
| Confirmar transição | `risk-lifecycle-actions.tsx:84-201` (`TransitionConfirmDialog`, usa `@/components/ui/dialog`) | Botão de transição na barra de ciclo de vida | Sim — via `dialog.tsx` (D-15) |
| Solicitar aprovação | `approval-dialogs.tsx:76-191` (`RequestApprovalDialog`) | Botão "Solicitar aprovação: X" | Sim |
| Decidir aprovação | `approval-dialogs.tsx:213-352` (`ApprovalDecisionDialog`) | Botões Aprovar/Rejeitar | Sim |
| Editar ação de tratamento | `treatment-actions-table.tsx:720-837` (`Dialog` do shadcn) | Item de menu "Editar" dentro de `DropdownMenu` — **exatamente o caso indireto que `resolveDialogRestoreTarget` existe para resolver** | Sim, incluindo o caso do item de menu desmontado |
| Reabrir ação (com motivo) | `ReopenActionDialog` (`@/features/actions/components/reopen-action-dialog`, fora deste arquivo) | Item de menu "Reabrir" | Sim (mesmo mecanismo — usa `<Textarea autoFocus>`, o caso (a) do D-15) |
| Confirmar desvínculo (controle/processo/ativo) | `risk-controls-section.tsx:315-332` (`ConfirmDialog`) | Botão "Desvincular" por linha | Sim — `ConfirmDialog` usa o mesmo hook (D-15, "34 callers") |
| Confirmar retirada de comentário | `risk-comments-section.tsx:186-201` (`ConfirmDialog`) | Botão "Remover" por comentário | Sim |
| Confirmar retirada de anexo | `risk-attachments-section.tsx:204-223` (`ConfirmDialog`) | Botão "Remover" por anexo (dentro de `AttachmentList`) | Sim |
| Confirmar arquivamento/desvínculo de evidência | `evidence-panel.tsx:282-320` (dois `ConfirmDialog`) | Botões "Arquivar"/"Desvincular" | Sim |
| Confirmar arquivamento de achado | `findings-panel.tsx:453-472` (`ConfirmDialog`) | Botão "Arquivar" | Sim |
| Diálogos de criar/editar/fechar/reabrir achado | `FindingCreateDialog`/`FindingEditDialog`/`FindingCloseDialog`/`FindingReopenDialog` (fora deste arquivo, `features/findings/components/`) | Botões correspondentes em `findings-panel.tsx` | Não verificado neste inventário (fora do arquivo sob análise) — presumivelmente sim, se usarem `@/components/ui/dialog`, mas não lido linha a linha |

**Sistema de abas (`EntityTabs`):** construído sobre `@radix-ui/react-tabs`, que implementa roving
tabindex nativamente (uma só aba no `tab order`, setas esquerda/direita movem o foco entre abas,
ativação automática ao focar). Confirmado por teste E2E dedicado
(`apps/web/e2e/accessibility.spec.ts`, teste "risk detail tabs are reachable and operable by keyboard
(roving tablist)", ~linha 1023). O componente adiciona affordance de rolagem horizontal com dois
botões (`scrollBack`/`scrollForward`, `entity-tabs.tsx:210-242`) — visíveis só quando há conteúdo
clipado, nunca decorativos (comentário 133-144) — mas o **conteúdo de cada aba não recebe foco
automático ao trocar de aba** (comportamento padrão do Radix: `TabsPrimitive.Content` não é
focado automaticamente; nenhum código customizado em `entity-tabs.tsx` faz isso). Isto é relevante
para um redesenho: se a navegação virar dois níveis (ex.: seções dentro de sub-seções), o padrão
atual de "sem foco automático de conteúdo" precisa de decisão explícita, não herança silenciosa.

**Menus (`DropdownMenu`) usados nesta tela:** `treatment-actions-table.tsx:528-562` (menu de ações
por linha da tabela de Planos de Ação) — usa `@/components/ui/dropdown-menu`, primitivo Radix não
listado em D-15 como modificado (ou seja, comportamento de foco é o padrão do Radix, não customizado
por este projeto).

---

## 7. Cobertura de teste existente

### 7.1 Teste do próprio `risk-detail-view.tsx`

`apps/web/src/app/(app)/risks/[id]/risk-detail-view.test.tsx` (246 linhas, 6 testes):
1. Renderiza header + confirma que TODAS as abas obrigatórias existem como `tab` real (linhas
   131-153) — **não** testa Incidentes/Problemas/Evidência/Achados nesta lista (só as 7 originais
   mais Avaliação/Causas e Consequências, que são testadas separadamente nas linhas 135-136).
2. Confirma que "Planos de Ação" mostra conteúdo real, não mais o placeholder antigo (155-183).
3. Omite a aba Auditoria sem `audit:view` (185-196).
4. Mostra a aba Auditoria com `audit:view` (198-209).
5. 404 honesto (211-222).
6. Botão "Editar" condicionado a `risk:edit` (224-245).

**Não testado neste arquivo:** visibilidade condicional das abas Evidência/Achados por permissão
(`evidence:view`/`finding:view`) — só Auditoria tem teste de visibilidade condicional aqui.

### 7.2 Testes de componente por seção

Existem testes dedicados para: `approval-dialogs`, `assessment-form`, `assessment-history`,
`pending-approval-badge`, `risk-assessment-section`, `risk-attachments-section`,
`risk-causes-consequences`, `risk-comments-section`, `risk-controls-section`, `risk-form`,
`risk-lifecycle-actions`, `risk-overview`, `risk-review-schedule`, `risk-treatment-section`,
`treatment-actions-table` — 15 arquivos de teste de componente cobrindo 15 dos componentes usados
por esta tela.

**Sem teste de componente dedicado, confirmado por ausência de arquivo:**
- `risk-history-section.tsx` — **nenhum** `risk-history-section.test.tsx`.
- `risk-audit-section.tsx` — **nenhum** `risk-audit-section.test.tsx`.
- `risk-incident-problem-links-section.tsx` — **nenhum** teste de componente (nem para
  `RiskIncidentLinksSection` nem para `RiskProblemLinksSection`).

Essas três seções são cobertas apenas indiretamente: pelo teste geral de montagem em
`risk-detail-view.test.tsx` (que nem sequer navega até "Histórico"/"Auditoria" em suas asserções,
exceto para checar existência da aba) e pelos E2E abaixo.

### 7.3 Testes E2E que exercitam a tela de detalhe do risco

**Arquivos majoritariamente dedicados a esta tela**: `risk-approval.spec.ts`, `risk-assessment.spec.ts`,
`risk-collaboration.spec.ts`, `risk-history.spec.ts`, `risk-treatment.spec.ts`. Todos seguem o mesmo
padrão: `page.goto('/risks/new')` → preencher formulário → `page.waitForURL(/\/risks\/[0-9a-fA-F-]+$/)`
→ interagir com abas da tela de detalhe pela URL resultante.

**Chamadas exatas dependentes de rótulo de aba ou de estrutura da página** (arquivo:linha):

| Arquivo | Linha | Chamada |
|---|---|---|
| `risk-approval.spec.ts` | 123 | `page.getByRole('tab', { name: 'Avaliação' }).click()` |
| `risk-approval.spec.ts` | 147 | `page.getByRole('tabpanel', { name: 'Avaliação' })` |
| `risk-approval.spec.ts` | 156 | `page.getByRole('tab', { name: 'Visão geral' }).click()` |
| `risk-assessment.spec.ts` | 73 | `page.getByRole('tab', { name: 'Avaliação' }).click()` |
| `risk-collaboration.spec.ts` | 71 | `page.getByRole('tab', { name: 'Comentários' }).click()` |
| `risk-collaboration.spec.ts` | 97 | `page.getByRole('tab', { name: 'Anexos' }).click()` |
| `risk-collaboration.spec.ts` | ~99 | `page.getByRole('tabpanel', { name: 'Anexos' })` |
| `risk-history.spec.ts` | 100 | `expect(page.getByRole('tab', { name: 'Auditoria' })).toHaveCount(0)` (sem `audit:view`) |
| `risk-history.spec.ts` | 108 | `page.getByRole('tab', { name: 'Avaliação' }).click()` |
| `risk-history.spec.ts` | 123 | `page.getByRole('tabpanel', { name: 'Avaliação' })` |
| `risk-history.spec.ts` | 131 | `page.getByRole('tab', { name: 'Visão geral' }).click()` |
| `risk-history.spec.ts` | 151 | `page.getByRole('tab', { name: 'Histórico' }).click()` |
| `risk-history.spec.ts` | ~153 | `page.getByRole('list', { name: 'Histórico do risco' })` |
| `risk-history.spec.ts` | 224 | `page.getByRole('tab', { name: 'Histórico' }).click()` (segunda vez, com admin) |
| `risk-history.spec.ts` | 237 | `expect(page.getByRole('tab', { name: 'Auditoria' })).toBeVisible()` (com `audit:view`) |
| `risk-history.spec.ts` | 238 | `page.getByRole('tab', { name: 'Auditoria' }).click()` |
| `risk-history.spec.ts` | ~240 | `page.getByRole('list', { name: 'Trilha de auditoria' })` |
| `risk-treatment.spec.ts` | 113 | `page.getByRole('tab', { name: 'Tratamento' }).click()` |
| `risk-treatment.spec.ts` | 136 | `page.getByRole('tab', { name: 'Planos de Ação' }).click()` |
| `risk-treatment.spec.ts` | ~144 | `page.locator('form').filter({ hasText: 'Nova ação de tratamento' })` |
| `risk-treatment.spec.ts` | 186 | `page.getByRole('tab', { name: 'Controles' }).click()` |
| `risk-register.spec.ts` | 364 | `panel.getByRole('tab', { name: 'Visão geral' })` — **atenção**: este é o painel de visualização rápida (`RiskQuickView`, um componente distinto de `risk-detail-view.tsx`, aberto por card no registro), não a tela de detalhe completa. Reusa o mesmo rótulo "Visão geral" — um redesenho da tela de detalhe que renomeie essa aba também quebraria a consistência esperada com o quick view, mesmo sem tocar no arquivo do quick view. |
| `action-plan.spec.ts` | 88 | `page.getByRole('tab', { name: 'Planos de Ação' }).click()` |
| `action-plan.spec.ts` | 258 | `page.getByRole('tab', { name: 'Planos de Ação' }).click()` (segundo cenário, usuário somente leitura) |
| `assets-processes.spec.ts` | 301 | `page.getByRole('tab', { name: 'Controles' }).click()` (na tela de detalhe do RISCO, testando recusa de vínculo com ativo/processo inativo) |
| `assets-processes.spec.ts` | 353 | `page.getByRole('tab', { name: 'Controles' }).click()` (mesmo teste, reativado) |
| `accessibility.spec.ts` | 964-975 | Array `detailSections` com **10** rótulos de aba: `'Visão geral'`, `'Causas e consequências'`, `'Avaliação'`, `'Controles'`, `'Tratamento'`, `'Planos de ação'`, `'Histórico'`, `'Auditoria'`, `'Anexos'`, `'Comentários'` — usado em loop (977-993) para gerar um teste de axe por aba. **Nota de nomenclatura**: os literais no array usam grafia diferente da fonte oficial (`risks.ts`) em dois pontos — `'Causas e consequências'` (c minúsculo) vs. `'Causas e Consequências'` real, e `'Planos de ação'` (a minúsculo) vs. `'Planos de Ação'` real. Funciona hoje porque `getByRole` com string faz correspondência **case-insensitive** por padrão no Playwright — mas é uma fragilidade textual que um redesenho que mude a grafia real do rótulo não pegaria neste teste de qualquer forma, e que uma futura migração para `exact: true` quebraria silenciosamente. |
| `accessibility.spec.ts` | 995-1002 | Teste dedicado "Evidência" (fora do array `detailSections`, com espera por conteúdo real antes do scan — F-28) |
| `accessibility.spec.ts` | 1004-1009 | Teste dedicado "Achados" (idem) |
| `accessibility.spec.ts` | 1011-1018 | Teste "Visão geral" em tema escuro |
| `accessibility.spec.ts` | 1019-1029 | Teste de navegação por teclado na tablist (roving tabindex) |
| `accessibility.spec.ts` | ~1030+ | Teste do formulário de edição do risco (fora do escopo desta tabela — abre por "Editar") |

**Ausência notável**: **nenhum** teste E2E, em nenhum arquivo, clica nas abas "Incidentes" ou
"Problemas" da tela de detalhe do risco. O array `detailSections` de `accessibility.spec.ts` também
não as inclui — ou seja, essas duas abas (adicionadas na fase 013) não têm cobertura de
acessibilidade E2E nem cobertura funcional E2E a partir do lado do Risco (existe cobertura reversa,
a partir de Incidente/Problema, em `incident-problem-links-source-scope.spec.ts`, mas é teste de
integração de API, não E2E de navegador — conforme já registrado em `CLAUDE.md` §17, item 13).

**Contagem total de chamadas E2E dependentes de rótulo de aba ou estrutura de página da tela de
detalhe do risco**: **27** ocorrências de `getByRole('tab'` ou `getByRole('tabpanel'` distintas
(contadas na tabela acima), mais o array `detailSections` de `accessibility.spec.ts`, que por si só
gera 10 testes parametrizados adicionais (20 chamadas efetivas contando luz+escuro apenas para o
padrão do loop, mas o loop em si só roda em modo claro — ver linha 977). Se cada entrada do array for
contada como 1 dependência de rótulo (a forma mais direta de contar "o que precisa mudar se o rótulo
mudar"), o total sobe para **27 + 10 = 37** pontos de dependência textual/estrutural.

---

## 8. Riscos de regressão (priorizados)

1. **A aba "Achados" não filtra por risco — filtra pela unidade organizacional inteira do risco**
   (`findings-panel.tsx:184-185`). Qualquer redesenho que mova essa lista para outro lugar, ou que
   assuma implicitamente "isto é a lista de achados deste risco", vai alterar comportamento
   observável de forma sutil e potencialmente correta-parecendo-errada (ou vice-versa). É o item de
   maior risco de má-interpretação nesta tela inteira, porque o nome da aba ("Achados") não comunica
   o escopo real dos dados.

2. **Ausência total de teste de componente para `RiskHistorySection`, `RiskAuditSection` e as duas
   seções de vínculo Incidente/Problema.** Um redesenho que extraia, funda ou reestruture essas
   quatro seções não tem uma rede de segurança de unidade — só a cobertura frágil e indireta de
   `risk-detail-view.test.tsx` (que nem chega a clicar nessas abas) e dos E2E (que dependem de
   backend real, rodam mais devagar e nem sempre estão no caminho de CI padrão). Regressões em
   paginação, filtro por tipo de evento, ou no tratamento de 403 na aba Auditoria têm alta chance de
   passar despercebidas até QA manual.

3. **27+ chamadas E2E em 9 arquivos diferentes dependem do rótulo exato das abas via `getByRole('tab',
   { name: ... })`.** Qualquer renomeação de rótulo, ou qualquer mudança estrutural que faça duas
   abas virarem uma, ou uma aba virar uma seção não-aba (ex.: uma navegação de dois níveis), quebra
   essas 27+ chamadas simultaneamente, espalhadas por specs que testam fluxos de negócio inteiramente
   diferentes (aprovação, avaliação, colaboração, tratamento, plano de ação, escopo de
   ativos/processos, acessibilidade). O maior efeito dominó é em `accessibility.spec.ts`, cujo
   `beforeAll` (linha 268) monta UM ÚNICO risco fixture reusado por ~15 testes subsequentes — um erro
   de seleção de aba ali derruba todos eles em cascata (o arquivo já usa `test.describe.configure({
   mode: 'serial' })`, linha 244, então uma falha cedo cancela o resto).

4. **A pré-condição real de "criar ação de tratamento" é mais fraca do que o nome da aba sugere**
   (ver Seção 2): não existe bloqueio de UI nem, aparentemente, de servidor (não verificado no
   back-end, fora do escopo desta onda) exigindo uma decisão de tratamento vigente antes de criar uma
   ação em "Planos de Ação". Um redesenho que reagrupe Tratamento e Planos de Ação sob uma hierarquia
   (ex.: Planos de Ação como sub-item de Tratamento) pode introduzir acidentalmente essa restrição
   que hoje não existe, mudando comportamento de negócio sob o disfarce de reorganização visual —
   exatamente o tipo de mudança que CLAUDE.md §18.9 exige que não aconteça em silêncio.

5. **`RiskLifecycleActions` monta e busca (`GET .../lifecycle`) independentemente do sistema de
   abas** (`risk-detail-view.tsx:252-258`) e nunca é filhote de `EntityTabs`. Qualquer redesenho que
   trate a barra de ciclo de vida como "só mais uma seção" e a mova para dentro de uma aba vai mudar
   quando essa requisição dispara (hoje: sempre, no mount da página; depois: só ao selecionar aquela
   aba) — um efeito colateral de desempenho E de comportamento (o indicador de aprovação pendente no
   header deixaria de estar sempre visível se a lógica que o alimenta passasse a depender de uma aba
   selecionada, embora o dado do header em si venha de `risk.pendingApproval`, já no payload
   principal — mas a barra de AÇÕES em si sumiria até a aba ser aberta).

6. **Duas grafias divergentes de rótulo já coexistem no próprio repositório**
   (`accessibility.spec.ts`'s `'Causas e consequências'`/`'Planos de ação'` com minúsculas vs. as
   fontes oficiais `'Causas e Consequências'`/`'Planos de Ação'` em `risks.ts`). Isso só não quebra
   hoje por causa do matching case-insensitive do Playwright. Um redesenho que precise migrar esses
   testes para `exact: true` (frequentemente necessário para evitar colisões de acessible-name, como
   o próprio código já faz em outros pontos — ex. `risk-approval.spec.ts:214`) vai expor essa
   divergência como falha, não como sucesso silencioso.

7. **O painel de visualização rápida do registro (`RiskQuickView`, usado em `risk-register.spec.ts:364`)
   reusa o rótulo "Visão geral"** mas é um componente inteiramente distinto de `RiskOverview`/
   `risk-detail-view.tsx`. Não foi lido em detalhe nesta onda (fora do escopo do arquivo pedido), mas
   sua mera existência é um risco de inconsistência: um redesenho da tela de detalhe que mude a
   ordem, o conteúdo ou o nome da primeira seção sem revisar o quick view correspondente pode deixar
   os dois divergentes de um jeito que o usuário nota (o mesmo risco que abriu de duas formas
   diferentes).

8. **A aba "Evidência" faz uma chamada `GET /evidence/{id}/links` por item retornado** (N+1
   documentado, `evidence-panel.tsx:99-119`) — um redesenho que aumente a quantidade de evidências
   visíveis de uma vez (ex.: removendo paginação, ou pré-carregando mais abas) amplifica esse custo
   sem que o código sinalize isso de forma óbvia a quem não leu o comentário-fonte.

9. **A permissão que gate cada aba "de colaboração"/"de origem" está sempre codificada no componente
   pai (`risk-detail-view.tsx`), nunca dentro da própria seção** (as 17 permissões da Seção 3, com
   exceção). Uma reestruturação que mova essas seções para arquivos/rotas diferentes precisa migrar a
   checagem de permissão junto, linha por linha — não há um único "gate central" reutilizável para
   isso hoje; é fácil esquecer uma das 17 ao fatiar o arquivo.

10. **Nenhuma seção usa `role="tabpanel"` com nome verificável de forma consistente exceto onde os
    testes precisaram escopar deliberadamente para evitar colisão de nome acessível** (ex.:
    "Inerente: Crítico" aparecendo tanto no header quanto na aba Avaliação, forçando
    `getByRole('tabpanel', { name: 'Avaliação' })` em pelo menos 3 specs). Um redesenho que mude a
    estrutura ARIA do container de aba (por exemplo, para acomodar navegação de dois níveis) precisa
    preservar `role="tabpanel"` com nome acessível igual ao rótulo da aba correspondente, ou todas
    essas escopagens explícitas nos E2E deixam de funcionar.
