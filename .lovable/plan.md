# Plano: 4 módulos de gestão financeira

Vou implementar em 5 fases. Cada fase é autocontida e testável.

## Fase 0 — Setup (DB + sidebar)

**Migração única** com as 5 tabelas (`financiadores`, `financiamentos`, `previsoes_tesouraria`, `relatorio_notas`, `alertas_financeiros`), respectivos GRANTs (`authenticated` + `service_role`), RLS e políticas permissivas para utilizadores autenticados (leitura/escrita sem filtro `user_id` — segue o padrão atual do projeto, que não associa dados a utilizador).

**Sidebar** (`AppShell.tsx`): novo grupo "FINANCIAMENTO" entre "FINANCEIRO" e "ESTRUTURA" com as 4 entradas e ícones (`Landmark`, `Waves`, `FileText`, `BellDot`). Badge no item Alertas via `useQuery(["alertas-count"])` com refetch a cada 2 min.

## Fase 1 — `/financiadores`

- Server fns: `listFinanciadores`, `upsertFinanciador`, `deleteFinanciador`, `listFinanciamentos({ financiadorId? })`, `upsertFinanciamento`, `deleteFinanciamento`.
- Layout 2 colunas (`md:grid-cols-[280px_1fr]`): painel esquerdo com lista de cards + opção "Todos"; painel direito com 4 SummaryCards, banner de alerta (≤30d), DataGrid e Sheets de criar/editar.
- Estado e "Por receber" coloridos conforme spec; linhas em atraso com fundo vermelho via `getRowClassName`.

## Fase 2 — `/tesouraria`

- Server fns: `listPrevisoes({ ano })`, `upsertPrevisao` (com expansão de recorrência até 24 ocorrências), `deletePrevisao`, `previsaoMensal({ ano })` (devolve entradas/saídas previstas + reais por mês a partir de `previsoes_tesouraria` + `resumo_transacoes_mensal` RPC existente), `importarDeFinanciamentos`.
- Secção 1: `ComposedChart` (barras Entradas/Saídas + linhas Saldo Acumulado previsto/real + `ReferenceLine` y=0) + 4 SummaryCards.
- Secção 2: tabela mensal com badges Realizado/Em curso/Previsto e expansão inline por mês.
- Secção 3: DataGrid de previsões + Sheet com toggle Entrada/Saída, categorias dinâmicas, recorrência, ligação a financiamento.

## Fase 3 — `/relatorio`

- Server fns: `getNotasRelatorio({ ano, projeto })`, `upsertNotaRelatorio`.
- Reutiliza `resumoDashboard` existente para Execução Orçamental e `listFinanciamentos` para Por Financiador.
- Barra sticky de controlos (ano, projeto, tipo, exportar CSV, copiar texto, gerar).
- Vista "Execução Orçamental": tabela com subtotais Receitas/Despesas/Resultado, pill de % execução, observações inline editáveis (upsert em `relatorio_notas`).
- Vista "Por Financiador": uma secção por financiador com subtotais e total geral.
- Vista "Resumo Executivo": bloco `pre` mono-spaced gerado em memória + botão copiar (clipboard + toast).
- Exportar CSV: helper local (`toCsv`) que serializa as linhas visíveis da vista ativa.

## Fase 4 — `/alertas`

- Server fns:
  - `countAlertas` — devolve nº de alertas ativos não resolvidos (para badge da sidebar).
  - `listAlertas({ filtro })`.
  - `resolverAlerta({ id })`, `marcarLido({ id })`.
  - `gerarAlertas` — calcula condições e faz upserts idempotentes verificando se já existe um alerta não-resolvido com `tipo` + chave em `dados` (ex.: `financiamento_id`, `rubrica`, `mes`). Não duplica.
- Conditions implementadas conforme spec usando: `financiamentos`, `resumoDashboard`, `previsoes_tesouraria`, `transacoes_extrato`, `orcamentos`.
- Chamadas a `gerarAlertas` em: load de `/alertas`, após `ImportarExtratosTab` salvar, após edição de orçamento.
- UI: 3 stat cards no topo, tabs de filtro, lista de cards com ícone por severidade, ações Ver/Resolver, empty state com `CheckCircle2`.
- Tempo relativo "há X dias" via helper local pequeno (sem nova dependência).

## Notas técnicas

- Todas as server fns: `createServerFn` + `requireSupabaseAuth` (padrão atual).
- Todas as queries com TanStack Query; invalidação consistente (`["financiamentos"]`, `["previsoes", ano]`, `["alertas"]`, `["alertas-count"]`).
- UI: shadcn `Sheet`, `Dialog`, `Tabs`, `Badge`, `Select`, `Checkbox`, `Textarea`, `Calendar`/`Popover` para date pickers (já presentes).
- Reutiliza `DataGrid`, `SummaryCard`, `CurrencyCell`, `fmtEur`, `MESES_CURTOS`, `MESES_LONGOS`, `formatDateBR`.
- Texto em pt-PT, moeda €X.XXX,XX, despesas a negativo+vermelho (já garantido pelas alterações anteriores).
- Sem dependências novas.

## Ordem de entrega

Vou entregar fase a fase para conseguires validar cada peça:

1. Migração + sidebar + página `/alertas` mínima (só para a badge não quebrar).
2. `/financiadores` completo.
3. `/tesouraria` completo.
4. `/relatorio` completo.
5. `/alertas` completo + `gerarAlertas` + hooks nas páginas existentes.

Confirmas que avanço assim, ou preferes outra ordem / queres ajustar algo antes?
