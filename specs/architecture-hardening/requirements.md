# Requisitos — Hardening Arquitetural

## Objetivo

Evoluir o BRQ Delivery Coverage Hub de uma homologação funcional para uma base
mais segura e sustentável, com regras críticas fora do frontend, operações
atômicas, RLS auditável e guardrails de produção.

## Requisitos

- O frontend pode sugerir regras, mas banco/backend deve validar regras críticas.
- Salvamentos que alteram entidade e relacionamentos devem ocorrer em uma
  transação.
- Metas por pessoa/cliente/tipo/ano devem evitar inconsistência por concorrência.
- Tabelas normalizadas de fonte de verdade devem possuir auditoria.
- Produção não deve cair silenciosamente para dados mockados sem Supabase.
- A policy ampla de homologação deve ficar documentada como temporária, com
  plano de substituição por viewer/editor/admin.

## Escopo inicial

- RPC transacional para salvar Pessoa com clientes.
- RPC transacional para salvar Cliente com managers.
- RPC transacional para salvar metas Hunter, Renovação + Ampliação e Áreas /
  Studios de uma pessoa em um cliente/ano.
- Auditoria em `person_customer_assignments` e `revenue_target_allocations`.
- Guardrail no app para bloquear mock local em produção sem Supabase.

## Fora de escopo imediato

- Substituir toda leitura direta do browser por BFF.
- Remover a policy ampla de homologação antes da validação interna.
- Criar observabilidade externa.
