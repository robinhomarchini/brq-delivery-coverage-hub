# Current State

Atualizado em: 2026-10-30

## Fechamento de persistencia e release em 2026-10-30

- WIP de `businessArea` concluido: coluna canonica nullable, RPC transacional
  compativel, adapter de leitura/escrita e opcao Nao informado no formulario.
  Sem backfill, classificacao presumida, novos indices ou ampliacao de RLS.
- Hunter pode salvar perfil com classificacao inalterada; RPC e trigger de
  coluna bloqueiam mudanca direta ou indireta da classificacao.
- Migration aplicada e historico alinhado em 102 locais/remotas; suite real
  transacional de 33 verificacoes aprovada, com rollback integral dos fixtures.
- Zod atualizado para 4.6.7; npm audit completo retornou zero vulnerabilidades.
- validate (lint, tipos e testes), build, seguranca, performance e smoke critico
  aprovados; quatro avisos de navegacao preexistentes permanecem sem erros.
- CI remoto e publicacao Vercel em andamento; evidencias finais serao registradas
  apos verificacao. Operacao Supabase comprovada em `docs/SUPABASE_ACCESS.md`.
- Registros datados abaixo sao historicos; o WIP e a contagem anterior foram
  superados por este fechamento.

## Fluxo de agentes e contexto em 2026-10-30

- Personas Markdown documentadas como referencias por impacto, sem execucao
  obrigatoria do catalogo ou registro automatico de subagentes nativos.
- Manifesto aponta contrato de repositorio e estado canonico; teste de agentes
  verifica existencia das personas das rotinas e dos entrypoints.
- Seletor local aplica exclusoes a descoberta, referencias, imports e memorias;
  rejeita caminhos externos, links/junctions e arquivos locais de ambiente.
  Instrucoes e resumos canonicos precedem fontes dentro do budget configurado.
- `test:ai-router` integra `validate`; CI inclui smoke critico, permissoes de
  leitura e cancelamento de execucoes superadas. Sem novas dependencias.
- Analises independentes de agentes e gate feitas em paralelo; implementacao
  separada por ownership. Sem alteracao de UI, dominio, banco, Auth ou RLS.
- Validacao local completa, seguranca, performance e smoke critico aprovados;
  lint mantem quatro avisos preexistentes. Build de producao aprovado.
- Politica de contexto nao e parser gitignore completo; limites documentados
  em `.ai/README.md`. Sem medicao ou alegacao de ganho no runtime da aplicacao.
- Sem push ou deploy; workflow atualizado ainda requer execucao remota.

## Incidente de autenticacao em 2026-10-26

- Rotina `Supabase Availability` publicada na main remota no commit `0a1b46d`,
  sem enviar os commits locais de produto. Agenda diaria as 08:17 de Sao Paulo,
  inclusive fins de semana, com secrets da URL e chave anon existentes.
- Execucao manual remota `40369310614` concluida com sucesso; workflow ativo.
  Verifica Auth e resposta do PostgreSQL via PostgREST sem ampliar grants/RLS.
  A negativa `42501` para anon e esperada e nao expoe dados.
- `npm run validate`, `npm run build`, `npm run test:security` e diff --check
  passaram; lint manteve quatro avisos preexistentes, sem erros.
- Rotina nao garante impedir pausa do Free. GitHub pode desativar schedules
  de repositorios publicos apos 60 dias sem atividade. Migration drift antigo
  continua separado: ultimo run observado falhou por connection string invalida.

- Vercel confirmou producao `Ready` no deployment `dpl_E9wrLaiQpWFurFDoPgCUr7GL2kau`;
  a pagina inicial respondeu HTTP 200.
- Supabase CLI confirmou o projeto vinculado `INACTIVE`; o hostname de Auth
  nao resolvia no DNS. Login e recuperacao de senha dependem desse servico.
- Retomada concluida pelo painel autenticado. Projeto passou por `COMING_UP`
  e `RESTORING` e voltou a `Healthy`; Auth health e settings responderam HTTP 200.
