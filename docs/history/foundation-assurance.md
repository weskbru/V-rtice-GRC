# PharosGRC — Matriz de Garantias da Fundação

> Artefato de asseguramento. Resultado da fase **Foundation Assurance & Hardening**, executada sobre
> o commit `115bf2a` e concluída em 2026-09-07.
>
> **Regra desta matriz**: nada recebe **PROVEN** sem evidência executável que se possa apontar — e
> "existe teste" não basta. O teste precisa ser de um tipo que **falharia se a garantia fosse
> removida**. Esta fase encontrou quatro casos de mecanismo correto, compilando, com teste ao lado,
> e sem nada que provasse a garantia. Eles estão marcados como o que são.

---

## 1. Como ler os estados

| Estado | Significado |
|---|---|
| **PROVEN** | Existe código de produção que aplica a garantia **e** teste que falha sem ela. Ambos apontados. |
| **PARTIALLY PROVEN** | Aplicada de verdade, mas a prova cobre parte do alcance declarado. O que falta está dito. |
| **DOCUMENTED ONLY** | Documentada, mecanismo existe, nada de produção a exerce. Intenção, não capacidade (CLAUDE.md §19.10). |
| **NOT IMPLEMENTED** | Não existe. Registrado aqui para que a documentação pare de sugerir o contrário. |
| **NOT APPLICABLE** | Fora do escopo desta fundação, por decisão registrada. |

---

## 2. A matriz

