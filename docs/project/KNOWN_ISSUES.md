# Known Issues

Atualizado em: 2026-07-31

- A semântica mensal/anual de `PersonCompensation.annualSalary` ainda precisa de
  definição formal.
- Algumas operações server-side ainda não usam telemetria estruturada e não há
  sink externo confirmado.
- Dados legados duplicados exigem saneamento auditado antes de uma constraint
  única definitiva.
- A reconciliação remota de migrations depende de autenticação do Supabase CLI
  ou `SUPABASE_DB_URL`.
- Telas financeiras e exports devem continuar reconciliando Studios contidos e
  o escopo New Logo/Hunter de forma consistente.
