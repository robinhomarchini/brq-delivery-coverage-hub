# SDD pragmático

Specs descrevem comportamento ativo, não histórico de implementação.

- Use `delivery-coverage-hub/` para o produto base e uma pasta por capacidade
  independente, como `employee-import/`.
- Mantenha requisitos, regras/fonte de verdade, critérios de aceite, riscos e
  comandos de validação explícitos.
- Atualize a spec quando o comportamento mudar; não crie versões `v2`, cópias ou
  pastas de arquivo. O Git preserva versões anteriores.
- Remova planos concluídos sem valor normativo após 15 dias, desde que decisões
  duráveis tenham sido promovidas para `docs/project/DECISIONS.md`.
- Prefira o menor conjunto de documentos que mantenha rastreabilidade. Para
  mudanças pequenas, requisitos e critérios de aceite podem ser breves.
