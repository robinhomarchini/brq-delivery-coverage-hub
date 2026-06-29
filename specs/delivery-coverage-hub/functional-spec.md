# Especificação funcional

## Navegação

Sidebar com Dashboard Executivo, Organograma, Pessoas, Clientes, Portfólio de
Clientes, Metas, Metas por Pessoa, Relatório de Metas, Assuntos, Mapa de
Cobertura, Configurações e Ajuda. O item Assuntos fica visível como
pausado/desabilitado até nova definição do modelo.

## Fluxos CRUD

Cada tela de gestão apresenta busca/filtros, tabela responsiva e modal de cadastro
ou edição. Exclusões exigem confirmação do navegador.
Nas tabelas/listas editáveis, um duplo clique na linha abre a edição do item ou
leva diretamente para a tela operacional de ajuste correspondente.

## Clientes BU Financial

A tela de Clientes usa os clientes-fonte da planilha Financial BU como base
operacional. O formulário de novo cliente exibe Nome do cliente, Indústria,
Diretor responsável, Managers responsáveis, Conta estratégica, Meta total e
Margem. A listagem e o formulário exibem a composição financeira em Meta Hunter,
Meta Renovação + Ampliação e Meta Total, sempre formatada em reais. A meta total
continua sendo o campo editável do cliente; a quebra Hunter/Renovação é derivada
proporcionalmente da carga Financial BU para evitar duplicidade de fonte de
verdade.
No modal de edição, a composição da meta também deve mostrar a distribuição por
pessoa no ano corrente, separando Hunter, Renovação + Ampliação e Total por
pessoa. Quando parte da meta ainda não estiver alocada, a tela deve exibir uma
linha "Em aberto sem pessoa alocada"; quando houver alocação acima da meta do
cliente, a tela deve indicar o excedente e oferecer atalho para revisão em Metas
por Pessoa.

A carga inicial de clientes deve conter todos os nomes da coluna Cliente da
planilha Financial BU:

- AGIBANK
- ALELO
- ASA INVESTMENTS
- ASSOCIAÇÃO OPEN FINANCE
- B3
- B3 IP
- BANCO ABC
- BANCO B3
- BANCO BOCOM
- BANCO BS2
- BANCO ITAÚ S.A.
- BANCO PACTUAL
- BANCO RCI
- BBTS
- BRADESCO
- BULLLA
- CIP
- CREDIT SUISSE
- CRT4
- CSF
- CSU
- EDENRED
- FIS
- FUNDAÇÃO ITAÚ
- INTEL
- LIVELO S.A.
- NEW LOGO
- OPEA
- PICPAY
- PISMO
- PROFESSIONAL SERVICES
- QUOD
- REDECARD
- SANTANDER
- SICOOB
- SICREDI
- TRAVELEX
- VISA
- VOTORANTIM
- XP INVESTIMENTOS
- ZURICH

Os dropdowns de responsáveis são restritos a:

- Diretor responsável: CA e Ane Knust.
- Managers responsáveis: Bruno, Orion, Fernanda, Ricardo Bonfim e Ana Braz.

Ao informar o nome do cliente, o formulário aplica a regra padrão:

- Clientes-fonte de Itaú: diretor CA e managers Bruno, Orion, Fernanda e
  Ricardo Bonfim.
- Alelo e CIP/Núclea: diretor CA e manager Ana Braz.
- Demais clientes: diretor Ane Knust e manager Ana Braz.

Os dados continuam editáveis manualmente após a carga inicial. A regra acima
define o preenchimento padrão, mas a tela permite escolher um ou mais managers
de Delivery em qualquer cliente, usando apenas Bruno, Orion, Fernanda, Ricardo
Bonfim e Ana Braz. Hunters, Farmers e papéis comerciais ficam fora do cadastro
de clientes. A seleção de managers deve usar uma interface de duas listas
selecionáveis, permitindo mover um ou mais managers entre disponíveis e
selecionados sem depender de Ctrl/Cmd. Um duplo clique sobre um manager deve
movê-lo imediatamente para a outra lista. Ao salvar com sucesso, a tela deve
exibir uma mensagem de confirmação flutuante. Erros de salvamento devem aparecer
em aviso flutuante, sem alterar o layout do formulário ou exigir scroll.
Quando a Meta Total editada no cliente ficar acima da soma já distribuída em
Metas por Pessoa no ano corrente, o formulário deve exibir um alerta com o gap,
a lista de pessoas/gerentes envolvidos no cliente e atalhos para abrir a tela
Metas por Pessoa com cliente e pessoa pré-selecionados.

