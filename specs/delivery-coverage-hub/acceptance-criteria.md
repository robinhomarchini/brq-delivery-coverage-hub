# Critérios de aceite

- Todas as rotas da navegação renderizam sem backend.
- KPIs refletem os dados atuais do store.
- O organograma mostra Robinson, os dois diretores, Renan como Staff e todos os
  managers solicitados.
- No organograma, cards de Diretores mostram a união dos clientes dos seus
  managers diretos, sem a seção Assuntos.
- No organograma, Robinson mostra a união dos clientes de todos os managers, sem
  a seção Assuntos.
- No organograma, a seção Assuntos não aparece em nenhum nível enquanto o módulo
  estiver pausado.
- Todos os colaboradores abaixo de Ane Knust e CA aparecem como Serviços
  Financeiros.
- O cargo de direção de Delivery aparece como "Diretor de Delivery", sem
  variação de gênero.
- CRUD atualiza tabelas, KPIs, gráficos e cobertura.
- Nas tabelas editáveis, duplo clique na linha abre o formulário de edição ou a
  tela operacional de ajuste daquele item.
- O mapa apresenta Diretor → Manager → Cliente.
- A carga inicial de clientes contém todos os clientes-fonte da planilha:
  AGIBANK, ALELO, ASA INVESTMENTS, ASSOCIAÇÃO OPEN FINANCE, B3, B3 IP,
  BANCO ABC, BANCO B3, BANCO BOCOM, BANCO BS2, BANCO ITAÚ S.A.,
  BANCO PACTUAL, BANCO RCI, BBTS, BRADESCO, BULLLA, CIP, CREDIT SUISSE,
  CRT4, CSF, CSU, EDENRED, FIS, FUNDAÇÃO ITAÚ, INTEL, LIVELO S.A., NEW LOGO,
  OPEA, PICPAY, PISMO, PROFESSIONAL SERVICES, QUOD, REDECARD, SANTANDER,
  SICOOB, SICREDI, TRAVELEX, VISA, VOTORANTIM, XP INVESTIMENTOS e ZURICH.
- O cliente Itaú aceita múltiplos managers responsáveis: Bruno, Orion, Fernanda
  e Ricardo Bonfim.
- A margem do cliente é exibida como margem-alvo informativa, com padrão de
  35,8%, sem cálculo de apuração real nesta versão.
- Os clientes-fonte de Itaú ficam com diretor CA e managers Bruno, Orion,
  Fernanda e Ricardo Bonfim.
- Alelo e CIP ficam com diretor CA e manager padrão Ana Braz.
- Os demais clientes Financial ficam com diretor Ane Knust e manager padrão Ana
  Braz.
- A edição de qualquer cliente permite selecionar um ou mais managers de Delivery
  entre Bruno, Orion, Fernanda, Ricardo Bonfim e Ana Braz.
- A edição de Cliente permite selecionar "Outros" no campo Diretor responsável
  para contas ainda sem definição de diretoria.
- Clientes com Diretor responsável "Outros" aparecem em Clientes, Portfólio e
  dashboards de diretor como bucket transitório, mas não aparecem como diretoria
  elegível no Relatório de Metas por Diretoria Delivery.
- A seleção de managers em Clientes usa duas listas, com itens disponíveis e
  selecionados, e permite mover um ou mais managers sem Ctrl/Cmd.
- Um duplo clique em um manager move o item para a outra lista.
- Ao salvar um cliente com sucesso, a tela exibe mensagem flutuante de
  confirmação.
- Erros ao salvar cliente aparecem como aviso flutuante sem exigir scroll.
- A tela de Clientes não oferece Hunters, Farmers ou papéis comerciais como
  responsáveis.
- A edição de pessoa permite selecionar Delivery, Farmer + Delivery, Hunter,
  Farmer, Hunter + Farmer ou Hunter Especializado como tipo de atuação.
- Pessoas Hunter, Farmer e Hunter + Farmer podem ser usadas em metas/reporting,
  mas não aparecem como Manager responsável de Delivery enquanto `isManager` for
  falso.
- Pessoas Hunter Especializado podem ser vinculadas a clientes para leitura
  gerencial cross, mas não aparecem como pessoa lançável em Metas por Pessoa nem
  podem receber meta direta no banco.
- E-mail não é obrigatório na criação ou edição de Pessoa.
- Ao selecionar Hunter ou Hunter + Farmer, a lista de clientes disponíveis
  mantém clientes já associados a outro Hunter.
- Ao trocar o perfil para Hunter ou Hunter + Farmer, clientes selecionados que já
  pertencem a outro Hunter permanecem na seleção.
- O banco permite associar um mesmo cliente a mais de um Hunter na tabela
  normalizada `person_customer_assignments`; a duplicidade proibida continua
  sendo Cliente + Pessoa + Tipo de Meta + Ano nas metas.
