# Especificação funcional

## Navegação

Sidebar com Dashboard Executivo, Organograma, Pessoas, Áreas / Studios,
Clientes, Portfólio de Clientes, Metas, Metas por Pessoa, Relatório de Metas,
Comparativo Baseline, Insights, Análise de Desafio, Assuntos, Mapa de Cobertura, Configurações e Ajuda. O item Assuntos
fica visível como pausado/desabilitado até nova definição do modelo.
Ao navegar pelo menu ou mudar a rota/query, telas contextuais devem ser
remontadas para fechar modais, limpar filtros temporários e evitar que uma tela
como Clientes reabra presa no último cliente consultado.
Seletores usados para contexto de edição, pré-preenchimento de modal ou navegação
entre telas não devem reutilizar o mesmo estado de filtros da grade, exceto
quando a tela deixar claro que o seletor é um filtro. Ao trocar entre visões de
relatório, filtros ou seleções que não aparecem na nova visão devem ser limpos
ou ignorados para não esconder resultados sem indicação visual.
Usuários com perfil de acesso Consulta Hunter veem apenas Clientes, Relatório de
Metas e Ajuda. Nesse perfil, Clientes fica em modo leitura e limitado aos
clientes vinculados ao Hunter identificado pelo e-mail da Pessoa; Relatório de
Metas abre diretamente no detalhe do próprio Hunter, incluindo Hunter próprio e
Studio Hunter atribuído a ele, sem exibir demais visões ou demais hunters.

Em telas de celular, a experiência deve ser restrita a consultas simples e
relatórios básicos: Dashboard Executivo, Portfólio de Clientes, Relatório de
Metas, Baseline vs Cadastro e Ajuda. Rotas operacionais ou administrativas
devem permanecer visíveis na navegação, porém inibidas com indicação
"Disponível no desktop", e exibir uma mensagem orientando o uso em desktop ou
tablet quando acessadas diretamente, sem expor formulários largos, grades
operacionais ou ações de manutenção no mobile.

Cards de totais/KPIs devem usar o componente compartilhado do design system.
Valores financeiros em cards executivos devem aparecer em formato compacto
legível, como `R$ 108,7 mi`, sem quebra de linha no número; o valor completo
deve permanecer disponível em tooltip/acessibilidade.
Labels de KPIs devem caber no card sem cortar de forma ilegível, sem sobrepor o
valor e sem forçar o número para fora da área visível. A revisão de UX deve
tratar label quebrado, número grande demais, scroll horizontal desnecessário ou
cards desalinhados como bloqueio antes de produção.
Telas de análise executiva devem traduzir números críticos em sinais visuais
acionáveis, como ícones, status e tooltip de racional, principalmente quando a
decisão depende de benchmark, senioridade, cargo, mercado ou comparação com
meta. Essa regra deve fazer parte da revisão de UX para evitar telas que exibem
apenas números sem interpretação operacional.

## Fluxos CRUD

Cada tela de gestão apresenta busca/filtros, tabela responsiva e modal de cadastro
ou edição. Exclusões exigem confirmação do navegador.
Nas tabelas/listas editáveis, um duplo clique na linha abre a edição do item ou
leva diretamente para a tela operacional de ajuste correspondente.
Quando uma lista operacional tiver cabeçalhos clicáveis, a ordenação deve atuar
apenas sobre os itens já filtrados e indicar visualmente a direção crescente ou
decrescente.

## Clientes BU Financial

A tela de Clientes usa os clientes-fonte da planilha Financial BU como base
operacional. O formulário de novo cliente exibe Nome do cliente, Indústria,
Diretor responsável, Managers responsáveis, Hunter responsável, Conta
estratégica, Meta Hunter, Meta Renovação + Ampliação, Meta Áreas / Studios e
Meta Total calculada. A listagem e o formulário exibem a composição financeira
em Meta Hunter, Meta Renovação + Ampliação, Áreas / Studios e Meta Total, sempre
formatada em reais. A tela de Clientes é a base da meta do cliente: Meta Total é
calculada por Meta Hunter + Meta Renovação + Ampliação. Áreas / Studios é uma
subquebra contida para conciliação detalhada e não soma novamente no total do
cliente. A carga Financial BU pode sugerir a quebra inicial, mas após edição os
campos do cadastro do cliente são a fonte de verdade para as demais telas.
Margem deve ser tratada como margem-alvo informativa, com padrão de 35,8%,
sem apuração automática nesta versão.
Meta Hunter, Meta Renovação + Ampliação e Meta Áreas / Studios aceitam `0` como
valor válido. Campo em branco nesses campos deve ser interpretado como R$ 0 e
não pode bloquear o salvamento do cliente.
No formulário de Clientes, Meta Áreas / Studios não é editável diretamente.
Studio Hunter e Studio Manutenção/Renovação devem aparecer como valores
derivados e somente leitura, calculados pelas alocações em Metas por
Área/Studio no Cliente + Ano. A ação de ajuste deve levar para
`/metas-studios` com cliente e ano em contexto. Ao salvar o Cliente, esses
valores podem ser enviados apenas como cache compatível do ano, preservando
`studio_target_allocations` como fonte canônica.
Managers responsáveis representam governança Delivery da conta. O Hunter
responsável representa vínculo cadastral/comercial. Áreas / Studios classificam
pessoas e podem apoiar a execução, mas não substituem o manager responsável do
cliente.
Ao trocar o Hunter responsável de um cliente existente, se houver Meta Hunter ou
Studio Hunter do cliente/ano vinculados a outro Hunter, o sistema deve perguntar
se o usuário deseja transferir automaticamente essas metas para o novo Hunter.
Confirmar a pergunta transfere a Meta Hunter e as alocações de Studio Hunter
para o novo Hunter, consolidando linhas equivalentes quando necessário. Cancelar
mantém as metas e os vínculos financeiros com o Hunter atual, sem alteração
automática. Salvar o cliente sem trocar o Hunter principal não deve remover nem
transferir metas de outros Hunters associados ao mesmo cliente.
No modal de edição, a composição da meta também deve mostrar a distribuição por
pessoa no ano corrente, separando Hunter, Renovação + Ampliação, Áreas /
Studios e Total por pessoa. Quando parte da meta ainda não estiver alocada, a tela deve exibir uma
linha "Em aberto sem pessoa alocada"; quando houver alocação acima da meta do
cliente, a tela deve indicar o excedente e oferecer atalho para revisão em Metas
por Pessoa.
Na lista e no modal de Clientes, o status de reconciliação do cliente deve
considerar Studio Hunter como parte do componente Hunter alocado. Assim, a
comparação Hunter usa Meta Hunter direta das pessoas + Studio Hunter atribuído
em `studio_target_allocations`. Studio Manutenção/Renovação passa a compor a
meta Renovação + Ampliação de Farmers/Delivery quando a linha tiver pessoa
associada com perfil elegível. Linhas sem responsável elegível continuam no
componente de Áreas / Studios. Studio Hunter permanece
contido em Hunter e não soma novamente no Total do cliente.
A listagem principal de Clientes também deve exibir, por cliente e ano corrente,
quais pessoas compõem a meta Hunter, a meta Renovação + Ampliação/Farmer e a
meta Áreas / Studios, com os valores alocados por pessoa, derivados de
`revenue_target_allocations`.
Linhas de saldo "Em aberto" ou "Acima da meta" só devem aparecer quando houver
valor material visível em reais; diferenças residuais de centavos/arredondamento
que aparecem como R$ 0 não devem gerar linhas no grid.
Avisos de distribuição abaixo/acima da meta no modal de Cliente devem seguir a
mesma regra visual: se a diferença arredondada em reais for R$ 0, o aviso não
deve ser exibido.
Essas linhas devem considerar o saldo líquido total do cliente. Se Hunter estiver
abaixo da quebra sugerida e outra parcela estiver acima no mesmo valor -- por
exemplo Renovação + Ampliação ou Áreas / Studios -- e a soma das pessoas bater
com a meta total do cliente, não deve existir linha de pendência nem de
excedente.

