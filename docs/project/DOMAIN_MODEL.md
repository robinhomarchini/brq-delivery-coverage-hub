# Domain Model

Gerado em: 2026-07-28 13:19:26 -03:00

## Entidades confirmadas

### Pessoa

- Fonte UI/mock: `src/data/mockData.ts`.
- Tipo canonico de papel: `src/lib/roles.ts`.
- Persistencia Supabase: tabela `people`, criada e evoluida em `supabase/migrations/20260612173513_flat_sun.sql` e migrations posteriores.
- Campos relevantes observados: nome, email, papel, status ativo, relacionamento hierarquico, clientes associados.

### Cliente

- Fonte de dominio: `Customer` em `src/lib/repositories/types.ts`.
- Persistencia: tabela `customers` e metas anuais em `customer_target_years`.
- Clientes podem estar dentro ou fora da meta anual pelo par `counts_toward_target` e `target_exclusion_reason`.

### Area / Studio

- Fonte de dominio: `Area` e `studio_target_allocations` em `src/lib/repositories/types.ts`.
- Persistencia: `areas` e `studio_target_allocations`.
- Alocacoes de Studio podem ter valor Hunter e valor Manutencao/Renovacao.

### Metas de cliente

- Fonte de verdade operacional: `customer_target_years`.
- Modelo de dominio: `CustomerTargetYear` em `src/lib/repositories/types.ts`.
- Total oficial atual no codigo: `hunterTarget + farmerRenewalTarget`, conforme `src/lib/customer-target-total.ts`.

### Metas por pessoa

- Fonte de verdade: `revenue_target_allocations`.
- Tipos confirmados: `hunter` e `farmer-renewal`.
- Regras derivadas em `src/lib/reports/person-target-rollups.ts`, `src/lib/reports/person-target-rows.ts` e `src/lib/reports/person-target-official-export.ts`.

### Baselines

- Baseline de board/curva: `board_target_baselines` e `target_baseline_snapshots`.
- Baseline de studios: `studio_baseline_snapshots`.
- Importadores confirmados: `src/lib/target-baseline-import.ts`, `src/lib/studio-baseline-import.ts`, `src/lib/studio-curve-baseline-snapshot.ts`.
- Baselines sao fotos de comparacao e nao devem sobrescrever metas operacionais automaticamente.

### Hunter Especializado

- Papel persistido valido em `src/lib/roles.ts`.
- Nao e pessoa target-assignable direta por padrao.
- Relacoes especificas de studio ficam em `specialist_hunter_studio_assignments`.
- Valor atribuido ao Hunter Especializado e informativo/relacional quando modelado fora da meta oficial.

### Acesso e auditoria

- Usuarios de aplicacao: `app_users`.
- Convites/acesso: `app_access_invites`.
- Eventos de auditoria: `domain_audit_events`.

## Relacionamentos principais

- Pessoa -> Cliente: `person_customer_assignments` e `clientIds` no modelo carregado.
- Cliente -> Meta anual: `customer_target_years`.
- Pessoa -> Meta por cliente/ano/tipo: `revenue_target_allocations`.
- Cliente -> Studio/ano: `studio_target_allocations`.
- Hunter Especializado -> Cliente/Studio/Ano: `specialist_hunter_studio_assignments`.
- Pessoa -> Remuneracao: `person_compensations`, usada na analise de desafio.

## Assuncoes nao confirmadas nesta auditoria

- A cardinalidade desejada final entre cliente e hunters pode ser mais rica do que a documentacao antiga descreve. O codigo atual suporta multiplas participacoes, mas a regra comercial definitiva deve permanecer documentada em `BUSINESS_RULES.md` e migrations.
- O destino futuro SQL Server ainda nao possui adapter implementado; a arquitetura atual apenas prepara fronteiras para portabilidade.
