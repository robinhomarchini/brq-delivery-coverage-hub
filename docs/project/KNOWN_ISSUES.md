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
- `npm audit` ainda reporta o `sharp < 0.35.0` transitivo do Next 16.2.12. O
  downgrade automático para Next 14 é incompatível; aguardar correção suportada
  pelo Next ou validar explicitamente uma atualização de `sharp`.
- Telas financeiras e exports devem continuar reconciliando Studios contidos e
  o escopo New Logo/Hunter de forma consistente.