O cadastro de cliente deve permitir zero, um ou vários managers responsáveis.
As regras automáticas de CA/Ane/Ana/Bruno/Orion/Fernanda/Bonfim são sugestões de
carga inicial e preenchimento rápido, mas não podem recolocar um manager removido
manualmente no momento de salvar. Cliente sem manager é um caso válido de
cobertura descoberta e deve ser tratado pelas telas de governança/assistente de
metas, não bloqueado pelo formulário.
O campo Diretor responsável deve oferecer a opção "Outros" para clientes vindos
da relação de contas que ainda não têm definição de diretoria. "Outros" é um
bucket transitório de governança do cliente, não uma pessoa que recebe ou
consolida meta. Ele pode aparecer em Clientes, Portfólio e dashboards por
diretor para leitura; não deve compor o Relatório de Metas por Diretoria
Delivery.

Listas operacionais da tela de Clientes não devem depender de IDs hardcoded. Os
diretores responsáveis devem vir das Pessoas ativas com perfil Diretor. Managers
responsáveis devem vir das Pessoas ativas marcadas como manager e elegíveis para
atuação operacional. Ao remover um manager de um cliente, as metas de Renovação +
Ampliação desse manager para o cliente devem ser removidas na mesma transação de
salvamento, mantendo a meta total do cliente e exibindo o saldo como pendente
sem pessoa alocada.

Ao salvar uma meta de Renovação + Ampliação positiva em Metas por Pessoa para uma
pessoa que é manager operacional, o sistema deve garantir a associação
manager-cliente em `person_customer_assignments`, com origem de sincronização de
meta. Metas Hunter não criam vínculo de manager de Delivery. Se a meta de
Renovação + Ampliação for zerada, apenas o vínculo criado pela tela de metas pode
ser removido; vínculos manuais da tela de Clientes devem ser preservados.
Metas de Renovação + Ampliação também podem ser distribuídas para pessoas de
Áreas / Studios quando essas pessoas tiverem perfil apto a receber meta direta.
Nesse caso, o Studio é classificação operacional da pessoa e a alocação continua
em `revenue_target_allocations`.
Defaults automáticos de diretor/manager podem preencher apenas novos clientes.
Durante edição de um cliente existente, blur, hidratação, troca de foco ou
reabertura da modal não podem reaplicar defaults nem restaurar Ana Braz ou outro
manager removido manualmente.

Na listagem principal de Clientes, a coluna de governança deve exibir apenas o
diretor responsável pelo cliente, como CA ou Ane Knust. Managers e pessoas que
compõem as metas devem ficar nas colunas seguintes, evitando duplicidade visual.

Na tela Metas por Pessoa, os valores de Hunter, Renovação + Ampliação e Áreas /
Studios exibidos
na coluna "Meta do Cliente" devem vir diretamente da base do cliente
(`customers.hunter_target`, `customers.farmer_renewal_target` e
`customers.studio_target`). Esses valores
funcionam como atalhos de alocação. Ao clicar em um valor, o sistema deve pedir
confirmação e, se houver saldo disponível não alocado a outras pessoas para
aquele tipo, salvar imediatamente a meta daquele tipo para a pessoa selecionada
no ano corrente da tela. Se não houver saldo disponível, deve exibir uma mensagem
clara orientando revisar as pessoas já associadas.
Cada linha da tela Metas por Pessoa deve permitir remover explicitamente o
cliente da pessoa selecionada. Essa ação deve pedir confirmação, remover o
vínculo pessoa-cliente em `person_customer_assignments` e apagar/zerar as metas
daquela pessoa para aquele cliente em `revenue_target_allocations`, evitando que
o cliente continue reaparecendo por metas antigas ou associação residual.
Essa tela deve suportar navegação contextual: links vindos da tela de Clientes
devem abrir Metas por Pessoa com o cliente em foco já selecionado. O usuário
então escolhe a pessoa lançável e edita diretamente aquele cliente, sem precisar
procurar manualmente na grade. Também deve ser possível trocar o cliente em foco
por um seletor explícito.

As telas executivas podem exibir clientes agrupados em clusters financeiros,
desde que o cadastro operacional preserve os clientes individuais como fonte de
verdade. O agrupamento deve ser uma camada derivada/analítica: metas, pessoas e
cobertura continuam gravadas nos clientes individuais, e as telas agrupadas
somam os valores e pessoas dos clientes pertencentes ao grupo.

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
- Managers responsáveis: pessoas ativas da BU Financial marcadas como
  `is_manager = true` e com perfil operacional elegível para governança de
  Delivery.

Ao informar o nome do cliente, o formulário aplica somente a governança padrão
de diretor quando aplicável. Pessoas responsáveis por Delivery, Farmer ou Hunter
não são preenchidas por default:

- Clientes-fonte de Itaú: diretor CA, sem manager default.
- Alelo e CIP/Núclea: diretor CA, sem manager default.
- Demais clientes: diretor Ane Knust, sem manager default.

