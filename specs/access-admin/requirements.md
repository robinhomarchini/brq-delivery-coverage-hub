# Requisitos — Acesso, Administração e Usuários

## Objetivo

Fechar o acesso do Delivery Coverage Hub para usuários corporativos BRQ
pré-cadastrados, com administração segura de usuários pelo próprio app sem usar
service role no navegador.

## Regras de negócio

- Apenas e-mails normalizados com domínio `@brq.com` podem acessar.
- A fonte de verdade de autorização é o banco Supabase:
  - `app_users` para usuários ativos que já autenticaram;
  - `app_access_invites` para pré-cadastro básico pendente.
- Papéis permitidos:
  - `viewer`: leitura;
  - `editor`: leitura e escrita de dados do domínio;
  - `admin`: leitura, escrita e gestão de acessos.
- `robinson.marchini@brq.com` deve permanecer administrador inicial.
- A rota e o item de navegação Configurações devem aparecer apenas para admin.
- Admin pode criar, atualizar e desativar acessos por e-mail, papel e status
  ativo/inativo.
- Um convite pendente deve virar registro em `app_users` quando o usuário
  autenticado fizer login, porém ainda sem acesso ativo.
- Após o primeiro login, o usuário deve aparecer como "Aguardando aprovação" na
  tela Configurações.
- Apenas um administrador pode aprovar o usuário para transformar
  `app_users.active` em `true`.
- Administradores devem ver um alerta global quando houver usuários aguardando
  aprovação.
- O frontend usa somente a chave anônima do Supabase e depende de RLS/RPC para
  enforcement.

## Critérios de aceite

- Usuário fora do domínio BRQ não consegue prosseguir após autenticação.
- Usuário sem `app_users` ativo ou convite ativo recebe mensagem clara de acesso
  pendente/bloqueado.
- Usuário lê apenas o próprio `app_users`; admin lista e gerencia
  `app_users`/`app_access_invites`.
- `viewer` não consegue alterar dados do domínio por RLS; `editor` e `admin`
  conseguem.
- Funções `security definer` usam `search_path` seguro.
- Configurações lista usuários ativos, pré-cadastros e usuários aguardando
  aprovação, com ação explícita de "Aprovar" e feedback de sucesso/erro.

## Riscos e validação

- A migration substitui policies permissivas de homologação por RBAC. Aplicar em
  ambiente remoto exige smoke test com usuários viewer/editor/admin.
- Validar com lint, typecheck e build do Next.js.