- Os cargos "Diretor Comercial", "Gerente Executivo de Vendas" e "Executivo de
  Negócios" aparecem como sugestões no campo Cargo.
- A edição de pessoa permite vincular um ou mais clientes usando duas listas, com
  itens disponíveis e selecionados, e salva os vínculos ao gravar.
- Para administradores, a lista de Pessoas mostra indicação de "Usuário do
  sistema" quando o e-mail da pessoa corresponde a um usuário de acesso,
  incluindo perfil e status do acesso.
- A tela de Pessoas permite desligar uma pessoa sem excluir o cadastro.
- Ao desligar uma pessoa, o sistema grava status Encerrado/Desligado, data de
  desligamento e motivo opcional, preservando histórico de metas, vínculos,
  remuneração e relatórios.
- Pessoas desligadas deixam de ser tratadas como ativas em listas operacionais,
  mas continuam disponíveis para histórico e auditoria.
- A tela de Pessoas permite reativar uma pessoa desligada ou desativada.
- O salário mensal da pessoa é salvo em `person_compensations`, separado do
  cadastro geral de Pessoas.
- O campo de remuneração só fica disponível para usuário BRQ ativo com perfil
  admin e cargo próprio de VP ou Vice-presidente.
- A tabela `person_compensations` possui RLS para impedir leitura ou gravação de
  remuneração por perfis não autorizados.
- A tela Configurações, restrita a administradores, permite exportar a base
  operacional escolhendo o ano.
- A exportação admin inclui abas operacionais para Pessoas, Clientes,
  Áreas/Studios, Assuntos, vínculos e metas/alocações do ano escolhido.
- A exportação admin não inclui dados de remuneração/salário nem campos da tabela
  `person_compensations`.
- Usuários BRQ pré-cadastrados e ativos pelo administrador conseguem criar senha
  no primeiro acesso sem depender de liberação manual adicional após o cadastro.
- Usuários BRQ pré-cadastrados e ativos são auto-confirmados no Supabase Auth
  quando a confirmação de e-mail do projeto bloquearia o primeiro login.
- A jornada Redefinir senha permite recuperar acesso de usuário já criado sem
  exigir intervenção manual do administrador.
- A autenticação permanece nominal por usuário final; service role ou usuário de
  serviço só pode ser usado em backend/BFF, sem substituir a identidade nominal
  do usuário no navegador.
- Administradores podem atribuir o papel Consulta Hunter a um usuário BRQ.
- Usuários com papel Consulta Hunter veem apenas Clientes, Relatório de Metas e
  Ajuda na navegação.
- Para Consulta Hunter, a tela Clientes fica em modo leitura, sem botões de
  novo, editar ou excluir, e mostra apenas clientes vinculados ao Hunter pelo
  e-mail cadastrado na Pessoa, por meta Hunter direta ou por Studio Hunter.
- Para Consulta Hunter, o Relatório de Metas abre diretamente no detalhe do
  próprio Hunter, mostrando Hunter próprio e Studio Hunter, sem seletor de
  outros Hunters e sem botão de ajuste de metas.
- A rota Análise de Desafio aparece na navegação apenas para usuário BRQ ativo
  com perfil admin e cargo próprio de VP ou Vice-presidente.
- A Análise de Desafio permite alternar entre visões Hunters, Farmers e
  Delivery.
- A Análise de Desafio calcula múltiplo como meta anual da visão dividida pelo
  salário mensal cadastrado anualizado por 12.
- A Análise de Desafio classifica Hunters como adequado entre 4x e 8x e Farmers
  como adequado entre 3x e 6x.
- A Análise de Desafio classifica Delivery como adequado entre 2x e 5x.
- A Análise de Desafio mostra no mouse over dos botões/status o racional da
  comparação e a faixa usada.
- A Análise de Desafio mostra avaliação indicativa de mercado/senioridade com
  ícone, status, senioridade inferida, faixa de referência e tooltip de racional.
- A avaliação de mercado/senioridade é apresentada como apoio executivo e não
  como decisão automática de remuneração ou cobrança individual.
- A leitura com IA é chamada por rota backend interna e não expõe chave OpenAI
  no navegador.
- A leitura com IA é agregada/anônima e não cita nomes de pessoas.
- A Análise de Desafio permite informar contexto adicional em texto para
  reavaliar o insight com IA sem persistir esse contexto.
- Quando o navegador suportar reconhecimento de voz, a Análise de Desafio
  permite ditar contexto em pt-BR e preencher o campo de contexto.
- A reavaliação com IA diferencia dados calculados, hipóteses informadas no
  contexto e recomendações, sem alterar salários, metas ou status calculados.
- A reavaliação GEN AI mostra o resultado da avaliação, os números oficiais
  refletidos e os conceitos/hipóteses aprendidos no baseline.
