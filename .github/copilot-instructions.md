# Constituição de Engenharia — BRQ Delivery Coverage Hub

Este documento define os princípios obrigatórios para todas as tarefas do GitHub Copilot Agent e para a equipe de engenharia deste repositório.

## Objetivo

Garantir que mudanças materiais sigam um padrão disciplinado, evitem correções apenas de sintoma e preservem a consistência entre dashboards, relatórios, exportações e comparações de baseline.

## Princípios fundamentais

1. **Fonte de verdade explícita**
   - Toda regra de negócio material deve apontar para uma fonte canônica de verdade.
   - Se a regra vive em código, ela deve ter documentação e/ou um arquivo de especificação associado.

2. **Regras de domínio fora da UI**
   - Financial, allocation, authorization e persistence rules são invariantes e não devem ser implementadas em componentes de apresentação.
   - UI pode aplicar validação de experiência, mas não deve ser a única camada que garante o comportamento correto.

3. **Uma única cálculo canônico**
   - Métricas compartilhadas devem ser calculadas em um único lugar e reutilizadas.
   - Evite duplicação de cálculo entre relatórios, exportações, dashboards e comparação de baseline.

4. **Separação de baseline**
   - Baseline board-approved e operational targets são fatos diferentes.
   - Não confunda baseline com meta operacional no mesmo fluxo de dados.

5. **Aplicação backend**
   - Invariantes críticas devem ser aplicadas no domínio, BFF, RPC, constraint, trigger, RLS ou em combinação apropriada.
   - UI não é limite de segurança.

6. **Sem identidades hardcoded**
   - Regras não podem depender de nomes fixos de pessoas, clientes, papéis, Studios ou labels de exibição.
   - Hardcode operacional é bug e risco de manutenção.

7. **Proteção contra regressão**
   - Todo defeito material deve gerar teste de regressão generalizado.
   - Não basta adicionar um caso especial; ato explicitamente a regra geral.

8. **Reconciliação cross-view**
   - Mudanças financeiras devem reconciliar Dashboard, Baseline Comparison, exportações oficiais, relatórios e valores persistidos.
   - Um conjunto de consumidores impactados deve ser listado e verificado.

9. **Validação adversarial**
   - Um passo de revisão deve tentar refutar a implementação.
   - Use exemplos contrários e cenários de quebra antes de concluir.

10. **Conclusão baseada em evidências**
    - O relatório final deve listar comandos realmente executados, resultados, verificações puladas e limitações conhecidas.
    - Presença de build/lint/typecheck sozinha não qualifica conclusão.

11. **Regra anti-loop**
    - Se duas correções consecutivas afetarem o mesmo conceito de negócio, pare e reavalie a causa raiz.

12. **Segurança de produção**
    - Produção nunca deve cair silenciosamente para mock ou local data.
    - Um fallback local só pode existir para desenvolvimento, não em produção.

13. **Segurança obrigatória**
    - RLS, RBAC, autenticação e autorização backend são limites obrigatórios, não conveniências de UI.

## Fluxo operacional obrigatório

Para mudanças materiais, siga esta sequência:

1. Leia esta Constituição.
2. Leia a especificação funcional relevante.
3. Identifique a fonte de verdade canônica.
4. Mapeie os consumidores afetados.
5. Defina exemplos de aceitação e contraexemplos.
6. Implemente na camada canônica.
7. Adicione testes de regressão.
8. Reconcilie todas as views afetadas.
9. Execute revisão adversarial.
10. Relate evidências.

## Comportamento anti-loop

Pare e reavalie quando ocorrerem quaisquer dos seguintes sinais:

- Duas correções tocam a mesma regra de negócio.
- Uma mudança faz uma view divergir de outra.
- O mesmo cálculo existe em múltiplos arquivos.
- Um delta financeiro relatado muda, mas não desaparece.
- Uma nova exceção é introduzida para nomes específicos.
- A invariante não pode ser explicada claramente.
- O mesmo teste de regressão é modificado repetidamente.

Quando isso acontecer, documente:

```
Observed symptom:
Canonical invariant:
Current implementations:
Duplicated logic:
Affected consumers:
Why previous fix was insufficient:
Generalized scenarios:
Canonical correction:
```

## Aplicação prática

- Este é o documento canônico para agentes Copilot e desenvolvedores em mudanças de produção.
- Referencie-o em PRs, revisões de código e documentação de tarefas.
- Use instruções especializadas apenas para fluxos de trabalho extras; não duplique o conteúdo principal aqui.

## Descoberta e uso

- Agentes devem começar por este arquivo.
- `AGENTS.md` e as instruções do projeto devem apontar para ele.
- Em caso de conflito entre instruções locais e esta Constituição, siga esta Constituição salvo justificativa documentada.

## Observações

- Este documento é propositalmente conciso.
- Regras detalhadas devem viver em arquivos especializados como `docs/`, `specs/`, `.squad/` ou `.github/workflows/`.
- Não copie todas as regras para vários arquivos; mantenha só referências.
