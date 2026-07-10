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
  Supabase, incluindo `AccessRepository` para administração de acesso.
- `src/lib/auth`: contrato de autenticação provider-neutral, implementação
  Supabase atual e reserva para SSO corporativo futuro.
- `src/lib/ai`: funções mockadas para futuros insights de IA.
- `src/store`: estado CRUD compartilhado no navegador.
- `supabase/migrations`: schema, RLS, auditoria e RPCs transacionais.

## Persistência Supabase

O contrato `DeliveryRepository` isola listagem e persistência. A seleção do
provider fica centralizada em `src/lib/repositories/provider.ts`, que resolve
`supabase`, `local-dev` ou `unavailable` sem espalhar essa decisão pela store.
Hoje o provider usa o adaptador Supabase quando as variáveis públicas estão
configuradas e mantém o adaptador local apenas como fallback de desenvolvimento.
Produção sem Supabase configurado usa um provider indisponível, sem abrir dados
mockados.

O contrato provider-neutral de persistência vive em
`docs/persistence-contract.md`. Ele é o aceite funcional para qualquer provider
futuro e deve permanecer alinhado com o contrato TypeScript em
`src/lib/repositories/types.ts`, com as RPCs/migrations atuais e com os fluxos de
relatórios/exportações.

O esquema vive em `supabase/migrations`. O acesso remoto exige autenticação
corporativa, e as policies distinguem leitura de permissões de edição e
administração.

## Autenticação

A seleção do provider de autenticação fica centralizada em
`src/lib/auth/auth-service.ts`. O provider padrão é `supabase`; a variável
`NEXT_PUBLIC_AUTH_PROVIDER` pode declarar explicitamente `supabase` e reserva
`corporate-sso` para a integração futura de SSO interno. Enquanto
`corporate-sso` não estiver implementado, o app exibe bloqueio de configuração
em vez de liberar acesso.

A UI não chama `client.auth.*` diretamente. `AuthGate`, logout no layout e
rotas que precisam de bearer token usam o auth service. O tipo público de
usuário autenticado é `AuthenticatedUser`, próprio do app, para evitar que telas
dependam do tipo `User` do Supabase. A autorização de domínio continua em
`app_users`, `app_access_invites`, RPCs, RLS e policies.

## Administração De Acesso

A página Configurações consome `AccessRepository` em
`src/lib/repositories/accessRepository.ts`, em vez de criar cliente Supabase ou
chamar RPCs diretamente. A implementação atual continua usando as RPCs
`accept_current_app_access`, `list_app_access`, `upsert_app_access` e
`delete_app_access`, protegidas por RLS/RBAC. Essa fronteira permite trocar a
implementação futura por BFF ou SQL Server sem alterar a UI.

Operações críticas usam RPCs transacionais quando a migration de hardening está
aplicada:

- `save_person_with_assignments`: salva Pessoa e seus clientes em uma transação.
- `save_customer_with_managers`: salva Cliente e managers em uma transação.
- `saveCustomer`: a UI chama `DeliveryRepository`, o adaptador Supabase envia o
  comando para `/api/delivery/customers` com bearer token do usuário, e a rota
  valida sessão, app access, papel editor/admin e RLS antes de executar o
  provider atual. O handler desativa o próprio BFF para evitar recursão e mantém
  a semântica atual de salvar cliente, alvo anual e managers.
- `savePersonCustomerTargets`: a UI chama `DeliveryRepository`, o adaptador
  Supabase envia o comando para `/api/delivery/person-customer-targets` com
  bearer token do usuário, e a rota valida sessão, app access, papel editor/admin
  e RLS antes de executar o comando no provider atual. A implementação atual
  preserva o cálculo completo de `ownAmount` e Studio Hunter; a RPC
  `save_person_customer_targets` deve ser evoluída antes de remover o fallback
  compatível.

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

O baseline aprovado pelo board é tratado como fato de referência anual separado
do cadastro operacional. A tabela `board_target_baselines` possui grão Cliente +
Ano + Cenário, preserva fonte/colunas da planilha aprovada e é lida pelo
repositório como origem canônica do Dashboard Executivo e do Comparativo
Baseline. Para 2026, `metageralinicial.xlsx` fornece a foto inicial: Cliente na
coluna A, Meta Hunter na coluna I, Meta Renovação + Ampliação na coluna L e Meta
Total na coluna M. Alterações operacionais continuam em `customer_target_years`
e são comparadas contra essa referência, não sobrescrevem a foto aprovada. O
arquivo local `src/data/boardTargetBaseline.ts` é apenas fallback de
desenvolvimento e seed idempotente.

Enquanto a migration não estiver aplicada, o adaptador Supabase preserva fallback
compatível para não interromper homologação, mas o caminho recomendado é aplicar
a RPC.

## Arquitetura alvo anti-lock-in

Supabase/Postgres continua sendo a implementação de produção. A evolução
recomendada para reduzir lock-in é introduzir uma fronteira BFF/comandos antes de
qualquer troca de banco. A UI deve continuar consumindo a store e o
`DeliveryRepository`; operações críticas de escrita migram gradualmente para
rotas internas ou Server Actions, que chamam serviços de comando e o adapter do
provider atual. Os primeiros fluxos nesse formato são `/api/delivery/customers`
e `/api/delivery/person-customer-targets`.

Formato alvo:

```text
UI components
  -> delivery store facade
  -> DeliveryRepository
  -> BFF/API command handlers
  -> domain command services
  -> persistence provider adapter
       - Supabase/Postgres adapter today
       - future SQL Server adapter only after contract parity
```

Essa fronteira deve preservar as regras que hoje estão em RPCs, policies,
triggers e constraints. Enquanto Supabase for o provider, RLS/RBAC continuam
obrigatórios; uma implementação futura, como Microsoft SQL Server, precisa provar
equivalência de autorização, transação, auditoria e relatórios antes de qualquer
cutover.

As leituras podem continuar usando `DeliveryData` enquanto ele atender às telas
atuais. Novos read models específicos para dashboards, relatórios ou exportações
só devem ser criados quando houver necessidade real de performance ou clareza, e
devem manter paridade com o contrato de persistência.

## Decisões

- O modo Supabase exige autenticação.
- Seeds e migrações são executados administrativamente.
- Exportações são geradas no navegador.
- A policy ampla de homologação por e-mail BRQ é temporária; produção definitiva
  deve usar viewer/editor/admin estrito.
- O próximo salto arquitetural recomendado é mover os demais comandos críticos,
  principalmente `savePerson`, para BFF ou Server Actions, mantendo as RPCs como
  boundary transacional no banco.