Os dados continuam editáveis manualmente após a carga inicial. A tela permite
escolher zero, um ou mais managers de Delivery em qualquer cliente, derivados da
tabela Pessoas, sem lista operacional hardcoded no front e sem recolocar uma
pessoa default ao abrir, editar ou salvar. Hunters puros e papéis exclusivamente
comerciais ficam fora do cadastro de responsáveis de Delivery. A seleção de
managers deve usar uma interface de duas listas selecionáveis, permitindo mover
um ou mais managers entre disponíveis e selecionados sem depender de Ctrl/Cmd. Um
duplo clique sobre um manager deve movê-lo imediatamente para a outra lista. Ao
salvar com sucesso, a tela deve exibir uma mensagem de confirmação flutuante.
Erros de salvamento devem aparecer em aviso flutuante, sem alterar o layout do
formulário ou exigir scroll.
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
A lista de Pessoas deve indicar, para administradores, quando o e-mail da pessoa
também existe como usuário do sistema. O cruzamento é feito por e-mail
normalizado e deve exibir perfil e status do acesso sem alterar o cadastro da
pessoa.
Pessoas não devem ser excluídas no fluxo operacional de desligamento. O cadastro
de Pessoas usa ciclo de vida com status Ativo, Desativado e Encerrado/Desligado.
Ao desligar uma pessoa, o sistema deve gravar status Encerrado, data e motivo
opcional, marcar a pessoa como não ativa e preservar vínculos históricos, metas,
relatórios e remuneração. Pessoas encerradas deixam de aparecer como elegíveis
em listas operacionais que usam apenas pessoas ativas, mas continuam disponíveis
para histórico e auditoria.
Dados de remuneração não pertencem ao cadastro público de Pessoas. O salário
mensal deve ser persistido em `person_compensations`, com uma linha por pessoa,
e usado apenas para análises estratégicas. A Análise de Desafio anualiza esse
valor por 12 antes de comparar com metas anuais. O campo de salário só aparece e
só pode ser salvo por usuário BRQ ativo com perfil admin e cargo próprio de VP
ou Vice-presidente. A regra deve existir na UI para usabilidade e no banco por
RLS, porque salário é dado sensível.

## Configurações e Exportação Admin

A rota Configurações é restrita a administradores. Além do gerenciamento de
usuários, ela permite exportar a base operacional para trabalho externo em Excel
escolhendo apenas o ano. A exportação deve conter abas separadas para Pessoas,
vínculos Pessoa-Cliente, Clientes, Áreas/Studios, Assuntos, Metas de Clientes,
Metas por Pessoa e Alocações de Studios. Fatos financeiros anuais devem ser
filtrados pelo ano escolhido. Dados sensíveis de remuneração/salário armazenados
em `person_compensations` nunca entram nessa exportação.

## Acesso e Primeiro Login

O acesso é nominal por usuário no Supabase Auth, preservando auditoria, bloqueio
por pessoa e aplicação de RLS. O app pode usar BFF/API ou service role apenas em
rotas server-side para operações sensíveis deliberadas, nunca como identidade
única compartilhada por todos os usuários finais.

Administradores pré-cadastram e liberam e-mails BRQ na tela Configurações. Um
usuário pré-cadastrado ativo deve conseguir criar a primeira senha e entrar sem
aprovação manual adicional. Quando a configuração do Supabase exigir confirmação
de e-mail, usuários BRQ já pré-cadastrados e ativos devem ser auto-confirmados
no Auth pelo banco. Se o usuário esquecer a senha ou ficar em estado de tentativa
anterior, a jornada de Redefinir senha deve permitir recuperar o acesso pelo
link enviado ao e-mail corporativo.

## Análise de Desafio C-level

A rota Análise de Desafio é restrita a usuário BRQ ativo com perfil admin e
cargo próprio de VP ou Vice-presidente. Ela usa `person_compensations` como
fonte de salário mensal e `revenue_target_allocations` como fonte de metas por
pessoa/ano, além de `studio_target_allocations` como fonte derivada de Studio
Hunter atribuído. O salário mensal cadastrado deve ser anualizado por 12 para
calcular o múltiplo contra metas anuais. A tela deve ter visões alternáveis de
Hunters, Farmers e Delivery. Na visão Hunters, o valor analisado é a soma da
Meta Hunter própria da pessoa no ano mais o Studio Hunter atribuído a ela.
Studio Hunter entra apenas como derivação de visualização/análise, não como meta
direta gravada na pessoa. Na visão Farmers, o valor analisado é a soma de metas de
Renovação + Ampliação/Farmer. Na visão Delivery, o valor analisado é a soma de
metas sob responsabilidade de entrega, combinando Renovação + Ampliação e Áreas
/ Studios quando existirem no ano. O múltiplo de desafio é calculado como `meta
analisada / (salário mensal * 12)`.

As faixas internas iniciais são: Hunters adequado entre 4x e 8x; Farmers
adequado entre 3x e 6x; Delivery adequado entre 2x e 5x. Múltiplos abaixo da
faixa aparecem como desafio abaixo da referência; múltiplos acima aparecem como
desafio agressivo; pessoas sem salário aparecem como pendência de dado. Os
botões de visão e os status devem expor em mouse over o racional da tese: qual
meta está sendo comparada com salário e qual faixa de referência está sendo
usada. A tela exibe KPIs, tabela detalhada e uma leitura executiva gerada por IA
via rota backend interna. A chamada de IA não pode expor chave no navegador e
deve gerar uma leitura agregada/anônima, sem citar nomes de pessoas ou tomar
decisão individual de remuneração.

Além do status do múltiplo, a tabela deve mostrar uma avaliação indicativa de
mercado e senioridade com ícone, rótulo e tooltip de racional. Essa avaliação
usa a visão selecionada, o múltiplo calculado e uma senioridade inferida do
cargo/perfil para ajustar a faixa de referência. O sinal é apoio executivo para
triagem, não decisão automática de remuneração, promoção ou cobrança individual.

A tela também possui um Assistente de reavaliação. O usuário pode informar
contexto adicional em texto ou, quando o navegador suportar, ditar por voz em
pt-BR para preencher o campo. Ao acionar Reavaliar com IA, o backend deve enviar
à IA a análise calculada, a visão ativa, a faixa de referência e o contexto
adicional como hipótese temporária. Esse contexto não é persistido e não altera
salários, metas ou classificações calculadas; ele apenas recalibra o insight
executivo, distinguindo fatos medidos, hipóteses trazidas pelo usuário e
recomendações.
Cada reavaliação gera um baseline conceitual GEN AI para a visão/ano da sessão:
ele consolida conceitos existentes, hipóteses e aprendizados informados pelo
usuário para serem comparados contra os números oficiais cadastrados/calculados.
Esse baseline vira ponto de partida das próximas reavaliações da mesma visão/ano
na sessão da tela, mas não sobrescreve metas, salários, status, faixas de
referência ou qualquer registro oficial no banco.

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
de Meta Hunter própria e Meta Renovação + Ampliação própria para aquele
Cliente + Pessoa + Ano.
Ambas as telas usam `revenue_target_allocations` como fonte única de verdade.
Renovação + Ampliação pode ser distribuída entre managers, farmers/delivery e
pessoas dos Studios, desde que o perfil permita meta direta. O cadastro
Áreas / Studios não cria metas; apenas classifica pessoas para análise,
organograma e distribuição operacional.
Studio Hunter não é gravado como meta direta da pessoa em
`revenue_target_allocations`. A fonte de verdade dessa quebra é
`studio_target_allocations`, no grão Cliente + Área/Studio + Hunter + Ano. Nas
telas e relatórios de Hunter, o total exibido é derivado como Meta Hunter
própria + Studio Hunter atribuído, sem duplicar o valor na meta proprietária da
pessoa.
Excluir uma Área / Studio remove apenas a classificação dos registros
dependentes. Pessoas e territórios vinculados devem ficar sem área definida, e a
tela deve mostrar a contagem de vínculos antes da exclusão para evitar erro
técnico de chave estrangeira.
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
meta Hunter no cadastro do cliente, valores em aberto ou excedentes e
divergências entre soma das pessoas e meta total do cliente. Achados relacionados
ao cliente navegam para a tela Clientes com o cliente em edição. Achados
relacionados à associação de metas navegam para Metas por Pessoa com cliente e
ano pré-selecionados.

