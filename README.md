# BRQ Delivery Coverage Hub

Aplicação executiva interna para cobertura de Delivery, clientes, pessoas,
metas, baselines, relatórios e análises. Next.js 16, React 19, Supabase e Vercel.

## Executar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Desenvolvimento

```bash
npm run dev
npm run validate
npm run build
```

Para persistência crítica, execute também `npm run smoke:critical`. Mudanças de
banco exigem `npm run db:migrations:check`.

## Produção

Versão publicada no Vercel:

- https://brq-delivery-coverage-hub.vercel.app

O acesso usa Supabase Auth, usuários corporativos e autorização por RLS/RBAC.

## Arquitetura

`DeliveryRepository`, BFFs, RPCs e RLS formam a fronteira de persistência.
Produção nunca usa fallback local. O baseline técnico canônico está em
`docs/project/`; requisitos ativos ficam em `specs/` e migrations são sempre
forward-only em `supabase/migrations/`.

Comece por `AGENTS.md` e `docs/project/PROJECT_OVERVIEW.md`.
