# UX Guidelines

Gerado em: 2026-07-28 13:19:26 -03:00

## Principios confirmados para este produto

- Interface em pt-BR para usuarios.
- Experiencia de ferramenta operacional: informacao densa, escaneavel, sem layout de landing page.
- Metricas financeiras devem ser legiveis; nao truncar valores importantes em cards ou tabelas.
- Filtros aplicados devem refletir em KPIs, graficos, tabelas, relatorios e exportacoes.
- Estados de carregamento, erro, vazio e sucesso devem ser claros e proximos da acao.

## Componentes e padroes existentes

- Cabecalho ordenavel: `src/components/shared/sortable-table-head.tsx`.
- Celulas empilhadas/comparativas estaveis: `src/components/shared/stacked-comparison-cell.tsx`.
- Cards KPI: `src/components/shared/kpi-summary-card.tsx`.
- Acoes de exportacao: `src/components/shared/report-export-actions.tsx`.
- Filtros: `src/components/shared/filter-bar.tsx`.
- Cabecalho de pagina: `src/components/shared/page-header.tsx`.

## Regras de tela

- Tabelas comparativas com multiplas linhas por cliente/studio devem usar celulas de altura estavel e alinhamento consistente.
- Cabecalhos de grids/tabelas devem usar o componente padrao de ordenacao quando houver dados tabulares.
- Valores `-R$ 0` ou divergencias arredondadas para zero nao devem aparecer como erro.
- New Logo deve ter indicacao visual clara e filtro consistente.
- Cores de status devem ser coerentes:
  - vermelho: abaixo/risco real;
  - azul: batido/igual;
  - verde: acima/superado;
  - roxo: contexto especializado quando a regra comercial pedir diferenciacao.
- Modais de criacao devem iniciar zerados e sem herdar estado de outro registro.
- Modais de edicao devem recarregar valores salvos e refletir alteracoes na tela de origem apos salvar.

## Mobile e navegacao

- Rotas mobile permitidas estao controladas em `src/components/layout/app-shell.tsx`.
- Menus desabilitados devem permanecer visivelmente indisponiveis ate a feature ser retomada.

## Riscos de UX a observar

- Cards financeiros do dashboard e comparativo ja apresentaram truncamento.
- Relatorios com muitas dimensoes podem ficar confusos se repetirem nomes/valores sem necessidade.
- Telas de baseline e comparativo sao sensiveis a scroll horizontal e alinhamento; use componentes compartilhados antes de criar celulas novas.