- O baseline GEN AI vira ponto de partida contextual das próximas reavaliações
  da mesma visão/ano na sessão da tela, sem persistir nem sobrescrever metas,
  salários, status ou faixas oficiais.
- No campo de contexto da Análise de Desafio, Enter aciona Reavaliar com GEN AI
  e Shift+Enter mantém quebra de linha.
- Cards de KPI compartilhados mantêm rótulos e valores legíveis, sem sobreposição
  ou estouro visual em Dashboard Executivo, Clientes, Metas, Relatórios e
  Análise de Desafio.
- Em telas de iPhone/mobile, a página principal não gera scroll horizontal; se
  uma consulta permitida tiver tabela larga, a rolagem horizontal fica limitada
  ao card/tabela, mantendo cabeçalho, KPIs, filtros e botões enquadrados na
  largura da viewport.
- O Mapa de Cobertura reflete os clientes vinculados na edição de Pessoas para
  montar a relação Manager → Cliente.
- A relação Pessoa ↔ Cliente é persistida em tabela associativa normalizada e
  os campos legados não são fonte de verdade.
- Ao salvar Pessoa ou Cliente, a tabela associativa normalizada é atualizada e as
  demais telas derivam seus dados dela.
- Um duplo clique em um cliente move o item para a outra lista.
- Ao salvar uma pessoa com sucesso, a tela exibe mensagem flutuante de
  confirmação.
- Erros ao salvar pessoa aparecem como aviso flutuante sem exigir scroll.
- Ao trocar o Hunter responsável no cadastro de Cliente, se existirem Meta Hunter
  ou Studio Hunter do cliente/ano em outro Hunter, o sistema pergunta se deve
  transferir automaticamente essas metas para o novo Hunter.
- A transferência automática ao trocar o Hunter responsável considera apenas o
  Hunter responsável anterior; outros Hunters ou Hunter + Farmer associados ao
  mesmo cliente permanecem vinculados e com suas metas preservadas.
- Ao cancelar a transferência de Hunter no cadastro de Cliente, as metas e
  vínculos financeiros permanecem com o Hunter atual.
- Salvar um Cliente sem trocar o Hunter principal não remove metas de outros
  Hunters associados ao mesmo cliente.
- Na tela Clientes, o status de reconciliação considera Meta Hunter direta +
  Studio Hunter como componente Hunter alocado, e Studio Manutenção como
  componente de Áreas / Studios.
- Na tela Clientes, Studio Hunter não soma novamente no total do cliente; ele
  apenas compõe a conferência do componente Hunter.
- Na tela Clientes, quando Meta Hunter direta e Studio Hunter detalhado existirem
  para o mesmo cliente/ano, a reconciliação usa o maior dos dois como cobertura
  Hunter e não soma os valores, evitando falso status "Acima".
- No detalhe de Cliente, Studio Hunter acima da abertura informativa não gera
  linha "Acima da meta"; apenas Studio Manutenção/Renovação pode gerar excedente
  no componente de Área/Studio.
- O módulo Portfólio de Clientes renderiza a carga importada da planilha
  Financial BU.
- O módulo Portfólio de Clientes exibe Cliente, Diretor Responsável,
  Delivery/Farmer, Hunter / Comercial, Receita Atual, Meta Prevista, Receita
  Hunter, Receita Delivery/Farmer e Áreas / Studios quando aplicável.
- A lista Delivery/Farmer e Hunter / Comercial do Portfólio considera todos os
  clientes-fonte do cluster e deriva participantes de `person_customer_assignments`,
  metas de pessoa e alocações de Studio, não apenas do campo de manager
  responsável do cadastro do cliente.
- O módulo Portfólio de Clientes apresenta dashboards por Diretor, Manager e
  Cluster de Cliente.
- O módulo Portfólio de Clientes compara Receita Atual e Meta Prevista por
  cliente/cluster.
- O módulo Portfólio de Clientes reconcilia Receita Hunter + Receita
  Delivery/Farmer + Áreas / Studios com o total Financial BU.
- A tela de Metas permite cadastrar, editar e excluir metas por Cliente, Pessoa,
  Tipo de Meta e Ano.
- A tela de Metas separa Tipo de Meta em Hunter, Farmer/Renovação e Áreas /
  Studios.
- A tela de Metas impede duplicidade para a mesma combinação Cliente + Pessoa +
  Tipo de Meta + Ano.
- A tela de Metas mostra a conciliação entre meta total do cliente e soma das
  metas das pessoas.
- A tela Metas por Pessoa mostra Meta do Cliente, Já associado a outras pessoas
  e Gap após edição quebrados em Hunter, Renovação + Ampliação e Áreas /
  Studios.
