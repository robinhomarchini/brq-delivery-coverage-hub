# Acesso Supabase deste projeto

Atualizado em: 2026-10-30

- Inspecao somente leitura em 2026-11-03 comprovada com
  `npx --cache .npm-cache --yes supabase db query --linked --read-only --file <arquivo>`.
  Sem `--read-only`, a versao atual bloqueou a consulta em modo agente antes de
  executar; nao adicionar `--yes` para contornar essa protecao.
- Catalogo Radar usa as tabelas existentes por sessao do usuario e RLS:
  48 clientes, 96 vinculos pessoa-cliente e 15 associacoes especializadas na
  inspecao datada. Sem alteracao de schema, indices, grants ou historico.

- Projeto vinculado: `ttuvykiohikejxioxvhn` (Delivery Coverage Hub).
- Raiz canonica: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- Caminho comprovado: `npx --cache .npm-cache --yes supabase <comando> --linked`.
- `npm run db:migrations:check`: 102 locais e 102 remotas alinhadas apos aplicar
  `20261030180000_people_business_area.sql` com `db push --linked`.
- Antes de aplicar: `db push --linked --dry-run` listou somente essa migration.
- Teste versionado e transacional comprovado sem Docker:
  `npx --cache .npm-cache --yes supabase db query --linked --file supabase/tests/people_business_area.test.sql`.
  A suite usa `finish(true)` para falhar com excecao e termina com rollback;
  33 verificacoes aprovadas sem preservar fixtures nem ampliar acessos reais.
- `test db --linked` depende de Docker mesmo para banco remoto; nesta maquina
  falhou por indisponibilidade de `dockerDesktopLinuxEngine`. Nao e schema drift.
- SQL de teste usa o nome real de `pg_my_temp_schema()` para grants temporarios;
  `GRANT ON SCHEMA pg_temp` literal falhou e foi corrigido antes do teste aprovado.
- O workflow remoto de migration drift usa `SUPABASE_DB_URL`; falha historica de
  connection string e configuracao de acesso, separada da reconciliacao local.
  Nao copiar credenciais locais para documentos ou ampliar grants para o check.
- 403 indica autorizacao; erros de CLI/cache/rede nao comprovam drift.
- Sem reset, repair, SQL ad hoc de reparo ou rollback automatico.
