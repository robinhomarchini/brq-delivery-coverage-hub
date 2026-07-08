# Squad Memory - BRQ Delivery Coverage Hub

## Current Task Objective

Corrigir visão Hunter x Clientes para incluir Renovação + Ampliação alocada em Delivery Managers/Farmers no total do cliente.

## Execution Checklist

- [x] Ler contexto enxuto, memoria, contrato de squad e specs relevantes.
- [x] Decidir fonte de verdade: `own_amount` editavel e `amount` derivado/cache de Meta Hunter atual.
- [x] Criar migration com backfill inicial `own_amount = amount - Studio Hunter`.
- [x] Ajustar Metas por Pessoa para editar Meta propria e exibir Studio contido + Meta Hunter atual.
- [x] Ajustar repositorios local/Supabase para recalcular total ao salvar Meta propria ou Studio Hunter.
- [x] Ajustar Análise de Desafio para nao duplicar Studio Hunter quando ja houver Meta Hunter atual.
- [x] Atualizar specs e regras de negocio.
- [x] Aplicar migration e rodar lint/typecheck/build/smoke.
- [x] Remover exportacao duplicada do PageHeader quando a visao ativa e Baseline de Studios.
- [x] Consolidar filtros, cards de totais e inclusao de cliente em um painel unico sticky em Metas por Pessoa.
- [x] Rodar typecheck, lint, build e smoke critico apos ajustes de UX.
- [x] Modelar Hunter Especializado como papel de Pessoa, nao como novo fato financeiro.
- [x] Impedir Hunter Especializado de aparecer como pessoa lancavel em Metas por Pessoa.
- [x] Criar relatorio derivado por Hunter Especializado + Cliente + Studio, usando `studio_target_allocations`.
- [x] Criar migration para permitir o novo role e bloquear meta direta no banco.
- [x] Aplicar migration no Supabase, rodar lint/typecheck/build/smoke e publicar producao.
- [x] Ampliar sugestoes do campo Cargo em Pessoas sem alterar `RoleType` nem regras financeiras.
- [x] Hidratar a visão Baseline de Studios com o snapshot mais recente do ano quando nao houver planilha importada na sessao.
- [x] Ao trocar Área/Studio em uma alocacao existente, perguntar se a meta existente deve ser movida ou se a edicao deve virar nova meta.
- [x] Sugerir o Hunter associado ao cliente ou com Meta Hunter no ano ao abrir nova meta por Area/Studio.
- [x] Preservar Valor Hunter, Valor Manutencao/Renovacao e Observacoes ao trocar apenas o Hunter durante edicao, carregando linha existente somente quando a combinacao ja existir.
- [x] Remover bloqueio de Hunter obrigatorio em Metas por Area/Studio e documentar que Hunter vazio fica como Studio Hunter a detalhar.
- [x] Separar Meta propria e Meta herdada de Studios na visao/detalhe/export de Hunters.
- [x] Mostrar Hunter Especializado em Metas por Pessoa somente como consulta derivada dos Studios do cliente, com Renovacao e acoes diretas inibidas.
- [x] Fazer Metas por Pessoa incluir clientes vindos de `studio_target_allocations` quando a pessoa e Hunter associada ao Studio.
- [x] Fazer Clientes considerar Studio Hunter por pessoa na lista de Hunters alocados e na distribuicao por pessoa, usando max(Meta Hunter direta, Studio Hunter) para nao duplicar.
- [x] Rodar typecheck, lint, smoke critico e build apos a correcao SICREDI/Gabriela.
- [x] Atualizar `AGENTS.md` com o modo lean enterprise engineering e novo formato final.
- [x] Atualizar `.squad/config.yaml` com ladder enxuto, regras de producao/Supabase e contrato de handoff.
- [x] Atualizar `C:\Users\rmarchini\.codex\AGENTS.md` para aplicar o modo lean enterprise engineering globalmente.
- [x] Reduzir duplicacao no `AGENTS.md` local, deixando o projeto herdar o padrao global.
- [x] Modelar meta gerencial de Hunter Especializado como relacao `specialist_hunter_studio_assignments`, sem criar meta oficial em `revenue_target_allocations`.
- [x] Criar migration/RPC transacional para salvar selecao por Hunter Especializado + Cliente + Ano.
- [x] Expor a selecao no contrato de repositorio, Supabase, fallback local e store.
- [x] Criar rota/tela Metas Hunter Especializado com filtros, checkboxes e totalizador.
- [x] Ajustar Relatorio de Metas para usar somente as linhas selecionadas de Hunter Especializado.
- [x] Rodar db:migrations:check, typecheck, lint, smoke critico e build.
- [x] Ao selecionar Hunter Especializado em Metas por Pessoa, orientar abertura da tela dedicada com pessoa/ano no contexto.
- [x] Redesenhar Metas Hunter Especializado com bloco Nova inclusao e bloco Selecoes cadastradas, incluindo pre-visualizacao de linhas ainda nao salvas.
- [x] Rodar typecheck, lint, smoke critico e build apos o ajuste de UX.
- [x] Ajustar Clientes para abater Studio Manutencao da pendencia de Renovacao na distribuicao por pessoa.
- [x] Atualizar specs para explicitar que Studio Manutencao concilia em Areas/Studios, nao em Metas por Pessoa.
- [x] Rodar typecheck, lint, smoke critico e build apos correcao de Clientes.
- [x] Fazer Metas por Pessoa mostrar cliente quando a pessoa esta em `hunterPersonId` de Studio com qualquer valor Hunter ou Manutencao.
- [x] Fazer Clientes mostrar a pessoa associada no Hunter do Studio mesmo quando a linha tem apenas Manutencao/Renovacao, sem somar manutencao no total Hunter.
- [x] Rodar typecheck, lint, smoke critico e build apos correcao BMG/Gabriela.
- [x] Fazer Metas por Pessoa somar Studio Hunter pelo Hunter efetivo quando `hunterPersonId` esta vazio e o Hunter principal vem da tela Clientes.
- [x] Fazer Metas por Area/Studio exibir, filtrar e ordenar pelo Hunter efetivo.
- [x] Rodar typecheck, lint, smoke critico e build apos correcao de Hunter efetivo.
- [x] Fazer Relatório de Metas usar Hunter efetivo em Pessoas, Hunters, detalhes e exportações.
- [x] Documentar criterio de aceite para que clientes como SICOOB/SICREDI nao sumam por `hunterPersonId` vazio.
- [x] Criar visão Hunter x Clientes com seletor unico de Hunter e linhas por Cliente + Area/Studio.
- [x] Incluir Meta propria Hunter e alocacoes de Studio Hunter/Manutencao usando Hunter efetivo.
- [x] Documentar que Manutencao aparece para leitura operacional e nao vira meta Hunter.
- [x] Criar agentes locais `ux-quality-reviewer`, `reuse-componentization-reviewer` e `database-performance-reviewer`.
- [x] Atualizar `.codex/project.json`, `.codex/README.md`, `AGENTS.md` e `.squad/config.yaml` com o novo fluxo de revisao.
- [x] Aplicar o mesmo padrao global em `C:\Users\rmarchini\.codex` para valer para todos os projetos.
- [x] Ajustar Hunter x Clientes para somar Renovacao + Ampliacao de pessoas nos clientes do Hunter.
- [x] Manter Manutencao/Renovacao como coluna operacional, sem alterar Meta Hunter.

