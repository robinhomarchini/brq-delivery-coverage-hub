# Requisitos — Acesso, Administração e Usuários

## Objetivo

Fechar o acesso do Delivery Coverage Hub para usuários corporativos BRQ
pré-cadastrados, com administração segura de usuários pelo próprio app sem usar
service role no navegador.

## Regras de negócio

- Apenas e-mails normalizados com domínio `@brq.com` podem acessar.
- A fonte de verdade de autorização é o banco Supabase:
  - `app_users` para usuários ativos que já autenticaram;
  - `app_access_invites` para pré-cadastro básico e bloqueio/liberação por e-mail.
- Papéis permitidos:
  - `viewer`: leitura;
  - `editor`: leitura e escrita de dados do domínio;
  - `admin`: leitura, escrita e gestão de acessos.
- `robinson.marchini@brq.com` deve permanecer administrador inicial.
- A rota e o item de navegação Configurações devem aparecer apenas para admin.
- Admin pode criar, atualizar e desativar acessos por e-mail, papel e status
  ativo/inativo.
- Um pré-cadastro ativo deve virar registro em `app_users` ativo quando o
  usuário autenticado fizer login pela primeira vez.
- Um e-mail BRQ pré-cadastrado e ativo deve ser auto-confirmado no Supabase Auth
  quando o projeto exigir confirmação de e-mail, evitando que a primeira senha
  criada deixe o usuário em estado pendente invisível para o administrador.
- A jornada de redefinição de senha deve recuperar usuários que já criaram conta
  ou tentaram o primeiro acesso, sem exigir nova liberação manual.
- Um pré-cadastro inativo ou usuário sem pré-cadastro deve permanecer sem
  acesso ativo.
- Administradores liberam ou bloqueiam o acesso diretamente pelo status ativo
  do pré-cadastro/usuário na tela Configurações.
- O frontend usa somente a chave anônima do Supabase e depende de RLS/RPC para
  enforcement.

## Critérios de aceite

- Usuário fora do domínio BRQ não consegue prosseguir após autenticação.
- Usuário sem `app_users` ativo ou pré-cadastro ativo recebe mensagem clara de acesso
  pendente/bloqueado.
- Usuário lê apenas o próprio `app_users`; admin lista e gerencia
  `app_users`/`app_access_invites`.
- `viewer` não consegue alterar dados do domínio por RLS; `editor` e `admin`
  conseguem.
- Funções `security definer` usam `search_path` seguro.
- Configurações lista usuários ativos, pré-cadastros e usuários bloqueados, com
  ação explícita de salvar/liberar/bloquear e feedback de sucesso/erro.
- Primeiro acesso de usuário pré-cadastrado ativo cria senha e permite entrada
  sem etapa manual adicional de confirmação pelo administrador.
- Redefinir senha envia link ao e-mail corporativo e permite definir uma nova
  senha para usuário já criado.

## Riscos e validação

- A migration substitui policies permissivas de homologação por RBAC. Aplicar em
  ambiente remoto exige smoke test com usuários viewer/editor/admin.
- Validar com lint, typecheck e build do Next.js.
