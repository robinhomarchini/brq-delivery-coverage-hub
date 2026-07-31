# Project Overview

Baseline atualizado em: 2026-07-31

## Fatos confirmados

- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`.
- Raiz local canonica: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- Branch canônica: `main`.
- Aplicacao Next.js/React para gestao executiva de cobertura Delivery, clientes, pessoas, metas, baselines, studios, relatorios e analise de desafio.
- Stack confirmada em `package.json`: Next `16`, React `19`, TypeScript, Supabase JS, Recharts, Tailwind, Zod, OpenAI, importacao Excel via `read-excel-file`, exportacoes PDF/CSV/Excel.
- Persistencia e leitura de dominio devem passar pelo contrato `DeliveryRepository` em `src/lib/repositories/types.ts`.
- Supabase e o backend atual de producao. Fallback local existe para desenvolvimento, mas producao sem Supabase deve falhar de forma explicita conforme `src/lib/repositories/provider.ts`.

## Escopo funcional atual

- Dashboard executivo: `src/components/dashboard/executive-dashboard.tsx`.
- Organograma: `src/components/organization/organization-chart.tsx`.
- Pessoas e hierarquia: `src/app/pessoas/page.tsx`, `src/lib/roles.ts`, `src/data/mockData.ts`.
- Clientes e portfolio: `src/app/clientes/page.tsx`, `src/app/portfolio-clientes/page.tsx`, `src/lib/customers/customer-coverage-view-model.ts`.
- Metas por pessoa: `src/app/metas-pessoas/page.tsx`.
- Metas por area/studio: `src/app/metas-studios/page.tsx`.
- Hunters especializados: `src/app/metas-hunters-especializados/page.tsx`.
- Relatorio de metas e exportacao oficial: `src/app/relatorio-metas/page.tsx`, `src/lib/reports/person-target-official-export.ts`.
- Baselines e comparativos: `src/app/baselines/page.tsx`, `src/app/comparativo-baseline/page.tsx`, `src/lib/target-baseline-import.ts`, `src/lib/studio-baseline-import.ts`, `src/lib/studio-curve-baseline-snapshot.ts`.
- Analise de desafio com IA: `src/app/analise-desafio/page.tsx`, `src/app/api/challenge-analysis/route.ts`, `src/server/ai/challenge-analysis.ts`.
- Auditoria temporaria de duplicatas: `src/app/auditoria-duplicatas/page.tsx`.
- Administracao de acesso: `src/app/configuracoes/page.tsx`, `src/lib/access-control.ts`.

## Fonte de verdade operacional

- Regras de dominio confirmadas no codigo ficam em `src/lib/`.
- Regras de persistencia, autorizacao e auditoria ficam em `supabase/migrations/`, `src/server/auth/` e rotas BFF em `src/app/api/`.
- Documentos anteriores em `docs/` podem estar parcialmente obsoletos. Este conjunto em `docs/project/` registra o estado observado nesta auditoria.

## Assuncao marcada

- A URL de producao historica conhecida e `https://brq-delivery-coverage-hub.vercel.app`, mas esta auditoria nao executou verificacao de deploy.
