# Persistencia da area de atuacao de Pessoas

Data: 2026-10-30

## Dominio e fonte de verdade
- Area de atuacao e classificacao opcional da Pessoa, independente do vinculo
  operacional Area/Studio (`areaId`). Grao: uma classificacao por pessoa.
- Vocabulario ja existente: Vendas, Delivery, Outras; null significa nao informado.
- Fonte unica: people.business_area; sem inferir classificacao de papeis,
  nomes ou areas. Registros existentes continuam null, sem backfill inventado.
- Nao altera metas, periodos, clientes ou hierarquia. Nao e fato financeiro.

## Persistencia e autorizacao
- Migration aditiva forward-only com coluna nullable e check do vocabulario.
- Estender RPC existente com sobrecarga de assinatura completa (sem defaults
  ambiguos), delegando a assinatura anterior e gravando classificacao na mesma
  transacao. Clientes antigos preservam a classificacao ao usar RPC antiga.
- Preservar RBAC/RLS: admin/editor podem alterar; hunter_viewer nao pode mudar
  classificacao propria nem de terceiros. Revogar execute de public/anon na nova
  assinatura. Preferir security invoker e search_path fixo.
- Trigger focal de coluna aplica a mesma restricao a escrita direta permitida
  pelas policies legadas de Hunter; proteger somente insercao nao-null ou
  alteracao distinta, sem ampliar grants/RLS ou alterar outros campos.
- Adapter envia/le o campo em RPC, fallback existente e fetch, com tipo nullable.
- Formulario nao classifica silenciosamente registro sem valor como Vendas.

## Aceite e validacao
- Salvar e recarregar mantem cada valor permitido; limpar retorna null/undefined.
- Valor invalido e rejeitado no banco e validacao; chamadas nao autorizadas
  falham sem escrita parcial. Assinatura antiga continua utilizavel.
- Cobrir contrato de adapter e migration/RPC com regressao e smoke transacional
  equivalente ao papel real, sem deixar dados de teste na producao.
- validate, lint, typecheck, build, smoke:critical, test:security e performance.
- Conferir migration history antes/depois; aplicar migration antes do app.
- Revisar tela real, feedback e reload; publicar pelos scripts oficiais Vercel,
  verificar Ready e CI remoto. Nao executar reset, repair ou rollback automatico.

## Riscos e plano tecnico
- Adicao nullable sem default/backfill; nenhum indice novo (sem query nova).
- Lock de DDL curto; validar timeout e rollback da transacao em falha.
- Compatibilidade: migracao primeiro; app antigo ignora coluna nova. Recuperacao
  por deploy anterior mantendo estrutura aditiva, sem rollback automatico.
- Mudanca usa regras e contrato atuais; nao expandir para refatorar lifecycle
  ou fallback de persistencia preexistente.

## Evidencias de implementacao
- Adapter comportamental integrado a test:contracts: enum/null, RPC/fallback,
  reload e erro 42501 sem segunda escrita.
- Migration aplicada: 102 locais e remotas alinhadas. Suite pgTAP com 33 testes
  aprovada via CLI db query --linked --file, finish(true) e rollback.
- validate, build, smoke:critical, test:security e test:performance aprovados.
- Auditoria completa apos Zod 4.6.7: zero vulnerabilidades.
