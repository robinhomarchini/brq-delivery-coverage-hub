# Disponibilidade Supabase no plano gratuito

## Escopo e regras

- Executar diariamente as 08:17 America/Sao_Paulo e sob demanda no GitHub Actions.
- Monitorar somente o projeto Supabase deste repositorio, configurado por secrets.
- Consultar Auth health e uma coluna de no maximo uma area via PostgREST.
- A leitura de `areas.id` usa a chave anon existente e respeita RLS; resultado
  vazio e valido. O banco atual nega SELECT ao anon: HTTP 401/403 com codigo
  PostgreSQL `42501` tambem confirma conectividade e preserva essa restricao.
  Nao adicionar grants, policies, contas, RPCs ou migrations.
- Nao alterar registros, registrar respostas ou usar credenciais privilegiadas.
- A leitura produz atividade no banco, mas nao garante impedir a pausa do Free.
- Falhas devem reprovar a execucao, ficando visiveis no GitHub Actions. Notificacoes
  dependem das preferencias do usuario no GitHub; nao ha canal externo novo.

## Aceite e validacao

- Workflow tem schedule diario, workflow_dispatch, permissao contents: read,
  timeout e tentativas limitadas; nao instala dependencias do app.
- URL e chave ausentes causam falha explicita. URL deve ser HTTPS Supabase.
- Auth retorna HTTP 200; PostgREST retorna array HTTP 200 ou a negativa
  PostgreSQL `42501` HTTP 401/403 esperada. Outros erros falham; corpos nao sao impressos.
- Executar checagem equivalente local e workflow remoto apos publicacao.
- Rodar validate, build e diff --check. Nenhuma mudanca de produto ou banco.

## Riscos operacionais

- GitHub pode atrasar execucoes ou desativar agendas por inatividade do
  repositorio; verificar historico e preferencias de notificacao periodicamente.
- Projeto ja pausado exige retomada no Supabase; a rotina nao o restaura.
- O workflow de migration drift existente continua separado e sua configuracao
  de SUPABASE_DB_URL exige correcao propria; nao depende desta rotina.
