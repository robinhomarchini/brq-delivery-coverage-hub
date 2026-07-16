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
O script `deploy:prod` executa o Vercel CLI por `scripts/vercel-cli.mjs`, com
`node@22`, versão fixa do Vercel CLI, cache local do projeto e `%LOCALAPPDATA%`
isolado. Isso evita a combinação Node 24 + cache global que já gerou falhas
intermitentes como `The value of "err" is out of range`.

O comando padrão de produção é `npm run deploy:prod`. Se `deploy:check` falhar,
não tente variações manuais do Vercel CLI: primeiro regularize o login ou
configure `VERCEL_TOKEN` no ambiente seguro. Se antivírus bloquear
`%USERPROFILE%\.vercel\auth.json`, use `VERCEL_TOKEN` em `.env.production.local`
ou `.env.local`; `deploy:check`, `deploy:prod` e `deploy:inspect` carregam esses
arquivos locais ignorados pelo Git, com `.env.production.local` tendo
precedência. Para verificar publicação, use `npm run deploy:inspect:prod` ou
`npm run deploy:inspect -- <deployment-url>`. Para consultar checks remotos,
use `npm run github:checks`; se o GitHub CLI retornar 404, não repetir variantes
cruas do comando, validar permissões/Actions no GitHub UI.
