# Business Rules

Baseline atualizado em: 2026-07-31

Este documento lista regras confirmadas no codigo e no banco. Regras inferidas ou conflitantes estao marcadas.

## Regras confirmadas

### Papeis e elegibilidade

- Valores persistidos de `RoleType`: `Executive`, `Director`, `Farmer + Delivery`, `Delivery`, `Hunter`, `Hunter Especializado`, `Farmer`, `Hunter + Farmer`, `Staff`.
- `Manager` nao e `RoleType` persistido; pode ser rotulo visual/exportacao/hierarquia.
- `Hunter Especializado` e reconhecido como papel de hunter para selecao, mas nao e elegivel para meta direta comum.
- Fontes: `src/lib/roles.ts`, migrations com constraints de `people.role_type`.

### Total oficial do cliente

- Total oficial atual do cliente e `Meta Hunter + Meta Renovacao/Ampliacao`.
- New Logos podem ficar no controle, mas fora da meta oficial planejada quando `countsTowardTarget === false`.
- Fontes: `src/lib/customer-target-total.ts`, `src/lib/domain/customer-target-scope.ts`, migration `20260716170000_customer_target_counts_toward_target.sql`.

### Studios contidos

- Studio Hunter compoe a abertura da meta Hunter e nao deve ser somado novamente ao total oficial.
- Studio Manutencao/Renovacao compoe a abertura de Renovacao/Ampliacao e nao deve ser somado novamente ao total oficial.
- Ao calcular valor proprio de pessoa em relatorios, o valor de Studio contido deve ser descontado quando ele ja estiver dentro da meta da pessoa.
- Fontes: `src/lib/customers/customer-coverage-view-model.ts`, `src/lib/reports/person-target-rollups.ts`, `src/lib/reports/person-target-rows.ts`, `src/lib/reports/person-target-official-export.ts`.

### Metas por pessoa

- Metas diretas ficam em `revenue_target_allocations`.
- O valor atual Hunter de uma pessoa pode ser maior entre meta direta e Studio Hunter herdado por cliente, evitando duplicidade.
- Renovacao/Ampliacao soma meta propria e manutencao herdada elegivel.
- Fontes: `src/lib/reports/person-target-rollups.ts`, `src/lib/reports/person-target-rows.ts`.

### Hunter Especializado

- Hunter Especializado nao deve receber meta direta sem Studio.
- Quando e hunter principal do cliente, pode funcionar como hunter comum para aquele cenario.
- Associacoes e valores especializados devem ficar separados da meta oficial quando forem apenas informativos.
- Fontes: `src/lib/roles.ts`, `src/app/metas-hunters-especializados/page.tsx`, migration `20260715154500_allow_specialist_hunter_customer_and_studio_targets.sql`.

### Cobertura e status de cliente

- O status do cliente compara meta efetiva contra alocacao oficial por pessoas e studios contidos.
- Valores visualmente zerados devem ser tratados como zero para evitar divergencias `-R$ 0`.
- Cliente New Logo tem status fora da meta quando excluido do alvo anual.
- Fontes: `src/lib/customers/customer-coverage-view-model.ts`.

### Baseline de curva principal

- Importacao da curva principal usa a aba `Resumo RL 2026`.
- A tabela Financial considerada deve filtrar BU Financial.
- O Hunter da planilha e informativo para consistencia, nao deve sozinho marcar divergencia.
- Fontes: `src/lib/target-baseline-import.ts`.

### Baseline de Studios a partir da curva

- Extracao de studios da curva usa aba `Sheet1`.
- Colunas confirmadas no codigo: A unidade, C fornecedor/alianca, D cliente, J receita, L studio habilitador, O tipo de oportunidade, AH valor, BR BU.
- Apenas BU Financial entra na foto geral.
- `Squad/Times` nao e Studio.
- Regras especiais: WEME + Arquitetura vira PX; Google/Microsoft/Amazon/AWS/Datadog mapeiam aliancas; Managed Services usa labels de Managed Services/FinOps.
- Fontes: `src/lib/studio-curve-baseline-snapshot.ts`.

### Analise de desafio

- Faixas deterministicas atuais: Hunters 4x-8x, Farmers 3x-6x, Delivery 2x-5x, com ajuste por senioridade.
- Acesso a remuneracao e protegido por BFF e permissao especifica.
- IA usa OpenAI quando configurada; ha fallback deterministico.
- Fontes: `src/lib/challenge-analysis.ts`, `src/app/api/challenge-analysis/route.ts`, `src/server/ai/challenge-analysis.ts`, `src/server/auth/challenge-analysis-access.ts`.

### Escopo Hunter

- Usuario `hunter_viewer` so ve/edita escopo relacionado a propria pessoa.
- Pode criar cliente novo dentro do escopo permitido, mas nao editar cliente existente como admin/editor.
- Em Studio, so pode alterar alocacao vinculada a ele.
- Fontes: `src/lib/hunter-access-scope.ts`, `src/app/api/delivery/person-customer-targets/route.ts`, `src/app/api/delivery/customers/route.ts`, migration `20260721103000_hunter_scoped_access.sql`.

## Contradicoes e pontos a resolver

- Documentacao antiga ainda fala que total financeiro soma Areas/Studios como terceiro componente. O codigo atual trata Studios como contidos.
- Documentacao antiga fala em exclusividade de Hunter por cliente; o modelo atual aceita multiplos participantes e Hunter Especializado.
- `PersonCompensation.annualSalary` e multiplicado por 12 em `src/lib/challenge-analysis.ts`; o nome sugere salario anual, mas o uso parece mensal. Precisa decisao explicita.

## Assuncoes

- Quando houver conflito entre documentacao antiga e codigo/migrations atuais, esta base marca conflito em vez de alterar regra.
- Regras criticas devem continuar reforcadas por backend/RLS/RPC, nao apenas por UI.
