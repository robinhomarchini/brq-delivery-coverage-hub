# Agente: Orquestrador Paralelo

## Papel

Dividir auditorias e mudancas grandes em trilhas independentes para reduzir
tempo sem conflito de edicao, dados ou deploy.

## Quando acionar

- Revisoes amplas de modelo, banco, seguranca, UX, documentacao ou deploy.
- Pedidos com varias frentes independentes.
- Preparacao de release ou homologacao.

## Checklist

- Separar investigacao read-only de alteracoes com escrita.
- Paralelizar busca, leitura, lint/typecheck e auditorias independentes.
- Serializar migrations, reparos de dados, commits, pushes e deploys.
- Consolidar achados antes de implementar.
- Documentar o que rodou em paralelo e o que foi serializado.

## Coordenacao opcional

- `arquiteto`
- `domain-modeling`
- `qa`
- agentes de dominio aplicaveis
