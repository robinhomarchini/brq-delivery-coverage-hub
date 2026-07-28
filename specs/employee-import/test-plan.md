# Plano de testes

## Parser e domínio

- localizar cabeçalho após linhas de título;
- reconhecer `Nome`, `Salário` e `Gestor`;
- normalizar acentos, caixa e espaços;
- rejeitar arquivo sem colunas;
- ignorar salário inválido;
- não criar match aproximado;
- contar gestores e consolidar pelo de-para.

## Backend e banco

- negar sessão ausente e usuário sem permissão;
- análise persiste lote/snapshot e arquivo em bucket privado;
- consulta recupera o lote sem novo upload;
- ação salarial atualiza somente a linha comandada e marca seu status;
- confirmação salva de-paras e HC direto;
- pessoa de destino do de-para pode ser qualquer pessoa cadastrada;
- RLS bloqueia leitura e escrita não autorizadas;
- auditoria registra mudanças nas tabelas canônicas.

## UI

- seleção e troca de arquivo;
- cards de resumo;
- tabelas de encontrados e ausentes;
- combo de cada gestor não resolvido;
- confirmação bloqueada até resolver todos;
- feedback de sucesso/erro próximo à tarefa;
- recarregamento do lote sem arquivo local;
- botão e status por salário;
- HC importado visível no cadastro da pessoa.

## Gates

`npm run lint`, `npm run typecheck`, testes específicos, `npm run validate`,
`npm run smoke:critical`, `npm run db:migrations:check` e `npm run build`.