## Previous Completed Work

- [x] Ler `AGENTS.md`, `.squad/config.yaml`, `.squad/memory.md` e configuracoes essenciais.
- [x] Identificar riscos de contexto: `.next`, `node_modules`, `.npm-cache`, logs, binarios, specs longas e caches globais.
- [x] Checar Headroom antes de instalar; nao foi encontrada integracao confiavel Codex/Headroom.
- [x] Criar `.codexignore` com politica rigorosa de contexto LLM.
- [x] Criar `docs/context-strategy.md` para carregamento progressivo de contexto.
- [x] Criar resumos compactos de database, frontend, backend, API, regras de negocio e padroes de codigo.
- [x] Criar memoria compacta: `docs/project-memory.md`, `docs/decisions.md`, `docs/domain-model.md`, `docs/glossary.md`.
- [x] Atualizar `.gitignore` para artefatos/cache/logs que tambem poluem contexto.
- [x] Aplicar a politica global em `C:\Users\rmarchini\.codex` apos aprovacao de escrita fora do workspace.
- [x] Limpar historico/cache global seguro: `.codex\.tmp`, `.codex\tmp`, `.codex\generated_images`, `.codex\archived_sessions` e sessoes JSONL antigas.
- [x] Rodar verificacoes leves de diff/arquivos apos os ajustes.

