# Registro de Aprendizados

Use este arquivo para registrar aprendizados vindos de interacoes, incidentes, validacoes e decisoes do usuario.

Quando um aprendizado se repetir ou prevenir uma falha real, ele deve ser promovido para o agente correspondente em `.codex/agents/`.

## Modelo

```md
## AAAA-MM-DD - Titulo curto

Contexto:
- O que aconteceu.

Aprendizado:
- Regra ou padrao descoberto.

Promover para agente:
- Nome do agente, se aplicavel.
```

## 2026-06-18 - Recharts e prerender

Contexto:
- Containers responsivos do Recharts emitiram avisos de dimensão no build estático.

Aprendizado:
- Renderizar os gráficos somente após a hidratação, usando um sinal externo estável
  em vez de atualizar estado dentro de um efeito.

Promover para agente:
- `frontend`, caso o padrão se repita em novas páginas.

## 2026-06-18 - Estado do diretório Git

Contexto:
- A pasta `.git` aparece como reparse point do OneDrive, mas não é reconhecida
  pelo Git nesta máquina.

Aprendizado:
- Não assumir que o worktree está disponível; validar `git status` antes de rotinas
  de versionamento.

Promover para agente:
- Nenhum por enquanto.
