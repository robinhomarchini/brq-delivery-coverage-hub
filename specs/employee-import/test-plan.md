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
- prévia não persiste dados;
- aplicação repete parsing/matching no servidor;
- transação atualiza apenas pessoas encontradas;
- transação salva de-paras válidos;
- pessoa de destino do de-para precisa ser gestor ativo;
- RLS bloqueia leitura e escrita não autorizadas;
- auditoria registra mudanças nas tabelas canônicas.

## UI

- seleção e troca de arquivo;
- cards de resumo;
- tabelas de encontrados e ausentes;
- combo de cada gestor não resolvido;
- confirmação bloqueada até resolver todos;
- feedback de sucesso/erro próximo à tarefa;
- recarregamento da prévia após aplicação.

## Gates

`npm run lint`, `npm run typecheck`, testes específicos, `npm run validate`,
`npm run smoke:critical`, `npm run db:migrations:check` e `npm run build`.
