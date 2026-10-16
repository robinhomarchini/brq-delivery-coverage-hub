# Current State

Atualizado em: 2026-10-16

## Baseline v0.0.0

- Branch canônica: `main`.
- Stack: Next.js 16, React 19, TypeScript, Supabase e Vercel.
- Banco atual preservado com 101 migrations forward-only.
- Última reconciliação registrada: 101 migrations locais e 101 remotas.
- Reconciliação verificada em 2026-10-16 pelo check versionado, sem drift.
- Documentação técnica canônica: `docs/project/`.
- Requisitos ativos: `specs/`.
- Norma comum para Codex, Kilo, Copilot e Claude: `ENGINEERING_STANDARD.md`,
  protegida por `npm run test:agents`.
- Histórico anterior: Git, sem cópias ou archives no working tree.

## Estado funcional

- Fechamento do relatório: código versionado no commit `43a0be4`, separado das
  alterações locais de autenticação e cadastro. Pendências operacionais de
  responsáveis continuam dependendo de confirmação dos donos dos dados.

- Evolução do Relatório de Clientes em 2026-10-16: filtros combináveis por ID
  de Hunter e Delivery/Farmer, busca sem acentos, indicadores da seleção e
  limpeza de filtros. Alterações de filtro/ordenação reiniciam a paginação;
  prévia e exportação usam a mesma seleção completa. Validações e builds
  aprovados na raiz e worktree isolada. Publicado em produção no deployment
  `dpl_E9wrLaiQpWFurFDoPgCUr7GL2kau`, Vercel `Ready`; leitura autenticada de
  48 clientes e combinação Hunter + Delivery/Farmer (8 clientes) conferidas.

- Relatório de Clientes: nova rota `/relatorio-clientes`, com vínculos ativos
  de Hunters e Delivery Managers/Farmers, busca, filtro de pendências,
  ordenação, paginação e prévia/CSV/Excel da seleção completa. Inclui clientes
  sem responsáveis e sem metas. Deriva dos vínculos já carregados, sem novas
  consultas, migrations ou alteração de permissões. Publicado em 2026-10-15:
  deployment `dpl_Gv2H6nLAT4XdNWeXRUPWHWHGFxz2`, Vercel `Ready`, rota HTTP 200
  e leitura autenticada de 48 clientes confirmada em produção.

- Produção usa Supabase; fallback local é exclusivo de desenvolvimento.
- Persistência passa por `DeliveryRepository`, BFF/RPC e RLS.
- Dashboard usa RPCs tipadas/validadas na fronteira do repositório.
- Importação de funcionários persiste lotes, snapshots, estados salariais e HC
  com autorização administrativa e auditoria.
- O histórico da importação deriva a quantidade de linhas de
  `preview_snapshot.sourceRowCount`; não existe coluna física
  `employee_import_batches.source_row_count`.

## Política de retenção

- Handoffs, relatórios pontuais e planos concluídos: máximo de 15 dias.
- Specs e documentos canônicos: mantidos enquanto o comportamento estiver ativo.
- Migrations, ADRs vigentes, auditoria e evidências de segurança: preservados.
- Caches e artefatos gerados: não versionados e removíveis a qualquer momento.
