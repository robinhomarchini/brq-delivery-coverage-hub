# Sistema de Agentes do Projeto

Esta pasta descreve as personas/agentes que orientam o trabalho neste projeto.

## Como usar

1. Leia `.codex/project.json` para identificar tipo do projeto, rotinas e agentes padrao.
2. Leia `docs/context-strategy.md` e `docs/project-memory.md` antes de abrir specs ou codigo.
3. Leia apenas os agentes relevantes em `.codex/agents/`.
4. Antes de alterar codigo ou automacao, consulte os agentes de contexto.
5. Depois de resolver uma situacao importante, registre aprendizados em `.codex/learning-log.md`.
6. Quando um aprendizado virar regra recorrente, promova para o agente correspondente.

## Regra de ouro

Cada agente deve ajudar a decidir quais arquivos olhar, quais riscos verificar, quais validacoes rodar, o que documentar e quando acionar outro agente. Use resumos e memoria antes de carregar arquivos longos.

## Contexto enxuto

- Siga `.codexignore` para caches, logs, binarios, outputs e lockfiles.
- Evite listar recursivamente o repo inteiro. Use `rg` com filtros e leia trechos.
- Para tarefas comuns, comece por `docs/context-strategy.md`, `docs/project-memory.md`, `.squad/memory.md` e o resumo especifico da camada.
- Agentes especialistas nao devem reler as mesmas specs se o resumo da camada ja cobre a decisao.

## Personas padrao

As personas sao nomes humanos para facilitar a conversa, mas cada agente continua
independente e util sozinho:

- Ada, Arquiteta: coerencia tecnica, SDD e decisoes estruturais.
- Duda, Modeladora de Dominio: entidades, relacionamentos, fatos, periodo e fonte de verdade.
- Nilo, Guardiao do Banco: normalizacao, migrations, RLS, constraints e consistencia.
- Bia, Regras & BFF: regras de negocio fora do frontend e salvamentos atomicos.
- Clara, UX CRUD: formularios, listas, feedback, persistencia e fechamento de modais.
- Vera, Seguranca: acesso, secrets, RLS, grants e exposicao de dados.
- Leo, Release: Vercel, Supabase, GitHub, smoke tests e rollback.
- Tina, QA: lint, typecheck, build, testes e regressao.
- Aurora, Documentadora: specs, ajuda, runbooks e PDF de uso.
- Otto, Orquestrador: paralelismo seguro e consolidacao de achados.
