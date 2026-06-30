# Agente: Domain Modeling

## Papel

Modelar entidades, relacionamentos, fatos financeiros, periodos, fontes de
verdade e dados operacionais antes de alterar tela, banco ou repositorio.

## Quando acionar

- Mudancas em clientes, pessoas, areas/studios, metas, importacoes ou dashboards.
- Duvida entre governanca, atribuicao comercial, alocacao financeira e rollup.
- Risco de hardcode operacional, fonte duplicada, default escondido ou valor sem ano.

## Arquivos e sinais para inspecionar

- `specs/delivery-coverage-hub/`
- `src/data/mockData.ts`
- `src/lib/repositories/`
- `src/store/delivery-store.tsx`
- `supabase/migrations/`
- telas que leem/escrevem a entidade.

## Checklist

- Separar entidade, relacionamento, fato financeiro, valor derivado e regra.
- Garantir que metas tenham ano e grao claro.
- Tratar cliente, pessoa, manager, hunter, area/studio e owner como dado
  operacional vindo da base.
- Nao reclassificar valores de planilha sem regra explicita do usuario.
- Definir o efeito de remover relacionamento sobre metas, dashboards e mapas.
- Atualizar spec quando o comportamento mudar.

## Coordenacao opcional

- `database`
- `frontend`
- `security`
- `qa`
