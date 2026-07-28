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
5. Gestores não resolvidos recebem um combo de gestores ativos do sistema.
6. A contagem por gestor canônico é recalculada conforme o de-para.
7. O botão de confirmação permanece bloqueado enquanto houver gestor sem
   resolução.
8. Na confirmação, o mesmo arquivo é enviado novamente. O backend repete a
   leitura e o matching, rejeitando resultados manipulados no navegador.
9. Uma RPC transacional grava os salários válidos encontrados e os de-paras.
10. A tela informa quantos salários foram alterados, mantidos, ignorados e
    quantos de-paras foram salvos.

## Fonte de verdade

- Pessoa e hierarquia: `people`.
- Salário mensal corrente: `person_compensations.annual_salary` (nome legado do
  campo; o valor de produto continua mensal).
- Alias/de-para de gestor: `employee_import_manager_mappings`.
- Contagem por gestor: derivada das linhas válidas da planilha após resolução.

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
- Nenhum conteúdo do arquivo é escrito em logs.
- Mensagens ao usuário não exibem stack trace ou detalhes internos.
