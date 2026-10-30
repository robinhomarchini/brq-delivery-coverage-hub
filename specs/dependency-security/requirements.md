# Atualizacao de seguranca de dependencias - 2026-10-23

## Requisitos e escopo
- Corrigir alertas criticos do npm audit em Next.js e DOMPurify.
- Atualizar Next.js e eslint-config-next em conjunto, mantendo o major 16.
- Atualizar dependencias transitivas dentro das faixas compativeis, sem audit fix --force.
- Preservar regras de dominio, contratos de repositorio, Auth, RLS e migrations.
- Escopo local: sem deploy, push ou alteracao de dados operacionais.

## Aceite e validacao
- Zero alertas criticos no npm audit --omit=dev; registrar alertas restantes.
- npm run validate, npm run build, npm run smoke:critical e npm run test:security aprovados.
- Revisar diff de manifesto e resumo do lockfile, sem novas dependencias diretas.

## Riscos
- Atualizacoes de framework podem afetar compilacao e runtime; build e testes sao obrigatorios.
- Alertas que exigem mudanca principal ficam documentados, sem migracao automatica.
- Cadastro businessArea continua WIP; esta tarefa nao altera sua persistencia.

## Atualizacao de 2026-10-30
- Auditoria atual detectou GHSA-mrhx-c7xc-m3w5 em Zod anterior a 4.6.6.
- Atualizar somente Zod dentro do major 4, sem force ou novas dependencias.
- Aceite: auditoria completa sem alertas, validate/build e smoke/seguranca aprovados.
- Publicacao no GitHub/CI depende do escopo confirmado nesta rodada; deploy
  nao deve incluir silenciosamente o cadastro businessArea ainda WIP.

## Evidencia local
- Next.js/eslint-config-next 16.4.2 e DOMPurify 3.4.17 instalados.
- Validacao, build, smoke critico e testes de seguranca aprovados.
- Auditoria de producao zerada; completa com 7 altos e 2 moderados em ferramentas.
- Sem alteracao de dominio, queries, RLS/RBAC, contratos ou migrations.
