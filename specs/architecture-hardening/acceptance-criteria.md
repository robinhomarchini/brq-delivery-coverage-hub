# Critérios de aceite — Hardening Arquitetural

- A aplicação continua funcionando antes da migration ser executada.
- Quando a migration estiver aplicada, Pessoa + clientes é salvo por RPC
  transacional.
- Quando a migration estiver aplicada, Cliente + managers é salvo por RPC
  transacional.
- Quando a migration estiver aplicada, metas Hunter e Renovação + Ampliação de
  uma linha da tela Metas por Pessoa são salvas por RPC transacional.
- A migration adiciona auditoria às tabelas normalizadas de cobertura e metas.
- Produção sem Supabase configurado mostra erro explícito em vez de abrir mock.
- Specs e docs indicam o caminho para BFF completo e RLS viewer/editor/admin.
- Lint, typecheck e build passam.