- A tela Metas por Pessoa grava apenas metas proprietárias diretas da pessoa em
  `revenue_target_allocations`; Studio Hunter permanece em
  `studio_target_allocations` e não é duplicado como meta direta.
- Para metas Hunter por pessoa, o campo editável é "Meta própria". A "Meta
  Hunter atual" é derivada automaticamente como Meta própria + Studio Hunter
  alocado para a mesma Pessoa + Cliente + Ano, e não é editável.
- A carga inicial de "Meta própria" usa a diferença entre a Meta Hunter total já
  cadastrada e a soma dos Studios Hunter daquele Hunter no mesmo Cliente/Ano,
  preservando o total atual.
- Em Metas por Pessoa, incluir ou focar um novo cliente adiciona uma linha à
  grade sem ocultar os clientes já vinculados ou com meta existente da pessoa.
- Em Metas por Pessoa, o cabeçalho de totais mostra também a base esperada das
  contas da pessoa: Hunter considera Meta Hunter, Delivery/Farmer considera
  Renovação + Ampliação e Hunter + Farmer considera ambas.
- Ao editar uma alocação em Metas por Área/Studio, o seletor Hunter associado
  traz o Hunter salvo na linha e os Hunters associados ao cliente por metas
  Hunter diretas, vínculo cadastral ou Studio Hunter no ano.
- Em Metas por Área/Studio, é permitido salvar Valor Hunter sem Hunter
  associado; o valor fica como Studio Hunter a detalhar, aparece na conciliação
  do cliente/studio e não soma no total de nenhuma pessoa até associação futura.
- A grade de Metas por Área/Studio separa visualmente Studio Hunter e Studio
  Manutenção, indicando que Studio Hunter é uma abertura contida na meta
  própria do Hunter e Studio Manutenção não soma no Hunter.
- Studio Manutenção/Renovação com responsável Farmer/Delivery elegível compõe a
  meta Renovação + Ampliação atual da pessoa, preservando a meta própria em
  `ownAmount`; Studio PX e linhas sem responsável elegível permanecem somente no
  componente de Áreas / Studios.
- O Relatório de Metas possui visão por Diretoria Delivery com seletor de
  pessoa consolidadora derivado do cadastro de Pessoas: perfis Diretor ou
  pessoas ativas com subordinados em `people.directorId`, sem hardcode de CA,
  Ana/Ane, alcosta ou qualquer outro nome.
- Ao escolher uma Diretoria Delivery, a tela mostra dados abertos com
  pessoa/bloco, cliente, segmento, área/studio quando aplicável e valor da
  pessoa.
- A visão por Diretoria Delivery usa a chave Pessoa -> Cliente -> Quebras, sem
  repetir o nome da pessoa nas linhas de detalhe.
- Na visão por Diretoria Delivery, perfis Manager, Farmer e Delivery somam
  Renovação + Ampliação direta mais Studio Manutenção/Renovação elegível, exceto
  PX; Studio Hunter só soma para pessoas com perfil Hunter/Hunter + Farmer
  quando a pessoa é o Hunter do studio.
- A visão por Diretoria Delivery mostra subtotais por pessoa, subtotais por
  cliente e total geral da diretoria.
- A visão por Diretoria Delivery pode ser exportada e pré-visualizada antes do
  download.
- A visão Hunters permite selecionar um ou mais Hunters por checkbox e exibe a
  composição detalhada da seleção com cliente, segmento, área/studio quando
  aplicável, valor alocado, subtotais por Hunter + cliente e total selecionado.
- O total do Hunter em relatórios e na Análise de Desafio usa a Meta Hunter
  atual derivada como Meta própria + Meta herdada de Studios.
- No detalhe de Hunters do Relatório de Metas, existe uma linha de Meta própria
  e linhas de Meta herdada de Studios por cliente/studio, sem duplicar Studio
  como novo lançamento direto.
- Na visão Hunters do Relatório de Metas, tela, prévia, CSV, Excel e Planilha
  oficial devem comunicar que a Meta herdada de Studios compõe a Meta Hunter
  atual e não representa uma segunda soma.
- O Relatório de Metas possui visão "Hunters Especializados" que explode valores
  por Hunter Especializado, Cliente e Área/Studio, sempre derivados de
  `studio_target_allocations` dos clientes vinculados à pessoa.
- A visão "Hunters Especializados" é apenas gerencial: não possui Meta própria,
  não exporta valores como total oficial e não altera dashboards, conciliações,
  baseline ou Análise de Desafio.
- A rota Metas Hunter Especializado permite selecionar Hunter Especializado,
  Cliente e Ano, listar as metas de Studio do cliente, marcar linhas por
  checkbox e salvar a seleção gerencial.
- Ao selecionar uma pessoa Hunter Especializado em Metas por Pessoa, a aplicação
  orienta a ida para Metas Hunter Especializado, mantendo pessoa e ano como
  contexto inicial.
