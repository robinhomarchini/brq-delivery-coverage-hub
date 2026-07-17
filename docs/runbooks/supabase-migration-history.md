# Rotina de histórico de migrations Supabase

## Objetivo

Manter o histórico remoto de migrations alinhado com os arquivos em
`supabase/migrations`, evitando que `supabase db push` tente reaplicar SQL já
executado manualmente.

## Rotina agendada

O workflow `.github/workflows/supabase-migration-drift.yml` roda de segunda a
sexta às 08:00 no horário de São Paulo e também pode ser disparado manualmente.

Ele executa:

```bash
npm run db:migrations:check
```

O check compara:

- versões locais: arquivos `supabase/migrations/*.sql`;
- versões remotas: saída de `supabase migration list`.

Se houver diferença, o workflow falha e lista as versões divergentes.

## Comando local recomendado

Use primeiro o caminho já validado neste projeto:

```bash
npx --cache .npm-cache --yes supabase migration list --linked
```

Evite trocar de estratégia a cada falha. Erros de cache, rede, login role ou
PostHog/telemetria da CLI são falhas transitórias da ferramenta, não prova de
drift. Reexecute o mesmo comando uma vez antes de investigar outro caminho.

Use cache local do projeto para evitar falhas de permissão no Windows/Codex.
Se uma esteira específica precisar isolar outro cache, defina
`SUPABASE_MIGRATION_CHECK_NPM_CACHE`.

## Secret necessário no GitHub

Configure o secret do repositório:

```text
SUPABASE_DB_URL
```

Use a connection string Postgres do projeto Supabase. Ela deve ficar apenas em
GitHub Secrets, nunca em arquivos versionados.

Quando o secret estiver presente, o script usa `--db-url`; localmente usa
`--linked`. Este repositório não versiona `supabase/config.toml` nem `.supabase`;
por isso o GitHub Actions não deve cair para `--linked`. Se `SUPABASE_DB_URL`
estiver ausente no GitHub, o workflow falha como erro de configuração, não como
drift de migration.

## Regra operacional

Não faça `repair` automático em rotina agendada.

O comando abaixo altera somente o histórico de migrations, não executa o SQL da
migration. Use apenas depois de confirmar que o schema remoto já contém o estado
esperado:

```bash
npx supabase migration repair --linked --status applied <version...>
```

## Quando usar repair

Use `repair` quando:

- a migration foi aplicada manualmente no SQL Editor ou via `supabase db query`;
- o schema remoto foi validado;
- `supabase migration list` mostra a versão local sem correspondência remota.

Não use `repair` quando:

- há dúvida se o SQL foi realmente aplicado;
- a migration contém carga de dados crítica ainda não validada;
- o ambiente remoto pode estar em estado parcial.

Nesse caso, aplique uma migration idempotente ou execute o SQL corretivo de forma
controlada antes de marcar a versão como aplicada.