A rota Relatório de Metas apresenta visão por pessoa, diretoria de Delivery,
área/studio e Hunter. Na visão por pessoa e ano, exibe Meta Hunter, Meta
Renovação + Ampliação, Áreas / Studios, Meta Total, quantidade de clientes e
lista resumida de clientes. Cada pessoa do relatório deve navegar para Metas por
Pessoa com a pessoa e o ano pré-selecionados. A visão por Cliente consolida, no
grão Cliente + Ano, os Hunters envolvidos, Delivery Managers/Farmers
responsáveis e Hunters Especializados quando houver seleção gerencial de
Studios. Essa visão é derivada de vínculos pessoa-cliente, metas diretas,
alocações de Studio e seleções de Hunter Especializado; ela não cria nova fonte
de verdade. Ela deve exibir a meta total cadastrada do cliente, a meta ligada
pelas associações e a diferença entre os dois valores para conciliação. Deve
permitir alternar a visão entre com valores e sem valores; a opção sem valores
oculta números financeiros na tela e exportação, sem alterar a regra de
cobertura. Hunters nessa visão devem representar meta Hunter/Studio Hunter com
valor associado; se não houver nenhum Hunter com valor para o cliente, pode
aparecer somente o Hunter principal com valor zero. Vínculos comerciais
zerados adicionais não devem aparecer na coluna comercial. Na visão por diretoria de
Delivery, o usuário deve escolher uma pessoa consolidadora vinda do cadastro de
Pessoas: perfis Diretor ou pessoas ativas com subordinados apontando para seu
`people.directorId`. Após a escolha, o relatório abre os dados na chave Pessoa
-> Cliente -> Quebras,
sem repetir o nome da pessoa em cada linha. Dentro de cada pessoa, cada cliente
deve aparecer com subtotal e, abaixo dele, apenas as metas que compõem a meta
da pessoa naquele cliente. Metas diretas usam `revenue_target_allocations`
ligadas às pessoas com `people.directorId` igual ao diretor escolhido. Para
perfis Manager, Farmer e Delivery, a visão considera somente Renovação +
Ampliação direta; valores de Área/Studio não compõem a meta da pessoa nessa
visão, pois a abertura econômica do cliente já existe no relatório de Clientes.
Para perfis Hunter ou Hunter + Farmer, a visão também considera Meta Hunter
direta e Studio Hunter quando a pessoa é o `hunterPersonId` da alocação. Essa
soma é sempre derivada para visualização/relatório e não deve gravar Studio
Hunter como meta direta da pessoa.
Studio Manutenção permanece nas visões de cliente e de área/studio, não no
total da pessoa da diretoria. A tela deve mostrar subtotais por pessoa, por
cliente e total geral das pessoas da diretoria, permitindo que CA e Ana/Ane
tenham uma visão aberta das suas áreas sem hardcode de nomes no frontend. Não
há visão "meu relatório" nessa rota; a visão de Hunters já cobre o recorte
comercial individual.
Na visão de Hunters, sem Hunter selecionado, a tela mostra o consolidado por
Hunter. A tabela deve permitir selecionar um ou mais Hunters por checkbox; com
seleção ativa, a tela mostra o relatório detalhado no grão Hunter + cliente +
segmento + área/studio quando aplicável, separando Meta própria de Meta herdada
de Studios, com subtotais por Hunter + cliente e total selecionado. Meta Hunter
atual é a soma de Meta própria + Meta herdada de Studios; a linha herdada é
derivada de `studio_target_allocations` e não deve ser interpretada como novo
lançamento direto. A prévia e
exportação devem usar exatamente o modo ativo: consolidado quando não houver
Hunter selecionado e detalhado/explodido quando houver seleção.
A saída adicional "Planilha oficial" do Relatório de Metas gera uma planilha
`.xlsx` na aba `Resumo_Cliente`, no layout oficial Financial, com título em
`A1`, linha 2 em branco, cabeçalhos em `A3:I3`, filtro em `A3:I<n>` e as
colunas oficiais: BU/Área
Executivo, Executivo, Grupo Cliente, Cliente Faturamento, BU, Meta 2026,
Renovação (FARMER), Novo (HUNTER) e % Novo. Meta 2026 e % Novo devem sair como
fórmulas auditáveis por linha, seguindo o modelo Financial. Nas linhas do corpo,
`BU` usa `Financial`. Para linhas de Studio, `Cliente Faturamento` deve receber
o nome do Studio; linhas sem Studio não forçam o valor `10`. Na visão de
Pessoas, a Planilha oficial deve ser ordenada por pessoa: primeiro entram as
metas diretas da pessoa por cliente; em seguida, para o mesmo cliente, entram as
linhas de Studio Hunter atribuídas ao Hunter efetivo, porque Studio Hunter está
contido na meta Hunter da pessoa. Studio Manutenção/Renovação não deve aparecer
misturado nas pessoas; deve ser colocado ao fim da planilha, separado por chave
Studio + Cliente, preenchendo Renovação (FARMER) e deixando Novo (HUNTER)
zerado.
A visão Hunter x Clientes permite escolher um único Hunter e abrir a composição
por Cliente + Área/Studio + Ano, com linhas de Meta própria Hunter quando
existirem e linhas de Studio separando Studio Hunter e Studio
Manutenção/Renovação. Essa visão usa o Hunter efetivo da linha: Hunter
associado ao Studio ou, se vazio, Hunter principal cadastrado no cliente.
O total do cliente nessa visão também inclui metas de Renovação + Ampliação
alocadas em Delivery Managers/Farmers para os clientes do Hunter. Studio
Manutenção e Renovação + Ampliação aparecem para leitura operacional do cliente
e não alteram a meta Hunter. A prévia e exportação usam o mesmo grão detalhado
exibido em tela.
Na visão de Hunters Especializados, a tela mostra uma leitura gerencial cross.
Esse papel não possui Meta própria lançável nem Meta Renovação + Ampliação: os
valores são sempre derivados das alocações de Studios dos clientes vinculados à
pessoa, explodidos por Hunter Especializado, Cliente e Área/Studio. Em Metas por
Pessoa, Hunter Especializado aparece apenas em modo de consulta derivada; o valor
por cliente é limitado à meta de Studios do cliente, os campos de Meta própria e
Renovação ficam inibidos, e atalhos de clique para alocar meta do cliente ou
salvar/remover meta direta ficam desabilitados. A visão não altera totais
oficiais de cliente, pessoa, dashboard, baseline ou análise de desafio.
Para cadastrar a meta gerencial, a rota Metas Hunter Especializado deve usar uma
tela dedicada. Quando o usuário escolhe um Hunter Especializado em Metas por
Pessoa, a aplicação deve orientar a abertura dessa rota porque esse perfil não
recebe lançamento direto. Na rota dedicada, o usuário seleciona Hunter
Especializado e Ano, usa um bloco de nova inclusão para escolher Cliente e marcar
por checkbox as linhas de `studio_target_allocations` daquele cliente, e enxerga
em um segundo bloco a lista consolidada das seleções já cadastradas para a
pessoa/ano. Os totais do topo são recalculados pela soma da lista consolidada,
incluindo prévias ainda não salvas de forma visualmente distinta. A seleção é
persistida na relação `specialist_hunter_studio_assignments`. Essa seleção não
cria `revenue_target_allocations` e não altera subtotais oficiais do cliente.
Na visão de Áreas / Studios, a tabela deve permitir selecionar um ou mais
Studios por checkbox; com seleção ativa, a tela mostra e exporta o detalhe
explodido por Studio + cliente + segmento + Hunter Studio. Na visão por pessoa,
a tabela deve permitir selecionar uma ou mais pessoas para exportação. Quando
houver seleção ativa visível, CSV/Excel exportam apenas as pessoas
selecionadas; sem seleção ativa, a exportação continua usando a lista filtrada
completa. Antes de baixar, a ação de exportação deve oferecer uma prévia
formatada em tela usando exatamente as linhas que serão exportadas, incluindo
apenas a seleção ativa quando houver seleção.
O Relatório de Metas deve evoluir com uma visão "Clientes detalhado", voltada a
reconciliação executiva por cliente. Essa visão deve consolidar baseline,
meta atual do cadastro do cliente, composição alocada em pessoas, Studio Hunter,
Studio Manutenção, valor atual e diferenças, permitindo exportação formatada. O
grão é Cliente + Ano, com quebras internas por segmento e pessoa/studio. Para
Consulta Hunter, a visão de cliente detalhado deve respeitar o mesmo escopo de
clientes do Hunter.

