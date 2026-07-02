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
- A seleção de managers em Clientes usa duas listas, com itens disponíveis e
  selecionados, e permite mover um ou mais managers sem Ctrl/Cmd.
- Um duplo clique em um manager move o item para a outra lista.
- Ao salvar um cliente com sucesso, a tela exibe mensagem flutuante de
  confirmação.
- Erros ao salvar cliente aparecem como aviso flutuante sem exigir scroll.
- A tela de Clientes não oferece Hunters, Farmers ou papéis comerciais como
  responsáveis.
- A edição de pessoa permite selecionar Delivery, Farmer + Delivery, Hunter,
  Farmer ou Hunter + Farmer como tipo de atuação.
- Pessoas Hunter, Farmer e Hunter + Farmer podem ser usadas em metas/reporting,
  mas não aparecem como Manager responsável de Delivery enquanto `isManager` for
  falso.
- E-mail não é obrigatório na criação ou edição de Pessoa.
- Ao selecionar Hunter ou Hunter + Farmer, a lista de clientes disponíveis remove
  clientes já associados a outro Hunter.
- Ao trocar o perfil para Hunter ou Hunter + Farmer, clientes selecionados que já
  pertencem a outro Hunter são removidos automaticamente da seleção.
- O banco bloqueia associação de um mesmo cliente a dois Hunters por meio da
  tabela normalizada `person_customer_assignments`.
- O cargo "Diretor Comercial" aparece como sugestão no campo Cargo.
- A edição de pessoa permite vincular um ou mais clientes usando duas listas, com
  itens disponíveis e selecionados, e salva os vínculos ao gravar.
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
- O módulo Portfólio de Clientes renderiza a carga importada da planilha
  Financial BU.
- O módulo Portfólio de Clientes exibe Cliente, Diretor Responsável, Manager
  Responsável, Receita Atual, Meta Prevista, Receita Hunter, Receita
  Delivery/Farmer e Áreas / Studios quando aplicável.
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
- A tela de Metas bloqueia salvamento quando a soma das pessoas ultrapassa a
  meta total do cliente.
- Ao salvar uma meta com sucesso, a tela exibe mensagem flutuante de
  confirmação.
- Erros ao salvar meta aparecem como aviso flutuante sem exigir scroll.
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
- A rota Comparativo Baseline compara `metageralinicial.xlsx` contra o cadastro
  operacional por Cliente, Hunter e Hunter + Farmer.
- A rota Comparativo Baseline permite filtrar por ano, status e busca por
  cliente, e exporta CSV/Excel com valores numéricos.
- A importação de Insights aceita planilha sem coluna `resp` e trata total
  textual como Hunter + Renovação + Ampliação na linha afetada.
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
- Botões de exportação geram arquivos no navegador.
- Interface está em português; código e identificadores estão em inglês.
- `npm run lint`, `npm run typecheck` e `npm run build` concluem sem erros.