## Pessoas

A tela de Pessoas permite vincular uma pessoa a um ou mais clientes. O vínculo
de clientes deve usar uma interface de duas listas selecionáveis, permitindo
mover clientes entre disponíveis e selecionados. Um duplo clique sobre um
cliente deve movê-lo imediatamente para a outra lista. A gravação deve persistir
os clientes selecionados junto com a pessoa e exibir uma mensagem de confirmação
flutuante ao salvar com sucesso. Erros de salvamento devem aparecer em aviso
flutuante, sem alterar o layout do formulário ou exigir scroll.

## Mapa de Cobertura

O Mapa de Cobertura apresenta Diretor → Manager → Cliente. A relação
Manager → Cliente deve usar os clientes vinculados na tela de Pessoas
(`person.clientIds`) como fonte primária, para refletir imediatamente mudanças
manuais de cobertura feitas no cadastro da pessoa.

A relação Pessoa ↔ Cliente deve vir do modelo normalizado descrito em
`Modelo normalizado de cobertura`.

## Portfólio de Clientes e Metas

A rota Portfólio de Clientes apresenta a visão executiva importada da planilha
Financial BU `Curva de Vendas Revisada (1).xlsx`.

Além da visão importada, o app possui a rota Metas para cadastrar metas
financeiras por Cliente, Pessoa, Tipo de Meta e Ano. Essa é a fonte de verdade
para metas editáveis manualmente. Os valores agregados da planilha permanecem
como referência analítica importada.

A rota Metas funciona como visão de conciliação e consolidação executiva. A rota
Metas por Pessoa é a tela operacional principal para associar metas: o usuário
seleciona uma pessoa e um ano, escolhe o cliente na grade e informa os valores
de Meta Hunter e Meta Renovação + Ampliação para aquele Cliente + Pessoa + Ano.
Ambas as telas usam `revenue_target_allocations` como fonte única de verdade.
Na tela Metas por Pessoa, pessoas com papel Executivo ou Diretor não aparecem
para lançamento direto, pois Robinson, Ane Knust e CA são consolidações
derivadas dos subordinados. Ao selecionar uma pessoa, a grade deve carregar
automaticamente os clientes já associados a ela no cadastro de Pessoas e também
clientes com meta já lançada para a pessoa no ano selecionado. O usuário pode
incluir clientes adicionais apenas para associação de meta, sem alterar
automaticamente a cobertura de Delivery da pessoa.
Perfis Staff também não aparecem para lançamento direto. Renan responde
diretamente a Robinson e não deve carregar meta própria.

A rota Metas possui um Assistente de Metas acionável. Ele apresenta clientes sem
valor de meta, clientes sem manager, clientes sem hunter associado quando existe
meta Hunter esperada e divergências entre soma das pessoas e meta total do
cliente. Achados relacionados ao cliente navegam para a tela Clientes com o
cliente em edição. Achados relacionados à associação de metas navegam para
Metas por Pessoa com cliente e ano pré-selecionados.

A rota Relatório de Metas apresenta visão por pessoa e ano, com Meta Hunter,
Meta Renovação + Ampliação, Meta Total, quantidade de clientes e lista resumida
de clientes. Cada pessoa do relatório deve navegar para Metas por Pessoa com a
pessoa e o ano pré-selecionados.

A rota Ajuda deve disponibilizar um guia rápido simples em PDF, publicado como
link estático, com instruções de uso para homologadores.

O Dashboard Executivo também apresenta uma visão financeira resumida dos clientes
Financial, com Receita Atual, Meta Prevista, Receita Hunter, Receita
Delivery/Farmer, ranking de clientes por meta, abertura por Diretor e abertura
por subordinado/manager.

Entidades do módulo:

- Cliente: cliente-fonte da coluna Cliente da planilha.
- Diretor: CA ou Ane Knust.
- Delivery Manager: Bruno, Orion, Fernanda, Ricardo Bonfim ou Ana Braz.
- Plano de Receita: métricas financeiras do cliente/cluster.
- Alocação de Meta: valor editável de meta por cliente, pessoa, tipo e ano.

