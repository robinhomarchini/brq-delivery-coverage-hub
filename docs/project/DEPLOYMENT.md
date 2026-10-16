# Deployment

Baseline atualizado em: 2026-07-31

## Ambiente

- Framework: Next.js.
- Plataforma: Vercel.
- Configuracao Vercel: `vercel.json`.
- Build: `npm run build`.
- Install: `npm ci`.
- Configuracao Next: `next.config.ts`.

## Scripts oficiais

- Pre-check de deploy: `npm run deploy:check`.
- Deploy de producao: `npm run deploy:prod`.
- Inspecao de producao: `npm run deploy:inspect:prod`.
- Inspecao de URL especifica: `npm run deploy:inspect -- <deployment-url>`.

Nao use `npx vercel` diretamente neste repositorio; os scripts locais isolam cache, env e versoes.

## Quality gate antes de deploy

1. Conferir `git status --short`.
2. Rodar `npm run lint`.
3. Rodar `npm run typecheck`.
4. Rodar `npm run validate`.
5. Rodar `npm run build`.
6. Se persistencia/cliente/metas foram alteradas, rodar `npm run smoke:critical`.
7. Se Supabase/RLS/RPC foi alterado, rodar `npm run db:migrations:check`.
8. Executar `npm run deploy:check`.
9. Executar `npm run deploy:prod`.
10. Executar `npm run deploy:inspect:prod`.

## Supabase

- Comando base aprovado: `npx --cache .npm-cache --yes supabase <command> --linked`.
- Use `migration list` antes de `db push`.
- Nao usar `repair`, reset, rollback ou SQL manual sem verificacao e aprovacao explicita.

## Variaveis e segredos

- Exemplos ficam em `.env.example`.
- Segredos reais nao devem entrar em Git nem em documentos.
- Autenticacao Supabase exige configuracao de ambiente; provider `corporate-sso` existe como reserva, mas nao esta implementado.

## Entrega do Relatório de Clientes

- Publicação de 2026-10-16: `dpl_E9wrLaiQpWFurFDoPgCUr7GL2kau`, Vercel `Ready`.
- Rota: `https://brq-delivery-coverage-hub.vercel.app/relatorio-clientes`.
- Validate, build, smoke crítico e testes de segurança aprovados na cópia isolada.
- Histórico de migrations: 101 locais e 101 remotas, sem alteração de schema.
- Conferência autenticada: 48 clientes; filtros combinados e prévia reconciliados.
- O pacote exclui `.vercel-cli` e `.env*`; variáveis vêm do ambiente da Vercel.
- Versão anterior para recuperação operacional, se necessária:
  `dpl_Gv2H6nLAT4XdNWeXRUPWHWHGFxz2`. Não executar rollback automaticamente.
- Código do relatório e documentação são versionados separadamente de alterações
  locais pendentes de login/cadastro. O working tree completo não deve ser
  publicado indiscriminadamente.
