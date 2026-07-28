# Known Issues

Gerado em: 2026-07-28 13:19:26 -03:00

## Contradicoes documentais

1. `docs/ARCHITECTURE.md` antigo descreve total financeiro somando `Hunter + Renovacao + Areas/Studios`.
   - Codigo atual: `src/lib/customer-target-total.ts` soma apenas Hunter + Renovacao; Studios sao contidos.

2. `docs/DOMAIN.md` antigo descreve exclusividade de Hunter por cliente.
   - Codigo/migrations atuais aceitam multiplas participacoes e Hunter Especializado em cenarios especificos.

3. `README.md` menciona homologacao ampla para usuarios BRQ autenticados.
   - Migrations posteriores implementam `app_users`, RBAC, hunter scope e hardening.

4. `docs/agent-handoff.md` registra worktree limpa.
   - Git atual contem alteracoes staged/unstaged em dashboard metrics.

## Riscos funcionais

- Relatorios, dashboard e telas de cliente/pessoa precisam usar a mesma regra de Studios contidos para evitar totais divergentes.
- Regras de baseline possuem varios layouts e filtros; importacoes incorretas podem gerar comparativos falsos.
- A tela temporaria de duplicatas pode nao capturar todos os problemas historicos se o problema for regra de relatorio e nao duplicidade fisica.
- O calculo de desafio usa remuneracao sensivel e depende de semantica clara de salario mensal/anual.
- Hunter Especializado mistura papel de selecao, relacao especializada e possivel hunter principal; essa fronteira precisa continuar explicita.

## Riscos tecnicos

- `src/components/dashboard/executive-dashboard.tsx` ainda tem mudancas nao fechadas junto de `src/lib/dashboardMetrics.ts`.
- `scripts/smoke-critical.mjs` e `scripts/verify-dashboard-metrics.cjs` tambem estao pendentes e parecem acompanhar a validacao do dashboard.
- Algumas operacoes server-side ainda nao usam telemetria estruturada.
- Logs estruturados existem, mas nao ha sink externo confirmado.
- Possiveis diferencas entre status local, GitHub Actions, Supabase drift e Vercel precisam ser verificadas antes de release.

## Riscos de UX

- Telas com valores financeiros grandes historicamente sofreram truncamento.
- Tabelas com multiplas linhas por cliente/studio precisam usar componentes estaveis para evitar desalinhamento.
- Filtros como New Logo, pessoa simulada e escopo Hunter precisam refletir nos KPIs, tabelas, graficos e exports.