Campos exibidos:

- Cliente.
- Diretor Responsável.
- Manager Responsável.
- Receita Atual.
- Meta Prevista.
- Receita Hunter.
- Receita Delivery/Farmer.

Campos do cadastro de Metas:

- Cliente.
- Pessoa.
- Tipo de Meta: Hunter ou Renovação + Ampliação.
- Ano.
- Valor da Meta.
- Observações.

Campos da associação de Metas por Pessoa:

- Pessoa.
- Ano.
- Cliente.
- Meta Hunter do Cliente.
- Meta Renovação + Ampliação do Cliente.
- Já associado a outras pessoas, separado por Hunter e Renovação + Ampliação.
- Gap após edição, separado por Hunter e Renovação + Ampliação.
- Meta Hunter.
- Meta Renovação + Ampliação.
- Total associado.
- Origem do vínculo na tela: cliente associado, meta existente ou incluído na
  edição atual.
- Status de conciliação do cliente.

Regras do cadastro de Metas:

- Uma pessoa pode ter metas em vários clientes.
- Um cliente pode ter metas de várias pessoas.
- Para a mesma combinação Cliente + Pessoa + Tipo de Meta + Ano deve existir
  apenas um registro.
- A soma das metas das pessoas para um Cliente + Ano deve reconciliar com a
  meta total do cliente.
- A tela deve destacar clientes reconciliados, pendentes e acima da meta. O
  salvamento não deve permitir que a soma das pessoas ultrapasse a meta total do
  cliente.
- A tela Metas por Pessoa deve quebrar a meta do cliente, o valor já associado
  a outras pessoas e o gap após edição em Hunter e Renovação + Ampliação, para
  deixar claro onde falta ou sobra meta.
- Na tela Metas por Pessoa, quando uma alteração fizer a soma das metas das
  pessoas ultrapassar a meta atual do cliente, o sistema deve perguntar se o
  usuário deseja aumentar a meta do cliente pelo excedente. Se confirmado, a
  meta total do cliente é elevada antes de gravar a nova meta da pessoa; a
  mensagem deve indicar se o acréscimo veio de Hunter, Renovação + Ampliação ou
  ambos.
- Hunter é usado somente para atribuição/reporting de metas e não transforma a
  pessoa em responsável de Delivery do cliente.
- Renovação + Ampliação representa o crescimento e manutenção das squads
  existentes, trabalho de Farmer e Delivery Manager.
- A tela deve exibir uma visão anual por pessoa, com Meta Hunter, Meta Renovação
  + Ampliação, Meta Total, quantidade de clientes atendidos e status de
  cobertura no ano selecionado.
- A tela deve exibir uma consolidação hierárquica anual:
  - Robinson consolida todos os managers e hunters da estrutura.
  - Ane Knust consolida somente os managers abaixo dela.
  - CA consolida somente os managers abaixo dele.
  - Hunters aparecem em grupo próprio, sem entrar como responsáveis de Delivery.
    Esse grupo soma toda alocação do tipo Hunter, inclusive quando a pessoa não
    tiver perfil Hunter.
- Metas de diretores são derivadas dos subordinados e não devem ser gravadas
  como metas duplicadas na tabela de alocações.
- O cadastro de Pessoas suporta os perfis Delivery, Farmer + Delivery, Hunter,
  Farmer e Hunter + Farmer. Apenas Delivery e Farmer + Delivery são marcados
  automaticamente como `isManager` para fins de governança Delivery; os demais
  perfis comerciais podem receber metas e clientes para reporting, mas não viram
  Manager responsável do cliente.
- O e-mail de Pessoa é opcional e, quando ausente, deve ser persistido como
  `null`.
- Para perfis Hunter e Hunter + Farmer, a lista de clientes deve ser recalculada
  ao trocar o perfil e deve excluir clientes já vinculados a outro Hunter ou
  Hunter + Farmer.
- A exclusividade Hunter por cliente é aplicada na UI, no repositório e no banco
  por trigger sobre `person_customer_assignments`.
- O campo Cargo continua editável como texto livre, mas deve sugerir "Diretor
  Comercial".
- Quando um cluster financeiro possui mais de um cliente-fonte, a carga inicial
  divide a meta do cluster entre os clientes-fonte para manter conciliação sem
  duplicar valores. Os valores continuam editáveis manualmente.

