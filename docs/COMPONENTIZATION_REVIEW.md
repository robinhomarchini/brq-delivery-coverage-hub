# Componentização e Reaproveitamento de Código

Data: 2026-07-13

## Diagnóstico

A aplicação já tem uma base saudável de reaproveitamento:

- componentes primitivos em `src/components/ui/`;
- componentes compartilhados em `src/components/shared/`;
- regras de persistência atrás de `src/lib/repositories/`;
- helpers de domínio em `src/lib/`;
- specs e QA estático para fluxos críticos.

Os principais pontos de atenção estão em arquivos de tela muito grandes, onde UI,
view model, regras derivadas, exportação e serialização ficam juntos. Isso aumenta
o risco de uma correção ser feita em uma tela e esquecida em outra.

## Ajuste já aplicado

O fluxo de Baseline de Studios tinha lógica duplicada na central de Baselines e
no Comparativo Baseline para:

- montar linhas `Baseline`, `Alocado` e `Baseline Curva`;
- restaurar snapshots salvos;
- manter compatibilidade com fotos antigas;
- rotular status e diferenças.

Essa lógica agora fica centralizada em:

- `src/lib/studio-baseline-report.ts`

As telas passam a consumir esse helper, reduzindo duplicação e evitando
divergência entre preview, exportação e leitura de snapshot.

Também foi extraída a geração da Planilha oficial do Relatório de Metas para:

- `src/lib/reports/person-target-official-export.ts`

O componente `person-target-report.tsx` fica responsável pela tela e pela fiação
dos botões, enquanto a regra de exportação oficial fica em um módulo de domínio
testável. A função `buildOfficialRowsForView` permanece reexportada pelo
componente apenas para compatibilidade com o gate atual de QA.

Os rollups compartilhados de Studio/Hunter usados pelo relatório e pela
Planilha oficial agora ficam em:

- `src/lib/reports/person-target-rollups.ts`

Esse módulo centraliza cálculo de Studio Hunter efetivo, manutenção elegível por
pessoa, meta própria versus meta herdada e fallback de Hunter principal do
cliente. Ele evita que relatório visual e exportação oficial implementem a mesma
regra em paralelo.

## Próximas oportunidades

1. Extrair view models restantes de relatórios
   - Prioridade: `src/components/reports/person-target-report.tsx`
   - Motivo: o export oficial e rollups comuns já foram separados, mas o arquivo
     ainda concentra builders de tela, filtros e tabelas.
   - Caminho seguro: mover builders de Clientes, Hunters e Diretoria para
     `src/lib/reports/` em fatias independentes.

2. Extrair view models de Clientes
   - Prioridade: `src/components/customers/customer-management.tsx`
   - Motivo: CRUD, conciliação, seleção de responsáveis e tabelas convivem no
     mesmo arquivo.
   - Caminho seguro: separar builders/predicados antes de extrair componentes.

3. Padronizar formatação monetária
   - `roundCurrency` agora existe em `src/lib/utils.ts`.
   - Próximo passo: substituir duplicações locais gradualmente quando os arquivos
     forem tocados por mudança funcional.

4. Criar componentes pequenos para tabelas financeiras
   - Candidatos: células monetárias, pilhas de valores, linhas de comparação e
     badges de status.
   - Regra: extrair somente quando houver pelo menos dois usos reais.

5. Separar importação/parsing de apresentação
   - Baselines já seguem esse padrão.
   - Próximo alvo: relatórios oficiais e telas de Insights.

## Ordem recomendada

1. Helpers puros de relatório.
2. Helpers puros de clientes/metas.
3. Componentes pequenos de tabela financeira.
4. Quebra de arquivos grandes em seções.
5. Otimizações de performance com mapas/memos após a separação dos builders.

## Critério de qualidade

Cada extração deve preservar comportamento, passar por `lint`, `typecheck`,
`build` e pelo teste específico do fluxo tocado. Refactors grandes sem validação
por tela devem ser evitados.
