# Requisitos — Delivery Coverage Hub

## Objetivo

Centralizar a visão executiva da organização de Delivery da BRQ e permitir a
gestão demonstrativa de pessoas, clientes e metas atendidas dentro de cada
cliente. O módulo de assuntos permanece preservado tecnicamente, mas pausado na
experiência do usuário até nova definição de modelo.

## Requisitos funcionais

1. Exibir KPIs e gráficos executivos.
2. Representar a hierarquia informada, distinguindo Staff de Managers.
3. Permitir criar, editar e excluir pessoas, clientes e metas.
4. Filtrar tabelas e o mapa de cobertura.
5. Exportar organograma em PNG, dashboard em PDF e dados em CSV.
6. Expor insights mockados para futura evolução com IA.
7. Exibir um módulo de portfólio de clientes/metas importado da planilha
   Financial BU.
8. Permitir cadastrar metas editáveis por cliente, pessoa, tipo de meta e ano.

## Regras de negócio

- Renan é Staff e responde diretamente a Robinson.
- Delivery, Farmer + Delivery, Hunter, Farmer, Hunter + Farmer, Staff e
  Diretores têm identidade visual distinta.
- Apenas pessoas com `isManager: true` entram no KPI de Managers.
- Receita e margem pertencem ao portfólio de clientes. Nesta etapa, margem é
  apenas margem-alvo informativa com padrão de 36,8%; apuração real fica para
  evolução futura.
- Assuntos por cliente estão pausados na navegação, nas visualizações e nos
  exports enquanto o modelo de cobertura é reavaliado.
- A cobertura executiva segue Diretor → Manager → Cliente.
- Colaboradores abaixo de Ane Knust e CA devem estar classificados na área
  Serviços Financeiros.
- O cadastro de clientes representa apenas a governança de Delivery da BU
  Financial nesta etapa.
- No cadastro de clientes, os diretores responsáveis permitidos são CA e Ane
  Knust.
- A base operacional de clientes deve conter todos os clientes-fonte da coluna
  Cliente da planilha Financial BU.
- CA é responsável pelos clientes-fonte de Itaú, Alelo e CIP/Núclea; Ane Knust é
  responsável pelos demais clientes Financial.
- Clientes-fonte de Itaú podem ter Bruno, Orion, Fernanda e Ricardo Bonfim como
  managers responsáveis simultâneos.
- Alelo, CIP e os demais clientes Financial usam Ana Braz como manager padrão,
  exceto os clientes-fonte de Itaú.
- Hunters, Farmers e papéis comerciais não aparecem como responsáveis na tela de
  clientes; essa tela reflete somente governança de Delivery.
- O cadastro de Pessoas permite perfis Hunter, Farmer e Hunter + Farmer para
  atribuição/reporting, sem marcar automaticamente esses perfis como Managers de
  Delivery.
- E-mail da Pessoa é opcional.
- Ao cadastrar Pessoa com perfil Hunter ou Hunter + Farmer, a seleção de clientes
  deve permitir clientes já associados a outro Hunter, pois um cliente pode ter
  mais de um Hunter com metas distribuídas por pessoa e ano.
- Os cargos "Diretor Comercial", "Gerente Executivo de Vendas" e "Executivo de
  Negócios" devem estar disponíveis como sugestão no cadastro de Pessoas.
- Uma pessoa pode estar vinculada a um ou mais clientes, e um cliente pode ter
  um ou mais managers responsáveis.
- O portfólio de clientes/metas possui entidades de Cliente, Diretor, Delivery
  Manager e Plano de Receita.
- O plano de receita suporta Receita Atual, Meta Prevista, Receita Hunter,
  Receita Delivery/Farmer e Áreas / Studios. Hunters são usados somente para
  atribuição de meta e reporting; não entram como owners da governança de
  Delivery.
- Metas de Áreas / Studios são separadas em Studio Hunter e Studio
  Manutenção/Renovação. Studio Hunter fica contido na meta Hunter do cliente e
  não soma novamente no total; Studio Manutenção/Renovação fica contido na meta
  Renovação + Ampliação do cliente e também não soma novamente no total. Valores
  de Áreas / Studios cadastrados antes dessa separação são tratados como Studio
  Hunter.
