# Segurança

## Modelo de acesso

- Supabase Auth com link mágico para e-mails `@brq.com`.
- `viewer`: leitura.
- `editor`: leitura e escrita.
- `admin`: leitura, escrita e administração de acessos.
- O usuário `robinson.marchini@brq.com` é o administrador inicial.

## Controles

- RLS em todas as tabelas expostas pela Data API.
- Nenhuma permissão de dados para `anon`.
- Constraints de domínio e auditoria no PostgreSQL.
- Validação de entrada no cliente e no banco.
- Mensagens explícitas para falhas de carga e persistência.
- Headers HTTP de segurança e neutralização de fórmulas em CSV.

## Evolução

O login por link mágico deve ser substituído ou complementado por Microsoft Entra
ID. A autorização permanece no banco e não depende apenas da interface.
