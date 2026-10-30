# Otimizacao do fluxo de agentes e contexto

Data: 2026-10-30

## Requisitos e regras
- Reutilizar personas, roteador local e validadores existentes, sem dependencias novas.
- Personas Markdown sao referencias consultadas por impacto; nao representam subagentes registrados nem obrigam delegacao.
- Aplicar a politica de exclusao de contexto tambem a referencias diretas, imports e memorias, antes de ler conteudo.
- Impedir caminhos externos a raiz e links que contornem exclusoes. Segredos locais nunca entram no pacote automatico.
- Priorizar instrucoes e resumos canonicos antes de fontes, respeitando o limite de arquivos.
- Incluir testes do roteador e smoke critico no gate local/CI existente.

## Escopo e arquitetura
Camadas: tooling local em .ai/router, orientacoes .codex, testes e CI.
Sem mudanca de dominio, UI, contrato de repositorio, banco, RLS, providers ou deploy.
O roteador continua apenas classificando e selecionando contexto; nao executa alteracoes.

## Aceite e validacao
- Regressao cobre exclusoes, referencias/imports externos, budget e prioridade canonica.
- Manifesto JSON valido e todas as personas referenciadas nas rotinas existem.
- npm run validate, npm run test:security, npm run test:performance,
  npm run smoke:critical e npm run build aprovados; git diff --check limpo.
- Registrar limites da politica de exclusao e evidencias reais no estado atual.

## Riscos
- Exclusoes excessivas podem esconder contexto util; arquivos ignorados exigem inspecao deliberada fora do seletor.
- Prioridade canonica ocupa parte do budget; limite pequeno pode conter apenas documentos.
- Nao afirmar ganho de runtime da aplicacao: melhorias sao de seguranca, contexto e fluxo de engenharia.

## Evidencias em 2026-10-30
- Analises read-only de agentes/contexto e qualidade/CI executadas em paralelo;
  implementacao do seletor delegada com ownership exclusivo de tres arquivos.
- validate, seguranca, performance, smoke critico e build aprovados localmente.
- Lint da aplicacao manteve quatro avisos preexistentes, sem erros.
- Revisao independente encontrou raiz relativa perdendo imports; regressao
  adicionada e teste do roteador aprovado apos correcao.
- Sem mudancas de UI/banco: revisoes visuais, RLS e performance SQL nao se aplicam
  ao diff. Politica compartilhada reutilizada em quatro caminhos do seletor.
- Workflow preparado localmente, sem execucao remota, push ou deploy.
