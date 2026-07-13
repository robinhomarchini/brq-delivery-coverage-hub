# Decisoes do Projeto

Use este arquivo para registrar decisoes tecnicas que devem continuar orientando o projeto.

## 2026-06-18 - Criacao do sistema de agentes

O projeto passa a ter uma camada `.codex/` com manifesto, agentes, aprendizados e decisoes.

Motivo:
- preservar padroes reutilizaveis;
- permitir que novos trabalhos acionem agentes/personas por contexto;
- registrar aprendizados antes de transforma-los em regra permanente.

## 2026-06-18 - Dados locais atrás de contrato de repositório

O MVP usa um store cliente inicializado por `src/data/mockData.ts`, mas os contratos
de acesso ficam em `src/lib/repositories`.

Motivo:
- entregar a demonstração sem backend;
- permitir migração gradual para Supabase;
- evitar acoplamento entre componentes visuais e persistência.

## 2026-06-18 - Interface pt-BR e implementação em inglês

Todo texto visível ao usuário fica em português. Identificadores, componentes,
funções e comentários ficam em inglês, conforme requisito do produto.

## 2026-06-22 - Supabase como persistência do MVP

O projeto usa Supabase com tabelas para áreas, pessoas, territórios e clientes.
O adaptador local permanece como fallback quando as variáveis públicas não estão
configuradas.

Motivo:
- persistir alterações dos CRUDs entre sessões;
- preservar o contrato de repositório;
- permitir evolução futura para autenticação e policies por perfil.

Observação:
- as policies atuais permitem CRUD anônimo apenas para viabilizar o protótipo;
- antes do uso corporativo, autenticação e RLS restritivo são obrigatórios.

## 2026-06-29 - Hardening por RPC transacional antes do BFF completo

Operacoes criticas passam a usar RPCs Postgres transacionais como primeiro
hardening: Pessoa + clientes, Cliente + managers e Metas por Pessoa.

Motivo:
- reduzir risco de escrita parcial ainda no modelo client-side com Supabase;
- manter compatibilidade de homologacao enquanto o BFF/Server Actions nao vira
  boundary principal;
- centralizar regras criticas no banco, incluindo exclusividade Hunter na tabela
  normalizada `person_customer_assignments`.

Observacao:
- o target arquitetural continua sendo mover leituras e escritas criticas para
  BFF/API Routes ou Server Actions;
- mudancas futuras em migrations, RLS, RPCs ou constraints devem acionar os
  agentes `database`, `security`, `qa` e `documentador`.

## 2026-06-30 - Metas de cliente sao fatos anuais

Metas de cliente deixam de ser tratadas como atributos atemporais do cadastro do
cliente e passam a ser modeladas como fato anual: `customer_id + target_year`.

Motivo:
- permitir historico por ano;
- reconciliar metas de cliente com metas por pessoa, que ja usam `target_year`;
- evitar que importacoes de planilha 2026 sobrescrevam metas futuras;
- separar cadastro do cliente, relacionamento pessoa-cliente e valores
  financeiros.

Regras derivadas:
- relacionamento Pessoa-Cliente pode existir com valor financeiro zero;
- Manager/Farmer/Hunter nao pode ser recolocado por default no cadastro;
- planilhas de baseline devem comparar primeiro e atualizar apenas itens
  confirmados pelo usuario.

## 2026-07-13 - Arquiteto como guardiao do existente

Antes de qualquer criacao ou alteracao relevante, o agente `arquiteto` deve
verificar historico, specs, memoria, decisoes, componentes compartilhados,
servicos/helpers em `src/lib`, contratos de repositorio e scripts de QA ja
existentes.

Motivo:
- evitar que novas funcionalidades recriem logica ja existente;
- preservar conhecimento acumulado em specs, memoria e decisoes;
- reduzir duplicacao em telas, relatorios, importadores, rollups e persistencia;
- criar componentes/helpers novos apenas quando houver reuso concreto ou
  simplificacao real.

Regras derivadas:
- `reuse-componentization-reviewer` passa a participar tambem do fluxo
  `before_change`, nao apenas da revisao final;
- novas abstracoes devem declarar motivo, consumidores atuais e reuso esperado;
- quando existir padrao equivalente, preferir extender o padrao atual em vez de
  criar novo caminho paralelo.

