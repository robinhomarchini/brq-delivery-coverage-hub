# Especificação funcional

## Acesso

A página `/importacao-funcionarios` aparece somente para administrador ativo
que também possui permissão de remuneração. A mesma regra é validada novamente
nas rotas backend e no banco.

## Fluxo

1. O usuário seleciona uma planilha `.xlsx`.
2. A rota de prévia valida o arquivo e localiza o cabeçalho pelas labels, sem
   depender apenas das posições físicas.
3. O backend normaliza nomes removendo acentos, diferenças de caixa e espaços,
   e compara por igualdade exata.
4. A tela apresenta indicadores e tabelas de conciliação.
5. A análise salva o arquivo em bucket privado com chave técnica ASCII segura,
   preserva o nome original no lote e cria um snapshot parseado, permitindo
   retomar o trabalho sem novo upload.
6. Nomes de gestores não resolvidos recebem um combo com todas as pessoas do
   cadastro canônico.
7. A contagem por pessoa canônica é recalculada conforme o de-para.
8. Cada salário divergente possui botão próprio; a RPC valida o lote, atualiza
   a remuneração e marca a linha como atualizada com usuário e instante.
9. A confirmação do HC permanece bloqueada enquanto houver nome sem resolução.
10. Uma RPC separada salva os de-paras e o HC direto importado de todas as
    pessoas resolvidas em uma única transação.
11. Ao abrir a página, o backend devolve o lote mais recente e seus estados.

## Fonte de verdade

- Pessoa e hierarquia: `people`.
- Salário mensal corrente: `person_compensations.annual_salary` (nome legado do
  campo; o valor de produto continua mensal).
- Alias/de-para de gestor: `employee_import_manager_mappings`.
- Lote e snapshot: `employee_import_batches`.
- Ações salariais: `employee_import_salary_items`.
- HC direto vigente: campos importados de `people`, atualizados somente após
  confirmação do lote e exibidos com data/origem.

## Regras de matching

- O match de pessoas e gestores é por nome normalizado exato.
- Um de-para salvo tem precedência sobre o match automático do gestor.
- Duplicidade de nome normalizado no sistema torna o match ambíguo e impede
  atualização automática daquela pessoa.
- A matrícula é informativa nesta fase e não é usada como chave porque o
  sistema ainda não possui uma chave canônica de matrícula.

## Segurança e privacidade

- Limite de arquivo: 10 MB.
- Somente `.xlsx`.
- Nenhum salário é devolvido ou gravado para usuário sem a permissão
  `can_manage_person_compensation()`.
- O arquivo bruto fica em bucket privado e nenhum conteúdo é escrito em logs.
- Mensagens ao usuário não exibem stack trace ou detalhes internos.