- A rota Metas Hunter Especializado mostra dois blocos: Nova inclusão por
  Cliente e Seleções cadastradas por pessoa/ano. A lista cadastrada deve exibir
  as linhas já persistidas e destacar como prévia as linhas marcadas antes de
  salvar.
- O card totalizador da rota Metas Hunter Especializado atualiza Total
  selecionado, Studio Hunter selecionado, Studio Manutenção selecionado e Total
  disponível conforme os checkboxes mudam e conforme a lista consolidada muda.
- A seleção de Hunter Especializado é persistida em
  `specialist_hunter_studio_assignments` e o Relatório de Metas usa somente as
  linhas selecionadas para a visão Hunters Especializados.
- Em Metas por Pessoa, Hunter Especializado aparece somente em modo consulta:
  total por cliente vem dos Studios do cliente, limitado à meta de Studios do
  cliente, sem Meta Renovação + Ampliação editável, sem clique de alocação rápida
  e sem botão ativo para salvar/remover meta direta.
- A exportação/prévia da visão Hunters usa o consolidado quando nenhum Hunter
  está selecionado e o detalhe explodido quando há um ou mais Hunters
  selecionados.
- Na visão Hunters, ao selecionar Hunters por checkbox, a exportação usa a
  composição detalhada por Hunter, cliente, segmento e área/studio, em vez do
  consolidado.
- Na visão Áreas / Studios, é possível selecionar um ou mais Studios por
  checkbox e exportar o relatório detalhado com Studio, cliente, segmento,
  Hunter Studio e valor alocado.
- O Relatório de Metas oferece uma saída adicional "Planilha oficial" no modelo
  `FINANCIAL-Rateio Metas AEs`, com aba `Resumo_Cliente`, título em `A1`,
  cabeçalhos em `A3:I3`, filtro em `A3:I<n>` e as colunas BU/Área Executivo,
  Executivo, Grupo Cliente, Cliente Faturamento, BU, Meta 2026, Renovação
  (FARMER), Novo (HUNTER) e % Novo.
- Na Planilha oficial, as linhas do corpo preenchem `BU` com `Financial`; para
  linhas de Studio, `Cliente Faturamento` recebe o nome do Studio em vez de
  `10`.
- Na visão Pessoas, a Planilha oficial é ordenada por pessoa. Para cada pessoa,
  as metas diretas por cliente aparecem primeiro; linhas de Studio Hunter do
  Hunter efetivo aparecem logo depois da meta própria do mesmo cliente. Studio
  Manutenção/Renovação aparece no fim da planilha por chave Studio + Cliente.
- Quando a exportação do Relatório de Metas ou da tela Metas por Pessoa se
  refere a uma única pessoa, o nome do arquivo inclui o nome da pessoa em formato
  seguro para arquivo.
- O Relatório de Metas deve prever uma visão Clientes detalhado no grão Cliente
  + Ano, com baseline, meta atual, composição alocada por pessoa/studio, valor
  atual e diferenças; para Consulta Hunter, essa visão respeita o escopo de
  clientes do próprio Hunter.
- A tela de Metas permite salvar soma acima da meta total do cliente e mostra a
  diferença como positiva/verde.
- Diferenças abaixo da meta aparecem negativas/vermelhas em Clientes, Metas,
  Metas por Pessoa, Metas por Área/Studio, relatórios e exports.
- Seletores de contexto ou pré-preenchimento não escondem linhas existentes da
  grade quando a tela não os apresenta como filtro explícito.
- Ao trocar a visão do Relatório de Metas, filtros e seleções específicos da
  visão anterior não continuam atuando de forma invisível.
- Abrir um Cliente por link/query abre o cadastro correspondente sem preencher a
  busca da lista com o nome do cliente.
- Em Metas por Área/Studio, abrir ou alocar uma linha usa o cliente da linha como
  pré-preenchimento do modal sem alterar os filtros globais da tela.
- Em Metas por Área/Studio, ao clicar em Alocar na conciliação de um cliente que
  já possui alocações no ano, o modal abre a primeira alocação existente do
  cliente, respeitando filtros de Área/Studio e Hunter quando preenchidos.
- Em Metas por Área/Studio, quando o cliente possui mais de uma combinação
  Área/Studio + Hunter no ano, o duplo clique ou botão Alocar abre uma escolha
  intermediária com todas as combinações antes do modal de edição.
- Em Metas por Área/Studio, duplo clique em uma alocação abre o registro exato
  no grão Cliente + Área/Studio + Hunter + Ano, preenchendo cliente, área,
  hunter associado, ano, valores e observações já cadastrados.
- Em Metas por Área/Studio, ao selecionar Cliente + Área/Studio + Hunter + Ano
  de uma alocação já existente, o modal muda para edição e carrega os valores
  cadastrados antes de salvar.
