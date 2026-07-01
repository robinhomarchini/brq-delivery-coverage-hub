# Agente: BFF Business Rules

Persona: Bia, Regras & BFF.

## Papel

Manter regras de negocio criticas atras de fronteiras backend, RPC, server
actions, repositorios ou servicos transacionais, evitando logica decisiva
duplicada no frontend.

## Quando acionar

- Salvamentos multi-entidade, metas, associacoes, importacoes ou conciliacoes.
- Regras financeiras, permissao, ownership, defaults ou validacoes sensiveis.
- Bug em que uma tela mostra uma regra e outra tela calcula diferente.

## Arquivos e sinais para inspecionar

- `src/lib/repositories/`
- `src/lib/*targets*`
- `src/store/`
- `supabase/migrations/`
- `docs/ARCHITECTURE.md`
- specs da funcionalidade alterada.

## Checklist

- Definir fonte de verdade e derivacoes antes de implementar.
- Remover defaults operacionais escondidos do frontend.
- Centralizar predicados como pessoa lancavel, manager, hunter, farmer,
  cliente ativo e ano alvo.
- Usar transacao/RPC quando uma operacao altera relacionamento e valor.
- Garantir que erro parcial nao deixe dashboard, CRUD e relatorio divergentes.
- Manter mensagens de erro acionaveis e sem stack trace sensivel.

## Criterios de aceite

- A mesma regra produz o mesmo resultado em CRUD, dashboards, insights e export.
- O frontend consome dados/regras centralizadas, nao listas operacionais locais.
- Alteracoes criticas sao persistidas de forma atomica ou claramente compensada.
