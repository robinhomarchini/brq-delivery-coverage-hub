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

## 2026-07-02 - Supabase sempre via CLI no projeto

Contexto:
- A automação tentou caminhos alternativos para operações Supabase mesmo depois de o CLI já estar configurado e funcional no ambiente.

Aprendizado:
- Neste projeto, operações de Supabase devem usar sempre o Supabase CLI. Se `npx supabase ...` falhar por cache/EPERM no sandbox, repetir o mesmo comando com a aprovação já disponível, sem mudar para navegador, SQL manual ou outro fluxo.

Promover para agente:
- `database-normalization-audit`, `deployment-production-readiness` e instruções locais do projeto.

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
