# Implantação do PharosGRC no Kubernetes/Rancher

Estrutura inicial de homologação, preparada para revisão e aplicação futura.
Os exemplos e as imagens com `CHANGE_ME` precisam ser configurados antes do deploy.

## Arquitetura

```text
Usuário
  ↓ HTTPS
Ingress
  ↓
Frontend Next.js (pharosgrc-web:3000)
  ↓ /api/v1, via rewrite do Next.js
Backend NestJS (pharosgrc-api:3001)
  ├── PostgreSQL externo: 192.168.52.215:5432 / pharos_grc
  ├── Redis: pharosgrc-redis:6379
  └── PVC: pharosgrc-attachments
```

O Ingress encaminha todas as rotas ao Web, incluindo `/api`. O Next.js encaminha `/api/*`
à API; não há uma rota de Ingress diretamente para o backend nesta estrutura.

## Arquivos

| Arquivo | Finalidade | Incluído na base Kustomize |
| --- | --- | --- |
| `00-namespace.yaml` | Namespace `pharosgrc` | Sim |
| `01-configmap.yaml` | Configuração não sensível | Sim |
| `02-secret.example.yaml` | Exemplo com credenciais fictícias | Não |
| `03-attachments-pvc.yaml` | Persistência dos anexos | Sim |
| `04-redis-services.yaml` | Services headless e ClusterIP do Redis | Sim |
| `05-redis-statefulset.yaml` | Redis com AOF e emptyDir | Sim |
| `06-api-service.yaml` | Service ClusterIP da API | Sim |
| `07-api-deployment.yaml` | API, probes e montagem dos anexos | Sim |
| `08-web-service.yaml` | Service ClusterIP do Web | Sim |
| `09-web-deployment.yaml` | Web com configuração mínima | Sim |
| `10-ingress.yaml` | Entrada HTTPS de `pharos-dsv.aeb.gov.br` | Sim |
| `11-networkpolicy.example.yaml` | Políticas de rede a adaptar | Não |
| `kustomization.yaml` | Recursos da base no namespace `pharosgrc` | — |

## Storage

A StorageClass dos anexos foi definida conforme a configuração informada do cluster.
Neste ambiente, Redis utiliza armazenamento efêmero com `emptyDir`, sem StorageClass ou PVC.

| Dados | StorageClass | Capacidade | AccessMode | reclaimPolicy da classe |
| --- | --- | --- | --- | --- |
| Anexos da API | `longhorn-ha` | `10Gi` | `ReadWriteOnce` | `Retain` |
| Redis | — (`emptyDir`) | — | — | — |

## Anexos da API

`03-attachments-pvc.yaml` declara o PVC `pharosgrc-attachments` no namespace `pharosgrc`.
O Deployment da API deverá montar esse PVC em `/app/storage`, preservando
`ATTACHMENT_STORAGE_PATH=/app/storage/attachments`, conforme o Compose atual.

