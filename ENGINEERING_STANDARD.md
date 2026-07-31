# Norma geral de engenharia

Esta norma é obrigatória para qualquer agente ou extensão que trabalhe neste
workspace, independentemente de fornecedor ou modelo.

## Fluxo padrão

1. Leia as instruções do projeto e a documentação canônica antes do código.
2. Para mudança não trivial, explicite requisitos, regras, fonte de verdade,
   critérios de aceite, riscos e validação antes de implementar.
3. Identifique as camadas impactadas: domínio, banco, backend, frontend,
   segurança, documentação, testes e deploy.
4. Reutilize configuração, componentes, serviços e contratos existentes.
5. Implemente o menor escopo coerente, sem alterar comportamento adjacente.
6. Valide proporcionalmente ao risco e entregue evidências reais.

## Regras permanentes

- Regras críticas vivem em domínio/backend/banco; UI não é limite de segurança.
- Dados operacionais vêm de fontes canônicas, nunca de listas hardcoded na UI.
- Segredos ficam fora do código, logs, prompts, commits e bundles de navegador.
- Migrations são forward-only; histórico aplicado não é reescrito ou apagado.
- Mudanças multi-entidade críticas devem ser atômicas em BFF, serviço ou RPC.
- Preserve RLS, RBAC, auditoria, contratos de repositório e isolamento de dados.
- Não use mocks ou fallback local em produção.
- Não crie arquivos `old`, `backup`, `copy`, `v2` ou archives para versionar
  comportamento; Git é o histórico.
- Handoffs, relatórios pontuais e planos concluídos têm retenção máxima de 15 dias,
  salvo obrigação normativa, segurança, auditoria ou operação.
- Não introduza dependência quando a plataforma ou o projeto já oferece solução.
- Preserve alterações do usuário e não execute ação destrutiva sem escopo claro.

## Qualidade mínima

- Verifique consistência de domínio e fonte de verdade.
- Revise segurança e autorização no servidor/banco.
- Revise UX, estados de erro, acessibilidade e responsividade quando houver UI.
- Revise consultas, paginação, índices e volume quando houver dados.
- Procure duplicação real depois da implementação; extraia somente com reuso
  concreto.
- Execute lint, tipos, testes e build disponíveis. Declare o que não foi rodado.

## Organização de contexto

- Comece por resumos e specs; abra apenas arquivos impactados.
- Ignore caches, dependências, binários, outputs, logs e lockfile diffs quando
  não forem necessários.
- Regras gerais ficam neste arquivo; arquivos específicos de ferramentas apenas
  apontam para ele e registram diferenças indispensáveis.
