# Arquitetura

## Visão geral

O BRQ Delivery Coverage Hub é uma aplicação Next.js com App Router. O layout
executivo é compartilhado entre as páginas. Em desenvolvimento, o app pode usar
mock local. Em homologação/produção, o app deve usar Supabase; produção sem
Supabase configurado não abre dados mockados.

## Camadas

- `src/app`: rotas e composição de páginas.
- `src/components`: componentes de domínio, layout e primitivas de UI.
- `src/data`: dados iniciais e interfaces TypeScript.
- `src/lib/repositories`: contratos de persistência, adaptador local e adaptador
  Supabase.
- `src/lib/ai`: funções mockadas para futuros insights de IA.
- `src/store`: estado CRUD compartilhado no navegador.
- `supabase/migrations`: schema, RLS, auditoria e RPCs transacionais.

## Persistência Supabase

O contrato `DeliveryRepository` isola listagem e persistência. O provider seleciona
o adaptador Supabase quando as variáveis públicas estão configuradas e mantém o
adaptador local apenas como fallback de desenvolvimento.

O esquema vive em `supabase/migrations`. O acesso remoto exige autenticação
corporativa, e as policies distinguem leitura de permissões de edição e
administração.

Operações críticas usam RPCs transacionais quando a migration de hardening está
aplicada:

- `save_person_with_assignments`: salva Pessoa e seus clientes em uma transação.
- `save_customer_with_managers`: salva Cliente e managers em uma transação.
- `save_person_customer_targets`: salva Hunter, Renovação + Ampliação e Áreas /
  Studios de uma pessoa em um cliente/ano com lock por cliente/ano.

O banco também protege a regra de exclusividade Hunter na fonte de verdade
`person_customer_assignments`: um cliente não pode ficar associado a duas pessoas
com papel Hunter/Hunter + Farmer.

Metas financeiras anuais têm três componentes canônicos:

- Hunter.
- Renovação + Ampliação.
- Áreas / Studios.

O total financeiro exibido em Clientes, Metas, Dashboard, Insights e Relatórios
é sempre derivado da soma desses três componentes para o ano selecionado.
Campos legados em `customers` existem como cache de compatibilidade; a fonte
anual normalizada é `customer_target_years`.

Enquanto a migration não estiver aplicada, o adaptador Supabase preserva fallback
compatível para não interromper homologação, mas o caminho recomendado é aplicar
a RPC.

## Decisões

- O modo Supabase exige autenticação.
- Seeds e migrações são executados administrativamente.
- Exportações são geradas no navegador.
- A policy ampla de homologação por e-mail BRQ é temporária; produção definitiva
  deve usar viewer/editor/admin estrito.
- O próximo salto arquitetural recomendado é mover o browser client para um BFF
  ou Server Actions, mantendo as RPCs como boundary transacional no banco.
