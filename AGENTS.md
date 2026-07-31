# BRQ Delivery Coverage Hub - Agent Entry Point

Este arquivo e o ponto de entrada para qualquer agente de engenharia neste
repositorio. Antes de alterar codigo, leia a documentacao do projeto e use o
repositorio como fonte da verdade.

## Norma comum obrigatoria

Leia e siga `ENGINEERING_STANDARD.md`. Ele concentra as regras comuns a Codex,
Kilo, Claude, Copilot e outras ferramentas. Este arquivo registra somente as
particularidades do BRQ Delivery Coverage Hub.

## Leitura por contexto

1. `ENGINEERING_STANDARD.md` - norma comum obrigatoria.
2. `docs/project/PROJECT_OVERVIEW.md` e `CURRENT_STATE.md` - baseline e estado.
3. Leia apenas os documentos da camada impactada em `docs/project/`.
4. Leia a spec da capacidade afetada em `specs/` antes de mudar comportamento.
5. Use `docs/agent-handoff.md` somente para trabalho ainda em andamento.

Nao carregue todo o acervo por padrao. O Git preserva o historico; documentos
ativos devem representar apenas o baseline atual e pendencias reais.

## Regras permanentes

- Raiz canonica: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- O banco, as RPCs, RLS e regras de backend sao a fonte de verdade para regras criticas.
- Nao hardcode IDs, nomes, clientes, pessoas, estudios ou mapeamentos operacionais na UI.
- Preserve comportamento existente salvo quando a mudanca for explicitamente pedida.
- Valide banco, backend, frontend, dashboards, relatorios e exportacoes de forma consistente.
- Revise impactos de Supabase RLS/RBAC, auditoria e seguranca antes de concluir mudancas.
- Mantenha acesso a dados atras de `src/lib/repositories/` e fronteiras BFF/RPC quando houver mutacao critica.
- Atualize `docs/project/CURRENT_STATE.md` e `docs/project/DECISIONS.md` apos mudancas relevantes.

## Database engineering guardian

Esta regra se aplica a Codex, Kilo, Claude, Cursor, GitHub Copilot e qualquer
outro agente automatizado que opere neste repositorio.

Antes de planejar qualquer parte de uma tarefa que crie, altere, revise ou
dependa de SQL, schema, tabela, coluna, constraint, relacionamento, tipo de
banco, migration, backfill, indice, query, join, view, materialized view,
function, procedure, RPC, trigger, RLS, grant, seguranca de banco, transacao,
tipos Supabase, adapter de repositorio, performance ou execution plan:

1. carregue e siga `.agent/skills/database-engineering-guardian/SKILL.md`;
2. leia os checklists aplicaveis referenciados pela skill;
3. inclua as validacoes de banco no plano de implementacao;
4. pare diante de fonte de verdade ou cardinalidade nao resolvida;
5. apresente evidencias para indices e alegacoes de performance;
6. preserve o historico de migrations como forward-only.

O arquivo da skill e a unica fonte canonica dessas regras. Adapters de
ferramentas devem apenas apontar para ele, sem copiar seu conteudo. A existencia
desta regra nao implica suporte automatico de uma ferramenta sem configuracao
confirmada no repositorio.

## Comandos de validacao

- Padrao: `npm run lint`, `npm run typecheck`, `npm run validate`, `npm run build`.
- Fluxos criticos de persistencia: tambem rode `npm run smoke:critical`.
- Banco, RLS, RPCs ou migrations: tambem rode `npm run db:migrations:check`.
- Supabase CLI neste projeto: `npx --cache .npm-cache --yes supabase <command> --linked`.
- Deploy de producao somente pelos scripts versionados: `npm run deploy:check`, `npm run deploy:prod`, `npm run deploy:inspect:prod`.

## Politica de alteracao

- Nao reverta mudancas nao feitas por voce.
- Nao misture commits de documentacao com codigo de produto quando o trabalho pedir fronteira limpa.
- Antes do handoff, informe arquivos alterados, validacoes executadas, riscos restantes e proximo passo.
