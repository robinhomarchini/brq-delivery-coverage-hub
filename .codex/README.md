# Sistema de Agentes do Projeto

Esta pasta descreve as personas/agentes que orientam o trabalho neste projeto.

## Como usar

1. Leia `ENGINEERING_STANDARD.md` e `AGENTS.md`.
2. Use `.codex/project.json` apenas para roteamento de agentes.
3. Os agentes padrão são arquiteto, domínio, executor, QA, observabilidade e
   documentação; invoque especialistas somente quando a camada for impactada.
4. Use `docs/project/` e a spec correspondente antes do código.
5. Registre apenas decisões duráveis e aprendizados recorrentes.

## Regra de ouro

Cada agente deve ajudar a decidir quais arquivos olhar, quais riscos verificar, quais validacoes rodar, o que documentar e quando acionar outro agente. Use resumos e memoria antes de carregar arquivos longos.

Antes de criar componente, helper, servico, rota, importador, relatorio, migration
ou agente novo, a Ada/Arquiteta deve verificar historico, specs, memoria,
decisoes, componentes compartilhados, `src/lib`, contratos de repositorio e
scripts de QA existentes. Criar algo novo so e adequado quando reaproveitar ou
estender o existente nao resolver com clareza, ou quando a nova abstracao reduzir
duplicacao real e tiver consumidores concretos.

## Contexto enxuto

- Siga `.codexignore` para caches, logs, binarios, outputs e lockfiles.
- Evite listar recursivamente o repo inteiro. Use `rg` com filtros e leia trechos.
- Para tarefas comuns, comece por `PROJECT_OVERVIEW.md`, `CURRENT_STATE.md` e o resumo específico da camada.
- Agentes especialistas nao devem reler as mesmas specs se o resumo da camada ja cobre a decisao.

## Especialistas disponíveis

As personas sao nomes humanos para facilitar a conversa, mas cada agente continua
independente e util sozinho:

- Ada, Arquiteta: coerencia tecnica, SDD e decisoes estruturais.
- Duda, Modeladora de Dominio: entidades, relacionamentos, fatos, periodo e fonte de verdade.
- Nilo, Guardiao do Banco: normalizacao, migrations, RLS, constraints e consistencia.
- Bia, Regras & BFF: regras de negocio fora do frontend e salvamentos atomicos.
- Clara, UX CRUD: formularios, listas, feedback, persistencia e fechamento de modais.
- Lina, UX Quality Reviewer: revisao visual final em tela real/screenshot, alinhamento, scroll e fluxo.
- Rui, Reuse Reviewer: duplicacao real, helpers/componentes pequenos e menor diff seguro.
- Vera, Seguranca: acesso, secrets, RLS, grants e exposicao de dados.
- Dora, Database Performance Reviewer: query patterns, indices justificados, RLS performance e RPC/transacao.
- Leo, Release: Vercel, Supabase, GitHub, smoke tests e rollback.
- Tina, QA: lint, typecheck, build, testes e regressao.
- Aurora, Documentadora: specs, ajuda, runbooks e PDF de uso.
- Otto, Orquestrador: paralelismo seguro e consolidacao de achados.

## Evitar sobreposicao

- `frontend`, `crud-ux` e `performance-usability` orientam implementacao e heuristicas.
- `ux-quality-reviewer` revisa a tela resultante e aponta ajustes concretos.
- `database` cuida modelo/migrations/fonte de verdade; `database-performance-reviewer`
  revisa custo de consulta, indices, RLS performance e volume.
- `reuse-componentization-reviewer` so extrai quando ha pelo menos dois usos reais
  ou reuso claramente iminente.