As metas-base do cliente também são anuais. A chave canônica é
`customer_id + target_year` em `customer_target_years`; os campos financeiros
legados em `customers` existem apenas para compatibilidade durante a migração.
Telas com valores financeiros devem exibir e filtrar o ano de referência.

Na rota Metas por Pessoa, o combo Pessoa deve iniciar vazio quando não houver
`personId` na URL, obrigando o usuário a escolher uma pessoa antes de carregar a
grade ou incluir clientes. Os campos de Meta Hunter própria e Meta Renovação +
Ampliação própria devem ser inputs monetários largos, com prefixo visual de R$,
seleção automática ao focar e suporte a digitação em formato brasileiro, como
`11.033.497,00`.
O seletor "Cliente em foco" é um filtro explícito da grade. Ao escolher um
cliente, a grade deve exibir apenas esse cliente; ao escolher "Todos os clientes
da pessoa", a grade volta a exibir todos os clientes vinculados, com meta
existente ou incluídos manualmente. Quando um cliente adicional for incluído,
ele deve entrar na lista de clientes visíveis da pessoa e pode ser usado como
foco sem apagar os demais vínculos.
O grid também deve exibir, por cliente e ano, quais pessoas compõem a meta
Hunter, quais pessoas compõem a meta Renovação + Ampliação/Farmer e quais
pessoas compõem Studio Hunter pelas alocações de Áreas / Studios, incluindo
valores por pessoa/hunter. Quando a pessoa selecionada tiver valor digitado
ainda não salvo, a linha deve indicar que aquela composição está em edição.

A rota Metas por Área/Studio deve permitir informar o Hunter associado à parcela
de Studio Hunter. O grão canônico para novas alocações de Studio passa a ser
Cliente + Área/Studio + Hunter + Ano, mantendo `hunter_amount` e
`maintenance_amount` no mesmo registro para a combinação. O Hunter informado é
atribuição comercial/financeira da parcela Studio Hunter, não manager
responsável de Delivery. A lista de Hunters deve vir de Pessoas ativas elegíveis
para Hunter, ou de pessoas que já possuam meta Hunter no cliente/ano, sem lista
hardcoded. A lista também deve incluir Hunters já associados ao cliente por
alocações de Studio Hunter no ano, e ao editar uma linha deve manter disponível
o Hunter gravado na própria linha mesmo que o filtro global esteja em outro
cliente. Dados legados sem Hunter devem continuar legíveis como "Hunter não
informado". Somente nesta tela, novas linhas com `hunter_amount` maior que zero
podem ser salvas sem Hunter associado; nesses casos o valor fica como Studio
Hunter a detalhar, entra na conciliação do cliente/studio e não soma no total de
nenhuma pessoa até que um Hunter seja associado.
Os campos Valor Hunter e Valor Manutenção/Renovação devem aceitar casas
decimais em formato monetário brasileiro, como `1.234,56`, preservando os
centavos ao editar e salvar alocações.
Ao abrir uma nova meta para um cliente que já possui Hunter associado no cadastro
ou Meta Hunter no ano, o campo Hunter associado deve vir sugerido como default,
sem alterar filtros globais nem gravar nada automaticamente.
Relatórios por Hunter devem somar `studio_target_allocations.hunter_amount`
apenas para o Hunter informado naquela alocação, evitando misturar clientes com
mais de um Hunter.
Na grade de alocações por Área/Studio, Studio Hunter e Studio Manutenção devem
aparecer visualmente segregados por tipo. Studio Hunter deve indicar que soma no
total do Hunter; Studio Manutenção deve indicar que soma na meta Renovação +
Ampliação do Farmer/Delivery associado, sem somar no Hunter.
Na conciliação de Metas por Área/Studio, se o detalhamento alocado por Studio já
superar a meta-base antiga do cliente, a tela deve considerar o detalhamento
como alvo efetivo exibido para evitar status "Acima" falso após edição da
própria abertura.
Ao abrir um cliente na conciliação por duplo clique ou pelo botão Alocar, se
houver mais de uma alocação candidata para o cliente/ano, a tela deve mostrar
uma etapa intermediária com todas as combinações Área/Studio + Hunter + valores.
Ao editar uma alocação existente e trocar o campo Área/Studio, a tela deve pedir
confirmação antes de salvar: o usuário escolhe entre atualizar/mover a meta
existente para o novo Studio ou criar uma nova meta mantendo a original
separada.
Ao editar uma alocação existente e trocar apenas o Hunter associado, a tela não
deve zerar Valor Hunter, Valor Manutenção/Renovação ou Observações. Se já existir
uma alocação para a combinação Cliente + Área/Studio + novo Hunter + Ano, essa
linha existente deve ser carregada; se não existir, os valores em edição devem
ser preservados para mover a alocação ao salvar.
O modal abre diretamente apenas quando houver zero ou uma alocação candidata.

