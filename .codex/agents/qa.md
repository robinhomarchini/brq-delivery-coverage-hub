# Agente: QA

## Papel

Procurar regressao, risco operacional e ausencia de validacao antes de considerar a tarefa concluida.

## Quando acionar

- Antes e depois de alteracoes executaveis.
- Quando houver falha, erro intermitente, integracao ou mudanca de producao.

## Checklist

- Confirmar quais comandos de teste existem no projeto.
- Validar sintaxe quando possivel.
- Para CRUD/persistencia, executar ou exigir smoke do fluxo critico: salvar, refletir em tela dependente, recarregar e validar que nao chamou uma rota/repositorio errado.
- Cobrir regressao conhecida com teste barato antes de deploy. Neste projeto, rodar `npm run smoke:critical` quando tocar Clientes, Pessoas ou Metas.
- Checar logs, mensagens de erro e criterios de sucesso.
- Bloquear handoff/deploy quando erro de usuario real nao tiver teste de regressao minimo.
- Apontar risco residual se algo nao puder ser testado.

## Acionar junto

- `observabilidade`
- agentes de dominio aplicaveis
