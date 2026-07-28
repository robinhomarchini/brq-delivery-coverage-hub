# Critérios de aceitação

- Dada uma planilha válida, a prévia informa total de linhas, pessoas
  encontradas, alterações de salário, salários já iguais e pessoas ausentes.
- A prévia consolida todas as abas válidas e inclui qualquer cargo ou perfil,
  sem restringir a importação ao time de Delivery.
- Para pessoa encontrada com salário positivo, o valor proposto vem da coluna
  `Salário`.
- Para pessoa ausente, salário inválido ou match ambíguo, nenhuma remuneração é
  alterada.
- A ausência de uma pessoa na planilha nunca apaga o salário existente.
- Cada nome distinto da coluna `Gestor` aparece com sua quantidade de
  colaboradores.
- Gestor sem match apresenta combo com todas as pessoas vindas de `people`.
- A confirmação do HC fica desabilitada enquanto houver nome não resolvido.
- Após confirmar, os de-paras reaparecem resolvidos em uma nova prévia.
- Cada atualização salarial é confirmada por botão próprio e, após sucesso,
  apresenta status Atualizado sem depender do arquivo local.
- A confirmação do HC salva de-paras e os totais diretos em uma transação.
- Ao reabrir a página, o lote mais recente e seus estados são recuperados.
- O cadastro da pessoa mostra o HC direto importado, a data e a origem.
- Usuário viewer, editor comum, hunter ou admin sem cargo de VP recebe `403`.
- Arquivo acima de 10 MB, formato diferente ou colunas obrigatórias ausentes é
  rejeitado com mensagem em português.
- O arquivo bruto fica em bucket privado; seu conteúdo não é registrado em logs.
- A tela continua legível em desktop, possui estados de carregamento, vazio,
  sucesso e erro, e preserva a prévia quando a gravação falha.