- Em Metas por Área/Studio, ao abrir uma nova meta para um cliente com Hunter
  associado no cadastro ou Meta Hunter no ano, o campo Hunter associado vem
  preenchido como sugestão inicial.
- Em Metas por Área/Studio, trocar apenas o Hunter associado durante edição não
  zera Valor Hunter, Valor Manutenção/Renovação nem Observações; se a combinação
  já existir para o novo Hunter, os valores existentes daquela combinação são
  carregados.
- Em Metas por Área/Studio, ao trocar o Studio durante edição de uma alocação,
  a tela pergunta se deve atualizar a meta existente para o novo Studio ou criar
  uma nova meta mantendo a original separada.
- Em Metas por Área/Studio, as grades de conciliação e alocações abrem
  ordenadas por Cliente em ordem crescente.
- Ao salvar uma meta por Área/Studio, a tela valida cliente, área e ano antes de
  chamar o repositório; Hunter associado é opcional somente nesta tela.
- A tela Metas por Área/Studio salva apenas a alocação normalizada em
  `studio_target_allocations`; diferenças contra subtotais do cliente aparecem
  na conciliação, sem disparar atualização automática de Cliente durante o
  submit.
- Campos monetários de Metas por Área/Studio usam máscara visual em Reais no
  padrão `R$ 0`, preservando o valor numérico ao salvar.
- Ao salvar uma meta com sucesso, a tela exibe mensagem flutuante de
  confirmação.
- Erros ao salvar meta aparecem como aviso flutuante sem exigir scroll.
- Se uma pessoa estiver associada a um cliente apenas por Studio Hunter em
  `studio_target_allocations`, a tela Metas por Pessoa mostra esse cliente e
  soma o valor como Studio herdado no total da pessoa.
- Se uma pessoa estiver associada no campo Hunter de uma linha de Studio com
  qualquer valor Hunter ou Manutenção/Renovação, a tela Metas por Pessoa mostra
  o cliente para essa pessoa. Apenas o valor Hunter da linha soma como Studio
  herdado; Manutenção/Renovação não soma no total Hunter.
- Se uma linha de Studio não tiver Hunter associado explicitamente, a tela Metas
  por Pessoa usa o Hunter principal cadastrado no cliente como Hunter efetivo da
  linha.
- O Relatório de Metas, incluindo visão Pessoas, visão Hunters, prévia e
  exportações, usa a mesma regra de Hunter efetivo para linhas de Studio:
  primeiro o Hunter associado ao Studio e, se vazio, o Hunter principal
  cadastrado no cliente. Clientes como SICOOB/SICREDI não podem sumir do
  relatório da pessoa apenas porque a linha de Studio está sem `hunterPersonId`.
- O Relatório de Metas possui visão Hunter x Clientes com seletor único de
  Hunter. Ao escolher um Hunter, a tela exibe cliente, área/studio ou pessoa,
  origem, Studio Hunter, Manutenção/Renovação e total da linha, incluindo Meta
  própria Hunter quando existir, todas as linhas de Studio associadas ao Hunter
  efetivo e as metas de Renovação + Ampliação alocadas em Delivery
  Managers/Farmers para os clientes do Hunter.
- A exportação da visão Hunter x Clientes usa o mesmo detalhe exibido em tela e
  não transforma Studio Manutenção nem Renovação + Ampliação em meta Hunter;
  Manutenção/Renovação permanece como coluna informativa/operacional do cliente.
- Na tela Clientes, a lista de Hunters alocados e a distribuição por pessoa
  exibem Hunters vindos de Studio Hunter; quando a pessoa também possui Meta
  Hunter direta, a leitura usa o maior valor entre meta direta e Studio Hunter
  para não duplicar o mesmo componente.
- Na tela Clientes, a pessoa associada no campo Hunter do Studio aparece como
  envolvida mesmo quando a linha tiver apenas Manutenção/Renovação; esse valor
  não soma no total Hunter.
- Na tela Metas por Área/Studio, a grade e o seletor por Hunter exibem o Hunter
  efetivo da linha: Hunter associado no Studio ou, se vazio, Hunter principal do
  cliente.
- Na tela Clientes, Studio Manutenção não gera pendência "Abaixo da meta sem
  pessoa alocada" na distribuição por pessoa. A pendência por pessoa considera
  somente Hunter e Renovação que realmente precisem de pessoa; diferenças de
  Studio Manutenção ficam na conciliação de Áreas/Studios.
- As metas editáveis são persistidas em tabela normalizada
  `revenue_target_allocations` e não em campos duplicados de cliente ou pessoa.
- O Dashboard Executivo exibe uma visão financeira resumida dos clientes
  Financial.
- O Dashboard Executivo exibe a visão financeira por Diretor e por
  subordinado/manager.
