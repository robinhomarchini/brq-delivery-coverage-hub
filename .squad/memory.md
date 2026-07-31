# Memória operacional

Baseline: `v0.0.0`, estabelecido em 2026-07-31.

- Fonte técnica canônica: `docs/project/`.
- Requisitos ativos: `specs/`.
- Histórico: Git; não criar arquivos de archive ou cópias versionadas.
- Banco: Supabase/Postgres, 101 migrations forward-only preservadas.
- Persistência: `DeliveryRepository` -> BFF/RPC -> RLS.
- Produção nunca usa fallback local.
- Gates: `npm run validate`, `npm run build`; persistência crítica também usa
  `npm run smoke:critical`; banco usa `npm run db:migrations:check`.
- Segredos ficam em arquivos `.env*` ignorados e nunca são registrados.

Pendência operacional: autenticar o Supabase CLI ou fornecer `SUPABASE_DB_URL`
para reconciliar o histórico remoto de migrations.
