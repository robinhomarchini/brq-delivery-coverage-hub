# Current State

Atualizado em: 2026-07-31

## Baseline v0.0.0

- Branch canônica: `main`.
- Stack: Next.js 16, React 19, TypeScript, Supabase e Vercel.
- Banco atual preservado com 101 migrations forward-only.
- Última reconciliação registrada: 101 migrations locais e 101 remotas.
- O check desta sessão ficou pendente por ausência de autenticação do Supabase CLI;
  a falha não confirmou drift.
- Documentação técnica canônica: `docs/project/`.
- Requisitos ativos: `specs/`.
- Norma comum para Codex, Kilo, Copilot e Claude: `ENGINEERING_STANDARD.md`,
  protegida por `npm run test:agents`.
- Histórico anterior: Git, sem cópias ou archives no working tree.

## Estado funcional

- Produção usa Supabase; fallback local é exclusivo de desenvolvimento.
- Persistência passa por `DeliveryRepository`, BFF/RPC e RLS.
- Dashboard usa RPCs tipadas/validadas na fronteira do repositório.
- Importação de funcionários persiste lotes, snapshots, estados salariais e HC
  com autorização administrativa e auditoria.
- O histórico da importação deriva a quantidade de linhas de
  `preview_snapshot.sourceRowCount`; não existe coluna física
  `employee_import_batches.source_row_count`.

## Política de retenção

- Handoffs, relatórios pontuais e planos concluídos: máximo de 15 dias.
- Specs e documentos canônicos: mantidos enquanto o comportamento estiver ativo.
- Migrations, ADRs vigentes, auditoria e evidências de segurança: preservados.
- Caches e artefatos gerados: não versionados e removíveis a qualquer momento.