A política `Retain` protege o volume de anexos contra remoção automática do PV após liberação do
PVC, mas **não substitui uma política de backup**. A recuperação ou remoção definitiva de um volume
retido exige intervenção administrativa. [Referência: política Retain do Kubernetes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#retain).

## Redis

`05-redis-statefulset.yaml` declara uma réplica de `redis:7-alpine`, com AOF habilitado por
`redis-server --appendonly yes` e volume `data` do tipo `emptyDir`, montado em `/data`.
Não há `volumeClaimTemplates` nem PVC do Redis nesta configuração. As probes executam
`redis-cli ping` na porta padrão `6379`.

Existem dois Services em `04-redis-services.yaml`, com os mesmos selectors do Pod Redis:

- `pharosgrc-redis-headless`, com `clusterIP: None`, é o governing Service referenciado por
  `serviceName` do StatefulSet.
- `pharosgrc-redis`, do tipo `ClusterIP`, é o endereço utilizado pela API em
  `REDIS_URL=redis://pharosgrc-redis:6379`.

Redis não é exposto externamente e permanece sem autenticação Redis.

O `nodeSelector` fixa temporariamente o Pod em `svlparancherwk1`, com
`imagePullPolicy: IfNotPresent`, aproveitando a imagem em cache nesse worker.

Neste ambiente o Redis utiliza emptyDir e não possui persistência entre recriações do Pod. Sessões, cache e dados efêmeros do Redis podem ser perdidos. PostgreSQL e anexos não são afetados.

## PostgreSQL externo e bootstrap

O PostgreSQL permanece externo em `192.168.52.215:5432`, banco `pharos_grc`.
Neste ambiente existe apenas um banco PostgreSQL: `pharos_grc`. Não há banco de testes separado.
A API utiliza somente `DATABASE_URL`; variáveis `TEST_*` não fazem parte do runtime Kubernetes.

**NÃO executar testes automatizados que façam limpeza/reset de banco contra este ambiente.**

Nenhum PVC ou workload PostgreSQL é definido aqui. As migrations e o seed inicial já foram
executados; estes manifests não executam essas rotinas.

O servidor já possui `citext` e `pg_trgm`. As 53 migrations foram aplicadas e o seed inicial
criou administrador, permissões, papéis, ROOT, catálogos de risco e metodologia.
Migrations e seed não executam no startup da API, nem são Jobs ou initContainers desta base.
O Kubernetes não executa migrations nem seed. Prisma continua sendo o ORM da aplicação;
`database/prisma/schema.prisma` e as migrations continuam no repositório. As migrations são
administradas separadamente, fora do runtime Kubernetes, usando `DATABASE_MIGRATION_URL`.

## ConfigMap e Secret

`pharosgrc-config` contém apenas configurações não sensíveis exigidas pelo validador da API.
Os valores operacionais de homologação foram preservados a partir das variáveis não sensíveis
locais. O ambiente dos containers é `production`, com cookie seguro, fixtures desabilitadas,
Redis interno com armazenamento efêmero e armazenamento local persistente para os anexos.
`NODE_ENV=production` define o modo de execução da aplicação; todas as conexões PostgreSQL
continuam apontando para o único banco de homologação `pharos_grc`.

`APP_ORIGIN=https://pharos-dsv.aeb.gov.br` é a origem adotada nesta homologação. Mantenha a origem
pública exata igual no backend, no frontend e no build Web, para que a proteção CSRF funcione.
O cookie permanece `pgrc_session`, nome que o SSR do frontend procura atualmente.
`SEED_ADMIN_EMAIL` é obrigatória no validador mesmo em runtime; seu exemplo não cria um novo
administrador. Ajuste essa identificação à conta já cadastrada. `SEED_ADMIN_PASSWORD` não é
necessária para iniciar a API e não está no Secret de runtime.

O Secret real `pharosgrc-secrets` precisa fornecer:

- `DATABASE_URL`, apontando para `192.168.52.215:5432/pharos_grc`.

O exemplo usa somente credenciais `CHANGE_ME`. A URL de runtime identifica a aplicação por
`application_name=pharosgrc_runtime`. `DATABASE_MIGRATION_URL` não é exigida no startup da API
e não integra este Secret. Seu suporte permanece no Prisma para administração das migrations;
quando fornecida, deve continuar distinta de `DATABASE_URL`.
O uso temporário do mesmo login PostgreSQL foi decidido na preparação deste ambiente.
`TEST_DATABASE_URL` e `TEST_DATABASE_MIGRATION_URL` são opcionais no startup normal. As suítes
que precisam de banco continuam exigindo ambas nos helpers de testes, com validação de destino
e URLs distintas. Não configure essas variáveis nos Pods nem execute essas suítes contra este banco.

Crie o Secret real manualmente no namespace pelo Rancher ou, futuramente, por um arquivo de
ambiente protegido fora do repositório:

```powershell
kubectl create secret generic pharosgrc-secrets --namespace pharosgrc --from-env-file=C:\CAMINHO_FORA_DO_REPOSITORIO\secret.env
```

Esse comando é apenas documentação e não foi executado. O arquivo deve conter somente
`DATABASE_URL`, sem publicar credenciais no terminal, histórico ou versionamento.
`k8s/secret.yaml` e `k8s/secret.env` estão no `.gitignore`, mas essa proteção não equivale ao
`.dockerignore`: não mantenha Secrets reais no contexto de build Docker.
Nunca aplique `02-secret.example.yaml` como Secret operacional nem use a `.env` completa no Web.

## Imagens e frontend: build e runtime

Os manifests contêm placeholders de imagem:

- API: `registry.gitlab.aeb.gov.br/cti/pharosgrc/api:CHANGE_ME`.
- Web: `registry.gitlab.aeb.gov.br/cti/pharosgrc/web:CHANGE_ME`.

A pipeline usa o registry nativo do projeto, com `${CI_REGISTRY_IMAGE}/api:${CI_COMMIT_SHA}`
e `${CI_REGISTRY_IMAGE}/web:${CI_COMMIT_SHA}`, sem depender de `latest`. O job usa
`kubectl set image --local` para definir a imagem no YAML antes de enviá-lo diretamente ao
`kubectl apply -f -`. A pipeline nunca aplica os Deployments com `CHANGE_ME` ou uma tag antiga.
Os manifests versionados permanecem intactos; não há arquivos temporários nem patches.
O Redis é aguardado antes de criar os Deployments da API/Web.
Os jobs de build do GitLab Runner constroem e publicam as duas imagens.
Os manifests API/Web referenciam diretamente `gitlab-registry-secret` em `imagePullSecrets`.
Esse Secret deve existir em `pharosgrc`, com tipo `kubernetes.io/dockerconfigjson`, provisionado
separadamente. A pipeline não cria, altera ou apaga esse Secret nem armazena sua credencial.

`docker/web.Dockerfile` exige `API_INTERNAL_URL` e `APP_ORIGIN` na etapa de build.
`frontend/next.config.ts` monta a rewrite `/api/*` com a URL da API durante `next build`.
Alterar apenas o ConfigMap em runtime não corrige uma rewrite compilada com `http://api:3001`.

Para a imagem destinada a este namespace, utilize no build:

```text
API_INTERNAL_URL=http://pharosgrc-api:3001
APP_ORIGIN=https://pharos-dsv.aeb.gov.br
```

O Deployment injeta as mesmas duas variáveis em runtime para o SSR, além de `NODE_ENV`,
`HOSTNAME=0.0.0.0` e `PORT=3000`. O Web recebe somente essas variáveis, sem Secrets do banco.
Os Dockerfiles e o código do frontend não foram alterados nesta preparação.

## GitLab CI/CD

`.gitlab-ci.yml` segue o padrão operacional observado no `sis-bem-estar`: runner `rke2-prod`,
Sonar Scanner, builds com Kaniko e deploy com `kubectl`. Somente eventos `push` na branch `main`
criam a pipeline: `test` → `sonar` → `build-api` → `build-web` → `deploy`.
Uma falha interrompe as etapas seguintes; o Sonar aguarda o Quality Gate.

O job `test` instala pelo lockfile com pnpm `10.34.5`, compila `api-types` e `design-system`,
executa typecheck e os scripts unitários existentes da API e do Web. Gera relatórios JUnit
para o GitLab, com saída resumida e logs dos testes que falham. Não executa integração,
contrato ou E2E. O postinstall gera Prisma Client, sem aplicar migrations ou seed.
Não forneça conexões ou credenciais do PostgreSQL de homologação a esses jobs.

Não existe `sonar-project.properties`, provedor de coverage ou LCOV configurado neste checkout.
A análise usa as fontes TypeScript reais e exclui testes e tipos gerados. Não se declara
cobertura inexistente; os XML JUnit não são enviados como cobertura ao Sonar.
Se o Quality Gate exigir coverage maior que zero ou 80%, o job falhará até adicionarmos
coverage real e seus relatórios. A análise permanece estática.
Para gerar LCOV real futuramente, será necessário adicionar um provedor de coverage compatível
com cada workspace (Vitest `4.1.11` na API e `5.0.0` no Web), habilitar o reporter `lcov` nos
scripts unitários e entregar esses relatórios ao Sonar. Isso não foi implementado nesta revisão.

Configure estas variáveis CI/CD protegidas antes de habilitar a execução:
A branch `main` precisa estar protegida para disponibilizar essas variáveis aos jobs.

- `SONAR_HOST_URL` e `SONAR_TOKEN` (token também mascarado).
- `SONAR_PROJECT_KEY`: chave real do projeto PharosGRC no SonarQube.

`CI_REGISTRY`, `CI_REGISTRY_IMAGE`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD` e `CI_COMMIT_SHA`
são fornecidas pelo GitLab. A autenticação Kaniko é gerada fora do contexto de build.
Ambos Dockerfiles usam a raiz do repositório como contexto; o Web recebe os argumentos
`API_INTERNAL_URL` e `APP_ORIGIN`, com os mesmos valores do ConfigMap versionado.

O deploy reutiliza o acesso implícito do runner, como nos projetos AEB analisados. Nenhum
kubeconfig, token Kubernetes ou ServiceAccount foi inventado. O padrão é o mesmo do
`sis-bem-estar`: `kubectl apply`, `kubectl set image` e `kubectl rollout status`, sem consultas
prévias de recursos, loops de autorização ou arquivos temporários. Nos Deployments API/Web,
`set image --local` alimenta diretamente o `apply` para evitar uma imagem intermediária.
A ordem do deploy é:

1. ConfigMap (`01-configmap.yaml`).
2. PVC de anexos (`03-attachments-pvc.yaml`), preservando o PVC Bound existente.
3. Services Redis (`04-redis-services.yaml`).
4. StatefulSet Redis (`05-redis-statefulset.yaml`), com `emptyDir` e sem PVC Redis.
5. Aguardar o rollout do Redis, com timeout de 300 segundos.
6. Service API (`06-api-service.yaml`).
7. Service Web (`08-web-service.yaml`).
8. Ingress (`10-ingress.yaml`), após os Services.
9. `kubectl set image --local` no manifesto API (`07-api-deployment.yaml`) com
   `${CI_REGISTRY_IMAGE}/api:${CI_COMMIT_SHA}`, seguido de `kubectl apply -f -`.
10. `kubectl set image --local` no manifesto Web (`09-web-deployment.yaml`) com
   `${CI_REGISTRY_IMAGE}/web:${CI_COMMIT_SHA}`, seguido de `kubectl apply -f -`.
11. Aguardar o rollout da API, com timeout de 300 segundos.
12. Aguardar o rollout do Web, com timeout de 300 segundos.

O Redis mantém `redis:7-alpine`, `imagePullPolicy: IfNotPresent` e o worker `svlparancherwk1`.
O PVC de anexos é aplicado de forma idempotente, sem remoção ou recriação.
O Secret manual `pharosgrc-secrets`, que fornece `DATABASE_URL`, não é criado, alterado ou apagado
pela pipeline. `02-secret.example.yaml` não é aplicado. O Secret de pull também não é gerenciado.
Aplica o Ingress versionado após os Services, sem aplicar a base Kustomize. PostgreSQL permanece externo.
Não executa migrations nem seed. O grupo de recursos `pharosgrc` evita deploys simultâneos.

## API, volumes e probes

A API inicia com uma réplica e estratégia `Recreate`, evitando sobreposição das réplicas
durante atualização com o PVC `ReadWriteOnce`. Essa escolha implica interrupção durante updates.
O PVC é montado em `/app/storage`; os anexos são gravados em `/app/storage/attachments`.

Os Dockerfiles executam API e Web com `USER pharos`, sem UID/GID numéricos estáveis.
Os manifests preservam essa identidade e não inventam `runAsUser`, `runAsGroup` ou `fsGroup`.
Antes do deploy, confirme os IDs da imagem final e que o usuário da API consegue gravar no PVC
montado; configure permissões ou grupo do volume com base nessa verificação.

- API: startup/liveness em `/api/v1/health/live`; readiness em `/api/v1/health/ready`, porta `3001`.
  Readiness verifica PostgreSQL e Redis, mas não comprova permissões de escrita dos anexos.
- Web: probes TCP na porta `3000`, sem dependência de autenticação; verificam apenas o socket.
- Redis: probes com `redis-cli ping`, porta `6379`.

API, Web e Redis não montam token de ServiceAccount. Requests e limits são valores iniciais
para homologação e precisam ser ajustados por medição de carga. Os limites de autenticação e
logs preservados da configuração local também precisam de revisão antes da operação real.

## Ingress e NetworkPolicy

`10-ingress.yaml` declara `pharosgrc-ingress` no namespace `pharosgrc`, com o host
`pharos-dsv.aeb.gov.br` e a rota `/` com `pathType: Prefix` para `pharosgrc-web:3000`.
Todas as rotas passam pelo Web; `/api/v1` continua usando o proxy do Next.js para a API interna.
O padrão operacional foi confirmado no `sis-bem-estar`, no mesmo cluster: annotations
`kubernetes.io/ingress.class: traefik` e `traefik.ingress.kubernetes.io/router.tls: "true"`.
A IngressClass `traefik` usa o controller `traefik.io/ingress-controller`.
O bloco `tls.hosts` usa o mesmo host, sem `secretName`, conforme o padrão confirmado.
`APP_ORIGIN` permanece `https://pharos-dsv.aeb.gov.br` no ConfigMap e na pipeline.

As NetworkPolicies exemplificam restrição por padrão, Ingress Controller → Web, Web → API,
API → Redis, API → PostgreSQL externo `192.168.52.215/32:5432` e DNS TCP/UDP `53`.
Namespace e labels do Ingress Controller são fictícios; os selectors de DNS também precisam
ser conferidos, especialmente se houver NodeLocal DNSCache. Confirme suporte do CNI e tráfego
de probes antes de aplicar essas políticas. [Referência: NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/).

O Ingress real está incluído no `kustomization.yaml` e é aplicado pela pipeline após os Services.
Os exemplos de Secret e NetworkPolicy permanecem fora da base.

## Ordem de implantação futura

1. Confirmar as pendências abaixo e configurar imagens e origem pública.
2. Criar o namespace `pharosgrc`.
3. Criar o Secret real e o Secret de pull se necessário.
4. Aplicar a base: ConfigMap, PVC de anexos, Services e Redis, API, Web e Ingress.
5. Aguardar readiness e validar os anexos.
6. Validar o acesso HTTPS a `pharos-dsv.aeb.gov.br`; NetworkPolicies exigem uma validação separada.

Comandos para uso futuro, após a revisão, sem execução nesta preparação:

```powershell
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -k k8s
kubectl get pods,svc,pvc -n pharosgrc
kubectl get events -n pharosgrc --sort-by=.metadata.creationTimestamp
```

A base contém onze recursos em dez arquivos, incluindo dois Services Redis. O Namespace não
recebe um namespace próprio: somente os objetos namespaced usam `pharosgrc`.
Secrets e certificados não são gerados pelo Kustomize. [Referência: Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/).

## PENDÊNCIAS ANTES DO DEPLOY

- Secret real com somente `DATABASE_URL`, sem versionamento.
- Imagens API/Web publicadas, registry/caminhos/tags confirmados e acesso de pull.
- Validar o acesso HTTPS a `pharos-dsv.aeb.gov.br` após o deploy.
- Conectividade dos workers com `192.168.52.215:5432`.
- Backup dos anexos e verificação de restauração; `Retain` não substitui backup.
- Imagem Web construída com os valores corretos de build e runtime.
- UID/GID da imagem da API e permissão de gravação do PVC montado.
- Ajuste dos recursos, logs e limites de autenticação para homologação.
- Para as políticas opcionais: CNI, labels/namespaces do Ingress Controller e DNS.
