# Critérios de aceitação

- Dada uma planilha válida, a prévia informa total de linhas, pessoas
  encontradas, alterações de salário, salários já iguais e pessoas ausentes.
- Para pessoa encontrada com salário positivo, o valor proposto vem da coluna
  `Salário`.
- Para pessoa ausente, salário inválido ou match ambíguo, nenhuma remuneração é
  alterada.
- A ausência de uma pessoa na planilha nunca apaga o salário existente.
- Cada nome distinto da coluna `Gestor` aparece com sua quantidade de
  colaboradores.
- Gestor sem match apresenta combo com gestores ativos vindos de `people`.
- A confirmação fica desabilitada enquanto houver gestor não resolvido.
- Após confirmar, os de-paras reaparecem resolvidos em uma nova prévia.
- A gravação de salários e de-paras ocorre em uma única transação.
- Usuário viewer, editor comum, hunter ou admin sem cargo de VP recebe `403`.
- Arquivo acima de 10 MB, formato diferente ou colunas obrigatórias ausentes é
  rejeitado com mensagem em português.
- O arquivo bruto e as linhas integrais não são persistidos nem registrados em
  logs.
- A tela continua legível em desktop, possui estados de carregamento, vazio,
  sucesso e erro, e preserva a prévia quando a gravação falha.