- O Dashboard Executivo deriva a visão financeira de Clientes/metas anuais e
  mostra Hunter, Renovação + Ampliação e Áreas / Studios sem usar fonte
  financeira paralela.
- O Dashboard Executivo exibe os totais do board para 2026 como baseline oficial:
  Hunter R$ 110.525.090, Renovação + Ampliação R$ 427.744.200 e Total
  R$ 538.269.290, além do total cadastrado no sistema e diferença.
- O baseline oficial do board é persistido em `board_target_baselines` com chave
  lógica Cliente + Ano + Cenário, separado das metas operacionais editáveis em
  `customer_target_years`.
- Dashboard Executivo e Comparativo Baseline leem o baseline persistido pelo
  repositório; o arquivo local `boardTargetBaseline.ts` é apenas fallback técnico
  e seed idempotente da migration.
- A rota Comparativo Baseline compara `metageralinicial.xlsx` contra o cadastro
  operacional por Cliente, Hunter e Hunter + Farmer.
- A rota Comparativo Baseline permite filtrar por ano, status e busca por
  cliente, e exporta CSV/Excel com valores numéricos.
- A rota Baselines centraliza a importação de planilhas `.xlsx` temporárias de
  baseline para comparação no ano selecionado.
- Insights não renderiza o importador antigo e Comparativo Baseline não possui
  upload ou salvamento próprio de planilhas oficiais.
- No Comparativo Baseline, nenhum cliente é atualizado automaticamente após a
  leitura do baseline; o usuário escolhe a linha do cliente desejado e confirma a ação.
- A atualização por linha altera somente a meta anual do cliente, preservando as
  metas já cadastradas nas pessoas.
- No Comparativo Baseline, valores cadastrados acima do baseline aparecem como
  upside positivo/verde, e valores abaixo aparecem como débito negativo/vermelho.
- No Comparativo Baseline, clientes existentes no cadastro mas ausentes do
  baseline aparecem como "Cliente / receita nova", em azul.
- A importação de Insights aceita planilha sem coluna `resp` e trata total
  textual como Hunter + Renovação + Ampliação na linha afetada.
- Na importação de Insights, divergência de `Target RL Hunter` compara o valor
  da planilha com a soma de todas as metas Hunter do cliente/ano no sistema,
  incluindo múltiplos Hunters e pessoas de outros perfis com meta Hunter
  declarada, mais as alocações de Studio Hunter do cliente/ano.
- A mensagem de divergência Hunter em Insights mostra a composição das pessoas e
  valores do sistema, indicando origem Meta Hunter ou Studio Hunter, sem atribuir
  a diferença a um único responsável quando houver mais de uma alocação.
- A navegação não apresenta Territórios e mostra Assuntos como item
  desabilitado/pausado.
- A rota direta `/assuntos` renderiza uma mensagem de módulo em avaliação, sem
  CRUD ou visualização de dados.
- Nenhuma imagem é renderizada com `src` vazio na prévia do organograma.
- O papel `anon` não consegue ler nem alterar tabelas do domínio.
- Usuários fora do domínio `@brq.com` não conseguem criar sessão de acesso.
- Falhas de persistência aparecem na interface e não deixam alterações falsas no estado.
- Respostas HTTP incluem headers mínimos contra XSS, clickjacking e MIME sniffing.
- Filtros produzem resultados coerentes.
- A visão Baseline de Studios permite filtrar o batimento por Status e por
  Studio.
- Baselines separa Curva principal das origens PX, Alianças, Mobile, Analytics
  e GENAI, permitindo que cada origem evolua com layout próprio.
- Ao importar a Curva principal, o baseline geral de Studios é extraído da aba
  `Sheet1`, usando `Grupo Cliente` na coluna C, `Studio/Habilitador` na coluna
  L, `Tipo Opp` na coluna O para separar Novo/Ampliação de
  Manutenção/Renovação, `Total RL 2026` na coluna AH e filtrando `CC CROSS` na
  coluna BR igual a `BU Financial`; buckets `Squad` e `Times` não entram no
  baseline de Studios; `RESELL` não entra; `Cloud` é remapeado para
  `Managed Services` quando o cliente da coluna C for Managed Services ou a
  coluna J indicar Managed Services, e para Alianças Google/Microsoft/AWS quando
  o cliente da coluna C ou o Revenue Stream da coluna J indicar Google LLC,
  Microsoft ou Amazon Web; `Arquitetura`
  vira PX somente quando a coluna A/SU for Weme.
- Na importação da Curva principal, a curva de clientes vem da aba
  `Resumo RL 2026`; a aba `Sheet1` é usada para derivar a baseline geral de
  Studios.
