# Carteiras cadastrais para o Radar — 03/11/2026

## Escopo e regras
- OrgBRQDelivery continua como fonte de pessoas, clientes e vinculos; somente leitura.
- Pessoa ativa identificada por ID. Categorias derivadas de roles.ts: Hunter,
  Vendas Especializadas (Hunter Especializado), Delivery Manager (papel Delivery
  ou Farmer + Delivery, ou perfil isManager elegivel). Categorias podem coexistir.
- Carteira comum: person_customer_assignments. Especialista: associacao de
  specialist_hunter_studio_assignments com studio_target_allocations pelo ID,
  ambos do ano selecionado. Uniao por pessoa/cliente, sem somar valores.
- Exportar somente IDs, nomes, papel/categoria e origem do vinculo. Sem email,
  notas, remuneracao, metas, receita, margem, fotos ou hierarquia.
- Cobertura comum e atual, sem historico cadastral; nao representar carteiras
  antigas como se fossem fatos historicos. Especializacoes informam o ano.

## Acesso e arquitetura
- UI de conexao em /integracoes/radar exige sessao normal do Org e confirmacao.
- Servidor emite delegacao opaca AES-GCM com finalidade fixa, validade maxima
  de uma hora e limitada pela expiracao da sessao. Apenas a API de catalogo
  aceita essa delegacao; nenhum token de acesso/refresh do Org sai para o Radar.
- Segredo de criptografia exclusivo do servidor, provisionado na Vercel.
- API descriptografa a sessao e revalida usuario/acesso, consultando como esse
  usuario, com RLS. Nenhum uso de service_role, nova policy ou grant.
- Popup transmite delegacao somente ao dominio oficial do Radar, apos consentimento,
  com estado aleatorio verificado pelo receptor e origem/janela fixas.
- Radar mantem delegacao somente em memoria; recarregar ou expirar exige reconectar.
- Acesso direto anonimo, sessao revogada, delegacao adulterada/expirada e roles
  bloqueados falham fechados; respostas privadas/no-store, sem segredos em logs.
- Repositorio de leitura dedicado com colunas explicitas, consultas limitadas,
  sem N+1, erro se houver truncamento; sem migrations ou alteracao das escritas.

## Aceite, riscos e validacao
- Consultar carteira por pessoa/categoria e a partir do detalhe do AE no Radar.
- Sugerir nome completo exatamente igual somente se unico; confirmar sugestao
  ou escolher ID explicitamente. Nunca associar por similaridade nem persistir nomes como chave.
- Preservar escopo RLS de viewer/hunter_viewer/admin/editor; resultado pode ser parcial
  pelo acesso autorizado, sem ampliar acesso para exibir mais clientes.
- Testar expiracao/adulteracao/proposito, sessao negativa, vinculos anuais,
  deduplicacao sem valores e ausencia/ambiguidade de nome. Executar validate,
  build, smoke critico e gates dos dois repositorios; revisar tela publicada.
- Risco residual: delegacao de leitura e bearer temporario, mantido so em memoria.
  Usuario e permissoes sao revalidados em cada consulta; logout isolado nao garante
  revogacao imediata de um bearer ja emitido. Expiracao ou rotacao da chave encerra
  sua validade. Nao e sincronizacao de cadastros.
