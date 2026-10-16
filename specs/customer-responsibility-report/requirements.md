# Relatório de Clientes e Responsáveis

## Escopo e domínio

- Nova opção de menu e rota `/relatorio-clientes`, somente leitura.
- Uma linha por cliente acessível ao usuário, incluindo New Logo e clientes
  sem responsáveis. Não é um relatório financeiro ou histórico por ano.
- Mostrar cliente, Hunters e Delivery Managers/Farmers ativos vinculados.
- Fonte de verdade: projeções existentes de `person_customer_assignments` no
  store (`person.clientIds` e `customer.managerResponsibleIds`), carregadas pelo
  repositório e limitadas por RLS. Não inferir responsabilidade de metas/Studios.
- Hunters seguem `isHunterSelectionRole`; Delivery/Farmers seguem
  `isCustomerFarmerResponsibleProfile` ou o vínculo explícito de responsável.
  Hunter + Farmer pode aparecer nos dois grupos. Hunter Especializado aparece
  quando possui vínculo direto com o cliente.
- Excluir pessoas inativas; manter todos os responsáveis ativos distintos por
  ID, em ordem alfabética, mesmo sem metas financeiras. IDs desconhecidos não
  são exibidos como nomes. Ausência de responsável deve ficar explícita.

## Aceite e UX

### Evolução de filtros e cobertura — 2026-10-16

- Combinar busca sem distinção de acentos/caixa com filtros por ID de Hunter,
  Delivery/Farmer e situação de cobertura. Pessoas homônimas permanecem distintas.
- Opções vêm somente dos responsáveis ativos presentes nos clientes acessíveis,
  sem listas operacionais fixas ou novas consultas.
- Indicadores mostram clientes selecionados, com os dois grupos preenchidos e
  com pendências. Durante carregamento/erro, mostrar indisponibilidade, não zero.
- Limpar filtros restaura busca, responsáveis e situação; mudar filtros ou
  ordenação reinicia a paginação. Exportação/prévia preservam todos os filtros.
- Não alterar vínculos, elegibilidade, permissões, schema ou regras financeiras.
- Validar combinações, homônimos e acentos com regressão; rodar validate, build,
  segurança e smoke crítico, revisar desktop/mobile e verificar deploy.

- Busca por cliente ou responsável; filtro de pendências; colunas ordenáveis.
- Prévia, CSV e Excel usam exatamente a seleção e ordenação da tela.
- Paginar a tabela; exportação inclui toda a seleção, não apenas a página.
- Estados de carregamento, erro e seleção vazia não permitem exportar dados
  incompletos. Filtros e controles têm nomes acessíveis; tabela permite scroll
  horizontal em telas pequenas.
- Rota liberada no mobile. Manter o bloqueio atual para `hunter_viewer`;
  não expandir permissões nem incluir dados de remuneração ou valores.

## Plano técnico e riscos

- Reutilizar store, regras de papéis, PageHeader, SortableTableHead, tabela e
  ReportExportActions. Modelo de leitura específico, separado da cobertura
  financeira existente, para não ocultar vínculos de valor zero.
- Indexar vínculos por ID de cliente em memória. Sem novas consultas, mudanças
  de contrato, schema, migrations, grants, RPCs ou índices de banco.
- Risco: vínculos inativos ou sem pessoa identificável não completam um grupo
  ausente. A lista depende dos dados permitidos por RLS.
- Validar vínculos múltiplos, duplicados, ausentes, removidos, pessoas inativas,
  nomes iguais e papéis híbridos com regressão de domínio; executar validate,
  build e smoke crítico; revisar UX renderizada, exportação, reuso e segurança.

## Evidências de validação — 2026-10-15

- `npm run validate`, `npm run smoke:critical`, `npm run test:security` e
  `npm run build`: aprovados, também na worktree isolada da publicação.
- `npm run db:migrations:check`: 101 migrations locais/remotas alinhadas.
- Navegador local: busca por responsável, prévia da seleção, ausência de
  resultados, botões de exportação desabilitados, ordenação e filtro de
  pendências. Mobile: scroll de 760px limitado ao contêiner da tabela, sem
  overflow horizontal da página.
- Publicação versionada pela Vercel: `dpl_Gv2H6nLAT4XdNWeXRUPWHWHGFxz2`,
  estado `Ready`; rota HTTP 200; relatório autenticado com 48 clientes reais.

## Evidências da evolução — 2026-10-16

- Validate, build, smoke crítico e testes de segurança aprovados na raiz e na
  worktree isolada. Regressão cobre filtros combinados, acentos, homônimos por
  ID e vínculos removidos. Histórico de 101 migrations alinhado.
- Navegador local: filtro de responsável + busca `fundacao` retorna um cliente;
  indicadores/prévia conferidos; limpeza restaura 41 clientes de demonstração.
  Mobile sem overflow horizontal da página.
- Produção: `dpl_E9wrLaiQpWFurFDoPgCUr7GL2kau`, estado `Ready`; Auth e rota
  HTTP 200. Sessão autenticada com 48 clientes, combinação de responsáveis
  retorna oito clientes, oito completos e zero pendentes; prévia com oito linhas.
- `.vercelignore` passou a excluir runtime local da CLI e arquivos `.env*`.
