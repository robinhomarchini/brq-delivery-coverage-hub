# Production Readiness

## Status atual

O projeto está adequado para homologação interna controlada. Para produção
corporativa definitiva, ainda deve concluir a migração para BFF/API ou Server
Actions, endurecer RLS por perfil e separar metas financeiras de campos
operacionais de cliente.

## Guardrails aplicados

- Autenticação Supabase com e-mail corporativo.
- Headers mínimos de segurança.
- RLS habilitado nas tabelas de domínio.
- Relação Pessoa ↔ Cliente normalizada.
- Metas editáveis normalizadas por pessoa/cliente/tipo/ano.
- Produção sem Supabase configurado não abre mock local.
- RPCs transacionais disponíveis para operações críticas após migration.

## Próximos hardenings recomendados

1. Trocar policy ampla de homologação por viewer/editor/admin estrito.
2. Mover leituras e escritas críticas para BFF/API Routes.
3. Criar `customer_targets` para separar meta total de `customers.revenue`.
4. Adicionar testes automatizados de autorização e reconciliação.
5. Adicionar observabilidade de erros e auditoria visível no produto.

## Checklist de release

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run deploy:check`
- Migrations aplicadas no Supabase correto.
- Smoke test de login BRQ.
- Smoke test de salvar Pessoa, Cliente e Metas.
- Verificação de exportações.
- Plano de rollback da Vercel identificado.

## Deploy Vercel pelo Codex/Windows

Antes de publicar manualmente, rode `npm run deploy:check`. Ele valida que o
projeto está linkado em `.vercel/project.json` e que existe autenticação do
Vercel CLI via `VERCEL_TOKEN` ou `%USERPROFILE%\.vercel\auth.json`.
Também valida que o cache isolado do Vercel CLI em `.vercel-cli/` é gravável.
O script `deploy:prod` executa o Vercel CLI com `node@22` via `npx` e cache
local do projeto, evitando a combinação Node 24 + `%LOCALAPPDATA%` que já gerou
falhas intermitentes como `The value of "err" is out of range`.

O comando padrão de produção é `npm run deploy:prod`. Se `deploy:check` falhar,
não tente variações do `vercel deploy`: primeiro regularize o login com
`npx --cache .npm-cache --yes vercel login` ou configure `VERCEL_TOKEN` no
ambiente seguro. Se antivírus bloquear `%USERPROFILE%\.vercel\auth.json`, use
`VERCEL_TOKEN` em `.env.local`; `deploy:check` e `deploy:prod` carregam esse
arquivo local ignorado pelo Git. Para deploy manual local, use Node 22 LTS;
Node 24 só deve ser usado para a aplicação/build. O deploy manual do projeto já
força Node 22 pelo script.