Importações de baselines devem ficar centralizadas na rota Baselines. Insights e
Comparativo Baseline não devem manter upload próprio de planilhas oficiais; eles
podem orientar o usuário para a central ou consumir fotos já salvas. A central de
Baselines separa a Curva de Orçamento/Curva de Vendas principal das origens de
área/studio, como PX, Alianças, Mobile, Analytics e GENAI. Cada origem pode ter
layout de planilha próprio. Grupo visual da planilha não é conceito de domínio:
para baselines por área/studio, valem Cliente, tipo de receita
Manutenção/Renovação ou Novo/Hunter, valor e a origem selecionada.

A rota Baselines permite importar uma planilha `.xlsx` de baseline de metas com
as colunas Cliente, BU, Target RL Hunter, Target RL Farmer e Total RL 2026,
aceitando uma coluna opcional de `resp`. O batimento de Studios da Curva
principal é extraído da aba `Sheet1` e fica somente na visão detalhada de
Baseline de Studios, sem entrar na grade principal de clientes. A importação não
sobrescreve a base automaticamente. Primeiro o sistema
compara cliente a cliente contra `customer_target_years` do ano selecionado e
valida se o responsável Hunter da planilha está consistente com as pessoas e
metas Hunter cadastradas. As divergências aparecem em uma grade com checkbox por
cliente. Só os itens marcados pelo usuário atualizam a base canônica anual.
Na validação de Hunter, o campo `resp` é apenas uma referência de leitura da
planilha. A conferência financeira deve comparar `Target RL Hunter` com a soma
de todas as metas do tipo Hunter alocadas no sistema para o Cliente + Ano,
incluindo múltiplos Hunters e pessoas de outros perfis que tenham meta Hunter
declarada, mais as alocações de Studio Hunter atribuídas ao Hunter no mesmo
cliente/ano. Studio Manutenção continua fora do total Hunter; quando tiver
Farmer/Delivery elegível associado, compõe Renovação + Ampliação da pessoa. A
composição/responsável Hunter da planilha é informativa e não deve
gerar divergência, alerta ou bloqueio quando Hunter, Renovação e Total do
cliente estiverem batidos. A mensagem de detalhe pode mostrar a composição das
pessoas, valores e origem que formam o total do sistema, sem atribuir a
diferença a uma única pessoa.
A importação deve respeitar as colunas financeiras da planilha: `Target RL
Hunter` compara com Meta Hunter, `Target RL Farmer` compara com Renovação +
Ampliação. `Total RL 2026` é exibido e validado contra Hunter + Renovação, mas
não cria divergência separada porque a Meta Total do cliente é derivada desses
dois componentes. Áreas / Studios não é comparado nem aplicado nesta grade
porque já tem batimento próprio por Cliente + Studio. O campo `resp` identifica
o responsável informado na planilha para análise, mas não reclassifica
automaticamente valores entre os componentes. Se a coluna Total vier com texto
não numérico em uma linha, o sistema deve usar Hunter + Renovação + Ampliação
como total efetivo daquela linha.
Na Curva principal oficial, a aba `Resumo RL 2026` possui mais de um quadro; o
baseline de clientes deve usar somente o segundo quadro Financial, procurando o
cabeçalho a partir da linha 125. Quadros anteriores da mesma aba são ignorados
para evitar duplicidade de clientes no upload. Como esse segundo quadro já é a
visão Financial, a coluna `BU` é opcional nele; quando ausente, as linhas
válidas são inferidas como `BU Financial`.

A rota Comparativo Baseline apresenta a foto inicial aprovada pelo board para o
ano de referência e compara essa foto contra o cadastro operacional atual. Para
2026, a fonte inicial é `metageralinicial.xlsx`: coluna A para Cliente, coluna I
para Meta Hunter, coluna L para Meta Renovação + Ampliação e coluna M para Meta
Total. Depois de aprovado, esse baseline é persistido em
`board_target_baselines`, com grão Cliente + Ano + Cenário, e passa a ser a fonte
canônica de leitura para Dashboard Executivo e Comparativo Baseline. O arquivo
local versionado permanece apenas como fallback técnico de desenvolvimento e
semente idempotente da migração. O baseline do board não é editável nessa tela;
ele é referência fixa para análise. A importação temporária de planilhas nesse
mesmo formato acontece na central de Baselines, não no Comparativo. Nenhum valor
é aplicado automaticamente: cada linha com cliente
cadastrado deve oferecer uma ação explícita para atualizar somente a meta anual
daquele cliente (`customer_target_years`), usando os valores da planilha ou do
baseline, sem alterar as metas cadastradas nas pessoas em
`revenue_target_allocations`. A tela permite alternar entre visão por Cliente,
visão Hunter e visão Hunter + Farmer, exibindo baseline, cadastrado, diferença,
status e exportação CSV/Excel. Diferença positiva significa cadastrado acima do
baseline e deve ser tratada como upside; diferença negativa significa débito
contra o baseline.
A tela deve apresentar, logo no início, uma escolha clara entre as áreas de
trabalho "Board vs Cadastro" e "Baseline de Studios", sem exigir rolagem para
descobrir uma funcionalidade principal. Cada área deve manter seus próprios
controles, KPIs e exportações.

