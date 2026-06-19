## Objetivo
Em todas as tabelas do site, adicionar uma linha final fixa que soma os valores das colunas numéricas (montantes monetários e contagens), respeitando os filtros activos.

## Mudanças

### 1. `DataGrid` — totais automáticos
**`src/components/data-grid.tsx`**
- Adicionar `<TableFooter>` sticky no fundo do scroller (bg-muted/70 backdrop-blur) com fila "Total".
- Para cada coluna visível:
  - Se a coluna tem `aggregationFn === "sum"` → soma sobre `table.getFilteredRowModel().rows` (não inclui linhas de grupo, respeita filtros).
  - A primeira coluna sem soma mostra o label "Total" + contador `(N linhas)`.
  - Demais colunas ficam vazias.
- Render: usa `<CurrencyCell value={total} />` por defeito; suporta meta opcional `meta.totalFormat: "currency" | "number"` (número para contagens).

Cobre automaticamente:
- `movimentos.tsx` (débito, crédito)
- `index.tsx` ResumoProjetos (orçado, realizado, desvio)
- `index.tsx` ResumoRubricas (orçado, realizado, desvio)
- `ImportarExtratosTab.tsx` (débito, crédito)

### 2. Tabelas com `sortable-table`
**`src/components/sortable-table.tsx`** — exporta novo helper `TableTotalsRow({ cols })` que renderiza um `<TableRow>` em `<TableFooter>` com:
- Label "Total" na primeira coluna.
- Para cada `col`: se `format === "number" | "currency"` mostra soma; caso contrário célula vazia.
- Estilo `bg-muted/50 font-medium border-t-2`.

**`src/routes/_authenticated/centros-custo.tsx`**
- Adicionar `<TableFooter>` com somatórios:
  - Movimentos = Σ `c.linhas` sobre `sorted`
  - Projetos = Σ `edits[cc].projetos.length` sobre `sorted`

**`src/routes/_authenticated/contas-rubricas.tsx`**
- Footer com:
  - Contas = Σ `selected.length`
  - Movimentos = Σ `movimentosByRubrica(r.rubrica)`

### 3. `DashboardPeek` (`src/components/dashboard-peek.tsx`)
- Transações: adicionar `<tfoot>` com totais de crédito e débito (somados sobre `data.transacoes`).
- Orçamento: `<tfoot>` com total de valor.

### 4. Orçamento (`src/routes/_authenticated/orcamento.tsx`)
- Na tabela editável principal, adicionar `<TableFooter>` (após `<TableBody>`) com:
  - Label "Total" na primeira coluna.
  - Soma de `valor` sobre linhas filtradas (`table.getFilteredRowModel().rows`).
  - Formatação consistente com `CurrencyCell`.

### 5. Excluído
- `admin.tsx` — tabela só com texto/datas; sem coluna numérica.

## Resultado
Todas as tabelas mostram, na última linha (sticky quando a tabela é scrollável), o total dos valores das colunas numéricas. Os totais reflectem os filtros e a pesquisa actualmente activos.
