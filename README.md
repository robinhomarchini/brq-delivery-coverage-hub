# BRQ Delivery Coverage Hub

Aplicação executiva para gestão e visualização da estrutura de Delivery, gestores,
clientes, assuntos e modelos de atuação.

## Executar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Validação

```bash
npm run lint
npm run typecheck
npm run build
```

## Homologação

Versão publicada no Vercel:

- https://brq-delivery-coverage-hub.vercel.app

O acesso é feito por magic link do Supabase Auth e exige e-mail `@brq.com`.
O Supabase Auth está configurado com esse domínio Vercel como Site URL e Redirect URL,
mantendo também `localhost` e `127.0.0.1` para testes locais.

A migration `supabase/migrations/20260625190000_brq_homologation_rls.sql`
permite que validadores internos autenticados com e-mail BRQ leiam e editem os
dados principais durante a homologação, sem precisar cadastrar cada usuário
manualmente em uma tabela de permissões.

## Arquitetura

O app usa Supabase quando `.env.local` possui as credenciais públicas. Nesse modo,
o acesso exige autenticação com e-mail `@brq.com` e o banco aplica RLS. Sem
configuração Supabase, o adaptador local funciona como fallback de desenvolvimento.

O esquema e o hardening estão em `supabase/migrations/`. Consulte também
`docs/SECURITY.md`.

Consulte `docs/ARCHITECTURE.md` e `specs/delivery-coverage-hub/`.