A rota Baselines também permite importar uma planilha temporária de baseline de
Studios/Áreas por origem. O layout detalhado usa `SU`, `Torre`, `Grupo Cliente`,
`Studio/Habilitador`, `Tipo Opp` e `Receita Líquida`; layouts específicos por
origem podem usar colunas de Cliente, Renovação/Manutenção e
Novos Projetos/Hunter. Essa importação é apenas comparativa e não sobrescreve
dados. O batimento deve mostrar três referências: baseline por
Cliente + Studio vindo da planilha, alocação detalhada em
`studio_target_allocations` por Cliente + Área/Studio + Hunter + Ano e baseline
de Studio vindo da Curva principal do cliente (`customer_target_years` /
`customers.studioTarget`) no ano selecionado. Essa visão não deve misturar essas
origens como se fossem o mesmo fato. `Tipo Opp`
com Novo/Ampliação compõe Studio Hunter e deve bater contra valores alocados aos
Hunters ou pessoas que exercem papel de Hunter; demais tipos compõem Studio
Manutenção/Renovação e devem bater contra a manutenção alocada no próprio
Cliente + Studio. A leitura da planilha deve tolerar células `inlineStr` vazias
exportadas pelo Excel. Exportações desse batimento devem usar leitura executiva
no grão Cliente + Studio, com linhas separadas para Baseline Studio, Cadastrado
e Baseline Curva, e colunas de Hunter, Manutenção, Total e Diferença. Divergências
entre o nome/origem da planilha e o cadastro devem aparecer apenas como
indicativo contextual de origem quando existirem; quando estiverem consistentes,
não devem ocupar coluna nem poluir a visualização.
Quando a planilha manual de origem trouxer `BU` ou `CC CROSS`, somente linhas
`BU Financial` entram na prévia/snapshot. Quando a origem não trouxer coluna de
BU, como em planilhas PX simplificadas, a prévia deve permitir marcar
manualmente quais linhas Cliente + Studio são Financial. Os KPIs, exportações e
a ação de salvar foto devem considerar somente as linhas marcadas como
Financial, preservando as demais apenas como leitura/calibração antes do
salvamento.
A prévia da central de Baselines deve expor, por Cliente + Studio/Origem, os
valores do baseline importado, os valores alocados no sistema em Hunter e
Manutenção/Renovação, a baseline de Studio vinda da Curva principal, as
diferenças por componente e o total cadastrado no Cliente para Hunter,
Manutenção/Renovação, Studio Curva e Total. O diagnóstico visual deve
indicar se a divergência está em Hunter, Manutenção/Renovação ou nos dois. Para
legibilidade, cada Cliente + Studio/Origem deve aparecer em três linhas: uma
linha Baseline Studio, uma linha Cadastrado e uma linha Baseline Curva. Diferenças devem usar vermelho quando o
alocado estiver menor que o baseline, verde quando estiver maior e azul quando
estiver igual.
A central de Baselines deve carregar automaticamente a última foto salva para a
origem e o ano selecionados quando existir, sem exigir nova importação do mesmo
arquivo. O botão de salvar nova foto deve permanecer habilitado apenas após uma
nova importação.
Ao importar a Curva principal na central de Baselines, a aplicação também deve
criar/atualizar automaticamente a foto `Baseline geral de Studios` para o mesmo
ano, usando a aba `Sheet1` da própria Curva. A extração detalhada de Studio deve
usar `Grupo Cliente` na coluna D como cliente, a coluna C como identificador
auxiliar de parceiro/fornecedor para regras de alianças, `Studio/Habilitador` na coluna L
como Studio, `Tipo Opp (Renovação/Novo-ampliação)` na coluna O para separar
Novo/Ampliação como Studio Hunter e demais tipos como Manutenção/Renovação,
`Total RL 2026` na coluna AH como valor e `CC CROSS` na coluna BR como filtro;
somente linhas com `BU Financial` entram na foto. Os buckets `Squad` e `Times`
da coluna L não entram nessa foto de baseline de Studios, pois representam o
bloco operacional principal da Curva e não o recorte de Studios/Habilitadores a
ser comparado contra as alocações detalhadas. Quando a coluna L vier como
`RESELL`, a linha entra somente se a coluna C, o cliente da coluna D ou o Revenue Stream da
coluna J identificarem uma aliança reconhecida: `Google LLC`, `Microsoft`,
`Amazon Web` ou `Datadog`/`Data Dog`. Quando a coluna L vier como
`Arquitetura`, somente linhas com coluna A/SU igual a `Weme`
viram `PX`; as demais ficam fora. Quando a coluna L vier como `Cloud`/`CLOUD`,
linhas cujo identificador da coluna C, cliente da coluna D ou Revenue Stream
indique `Managed Services` viram `Managed Services`;
a coluna J `Managed Services / FinOps` ou `Managed Services` fica como fallback
para a mesma classificação; linhas cuja coluna C, cliente da coluna D ou Revenue Stream
da coluna J indiquem `Google LLC`, `Microsoft`, `Amazon Web` ou `Datadog`/`Data Dog` viram,
respectivamente, `Alianças Google`, `Alianças Microsoft`, `Alianças AWS` e
`Datadog-Alianças`. A aba `Resumo RL 2026`
continua sendo a origem da curva/baseline de clientes; a aba `Sheet1` é usada
somente para derivar a baseline geral de Studios. Essa foto geral é comparativa e
não altera metas de clientes, metas de pessoas nem alocações de Studios; ela
serve para que o Comparativo Baseline carregue a última Curva como origem
canônica geral de Studios, em vez de depender de uma importação manual antiga de
planilha de Studios. A planilha `Visão Agrupada` pode ser usada como conferência
de teste de mesa do resultado, mas não deve virar função sistêmica nem ser
necessária como origem quando a Curva trouxer essas colunas.
Durante a importação da Curva principal, a tela deve exibir progresso por etapa
para indicar que o processamento está avançando: leitura do baseline de clientes,
interpretação dos clientes, leitura da aba `Sheet1`, comparação com o cadastro,
geração do baseline de Studios e salvamento da foto quando existir.
A visão de Baseline de Studios no Comparativo deve consumir a última foto salva
na central para a origem e ano selecionados, sem permitir upload ou gravação
local naquela tela. A visão deve permitir filtro por Status e por Studio. O
texto/coluna de critério deve explicar de forma operacional que `Tipo Opp`
Novo/Ampliação é Studio Hunter e compara com alocações Hunter, enquanto os
demais tipos são Manutenção/Renovação e comparam com a manutenção do
cliente/studio.
Após importar e calcular o batimento na central de Baselines, a tela deve permitir "Salvar foto do
resultado". Essa foto é um snapshot imutável do resultado calculado naquele
momento, com ano, nome do arquivo, totais e linhas exibidas/exportáveis. Salvar
a foto não altera metas de cliente, metas de pessoas nem alocações de Studios;
serve para auditoria e rastreabilidade executiva.
Ao abrir a visão Baseline de Studios, se existir snapshot salvo para o ano
selecionado, a tela deve carregar automaticamente a foto mais recente e indicar
que se trata da última foto salva. Importar uma nova planilha substitui
temporariamente essa foto por uma comparação recalculada; limpar o baseline
remove a visualização atual sem apagar o snapshot salvo.

A rota Ajuda deve disponibilizar um guia rápido simples em PDF, publicado como
link estático, com instruções de uso para homologadores.

O Dashboard Executivo também apresenta uma visão financeira resumida dos clientes
Financial, com os totais de baseline aprovados pelo board destacados como alvo
oficial do ano, o total cadastrado no sistema e a diferença cadastro vs board.
As visões analíticas continuam exibindo ranking de clientes por meta, abertura
por Diretor e abertura por subordinado/manager.

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
- Áreas / Studios.

Campos do cadastro de Metas:

- Cliente.
- Pessoa.
- Tipo de Meta: Hunter, Renovação + Ampliação ou Áreas / Studios.
- Ano.
- Valor da Meta.
- Observações.

Campos da associação de Metas por Pessoa:

