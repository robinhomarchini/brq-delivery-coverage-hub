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