- A curva de clientes importa somente linhas válidas de `BU Financial` da aba
  `Resumo RL 2026`, usando o segundo quadro oficial que começa na linha 125 e
  excluindo quadros anteriores, outras BUs, linhas zeradas e a linha `Total`.
  Quando esse segundo quadro não trouxer coluna `BU`, ele é tratado como
  Financial por definição.
- Na comparação da Curva principal, mensagens longas de divergência Hunter não
  devem alongar a linha da tabela; a grade mostra resumo curto e um botão de
  detalhes para abrir o racional completo.
- A grade da Curva principal não exibe a coluna `Resp. planilha` quando a
  planilha não trouxer responsável confiável por cliente.
- A importação da Curva principal não pode cair silenciosamente para a primeira
  aba quando `Resumo RL 2026` não for encontrada; a tela deve exibir erro claro
  de aba obrigatória ausente.
- A linha `Baseline Curva` da comparação de Studios usa o valor da própria
  Curva no grão Cliente + Studio/Habilitador, nunca o total de Studio do cliente
  inteiro repetido para cada Studio.
- A linha `Baseline Curva` da comparação de Studios separa Hunter e Manutenção
  usando `Tipo Opp` da coluna O da aba `Sheet1`: Novo/Ampliação entra em
  Hunter, e demais tipos entram em Manutenção/Renovação.
- A importação da Curva principal exibe progresso por etapa enquanto processa o
  arquivo, incluindo leitura do baseline, leitura de Studios, comparação,
  geração da foto e salvamento.
- Ao importar baseline manual de Studio/Área, linhas com BU/CC CROSS diferente
  de Financial são ignoradas quando a coluna existir.
- Ao importar baseline manual de Studio/Área sem coluna BU/CC CROSS, a prévia
  exibe checkbox por Cliente + Studio para marcar quais linhas são Financial.
- Salvar foto de baseline manual de Studio/Área grava somente as linhas
  marcadas como Financial.
- Para planilhas de origem de Studio/Área no layout largo, linhas de grupo são
  ignoradas; o domínio importado é Cliente + tipo de receita
  Manutenção/Renovação ou Novo/Hunter + valor + origem selecionada.
- A prévia de Baselines por área/studio mostra baseline importado, alocado no
  sistema, baseline de Studio vinda da Curva principal e diferença separada por
  Hunter e Manutenção/Renovação.
- Cada Cliente + Studio/Origem aparece em três linhas, uma `Baseline Studio`,
  uma `Cadastrado` e uma `Baseline Curva`, em vez de repetir todas as métricas em
  colunas separadas.
- Tabelas comparativas com sublinhas empilhadas usam componente compartilhado de
  célula com altura fixa por sublinha, largura mínima para rótulos e valores
  alinhados entre colunas; rótulos quebrados não podem desalinha valores.
- Tabelas operacionais e comparativas devem usar o componente compartilhado de
  cabeçalho ordenável. Na central de Baselines, a prévia por área/studio ordena
  por Cliente, Studio/Origem, valores, divergência e Status, e consolida linhas
  duplicadas no grão Cliente + Studio/Origem antes de renderizar ou exportar.
- A mesma prévia mostra os totais cadastrados no Cliente para Hunter,
  Manutenção/Renovação, Studio Curva e Total, permitindo comparação visual
  automática.
- Quando houver divergência, a linha indica se ela está em Hunter, em
  Manutenção/Renovação ou nos dois componentes.
- Diferenças visuais usam vermelho para alocado menor que baseline, verde para
  alocado maior que baseline e azul quando estiver igual.
- Ao selecionar origem e ano, a central carrega automaticamente a última foto
  salva quando existir; salvar nova foto exige uma nova importação.
- A central de Baselines mantém a última visão escolhida pelo usuário entre
  `Curva principal` e `Áreas / Studios`, e abre em `Curva principal` quando não
  houver preferência salva.
- A visão `Curva principal` carrega automaticamente a última importação de
  clientes salva para o ano selecionado, identificando arquivo e data, sem
  exigir reupload para rever a comparação.
- Ao abrir Baseline de Studios no Comparativo, a última foto salva em
  `studio_baseline_snapshots` para a origem e ano selecionados é carregada
  automaticamente e identificada como foto salva.
- A visão Baseline de Studios explica o critério de comparação: Novo/Ampliação
  vira Studio Hunter e bate contra alocações Hunter; demais tipos viram
  Manutenção/Renovação e batem contra manutenção do cliente/studio.
- Botões de exportação geram arquivos no navegador.
- A exportação do Relatório de Metas oferece prévia formatada antes do download.
- Quando houver pessoas selecionadas no Relatório de Metas, a prévia e o arquivo
  exportado mostram apenas a seleção ativa.
- Interface está em português; código e identificadores estão em inglês.
- `npm run lint`, `npm run typecheck` e `npm run build` concluem sem erros.