- Pessoa.
- Ano.
- Cliente.
- Meta Hunter do Cliente.
- Meta Renovação + Ampliação do Cliente.
- Meta Áreas / Studios do Cliente.
- Já associado a outras pessoas, separado por Hunter, Renovação + Ampliação e
  Áreas / Studios.
- Gap após edição, separado por Hunter, Renovação + Ampliação e Áreas / Studios.
  O gap deve seguir o sinal `alocado - meta`: positivo acima da meta em verde,
  negativo abaixo da meta em vermelho e zero reconciliado.
- Meta Hunter.
- Meta Renovação + Ampliação.
- Meta Áreas / Studios.
- Total associado.
- Origem do vínculo na tela: cliente associado, meta existente ou incluído na
  edição atual.
- Status de conciliação do cliente.

Regras do cadastro de Metas:

- Uma pessoa pode ter metas em vários clientes.
- Um cliente pode ter metas de várias pessoas.
- Para a mesma combinação Cliente + Pessoa + Tipo de Meta + Ano deve existir
  apenas um registro.
- A soma das metas das pessoas para um Cliente + Ano deve ser comparada com a
  meta total do cliente.
- A tela deve destacar clientes reconciliados, abaixo da meta e acima da meta.
  Acima da meta representa superação positiva e deve aparecer em verde. Abaixo
  da meta representa falta para bater a meta e deve aparecer em vermelho. O
  salvamento deve permitir que a soma das pessoas ultrapasse a meta total do
  cliente.
- A tela Metas por Pessoa deve quebrar a meta do cliente, o valor já associado
  a outras pessoas e o gap após edição em Hunter, Renovação + Ampliação e Áreas
  / Studios, para
  deixar claro onde falta ou sobra meta.
- Na tela Metas por Pessoa, quando uma alteração fizer a soma das metas das
  pessoas ultrapassar a meta atual do cliente, o sistema deve perguntar se o
  usuário deseja aumentar a meta do cliente pelo excedente. Se confirmado, a
  meta total do cliente é elevada antes de gravar a nova meta da pessoa; a
  mensagem deve indicar se o acréscimo veio de Hunter, Renovação + Ampliação,
  Áreas / Studios ou combinação desses componentes.
- Hunter é usado somente para atribuição/reporting de metas e não transforma a
  pessoa em responsável de Delivery do cliente.
- Renovação + Ampliação representa o crescimento e manutenção das squads
  existentes, trabalho de Farmer e Delivery Manager.
- A tela deve exibir uma visão anual por pessoa, com Meta Hunter, Meta Renovação
  + Ampliação, Áreas / Studios, Meta Total, quantidade de clientes atendidos e status de
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
- Na tela de Cliente, o seletor de responsáveis Farmer/Delivery deve aceitar
  pessoas ativas com perfil operacional elegível para renovação, incluindo
  Farmer, Delivery, Farmer + Delivery e Hunter + Farmer, mesmo quando o campo
  legado `isManager` ainda não estiver regularizado.
- O e-mail de Pessoa é opcional e, quando ausente, deve ser persistido como
  `null`.
- Para perfis Hunter e Hunter + Farmer, a lista de clientes deve permitir
  clientes já vinculados a outro Hunter ou Hunter + Farmer. A relação
  Pessoa-Cliente indica participação/reporting, não propriedade exclusiva do
  cliente.
- Um cliente pode ter mais de um Hunter. A distribuição financeira deve ser
  controlada por metas no grão Cliente + Pessoa + Tipo + Ano em
  `revenue_target_allocations` e por Cliente + Área/Studio + Hunter + Ano em
  `studio_target_allocations`, sem trigger de exclusividade Hunter em
  `person_customer_assignments`.
- Metas gerenciais de Hunter Especializado são uma relação Pessoa + Meta de
  Studio + Ano em `specialist_hunter_studio_assignments`. Essa relação só aponta
  para linhas existentes de `studio_target_allocations`, exige pessoa ativa com
  papel Hunter Especializado e não participa dos totais oficiais.
- Quando uma alocação de `studio_target_allocations` tiver Hunter associado, a
  pessoa deve enxergar o cliente em Metas por Pessoa mesmo sem meta direta em
  `revenue_target_allocations`. A associação deve ser reconhecida quando a linha
  de Studio tiver qualquer valor Hunter ou Manutenção/Renovação. Quando
  `studio_target_allocations.hunterPersonId` estiver preenchido, ele define o
  Hunter efetivo da linha; quando estiver vazio, o Hunter efetivo é o Hunter
  principal cadastrado no cliente. Somente o valor de Studio Hunter
  (`hunterAmount`) aparece como Studio herdado e compõe a Meta Hunter atual da
  pessoa sem duplicar a Meta própria.
- Para Manutenção/Renovação de Studio, a responsabilidade operacional deve ser
  declarada em `studio_target_allocations.maintenancePersonId`. Esse campo
  identifica o Farmer/Delivery responsável por incorporar a renovação elegível
  à meta da pessoa. O campo legado `hunterPersonId` permanece como fallback de
  leitura para linhas antigas até o backfill/edição natural regularizar o dado.
  Quando `maintenancePersonId` estiver preenchido, a declaração explícita de
  responsável prevalece para o rollup da pessoa mesmo que o papel cadastral
  ainda esteja desatualizado; no fallback legado por `hunterPersonId`, a pessoa
  só incorpora a renovação se tiver papel Farmer/Delivery elegível. Studio PX
  segue a mesma regra de incorporação dos demais Studios.
  Na Planilha oficial Financial, em todas as visões exportáveis, metas próprias
  devem ficar em linhas separadas de metas herdadas de Studio. A linha herdada
  deve trazer o nome do Studio em `Cliente Faturamento`, tanto para Studio
  Hunter quanto para Studio Manutenção/Renovação.
- Na tela de Clientes, a distribuição por pessoa e a lista de Hunters alocados
  devem considerar Studio Hunter atribuído a pessoas. A cobertura Hunter por
  pessoa usa `max(Meta Hunter direta, soma de Studio Hunter da pessoa)` para
  preservar o conceito de Studio contido em Hunter. A pessoa associada no campo
  Hunter do Studio, ou o Hunter principal do cliente quando o campo estiver
  vazio, deve aparecer como envolvida mesmo quando a linha tiver apenas Studio
  Manutenção, mas esse valor de manutenção não soma no total Hunter.
  Studio Manutenção elegível e com responsável declarado compõe a base de
  Renovação/Ampliação da distribuição por pessoa. Studio Manutenção sem pessoa
  elegível permanece como cobertura de área/studio do cliente e não deve gerar
  linha "Abaixo da meta sem pessoa alocada"; eventuais diferenças de manutenção
  fora de pessoa devem aparecer na conciliação de Áreas/Studios, não como
  pendência de Metas por Pessoa.
- O campo Cargo continua editável como texto livre, mas deve sugerir "Diretor
  Comercial", "Gerente Executivo de Vendas" e "Executivo de Negócios".
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
