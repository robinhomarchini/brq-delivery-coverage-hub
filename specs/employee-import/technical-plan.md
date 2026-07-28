# Plano técnico

1. Criar parser puro em `src/lib/employee-import/` usando
   `read-excel-file/node` somente no servidor.
2. Criar serviço de domínio/backend que consulta pessoas, remunerações e
   de-paras com o cliente autenticado.
3. Criar rotas BFF para criar/consultar lote, aplicar uma linha salarial e
   confirmar HC.
4. Criar migration forward-only para:
   - `employee_import_manager_mappings`;
   - lote persistente e itens salariais;
   - campos de HC direto importado em `people`;
   - bucket privado, RLS/grants/auditoria;
   - RPCs transacionais por ação.
5. Criar página administrativa com upload, prévia, combos e confirmação.
6. Adicionar navegação somente para administrador com acesso a remuneração.
7. Adicionar testes de parser, contrato de autorização/migration e segurança.

## Fronteira transacional

A atualização de uma linha salarial é atômica com a marcação de seu status.
A confirmação do HC é atômica entre de-paras e atualização dos totais diretos.

## Portabilidade

O contrato JSON da RPC fica encapsulado no serviço server-side. Um futuro
adapter SQL Server deve substituir apenas essa fronteira, preservando os DTOs e
o parser de domínio.
