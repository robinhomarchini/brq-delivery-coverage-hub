# Plano de testes

## Automatizado

- ESLint para qualidade estática.
- TypeScript sem emissão para contratos.
- Build Next.js para validar rotas e renderização.

## Manual

- [x] Navegar por todas as páginas.
- [x] Abrir formulário CRUD e verificar campos.
- [x] Confirmar dados e filtros disponíveis.
- [x] Confirmar a linha pontilhada do papel Staff.
- [x] Confirmar presença das três ações de exportação.
- [x] Verificar layout desktop e viewport móvel.
- [ ] Criar, editar e excluir um assunto vinculado a um cliente.
- [ ] Criar cliente Itaú e confirmar seleção múltipla de Bruno, Orion,
  Fernanda e Ricardo Bonfim.
- [ ] Criar cliente Alelo ou Núclea e confirmar diretor CA com Ana Braz.
- [ ] Criar cliente Financial diferente dos anteriores e confirmar Ane Knust com
  Ana Braz.
- [ ] Editar pessoa e selecionar mais de um cliente vinculado.
- [ ] Confirmar que a tela de Clientes não lista Hunters/Farmers/comercial como
  responsáveis.
- [ ] Abrir Portfólio de Clientes e confirmar KPIs de Receita Atual, Meta
  Prevista, Receita Hunter e Receita Delivery/Farmer.
- [ ] Filtrar Portfólio de Clientes por Diretor, Manager e Cluster de Cliente.
- [ ] Conferir que Receita Hunter + Receita Delivery/Farmer reconciliam com
  R$ 538.269.290.
- [ ] Filtrar o mapa por cliente e assunto.
- [ ] Exportar o organograma sem warning de `src` vazio.
