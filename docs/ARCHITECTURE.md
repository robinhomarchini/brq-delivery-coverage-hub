# Arquitetura

## Visão geral

O BRQ Delivery Coverage Hub é uma aplicação Next.js com App Router. O layout
executivo é compartilhado entre as páginas e os dados do MVP vivem em um store
cliente inicializado por dados mockados.

## Camadas

- `src/app`: rotas e composição de páginas.
- `src/components`: componentes de domínio, layout e primitivas de UI.
- `src/data`: dados iniciais e interfaces TypeScript.
- `src/lib/repositories`: contratos de persistência e adaptador local.
- `src/lib/ai`: funções mockadas para futuros insights de IA.
- `src/store`: estado CRUD compartilhado no navegador.

## Persistência Supabase

O contrato `DeliveryRepository` isola listagem e persistência. O provider seleciona
o adaptador Supabase quando as variáveis públicas estão configuradas e mantém o
adaptador local como fallback de desenvolvimento.

O esquema vive em `supabase/migrations`. O acesso remoto exige autenticação
corporativa, e as policies distinguem leitura de permissões de edição e
administração.

## Decisões

- O modo Supabase exige autenticação.
- Seeds e migrações são executados administrativamente.
- Exportações são geradas no navegador.
