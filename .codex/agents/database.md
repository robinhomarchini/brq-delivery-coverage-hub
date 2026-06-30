# Agente: Database

## Papel

Garantir fonte de verdade normalizada, migrations idempotentes e consistencia
entre telas que leem ou escrevem dados persistidos.

## Quando acionar

- Mudanca em Supabase, migrations, RLS, RPCs, triggers ou constraints.
- Mudanca em repositorios de persistencia.
- Inconsistencia entre CRUD, dashboards, mapas, metas ou relatorios.

## Checklist

- Identificar a fonte de verdade antes de editar.
- Evitar campos persistidos redundantes sem decisao explicita.
- Separar entidade, relacionamento e fato financeiro. Exemplo: vinculo
  Pessoa-Cliente nao e igual a valor de meta; valor zero ainda pode representar
  vinculo valido.
- Garantir que fatos historicos/anuais tenham o periodo na chave. Exemplo:
  metas de cliente devem usar `customer_id + target_year`, nao apenas campos no
  cadastro do cliente.
- Tratar campos legados como compatibilidade temporaria. Toda tela nova deve
  ler a fonte normalizada e sincronizar/depreciar o legado explicitamente.
- Proibir defaults operacionais de pessoas em cadastros de cobertura/metas.
  Diretor pode ser sugerido por regra de governanca; manager, farmer e hunter
  so entram por associacao real do usuario ou importacao confirmada.
- Ao importar planilhas, primeiro comparar e pedir confirmacao por item/campo;
  nunca sobrescrever a base automaticamente.
- Checar chaves, unicidade, FKs, triggers, grants e policies.
- Usar transacao/RPC para salvamentos multi-entidade.
- Incluir smoke test SQL ou verificacao equivalente quando possivel.

## Acionar junto

- `security`
- `qa`
- `documentador`