| # | Garantia | Documentada em | Implementada em | Aplicada por | Testada em | Estado |
|---|---|---|---|---|---|---|
| 1 | Sessões opacas, token só como hash SHA-256 | ADR-002 | `core/sessions/.../session-cookie.ts` | aplicação | `session-lifecycle.spec.ts` lê a linha real e afirma `tokenHash !== rawToken` | **PROVEN** |
| 2 | Expiração por inatividade e absoluta, independentes | ADR-002 | `session.service.ts` `checkExpiry` | aplicação | `session-lifecycle.spec.ts` retroage timestamps reais no Postgres e evita o cache | **PROVEN** |
| 3 | Revogação de sessão, individual e total | ADR-002 | `session.service.ts` | aplicação | `session-lifecycle.spec.ts`, `user-deactivation-auth.spec.ts` | **PROVEN** |
| 4 | Desativar usuário derruba sessão viva na hora | ADR-002 | `auth-orchestrator.ts` (mesma transação do status) | aplicação | `admin-user-deactivation.spec.ts` reusa o cookie não atualizado do alvo | **PROVEN** |
| 5 | Falha de autenticação não distingue causa | FR-007 | `auth-orchestrator.ts`, argon2 contra hash-isca | aplicação | `auth-login.spec.ts` compara corpos byte a byte nos três casos | **PROVEN** |
| 6 | Bloqueio de conta por força bruta | FR-008 | `login-throttle.service.ts` | aplicação | `login-throttle.service.spec.ts` + `auth-login-lockout.spec.ts` — **acrescentados nesta fase** | **PROVEN** *(era DOCUMENTED ONLY: codificado, ligado, zero testes)* |
| 7 | RBAC `resource:action`, negação por padrão | ADR-003 | `permission.guard.ts` | aplicação | `permission.guard.spec.ts` monta resolvedor que "permitiria qualquer coisa" e prova que a guarda nega | **PROVEN** |
| 8 | Catálogo de permissões sem órfãs nos dois sentidos | ADR-003 | `permission-catalogue.ts` | compilação (`PermissionIdentifier`) | `permissions.spec.ts`; auditoria manual das 30 identidades | **PROVEN** |
| 9 | Revogação de permissão vale na requisição seguinte | FR-028 | `permissionsVersion` na chave de cache | aplicação | `permission-invalidation.spec.ts` reusa o mesmo cookie | **PROVEN** |
| 10 | …inclusive quando o seed altera papéis | FR-028 | `platform.seed.ts` `reconcileRolePermissions` | aplicação | `seed-permission-cache-invalidation.spec.ts` — **acrescentado nesta fase** | **PROVEN** *(o seed removia permissão sem invalidar; até 300s de cache quente)* |
| 11 | Segregação de funções na aprovação de risco | FR-029a | `approval.ts` + CHECK no banco | domínio **e** banco | `risk-approval.spec.ts:350` emite `$executeRawUnsafe` contornando caso de uso e repositório | **PROVEN** |
| 12 | Segregação de funções no encerramento de achado | FR-025 | `finding.entity.ts` | domínio (regra atravessa tabelas; CHECK não a expressa) | `findings.spec.ts` — inclui a tentativa por atualização genérica e o controle negativo | **PROVEN** |
| 13 | Escopo organizacional em leitura, escrita, listagem e agregados | ADR-004 | `ScopedRepository`, escopo obrigatório sem valor padrão | aplicação | `risk-scope.spec.ts`, `actions.spec.ts`, `findings.spec.ts`; varredura adversarial de 18 vetores | **PROVEN** |
| 14 | …e não expira quando a origem muda de unidade | ADR-004 | reverificação viva da origem em `get`/`update`/`transition`/`list` de Ação | aplicação | `actions.spec.ts` — **acrescentado nesta fase** | **PROVEN** *(retinha escrita e leitura após realocação do risco)* |
| 15 | Fora de escopo é indistinguível de inexistente | FR-030 | mapeamento único em `problem-details.filter.ts` | aplicação | `risk-scope.spec.ts`, `attachment-access.spec.ts`, `org-scope-denial-audit.spec.ts` | **PROVEN** |
| 16 | …inclusive em sujeitos compostos e na criação | FR-030 | acessor de decisão de tratamento re-chaveia; criação de Evidência/Achado colapsa mensagens | aplicação | testes **acrescentados nesta fase** | **PROVEN** *(vazava rótulo e UUID do risco pai; e existência de unidade na criação)* |
| 17 | Auditoria de operações permitidas, com valores anterior e posterior | FR-018 | `AuditRecorder` | aplicação | `session-audit.spec.ts`; 3.310 linhas reais amostradas | **PROVEN** |
| 18 | Auditoria acoplada à transação de negócio | ADR-005 | `PrismaAuditEventWriter` lança fora de transação | aplicação | `audit-transactional.spec.ts` grava, falha, e afirma **zero** linhas sobreviventes | **PROVEN** |
| 19 | Auditoria de negação por permissão | FR-030 | `AuditPermissionDenialRecorder` | aplicação | `audit-denied.spec.ts` | **PROVEN** |
| 20 | Auditoria de negação por **escopo organizacional** | FR-030 | `OrgScopeEnforcerService.assertExistingRecordAccessible`, 15 casos de uso | aplicação | `org-scope-denial-audit.spec.ts` — **acrescentado nesta fase** | **PROVEN** *(era zero linhas em todo o histórico; ver §4)* |
| 21 | Auditoria de eventos de autenticação | FR-018 | `auth-orchestrator.ts`, `session.service.ts` | aplicação | `session-audit.spec.ts` | **PARTIALLY PROVEN** — não existe evento de **login bem-sucedido**; só se infere por `session.created`, que não popula `actor_user_id` |
| 22 | Trilha append-only contra o papel da aplicação | ADR-005 | privilégios `UPDATE`/`DELETE` revogados de `pharos_app` | banco | `audit-append-only.spec.ts` — recusa com `SQLSTATE 42501`, sem chegar ao gatilho | **PROVEN** |
| 23 | Trilha append-only contra engano do dono | ADR-005 | gatilho `BEFORE UPDATE OR DELETE OR TRUNCATE`, no pai **e em cada partição** | banco | `audit-append-only.spec.ts` | **PROVEN** *(o `TRUNCATE` não era coberto; e gatilho só no pai não impede truncar partição — verificado, não presumido)* |
| 24 | Evidência de adulteração da trilha | — | — | — | — | **NOT IMPLEMENTED** — ver §3 |
| 25 | Ciclo de vida do Risco: todo estado alcançável, sem desvio genérico | ADR-006 | `risk-lifecycle.ts`, tabela declarativa | domínio | `risk-lifecycle.spec.ts` unidade + contrato | **PROVEN** |
| 26 | Ciclo de vida da Evidência | data-model §2 | `evidence.entity.ts` | domínio | `evidence.entity.spec.ts`, `evidence.spec.ts` | **PROVEN** |
| 27 | Ciclo de vida da Ação pela API própria | data-model §4 | `action.entity.ts`, tabela de 5 arestas | domínio | `action.entity.spec.ts` prova os 16 pares | **PROVEN** |
| 28 | …e pelo caminho do módulo de Riscos | R-003 | `MirrorActionStatusFromOriginUseCase` | **nada** — o espelho não passa pelo portão | `risk-action-convergence.spec.ts` cobre só o caminho legal | **PARTIALLY PROVEN** — sete pares ilegais alcançáveis; ver F-36 e §4 |
| 29 | Ciclo de vida do Achado | data-model §5 | `finding.entity.ts` | domínio | `finding.entity.spec.ts`, `findings.spec.ts` | **PROVEN** — com a aresta morta `OPEN → IN_REMEDIATION` documentada no próprio código |
| 30 | Fronteira de dependência entre camadas | ADR-011, ADR-016 | `eslint.config.mjs` | lint, no CI | quatro direções exercitadas com sondas descartáveis no fechamento do portão | **PROVEN** — cego a arquivos de composição (F-25) |
| 31 | Registro de permissões por módulo | ADR-003 | `combinePermissionDefinitions`, agregação estática | compilação | `permissions.spec.ts`, incluindo terceiro módulo fictício e colisão | **PROVEN** |
| 32 | Catálogos pt-BR por módulo | §11.1 | `user-messages.ts` composto; `lib/messages/index.ts` | compilação (`satisfies Record<Enum,…>`) | remoção deliberada de tradução falha o `typecheck` | **PROVEN** |
| 33 | Cobertura de contrato para todo endpoint | D-11 | `contract-coverage.spec.ts` | teste | 98 operações contratadas × implementadas | **PARTIALLY PROVEN** — cobre rota e método; **não** cobre forma de resposta (F-3) |
| 34 | Forma de resposta conforme contrato | ADR-009 | — | — | comparação empírica manual desta fase | **PARTIALLY PROVEN** — nenhum portão automatizado; ver §4 |
| 35 | Container de produção funcional | — | `docker/api.Dockerfile` corrigido | execução real | stack completa levantada, API estável, rotas GRC autenticadas | **PROVEN** *(a imagem não subia: cliente Prisma ausente)* |
| 36 | Prontidão distingue "alcançável" de "migrado" | — | `health.controller.ts` consulta `_prisma_migrations` | aplicação | 503 antes da migração, 200 depois — verificado no container | **PROVEN** *(acrescentado nesta fase)* |
| 37 | Aplicação conecta como papel restrito | ADR-005 | `docker-compose.yml`, `DATABASE_URL` | banco | `pg_stat_activity`: só `pharos_app`; `CREATE TABLE` negado | **PROVEN** |
| 38 | Ativos de marca servidos em produção | §18.6 | `docker/web.Dockerfile` | execução real | quatro SVGs, `200`, `image/svg+xml` | **PROVEN** |
| 39 | Relacionamento entre módulos de negócio (ADR-020) | ADR-020 | porta na camada compartilhada | — | não existe segundo módulo de negócio | **PARTIALLY PROVEN** — as partes aplicáveis sim; a inversão porta/adaptador não |