- Check de migrations tentou tres vezes e falhou por `ECONNREFUSED` ao criar
  o login role durante a retomada. Isso nao comprova drift de schema.
- Check repetido apos a retomada: 101 migrations locais e 101 remotas alinhadas.
- Sem alteracao de codigo, schema, RLS, credenciais ou deploy. Usuario confirmou
  que o acesso voltou a funcionar apos a retomada; entrega do email de
  recuperacao nao foi verificada separadamente.

## Seguranca de dependencias em 2026-10-23

- Next.js e eslint-config-next atualizados para 16.4.2; DOMPurify transitivo
  atualizado para 3.4.17. Nenhuma nova dependencia direta ou mudanca de banco.
- `npm audit --omit=dev`: zero alertas. Auditoria completa: nove alertas
  (sete altos e dois moderados), na cadeia de ferramentas Tailwind/lint.
  Resolver esses alertas exige avaliar migracoes principais; nao foi usado force.
- `npm run validate`, `npm run build`, `npm run smoke:critical` e
  `npm run test:security` passaram. O novo lint aponta quatro avisos de
  navegacao interna em codigo preexistente, sem erros.
- Alteracoes locais, sem publicacao. Producao ainda depende de deploy revisado;
  `businessArea` continua WIP conforme registrado abaixo.

## Fechamento das alteracoes locais em 2026-10-23

- Autenticacao e cadastro foram organizados em commits separados, preservando
  as alteracoes existentes. Sem deploy ou mudanca no banco.
- Passaram `npm run validate` (lint, tipos e testes), `npm run build`,
  `npm run smoke:critical`, `npm run test:security` e `git diff --check`.
- Cadastro de Pessoas permanece WIP: `businessArea` existe no modelo,
  validacao, formulario e filtro, mas nao e enviado pela RPC nem recuperado
  por `fromPersonRow` no adapter Supabase. O campo nao tem persistencia de
  producao; concluir contrato/backend/schema antes de publicar esta capacidade.
- Revisao de UX feita no componente, sem verificacao visual no navegador.
  Nao houve alteracao de RLS, grants, migrations ou consultas.

## Baseline v0.0.0

- Branch canônica: `main`.
- Stack: Next.js 16, React 19, TypeScript, Supabase e Vercel.
- Banco atual preservado com 102 migrations forward-only.
- Última reconciliação registrada: 102 migrations locais e 102 remotas.
- Reconciliação verificada em 2026-10-30 pelo check versionado, sem drift.
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

- Correção local em 2026-10-15: eventos de autenticação são entregues após o
  callback interno do Supabase, evitando consultas de perfil sob o lock de Auth.
  A autorização continua na RPC existente; validação nominal em produção pendente.
- Incidente de login em 2026-10-15: Vercel confirmou produção `Ready` no commit
  `6a5471d`; Supabase CLI confirmou o projeto vinculado como `INACTIVE`.
  O hostname de Auth retornou NXDOMAIN também no resolvedor público Cloudflare.
  Retomada concluída pelo painel autenticado: CLI confirmou `ACTIVE_HEALTHY`,
  Auth health/settings retornaram HTTP 200 e o check reconciliou 101 migrations
  locais com 101 remotas. Sessão administrativa e leitura autenticada foram
  confirmadas em produção ao validar o novo relatório de clientes.
  A correção de código continua sem publicação; validação e smoke crítico
  passaram na worktree isolada `OrgBRQDelivery-login-fix`. O build isolado foi
  impedido pelo Turbopack rejeitar a junction externa de `node_modules`.

- Produção usa Supabase; fallback local é exclusivo de desenvolvimento.
- Persistência passa por `DeliveryRepository`, BFF/RPC e RLS.
- No cadastro de Pessoas, a elegibilidade do combo Diretor é derivada do tipo de
  atuação Executivo/Diretor ou do Cargo contendo Diretor/Diretora; nomes
  operacionais não são hardcoded.
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