Dashboards:

- Receita Atual x Meta Prevista por Diretor.
- Meta Prevista por Manager.
- Receita Atual x Meta Prevista por Cliente/Cluster.
- Top clusters por Meta Prevista.
- Tabela executiva por cluster de cliente.

Mapeamento de origem:

- Receita Atual: `Anualizado + CPRB` da aba `Sheet1`, filtrada por `BU Financial`.
- Meta Prevista: `Total RL 2026` da aba `Resumo RL 2026`.
- Receita Hunter: `Times - Novo (Venda Líq.)` do segundo bloco Financial.
- Receita Delivery/Farmer: `Total (Venda Líq.) + Times - Renov. & Ampl. (Venda Líq.)`
  do segundo bloco Financial.
- Total Financial BU: Receita Hunter + Receita Delivery/Farmer.
- Hunters aparecem somente como atribuição/reporting; os owners da tela continuam
  sendo Diretor e Delivery Manager.

## Exportações

- Dashboard: PDF gerado a partir da área visível.
- Organograma: PNG gerado a partir da área do organograma.
- Dados: CSV com pessoas e clientes em seções. Assuntos ficam fora do export
  enquanto o módulo estiver pausado.

## Responsividade

Em telas menores a sidebar vira barra superior compacta, tabelas permitem rolagem
horizontal e os painéis passam para uma coluna.

## Direção visual executiva

- Identidade inspirada na marca institucional BRQ atual: branco, preto, cinzas
  neutros e roxo como assinatura.
- Sidebar clara, compacta e com item ativo em roxo suave.
- Header discreto de 56px para maximizar a área útil.
- Cards com borda leve, sombra mínima e raio moderado.
- Dashboard com seis KPIs prioritários, receita do portfólio em destaque e
  composição assimétrica dos gráficos.
- Densidade adequada para leitura executiva em tela 16:9.
- Elementos geométricos lineares podem ser usados como detalhe de marca, sem
  competir com os dados.

## Organograma

- Fluxo horizontal da esquerda para a direita:
  Diretor Executivo → Diretores/Staff → Managers.
- Cada diretor ocupa uma faixa horizontal com seus reports agrupados à direita.
- Staff usa faixa própria e conector pontilhado.
- Cards de managers são compactos para caber em uma visualização 16:9 e mostram
  área e quantidade de clientes.
- Cards de Diretor exibem clientes calculados pela união dos clientes dos seus
  managers diretos, sem listar assuntos.
- O card do Diretor Executivo exibe clientes calculados pela união dos clientes
  de todos os managers da estrutura, sem listar assuntos.
- Assuntos não aparecem no organograma enquanto o módulo estiver pausado.
- Cargos de direção usam nomenclatura neutra, como "Diretor de Delivery", sem
  variação por gênero.
- Todos os colaboradores abaixo de Ane Knust e CA são exibidos como Serviços
  Financeiros.

## Modelo normalizado de cobertura

A relação Pessoa ↔ Cliente deve ser persistida em uma tabela associativa única,
`person_customer_assignments`. Os campos legados `people.client_ids`,
`customers.manager_responsible_id` e `customers.manager_responsible_ids` ficam
apenas como compatibilidade técnica e não devem ser usados como fonte de verdade.

As metas editáveis por pessoa e cliente devem ser persistidas em
`revenue_target_allocations`. O app não deve gravar metas editáveis diretamente
em `people`, `customers` ou `revenue_plans`; essas telas devem somar os valores
a partir da tabela normalizada quando precisarem de visão por cliente, pessoa,
tipo ou ano.

O app deriva:

- `person.clientIds` a partir de `person_customer_assignments`;
- `customer.managerResponsibleIds` a partir de `person_customer_assignments`,
  considerando somente pessoas marcadas como managers.

## Assuntos por cliente

- Módulo pausado temporariamente.
- O item permanece visível na navegação como desabilitado para indicar que o
  tema existe, mas não participa das visualizações executivas atuais.
- A rota direta `/assuntos` exibe uma mensagem de módulo em avaliação, sem CRUD.
- Os dados técnicos existentes são preservados no banco para evolução futura.
- A tabela legada de territórios permanece no banco somente para preservar os
  dados existentes e não participa mais da navegação ou das análises.
