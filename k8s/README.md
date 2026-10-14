Status: provisional — exemplos genéricos de implantação, sem vínculo com um cluster existente.

# Kubernetes

Esta base descreve uma implantação de Vértice GRC e não contém credenciais, endpoints de banco,
registry, nó ou StorageClass de um ambiente operacional. Os domínios `example.com` e
`example.invalid`, senhas `CHANGE_ME` e endereço de documentação nas NetworkPolicies precisam
ser substituídos pela configuração do seu ambiente antes de qualquer aplicação.

Não há pipeline de implantação nesta distribuição. O arquivo GitLab CI institucional foi removido;
publicar uma branch no GitHub não aplica estes manifests nem executa migrações ou seed.

## Recursos e armazenamento

`kustomization.yaml` reúne namespace, ConfigMap, PVC de anexos, Redis, Services, API, Web e
Ingress. Secret e NetworkPolicies de exemplo ficam fora da base.

- O namespace é `verticegrc`.
- O PVC `verticegrc-attachments` usa `ReadWriteOnce` e solicita `10Gi`, com a StorageClass padrão
  do cluster. Escolha a classe, política de retenção e backup conforme sua implantação. Não há
  referência a volume preexistente. A política de retenção do cluster não substitui backup.
- Redis usa `redis:7-alpine`, AOF e `emptyDir`; não há fixação em worker ou persistência entre
  recriações do Pod. Redis não é exposto externamente e estes exemplos não configuram senha Redis.
- A API monta o PVC em `/app/storage` e usa `/app/storage/attachments`. Sua estratégia `Recreate`
  evita sobreposição com um PVC `ReadWriteOnce` e implica interrupção durante atualização.

Os containers não montam token de ServiceAccount. API e Web executam como o usuário `vertice`
das imagens; verifique UID/GID e permissões do PVC antes da implantação. Requests e limits são
valores iniciais de exemplo e precisam de medição no seu ambiente.

## PostgreSQL e Secret

Nenhum workload ou PVC PostgreSQL é criado por esta base. Configure uma instância própria e
nova, seguindo [Banco de dados](../docs/architecture/database.md), antes de iniciar a API.
O runtime usa `DATABASE_URL` com o papel restrito `vertice_app`, sem DDL ou superusuário.
`vertice_owner` é reservado à migração/administração e não deve integrar o Secret de runtime.

`02-secret.example.yaml` mostra somente a estrutura do Secret `verticegrc-secrets`, usando um
hostname fictício e senha `CHANGE_ME`. Não aplique esse exemplo como Secret operacional.
Provisione o Secret por um mecanismo protegido do seu ambiente, fora do versionamento e do
contexto de build Docker. `.gitignore` exclui `k8s/secret.yaml` e `k8s/secret.env`.

O Secret de runtime contém somente `DATABASE_URL`; não inclua `DATABASE_MIGRATION_URL`,
credenciais de superusuário, `SEED_ADMIN_PASSWORD` ou variáveis `TEST_*`. Migrations e seed
não executam no build ou startup e não são Jobs ou initContainers desta base.
Testes que apagam ou reinicializam dados exigem uma instância descartável separada.

## Configuração e imagens

`01-configmap.yaml` contém valores não sensíveis de exemplo e produção: cookie seguro,
fixtures desabilitadas, Redis interno e armazenamento persistente de anexos. `SEED_ADMIN_EMAIL`
é obrigatória para o validador e usa `admin@example.invalid`; informar o e-mail não cria nem
renomeia uma conta. A senha inicial deve ser fornecida separadamente ao executar o seed.

Substitua as imagens fictícias:

- `registry.example.invalid/verticegrc/api:CHANGE_ME`.
- `registry.example.invalid/verticegrc/web:CHANGE_ME`.

`imagePullSecrets` referencia `registry-credentials`, nome genérico. Provisione esse Secret se o
registry exigir autenticação ou remova a referência para imagens públicas. Use tags imutáveis
para a implantação. Os manifests não provisionam credenciais de registry.

`docker/web.Dockerfile` exige `API_INTERNAL_URL` e `APP_ORIGIN` no build. A rewrite `/api/*` é
compilada durante `next build`; alterar só o ConfigMap não muda essa rewrite. Para esta base,
a URL interna é `http://verticegrc-api:3001`. Substitua a origem HTTPS `https://grc.example.com`
pela origem pública exata e mantenha-a igual no build Web, no runtime Web e na API para CSRF.
O Web recebe apenas `NODE_ENV`, `API_INTERNAL_URL`, `APP_ORIGIN`, `HOSTNAME` e `PORT`.

O cookie é `vgrc_session`, também usado pelo SSR. Produção exige HTTPS e
`SESSION_COOKIE_SECURE=true`. Limites de autenticação, logs e recursos são exemplos genéricos;
ajuste-os por medição sem desabilitar controles de segurança.

## Probes e tráfego

- API: startup/liveness em `/api/v1/health/live`; readiness em `/api/v1/health/ready`, porta `3001`.
  Readiness verifica PostgreSQL e Redis, mas não comprova a escrita de anexos.
- Web: probes TCP na porta `3000`, verificando o socket.
- Redis: probes com `redis-cli ping`.

`10-ingress.yaml` usa o host fictício `grc.example.com`, a rota `/` para `verticegrc-web:3000`
e o Secret TLS `verticegrc-tls`. Provisione o certificado e configure a classe/annotations do seu
Ingress Controller. Nenhum controller específico de cluster é assumido. A API permanece interna,
acessada pelo proxy do Next.js.

`11-networkpolicy.example.yaml` exemplifica restrição por padrão, Ingress Controller → Web,
Web → API, API → Redis, API → PostgreSQL e DNS. `192.0.2.1/32` é somente endereço reservado
para documentação: substitua pelo destino autorizado do seu PostgreSQL. Confirme CNI, labels do
controller, DNS e tráfego das probes antes de adotar essas políticas.

## Preparação da implantação

1. Configure a instância PostgreSQL nova e aplique seu schema e seed administrativamente.
2. Configure imagens, origem pública, StorageClass, certificados e acesso ao registry.
3. Provisione namespace e Secrets por seu fluxo protegido.
4. Revise os manifests e aplique a base pelo procedimento do seu ambiente.
5. Verifique readiness, HTTPS, anexos, backup e restauração.

Nenhum comando de deploy, migração, seed ou conexão PostgreSQL foi executado ao preparar esta
distribuição. Uma validação estática dos manifests não comprova conectividade ou funcionamento
do cluster; essa verificação pertence à implantação configurada por seu operador.
