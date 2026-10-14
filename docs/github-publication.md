Status: vigente — distribuição para GitHub preparada em 2026-10-14.

# Distribuição Vértice GRC

A branch `github/vertice-grc` contém uma distribuição independente, com a marca Vértice GRC e
configurações de exemplo. Seu primeiro commit não possui pais, para que os exemplos e as
referências de implantação anteriores não entrem no histórico desta branch.

## Identificadores

O nome visível é **Vértice GRC**, nos catálogos pt-BR. Pacotes, arquivos, serviços, tabelas
auxiliares e papéis PostgreSQL usam `vertice`, sem acento. O cookie padrão é `vgrc_session`.
As regras de autorização, escopo organizacional, auditoria e preservação do histórico de negócio
continuam obrigatórias.

## Configuração

`.env.example` contém apenas exemplos locais. Endereços de implantação, contas, senhas e arquivos
de segredos devem ser fornecidos pelo operador, fora do Git. Os manifests Kubernetes são modelos;
seus hosts, imagens, armazenamento e Secret precisam ser configurados antes de aplicar.

O pipeline específico de implantação do ambiente de origem não faz parte desta distribuição.
Esta branch não executa implantação automática. Não use o `.env` de outra instalação para validar
ou testar esta cópia.

## Banco e migrações

Esta distribuição destina-se a um **banco novo**. A renomeação alcança os papéis `vertice_owner` e
`vertice_app`, a tabela auxiliar `vertice_config` e os scripts de migração e bootstrap. Isso altera
os checksums das migrações. Aplicar estes arquivos sobre uma instalação anterior exige um plano
de migração próprio; o envio ao GitHub não realiza essa migração nem acessa o banco existente.

Runtime continua usando um papel restrito, separado do proprietário usado nas migrações.
As instruções de conexão e preparação estão em
[database.md](architecture/database.md) e no [guia local](guides/development.md).

## Alcance do histórico

A ausência de pais protege apenas o histórico desta branch. Outras branches ou commits que já
tenham sido enviados ao GitHub continuam presentes até uma operação específica de remoção ou
reescrita. Criar esta distribuição não apaga o histórico de outras branches.

## Validação em 2026-10-14

- Typecheck e lint dos workspaces passaram.
- Unidade da API: 73 arquivos, 745 testes aprovados.
- Unidade do frontend: 225 arquivos, 1.491 testes aprovados; regressão final de login, marca e
  loader: 16 testes aprovados.
- Login renderizado em temas claro/escuro e largura móvel, sem rolagem horizontal; axe não
  detectou violações WCAG A/AA nesses três cenários.
- Os dois arquivos Compose e os manifests Kustomize foram validados sem iniciar serviços ou
  acessar um cluster. O bootstrap SQL foi regenerado e conferido com as 53 migrações.
- As referências da marca anterior e os componentes reais de conexão foram verificados no
  conteúdo preparado para publicação, sem copiar arquivos de segredos.

Integração, contrato e E2E autenticados não foram executados nesta rodada: o Docker estava
indisponível para criar o banco descartável. Nenhuma validação acessou a instalação existente.
