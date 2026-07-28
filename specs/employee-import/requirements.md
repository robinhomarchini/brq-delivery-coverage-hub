# Importação administrativa de funcionários

## Objetivo

Permitir que um administrador autorizado compare uma planilha de profissionais
com as pessoas já cadastradas, atualize somente os salários encontrados e
concilie os nomes de gestores da origem com os gestores canônicos do sistema.

## Requisitos

1. A função deve aceitar arquivos `.xlsx` com as colunas `Nome`, `Salário` e
   `Gestor`; na planilha de referência elas estão em B, E e P. Todas as abas
   que contenham essas colunas devem ser processadas, sem filtrar por cargo,
   perfil ou área (incluindo Hunters, Farmers, Delivery e lideranças).
2. A identificação de pessoa deve usar nome normalizado exato, sem aproximação
   automática que possa atribuir salário à pessoa errada.
3. Pessoa não encontrada não deve ser criada nem ter qualquer dado alterado.
4. Salário vazio, não numérico, zero ou negativo não deve substituir o salário
   atual.
5. A importação deve exibir uma prévia antes de persistir:
   - pessoas encontradas e salários atual/proposto;
   - pessoas não encontradas;
   - quantidade de colaboradores por gestor da planilha;
   - gestores resolvidos e não resolvidos.
6. Gestor sem correspondência deve exigir seleção em um combo alimentado pelos
   gestores ativos do sistema.
7. O de-para confirmado deve ser persistido para reutilização em importações
   futuras, sem alterar a hierarquia individual das pessoas.
8. A aplicação deve atualizar somente `person_compensations`; a planilha não se
   torna fonte canônica de `people`.
9. A gravação de salários e de-paras deve ser atômica, autorizada no backend,
   protegida por RLS e auditada.
10. O arquivo bruto não deve ser armazenado no banco nem em logs.

## Fora do escopo inicial

- criar pessoas ausentes;
- alterar cargo, cliente, líder, gestor ou status da pessoa;
- inferir correspondências aproximadas de nomes;
- persistir a contagem de colaboradores, que é uma projeção derivada da
  planilha e dos de-paras.