- [x] Ler `AGENTS.md`, `.squad/config.yaml`, `.squad/memory.md` e specs relevantes.
- [x] Inspecionar `PersonTargetReport`, `PersonTargetAssignment` e `ReportExportActions`.
- [x] Ler a estrutura da planilha `FINANCIAL-Rateio Metas AEs.xlsx` sem alterar o original.
- [x] Criar saída `.xlsx` real para exportações e botão customizado "Planilha oficial".
- [x] Adicionar exportação oficial no grão Executivo + Cliente, com subtotais e total geral.
- [x] Permitir detalhar/exportar um único Studio na visão Áreas / Studios.
- [x] Garantir que Hunter selecionado exporta o detalhe explodido por cliente/segmento/studio.
- [x] Incluir nome da pessoa no arquivo quando a exportação tiver uma única pessoa.
- [x] Mostrar base esperada das contas em Metas por Pessoa.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm run build`.
- [x] Revisar diff final, publicar em produção e registrar evidências.
- [x] Substituir escolha única por checkbox em Hunters e Áreas/Studios no Relatório de Metas.
- [x] Exportar/pré-visualizar detalhe explodido para um ou vários Hunters/Studios selecionados.
- [x] Atualizar specs para refletir seleção múltipla por checkbox.
- [x] Estruturar resposta GEN AI com narrativa, números refletidos, hipóteses/conceitos, recomendações, perguntas e baseline.
- [x] Mostrar baseline conceitual GEN AI ativo na Análise de Desafio.
- [x] Garantir que baseline GEN AI não altera metas, salários, status ou faixas oficiais.
- [x] Corrigir compatibilidade da API GEN AI para payload sem ano vindo de bundle/cache anterior.
- [x] Enter no contexto aciona Reavaliar com GEN AI; Shift+Enter quebra linha.
- [x] Criar bucket operacional `director-other` / "Outros" para governança transitória de cliente.
- [x] Exibir "Outros" no cadastro/filtro/listagem/export de Clientes e leituras por diretor.
- [x] Excluir "Outros" da visão de Relatório de Metas por Diretoria Delivery.
- [x] Controlar os campos do modal de Metas por Área/Studio por estado de formulário.
- [x] Validar cliente, área, ano e Hunter obrigatório antes de persistir alocação de Studio Hunter.
- [x] Normalizar o cliente apenas quando a edição de Studio exigir atualização de subtotais do cliente.
- [x] Rodar lint, typecheck, build e smoke crítico.
- [x] Publicar em produção após validação.
- [x] Ajustar Clientes para reconciliar Hunter por `max(Meta Hunter direta, Studio Hunter detalhado)`, sem duplicar Studio Hunter.
- [x] Impedir que Studio Hunter acima da abertura informativa gere linha "Acima da meta" no detalhe de Área/Studio do Cliente.
- [x] Rodar lint, typecheck, build e smoke crítico para a regra de Clientes.
- [x] Publicar correção de Clientes em produção.
- [x] Carregar automaticamente a alocação existente ao escolher Cliente + Área/Studio + Hunter + Ano no modal.
- [x] Ordenar por Cliente as grades de conciliação e alocações em Metas por Área/Studio.
- [x] Remover a atualização automática de Cliente no submit de Metas por Área/Studio para impedir erro falso após salvar a alocação.
- [x] Aplicar máscara visual em Reais nos campos de valor de Metas por Área/Studio.
- [x] Ao clicar em Alocar na conciliação, abrir a primeira alocação existente do cliente/ano quando houver.
- [x] Rodar lint, typecheck, build e smoke crítico para Metas por Área/Studio.
- [x] Publicar correção final de Metas por Área/Studio em produção.
- [x] Adicionar favicon SVG da aplicação em `public/icon.svg` e metadados em `src/app/layout.tsx`.
- [x] Ajustar a troca de Hunter responsável em Clientes para preservar outros Hunters/Farmers associados ao mesmo cliente.
- [x] Criar migration operacional para vincular Santander diretamente a Ricardo Bonatti Costa sem apagar outros participantes.
- [x] Aplicar migration Santander no Supabase de produção.
- [x] Rodar lint, typecheck, build e smoke crítico após os ajustes Santander/favicon.
- [x] Publicar produção com favicon e regra de preservação de Hunters/Farmers.
- [x] Analisar a planilha `Visao_Agrupada_SU_Torre_Grupo_Studio_TipoOpp.xlsx` para especificar a tela de baseline de studios.
- [x] Criar leitor de `.xlsx` tolerante a `inlineStr` vazio para o layout de Studios.
- [x] Criar helper de comparação Baseline Studio vs Cadastro do Cliente vs Alocação por Área/Studio.
- [x] Adicionar seção de upload, KPIs, grade e exportação do batimento de Studios no Comparativo Baseline.
- [x] Rodar lint, typecheck, build e smoke crítico para o batimento de Studios.
- [x] Publicar em produção e inspecionar alias Vercel.
- [x] Reposicionar Baseline de Studios como visão/botão no início do Comparativo Baseline, sem exigir rolagem.
- [x] Redesenhar batimento de Studios como tela executiva por Cliente + Studio, com linhas Baseline e Hunters/Alocações.
- [x] Publicar melhoria visual do Comparativo Baseline em produção e inspecionar alias Vercel.
- [x] Ajustar regra de batimento para comparar planilha vs Hunters/Alocações, sem bater contra total de Studios do cadastro do cliente.
- [x] Criar tabela `studio_baseline_snapshots` e ação "Salvar foto do resultado" para persistir snapshot imutável.
- [x] Aplicar migration `20260706204500_studio_baseline_snapshots.sql`, validar e publicar em produção.

## Decisions Already Made

- A politica global de contexto vive em `C:\Users\rmarchini\.codex\CONTEXT_POLICY.md` e vale para todos os projetos, salvo regra local mais estrita.
- Nao foi instalada ferramenta Headroom porque nao foi encontrada integracao Codex confiavel/verificavel; a alternativa segura foi politica global + `.codexignore` local.
- Bancos SQLite ativos do Codex (`logs_2.sqlite`, `state_5.sqlite`, etc.) foram preservados para nao quebrar estado/autenticacao/sessoes.
- O modelo de squad virtual complementa SDD e os skills existentes; ele nao substitui `AGENTS.md`, `.codex/`, specs ou arquitetura atual.
- O orquestrador e o comportamento padrao do Codex atuarao como Tech Lead: entender pedido, inspecionar contexto, classificar camadas impactadas, montar checklist, revisar com lentes especializadas e consolidar evidencia.
- A memoria operacional fica em `.squad/memory.md`; o contrato tecnico fica em `.squad/config.yaml`.
- Decisoes arquiteturais relevantes devem ser registradas em ADRs sob `docs/adr/`.
- Para UI, problemas de KPI, alinhamento, overflow, scroll, responsividade, acessibilidade e estados vazios/erro sao bloqueios de UX para telas tocadas.
- Para dados financeiros/metas, a fonte canonica deve preservar ano, grao e relacionamento normalizado; Studio Hunter e Meta Hunter direta sao fatos distintos e podem compor visoes derivadas.
- Em mobile/iPhone, o documento principal nao deve ter scroll horizontal. Tabelas largas podem ter scroll horizontal apenas dentro do proprio card/tabela.
- Dashboard Executivo, Portfólio de Clientes, Relatório de Metas, Baseline vs Cadastro e Ajuda continuam sendo as telas simples permitidas no mobile; telas operacionais permanecem inibidas.
- O modelo oficial de exportação Financial usa aba `Resumo_Cliente` e colunas Executivo, Grupo Cliente, Meta 2026, Renovação (FARMER), Novo (HUNTER), % Novo.
- Para Hunter, Studio Hunter compõe "Novo (HUNTER)" na saída oficial. Studio Manutenção compõe Renovação/Farmer quando a visão é Área/Studio.
- No Relatório de Metas, Hunters e Áreas/Studios usam checkboxes para seleção de exportação. Sem seleção, exportam consolidado; com seleção, exportam detalhe explodido.
- Na Análise de Desafio, baseline GEN AI é contextual/conceitual por visão+ano na sessão da tela. Ele aprende hipóteses e conceitos informados e os compara contra números oficiais, sem persistir ou sobrescrever dados oficiais.
- A API `/api/challenge-analysis` aceita `year` opcional para tolerar frontend em cache; quando ausente, usa 2026.
- `director-other` representa o bucket "Outros" para clientes sem diretoria definida. Ele existe como pessoa operacional por causa da FK `customers.director_responsible_id -> people.id`, mas não deve consolidar metas por Diretoria Delivery.
- Metas por Área/Studio devem editar a linha exata no grão Cliente + Área/Studio + Hunter + Ano; o modal não deve depender de `defaultValue` quando aberto repetidas vezes.
- Na tela Clientes, Studio Hunter é detalhe contido em Hunter: quando há Meta Hunter direta e Studio Hunter detalhado no mesmo cliente/ano, a reconciliação usa o maior dos dois como cobertura Hunter, não a soma.
- Em Metas por Área/Studio, a operação principal é salvar `studio_target_allocations`. O submit não deve chamar `saveCustomer`; subtotais divergentes ficam visíveis na conciliação.
- Um cliente pode ter múltiplos Hunters/Hunter + Farmer associados. A troca do Hunter responsável no cadastro de Cliente não deve remover esses vínculos nem metas de outros participantes.
- Santander deve ter Ricardo Bonatti Costa como Hunter direto; Ricardo Bonfim é outra pessoa e não deve ser confundido com Bonatti.
- A tabela `person_customer_assignments` ainda não diferencia claramente "Hunter direto/principal" de participante Hunter/Farmer. A correção atual preserva participantes e adiciona o vínculo direto, mas a evolução ideal é modelar esse papel explicitamente.
- O batimento de baseline de Studios fica na rota Comparativo Baseline e é apenas comparativo: não grava nem sobrescreve cliente, pessoa ou alocações.
- A planilha de Studios usa `Tipo Opp` para classificar valores: Novo/Ampliação entra em Studio Hunter; demais tipos entram em Studio Manutenção/Renovação.
- No batimento de Studios, não se compara contra o total de Studios cadastrado no Cliente. Studio Hunter da planilha bate contra `studio_target_allocations.hunter_amount` atribuído a Hunters/pessoas com papel de Hunter. Studio Manutenção bate contra `studio_target_allocations.maintenance_amount` no Cliente + Studio.
- A prévia/exportação de Studios deve evitar colunas sequenciais para cada fonte. A leitura executiva usa Cliente + Studio como chave, linhas por visão e colunas Hunter, Manutenção, Total e Diferença. Divergência de origem/nome aparece só como indicativo contextual quando existir.
- "Salvar foto do resultado" grava um snapshot imutável em `studio_baseline_snapshots`, com ano, arquivo, totais e linhas calculadas, sem alterar metas ou alocações.

## Next Pending Step

Próximo passo: validar e publicar a correcao de Hunter efetivo em Metas por Pessoa, Clientes e Metas por Area/Studio.

## Discovered Commands

- `npm run dev`: servidor local Next.js.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript sem emit.
- `npm run build`: build de producao Next.js.
- `npm run smoke:critical`: smoke critico para fluxos de cliente/pessoa/metas.
- `npm run db:migrations:check`: checagem de historico de migrations Supabase.
- `npm run audit:background`: auditoria de processos em background via PowerShell.
- `npx --cache .npm-cache --yes supabase <command> --linked`: caminho aprovado para Supabase CLI neste repo.
- `npx --cache .npm-cache --yes supabase db push --linked`: aplica migrations pendentes no Supabase remoto depois de `migration list`.
- `npx vercel deploy --prod`: deploy de producao Vercel.
- `npm install fflate`: declara o leitor ZIP usado pelo parser de `.xlsx` de Studios.

## Ports, Paths, Environment Variables and Project Conventions

- Raiz canonica: `C:\Users\rmarchini\projetos\OrgBRQDelivery`.
- Nao editar o stub OneDrive: `C:\Users\rmarchini\OneDrive - BRQ\Documentos\OrgBRQDelivery`.
- App local padrao: `http://localhost:3000`.
- Producao Vercel: `https://brq-delivery-coverage-hub.vercel.app`.
- Specs principais: `specs/delivery-coverage-hub/`.
- Repositorios de dados: `src/lib/repositories/`.
- Migrations Supabase: `supabase/migrations/`.
- Docs de arquitetura/producao/seguranca: `docs/`.
- ADRs: `docs/adr/`.
- Variaveis Supabase/OpenAI ficam em `.env.local`/Vercel; nunca expor secrets no frontend.
- Texto da UI: portugues do Brasil.
- Codigo, identificadores, componentes, funcoes e comentarios: ingles.
- Reusar componentes em `src/components/ui/` e compartilhados em `src/components/shared/`.

