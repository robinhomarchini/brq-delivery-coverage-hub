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
- Receita e margem pertencem ao portfólio de clientes.
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
  deve exibir somente clientes ainda não associados a outro Hunter.
- O cargo "Diretor Comercial" deve estar disponível como sugestão no cadastro de
  Pessoas.
- Uma pessoa pode estar vinculada a um ou mais clientes, e um cliente pode ter
  um ou mais managers responsáveis.
- O portfólio de clientes/metas possui entidades de Cliente, Diretor, Delivery
  Manager e Plano de Receita.
- O plano de receita suporta Receita Atual, Meta Prevista, Receita Hunter e
  Receita Delivery/Farmer. Hunters são usados somente para atribuição de meta e
  reporting; não entram como owners da governança de Delivery.
- Metas editáveis devem ser separadas em Hunter e Farmer/Renovação, vinculadas
  a uma pessoa e a um cliente, sem duplicidade para Cliente + Pessoa + Tipo +
  Ano.
- Dashboards executivos do portfólio devem permitir leitura por Diretor, Manager
  e Cluster de Cliente.
- A planilha Financial BU é a fonte dos valores importados. Quando a origem não
  separar renovação e ampliação, a ampliação permanece zerada e a limitação deve
  ser explícita na interface.
- O acesso remoto exige autenticação com e-mail corporativo `@brq.com`.
- Usuários `viewer` possuem leitura; `editor` e `admin` podem alterar dados.
- Toda alteração persistida registra usuário e instante para auditoria.

## Fora de escopo

IA generativa real e integração definitiva com Microsoft Entra ID.