---

## 3. O que esta fundação **não** garante

Dito aqui para que nenhum documento sugira o contrário.

**Não há evidência de adulteração da trilha de auditoria.** O que existe é imutabilidade e controle
de acesso, e as duas coisas são reais: o papel da aplicação não consegue `UPDATE`, `DELETE` nem
`TRUNCATE` — recusa por privilégio, antes mesmo do gatilho —, e o gatilho recusa também o dono da
tabela nas três operações. Mas o dono pode `DROP TRIGGER` ou `ALTER TABLE ... DISABLE TRIGGER` e
então fazer o que quiser. **Um gatilho é proteção de schema, não fronteira de privilégio.** Não há
encadeamento de hash, assinatura nem âncora externa; ninguém consegue provar, depois do fato, que a
trilha não foi alterada por quem detinha credencial de dono ou um backup adulterado.

A frase defensável hoje é: *"conseguimos mostrar o que mudou"*. Não é: *"conseguimos provar que
ninguém alterou o registro do que mudou"*.

**Não há evento de login bem-sucedido**, e os eventos do perímetro de autenticação
(`session.created`, `auth.login_failed`, `session.expired`) não populam `actor_user_id` — só um
rótulo textual. Reconstruir "tudo que o usuário X fez" a partir da chave estrangeira falha
exatamente na borda de autenticação.

