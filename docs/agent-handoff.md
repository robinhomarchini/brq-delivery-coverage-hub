# Agent Handoff — BRQ Delivery Coverage Hub

Este arquivo e um artefato oficial de coordenacao entre Codex, Kilo, ChatGPT e outros agentes de engenharia. Atualize ao fim de cada sessao relevante, mantendo fatos verificaveis no repositorio e sem incluir segredos, logs transientes ou conclusoes especulativas.

## 1. Metadata

- Atualizado em: 2026-07-28 10:07:51 -03:00
- Repositorio: `robinhomarchini/brq-delivery-coverage-hub`
- Raiz local: `C:\Users\rmarchini\projetos\OrgBRQDelivery`
- Branch: `main`
- HEAD de produto antes deste commit documental: `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- Commit de handoff: este commit documental (`docs: add agent handoff workflow`)
- Baseline de producao conhecida: `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- URL de producao conhecida: `https://brq-delivery-coverage-hub.vercel.app`
- Agente gerador: Codex
- Proximo agente previsto: Kilo, Codex ou ChatGPT

## 2. Git status verificado

- `git status --short` antes do commit documental: apenas `?? docs/agent-handoff.md`
- `git branch --show-current`: `main`
- `git rev-parse HEAD`: `3415af1e21813e9bcb2060bbdb3bccebd6afabb2`
- `git diff --stat`: sem diff de arquivos rastreados
- `git diff`: sem diff de arquivos rastreados
- `git diff --cached --stat`: sem staged changes
- `git diff --cached`: sem staged changes
- Arquivos untracked antes do commit documental: `docs/agent-handoff.md`
- Estado esperado apos o commit documental: working tree limpa

## 3. Objetivo atual

Estabelecer este handoff como referencia oficial de coordenacao de engenharia, separado dos commits de implementacao de produto.

## 4. Decisoes aprovadas

- `OrganizationChart` e a implementacao oficial do organograma.
- `OrganizationChartV2` nao deve ser reintroduzido.
- O organograma validado deve preservar `PersonCard` controlado pelo container, grid responsivo de reportes diretos, colunas flexiveis, conector pontilhado de Staff, expand/collapse acessivel e exportacao PNG completa.
- `src/lib/roles.ts` e a fonte canonica TypeScript para papeis de dominio.
- `src/data/mockData.ts` deve consumir `RoleType` de `src/lib/roles.ts`.
- Valores persistidos de papel devem permanecer: `Executive`, `Director`, `Farmer + Delivery`, `Delivery`, `Hunter`, `Hunter Especializado`, `Farmer`, `Hunter + Farmer`, `Staff`.
- `Manager` nao e `RoleType` persistido; pode ser apenas label visual, relacional, hierarquico ou de exportacao.
- Constraints Supabase de papel devem permanecer compativeis.
- Sobreposicoes semanticas entre papeis nao devem ser alteradas silenciosamente.

## 5. Fatos verificados no codigo

- `src/lib/roles.ts` exporta `ROLE_TYPES` como tuple readonly e deriva `RoleType` dele.
- `ROLE_DEFINITIONS` esta tipado como `Record<RoleType, RoleDefinition>`.
- `src/data/mockData.ts` importa `RoleType` de `@/lib/roles`.
- `Manager` nao aparece em `ROLE_TYPES` ou `ROLE_DEFINITIONS`.
- Nenhuma referencia ativa de runtime para `OrganizationChartV2`, `organization-chart-v2`, `useOrganizationTree` ou `use-organization-tree` foi encontrada; as referencias restantes sao avisos documentais.
- Migracoes historicas contem listas antigas de papeis, mas a migracao canonica de `Hunter Especializado` contem o conjunto atual. Nao tratar migracao antiga isolada como drift real.

## 6. Trabalho concluido

- `d1dd7b2 feat(roles): centralize role domain definitions and migrate active consumers`
- `3415af1 chore: harden role validation docs`
- `npm run validate` inclui `npm run test:roles`.
- Deploy anterior conhecido da baseline `3415af1` foi inspecionado como Ready.
- Esta sessao nao alterou codigo de produto.

## 7. Trabalho pendente

- Manter este arquivo em commits documentais separados quando a alteracao for apenas coordenacao de agentes.
- Em futura tarefa pequena, melhorar `scripts/verify-role-domain.cjs` para varrer novas constraints/RPCs de papeis sem confundir migracoes historicas supersedidas.
- Revisar comparacoes literais de papeis restantes e classificar como filtro intencional, label de UI ou candidato a helper.
- Reautenticar GitHub CLI antes de confiar em `npm run github:checks`.

## 8. Validacoes

- Executadas nesta sessao de handoff: comandos Git listados na secao 2 e inspecoes por `rg`/`Get-Content` em roles, mockData, organograma, migracoes, scripts de validacao e contratos.
- Nao executadas nesta sessao: lint, typecheck, build, smoke, migracoes e deploy, pois a tarefa e documental.
- Ultima baseline de produto conhecida passou anteriormente em: `npm run test:roles`, `npm run validate`, `npm run test:performance`, `npm run test:security`, `npm run smoke:critical`, `npm run build`, `npm run db:migrations:check`, `git diff --check`, `npm run deploy:check`, `npm run deploy:prod`, `npm run deploy:inspect:prod` e `npm run security:pentest-lite`.
- `npm run github:checks` falhou anteriormente por autenticacao do GitHub CLI, nao por erro de codigo.

## 9. Politica de commit e deploy

- Commits de handoff devem ficar separados de commits de produto.
- Este arquivo pode ser atualizado em commits documentais ou junto ao fim de uma entrega, desde que o escopo fique explicito.
- Nao incluir segredos, credenciais, dumps, logs transientes ou suposicoes nao verificadas.
- Deploy nao deve ser disparado para alteracoes apenas documentais.

## 10. Prompt de continuacao

Continue em `C:\Users\rmarchini\projetos\OrgBRQDelivery`. Leia `AGENTS.md`, `.github/copilot-instructions.md`, `.squad/config.yaml`, `.squad/memory.md` e `docs/agent-handoff.md`. Use Git e codigo como fonte da verdade. Preserve `DeliveryRepository`, Supabase/RLS e `src/lib/roles.ts` como fonte canonica de papeis. Nao reintroduza `OrganizationChartV2`. Antes de qualquer commit de produto, rode as validacoes proporcionais ao impacto; antes de deploy, use apenas os scripts `npm run deploy:*`.
