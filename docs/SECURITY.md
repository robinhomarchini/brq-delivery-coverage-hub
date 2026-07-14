# Segurança

## Modelo de acesso

- Autenticação encapsulada por `src/lib/auth/auth-service.ts`.
- O provider atual é `supabase`, configurado por `NEXT_PUBLIC_AUTH_PROVIDER`.
- `corporate-sso` está reservado como provider futuro para SSO interno, mas não
  libera acesso enquanto a integração não estiver implementada.
- Supabase Auth com e-mail/senha para e-mails `@brq.com`.
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
navegador. A administração passa por `AccessRepository`, que hoje chama as RPCs
`list_app_access()`, `upsert_app_access(...)` e `delete_app_access(...)`, todas
protegidas por `is_delivery_admin()`.
Credenciais de usuário não devem ser gravadas em código, variáveis públicas ou
bundle frontend. Usuários e senhas de teste continuam no provider de
autenticação, preservando sessão, RLS e auditoria.

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

## Validação automatizada

Use `npm run security:check` como gate rápido de segurança. O comando executa:

- `npm run test:security`: checagens estáticas de hardening da rota sensível,
  exportações, provider e scripts de RLS.
- `npm audit --json`: auditoria de vulnerabilidades conhecidas em dependências.
- `npm run smoke:rls`: smoke opcional de RLS/RBAC por perfis dedicados.
- `npm run security:pentest-lite`: pentest leve contra a URL configurada em
  `PENTEST_BASE_URL` ou contra a produção padrão.

Para validar RLS com perfis reais, configure somente em `.env.local` ou no CI
seguro:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RLS_SMOKE_PROVISION_CONFIRM=provision-rls-smoke-users`
- `SUPABASE_RLS_VIEWER_EMAIL` / `SUPABASE_RLS_VIEWER_PASSWORD`
- `SUPABASE_RLS_EDITOR_EMAIL` / `SUPABASE_RLS_EDITOR_PASSWORD`
- `SUPABASE_RLS_ADMIN_EMAIL` / `SUPABASE_RLS_ADMIN_PASSWORD`
- `SUPABASE_RLS_BLOCKED_EMAIL` / `SUPABASE_RLS_BLOCKED_PASSWORD`

Depois rode `npm run smoke:rls:provision` e `npm run smoke:rls`. As contas devem
ser dedicadas a teste e usar e-mail corporativo `@brq.com`; o provisionador
recusa contas que não pareçam ser de smoke/teste.

## Limpeza de snapshots de baseline

Fotos de baseline de Studios são históricas e não devem ser apagadas
manualmente pelo navegador. Para reduzir acúmulo de planilhas antigas, use:

```bash
npm run maintenance:baseline-snapshots
```

Por padrão o comando roda em `DRY-RUN`: lista quantas fotos existem por
`ano + origem` e quais seriam apagadas. A retenção padrão mantém as 2 fotos mais
recentes por combinação. Para executar a limpeza real em ambiente controlado:

```bash
BASELINE_SNAPSHOT_RETENTION=2 CONFIRM_BASELINE_SNAPSHOT_CLEANUP=delete-old-snapshots npm run maintenance:baseline-snapshots
```

O script usa `SUPABASE_SERVICE_ROLE_KEY` apenas em execução local/operacional,
nunca no frontend. A operação preserva RLS da aplicação e deixa trilha no audit
trigger da tabela `studio_baseline_snapshots`.

## Migration de hardening

A migration `20260701193000_access_admin_invites.sql` substitui policies
permissivas de homologação por RBAC. Antes de aplicar em produção/homologação,
confirmar:

- `robinson.marchini@brq.com` existe ou está pré-cadastrado como admin.
- Usuários que devem continuar acessando estão em `app_access_invites` ou já
  possuem `app_users` ativo.
- Smoke tests com um usuário `viewer`, um `editor` e um `admin`.

## Evolução

O login por senha deve ser substituído ou complementado por Microsoft Entra ID /
SSO interno. A UI já consome uma fronteira de auth provider-neutral; a
autorização permanece no banco e não depende apenas da interface.