---

## 4. Os quatro achados que definem o caráter desta fase

Não são defeitos independentes. São duas lacunas de mecanismo, cada uma observada várias vezes — e
é isso que vale registrar.

### 4.1 Correção aplicada num lugar e nunca propagada ao irmão

- O re-chaveamento do 404 existia em `attachment-access.ts` e faltava no acessor de decisão de
  tratamento, que vazava rótulo e UUID do risco pai.
- O painel de anexos existia para Risco e faltava para Evidência — arquivo anexado na criação ficava
  inalcançável para sempre pela interface.
- A reverificação viva de escopo existia no vínculo de evidência e faltava na Ação — o que produziu
  **retenção de permissão de escrita** após realocação do risco.

Nenhuma delas é desconhecimento. Em todos os casos a solução correta já estava no repositório.

### 4.2 Comentário que codifica verdade temporária, sem nada que force reavaliação

- `docker/web.Dockerfile`: *"`public/` não existe neste projeto"* — expirou quando a Fase 2 adicionou
  os ativos de marca.
- `risk-response.mapper.ts`: *"pertence à US6, cujo caminho de escrita ainda não existe"* — a US6 foi
  entregue; `pendingApprovalDetail` seguia sempre nulo.
- `schema.prisma`: *"Invariante E3, aplicada no domínio"* — não havia função alguma que a aplicasse.
- `docker/api.Dockerfile`: recomendava um comando de migração que **não funciona** contra a imagem de
  runtime, porque `pnpm` e o CLI do Prisma são deliberadamente excluídos dela.

Registrado como **F-42**, com proposta de mecanismo e com o que a proposta não pegaria.

---

## 5. Débito aceito, com razão declarada

| Item | Por que fica |
|---|---|
| **F-36** — janela de coexistência da Ação; espelho não passa pelo portão de transições | Fechar exige devolver 422 onde hoje se devolve 200 e exigir motivo na reabertura — mudanças de contrato REST e de comportamento do módulo de Riscos. **Portão: precede a fase de Incidentes.** |
| **F-37** — sem relação Achado ↔ Risco | Decisão de domínio: `Control` ainda não existe, e decidir agora se `Achado↔Controle` a torna redundante seria decidir sem informação. Adiada para a Fase 4, onde as duas chegam juntas. |
| **F-3 / F-34** — contrato não verifica forma de resposta | Nenhum portão automatizado existe. A comparação desta fase foi manual. Candidato natural ao próximo ciclo. |
| **F-24** — predicado de vencimento duplicado em quatro lugares no módulo de Riscos | Some naturalmente na convergência de F-36. |
| **F-25** — lint cego a arquivos de composição | Documentado; é exatamente onde o próximo módulo tende a errar. |
| Sem TLS no compose | Um navegador real recusaria o cookie `Secure`. Exige proxy terminador na frente da stack — decisão de operação, não de código. |

---

## 6. Veredito

Os seis bloqueadores identificados foram corrigidos e verificados: a imagem de produção sobe, o
escopo obsoleto da Ação não retém mais escrita nem leitura, a negação por escopo é auditada, a
criação não revela existência de unidade, o acessor composto não vaza identificador, e o bloqueio de
conta é auditado e testado.

O que permanece está declarado, tem dono e tem portão. Nada nesta matriz recebeu **PROVEN** sem que
a evidência executável fosse apontada — e onde a garantia não existe, esta matriz diz que não
existe, em vez de descrevê-la com palavra mais generosa.
