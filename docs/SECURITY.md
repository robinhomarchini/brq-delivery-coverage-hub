# Segurança

## Modelo de acesso

- Supabase Auth com link mágico para e-mails `@brq.com`.
- `viewer`: leitura.
- `editor`: leitura e escrita.
- `admin`: leitura, escrita e administração de acessos.
- O usuário `robinson.marchini@brq.com` é o administrador inicial.
- A fonte de verdade de autorização é:
  - `public.app_users` para usuários que já autenticaram no app;
  - `public.app_access_invites` para pré-cadastros e bloqueios/liberações por e-mail.
- A rota Configurações é visível e acessível apenas para `admin`.

## Provisionamento

1. O admin pré-cadastra um e-mail `@brq.com`, papel e convite habilitado em
   Configurações.
2. O usuário cria a senha no primeiro acesso e autentica com e-mail corporativo.
3. A RPC `accept_current_app_access()` valida o domínio e converte o
   pré-cadastro ativo em registro de `app_users` ativo.
4. Se o pré-cadastro estiver inativo, o usuário permanece bloqueado até o admin
   reativar o acesso em Configurações.
5. Usuários sem convite ou bloqueados ficam bloqueados pela
   UI e por RLS.

O frontend usa somente `NEXT_PUBLIC_SUPABASE_ANON_KEY`; não há service role no
navegador. A administração usa as RPCs `list_app_access()` e
`upsert_app_access(...)`, ambas protegidas por `is_delivery_admin()`.

## Controles

- RLS em todas as tabelas expostas pela Data API.
- Nenhuma permissão de dados para `anon`.
- `authenticated` recebe grants mínimos e as policies aplicam o papel:
  - `is_active_brq_user()` para leitura;
  - `can_edit_delivery_data()` para escrita;
  - `is_delivery_admin()` para administração de acessos e leitura de auditoria.
- Usuários autenticados leem apenas o próprio registro em `app_users`; admins
  leem e gerenciam todos os registros e convites.
- O primeiro login concede acesso automaticamente apenas quando já existe
  pré-cadastro ativo para o e-mail corporativo.
- Convites aceitam somente e-mails `@brq.com`; usuários ativos em `app_users`
  também precisam ter e-mail corporativo.
- Funções `security definer` usam `search_path` definido e referências
  qualificadas para tabelas públicas e helpers.
- Constraints de domínio e auditoria no PostgreSQL.
- Validação de entrada no cliente e no banco.
- Mensagens explícitas para falhas de carga e persistência.
- Headers HTTP de segurança e neutralização de fórmulas em CSV.

## Migration de hardening

A migration `20260701193000_access_admin_invites.sql` substitui policies
permissivas de homologação por RBAC. Antes de aplicar em produção/homologação,
confirmar:

- `robinson.marchini@brq.com` existe ou está pré-cadastrado como admin.
- Usuários que devem continuar acessando estão em `app_access_invites` ou já
  possuem `app_users` ativo.
- Smoke tests com um usuário `viewer`, um `editor` e um `admin`.

## Evolução

O login por link mágico deve ser substituído ou complementado por Microsoft Entra
ID. A autorização permanece no banco e não depende apenas da interface.