- Metas editáveis diretas da pessoa devem ser separadas em Hunter e Renovação +
  Ampliação, vinculadas a uma pessoa, cliente e ano, sem duplicidade para
  Cliente + Pessoa + Tipo + Ano. A quebra Studio Hunter não deve ser gravada
  como meta direta da pessoa; ela fica em alocação própria de Área/Studio e só
  soma no total do Hunter em telas e relatórios derivados.
- A tela de Metas deve exibir uma visão anual por pessoa, somando a meta Hunter
  direta, a meta de Renovação + Ampliação direta e a meta total proprietária de
  cada colaborador no ano selecionado. Quebras de Studio Hunter aparecem em
  visões de hunter/relatórios como valor derivado, sem duplicar persistência.
- Deve existir uma tela operacional "Metas por Pessoa" para associar, em uma
  única grade, Pessoa + Ano + Cliente + Meta Hunter + Meta Renovação/Ampliação
  proprietárias.
  Essa tela grava na tabela normalizada `revenue_target_allocations` e alimenta
  as demais visões de metas, dashboards e consolidações.
- A tela "Metas por Pessoa" deve excluir pessoas com perfil Executivo ou Diretor
  do lançamento direto de metas. Robinson, Ane Knust e CA aparecem apenas por
  consolidação derivada dos subordinados.
- A tela "Metas por Pessoa" também deve excluir Staff de lançamento direto de
  metas. Renan responde diretamente a Robinson e não deve carregar Meta Squads/Times.
- Ao selecionar uma pessoa em "Metas por Pessoa", a tela deve carregar
  automaticamente os clientes já vinculados à pessoa e os clientes com meta já
  existente para aquela pessoa/ano, permitindo incluir clientes adicionais para
  lançamento de meta quando necessário.
- Diferenças entre alocado/realizado e meta devem seguir o sinal
  `alocado - meta`: valor positivo indica superação da meta e deve aparecer
  verde; valor negativo indica falta para bater a meta e deve aparecer vermelho.
- A soma das metas das pessoas por Cliente + Ano deve ser comparada com a meta
  total do cliente. A aplicação deve destacar valores abaixo da meta até o
  fechamento exato e tratar valores acima da meta como superação positiva.
- Se uma edição em "Metas por Pessoa" ultrapassar a meta atual do cliente, o
  sistema deve solicitar confirmação para aumentar a meta do cliente pelo
  excedente, identificando se o acréscimo veio de Hunter, Renovação + Ampliação,
  Áreas / Studios ou combinação desses componentes.
- Deve existir um Assistente de Metas acionável que aponte clientes sem meta,
  sem manager, sem hunter associado quando houver meta Hunter esperada e clientes
  cuja soma das pessoas não bate com a meta total. Cada achado deve navegar para
  a tela de correção apropriada.
- Deve existir um Relatório de Pessoas e Metas com visão por pessoa, ano, Meta
  Hunter, Meta Renovação + Ampliação, Áreas / Studios, Meta Total e clientes
  associados.
- Deve existir uma página Ajuda com link para um guia rápido em PDF para
  homologadores.
- Diretores não recebem meta duplicada por cliente; Ane Knust e CA consolidam as
  metas dos managers subordinados. A meta total de Hunters é a soma de todas as
  alocações do tipo Hunter, incluindo pessoas com perfil Hunter e qualquer outra
  pessoa que eventualmente tenha meta Hunter declarada. Robinson consolida todas
  as metas da estrutura, incluindo managers e metas Hunter.
- Dashboards executivos do portfólio devem permitir leitura por Diretor, Manager
  e Cluster de Cliente.
- A planilha Financial BU é a fonte dos valores importados. Quando a origem não
  separar renovação e ampliação, a ampliação permanece zerada e a limitação deve
  ser explícita na interface.
- O acesso remoto exige autenticação com e-mail corporativo `@brq.com`.
- Usuários `viewer` possuem leitura; `editor` e `admin` podem alterar dados.
- Usuário `admin` pode simular, pela tela principal, o contexto de outro usuário
  ativo ou Hunter operacional para validar filtros, navegação e permissões
  percebidas. A simulação não troca o login, o token de autenticação nem a
  identidade auditada por BFF/RLS.
- Toda alteração persistida registra usuário e instante para auditoria.

## Fora de escopo

IA generativa real e integração definitiva com Microsoft Entra ID.