## Known Pitfalls and Constraints

- Worktree costuma estar suja; nao reverter alteracoes nao feitas pelo agente.
- Supabase CLI deve usar cache local `.npm-cache`; evitar `npx --no-install supabase`.
- Distinguir falhas de cache/rede/telemetria de drift real de schema.
- Nao hardcodar pessoas, clientes, managers, hunters, areas, studios ou owners em UI.
- Metas e fatos financeiros precisam de periodo/ano e grao explicito.
- Studio Hunter nao deve ser duplicado como meta direta da pessoa. `revenue_target_allocations.own_amount` guarda a Meta propria Hunter editavel; `revenue_target_allocations.amount` guarda a Meta Hunter atual derivada como propria + Studio Hunter.
- Arquivos `.xlsx` gerados pelo Excel podem conter células `inlineStr` vazias; `read-excel-file` falhou nesse layout específico, então a tela de baseline de Studios usa parser leve com `fflate` + `DOMParser`.
- Service role pode existir apenas em backend/BFF; usuarios finais continuam nominais.
- Salario/remuneracao e sensivel; exige controle UI + RLS/autorizacao.
- Telas executivas precisam de sinais visuais, tooltips de racional e KPIs sem overflow.
- Acoes de exportacao devem aparecer em um unico lugar por contexto/visao ativa; duplicar Preview/CSV/Excel no header e no card da mesma funcao e bloqueio de UX.
- Em telas operacionais de metas, filtros de contexto, totais e acoes de inclusao devem ficar agrupados no mesmo painel para reduzir zigue-zague visual.
- Hunter Especializado e um papel gerencial cross. Ele nao tem `own_amount`, nao recebe `revenue_target_allocations` e nao altera totais oficiais; seu relatorio deriva apenas das linhas selecionadas em `specialist_hunter_studio_assignments`, que apontam para `studio_target_allocations`.
- Na tela Clientes, Studio Manutencao cobre a leitura de Renovacao/Manutencao para fins de pessoa e nao deve gerar linha "Abaixo da meta sem pessoa alocada"; eventuais diferencas ficam na conciliacao de Areas/Studios.
- `studio_target_allocations.hunterPersonId` e uma associacao operacional relevante para visibilidade. Se a linha tiver valor Hunter ou Manutencao, a pessoa associada deve aparecer nas telas; apenas `hunterAmount` soma no total Hunter. Quando `hunterPersonId` estiver vazio, o Hunter efetivo e o Hunter principal do Cliente.
- Em mobile, fluxos operacionais complexos devem ficar inibidos/consulta simples conforme spec.
- Antes de deploy em fluxos de cliente/pessoa/meta, rodar `npm run smoke:critical`.

## Stable Facts About the Project

- Projeto: BRQ Delivery Coverage Hub.
- Tipo: aplicacao web executiva interna.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style primitives, Recharts.
- Banco: Supabase/Postgres com RLS, migrations em SQL.
- Persistencia: repositorios locais e Supabase adapter via contratos em `src/lib/repositories/`.
- Auth: Supabase Auth, usuarios BRQ nominais, dominio `@brq.com`, roles/perfis do app.
- Deploy: Vercel.
- Arquitetura: frontend Next.js com store client-side e repositorios; backend via rotas internas/API quando necessario.
- Quality gate padrao: lint, typecheck, build; smoke critico para persistencia de cliente/pessoa/meta; migrations check quando schema/RLS muda.
- SDD e obrigatorio para mudancas nao triviais; specs vivem em `specs/delivery-coverage-hub/`.
