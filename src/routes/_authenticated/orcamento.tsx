import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  ExpandedState,
  FilterFn,
  GroupingState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  listarOrcamentos,
  inserirLinhaOrcamento,
  atualizarLinhaOrcamento,
  apagarLinhasOrcamento,
  listarVersoesOrcamento,
  criarVersaoOrcamentoCsv,
  definirVersaoAtiva,
  apagarVersaoOrcamento,
} from "@/lib/orcamentos.functions";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Filter,
  GripVertical,
  Layers,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orcamento")({
  component: OrcamentoPage,
});

type Linha = {
  id: string;
  projeto: string;
  descricao: string | null;
  rubrica: string | null;
  tipo: "RECEITA" | "DESPESA";
  ano: number;
  mes: number;
  valor: number;
};

type FilterValue =
  | { operator: TextOp; value: string }
  | { operator: NumOp; value: string }
  | undefined;

type TextOp = "contains" | "equals";
type NumOp = "eq" | "gt" | "lt";

const TEXT_OPS: { value: TextOp; label: string }[] = [
  { value: "contains", label: "Contém" },
  { value: "equals", label: "É exatamente" },
];
const NUM_OPS: { value: NumOp; label: string }[] = [
  { value: "eq", label: "Igual a" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
];

const textFilterFn: FilterFn<Linha> = (row, id, filter: FilterValue) => {
  if (!filter || !filter.value) return true;
  const cell = String(row.getValue(id) ?? "").toLowerCase();
  const v = String(filter.value).toLowerCase();
  if (filter.operator === "equals") return cell === v;
  return cell.includes(v);
};

const numFilterFn: FilterFn<Linha> = (row, id, filter: FilterValue) => {
  if (!filter || filter.value === "" || filter.value == null) return true;
  const n = Number(filter.value);
  if (!Number.isFinite(n)) return true;
  const cell = Number(row.getValue(id));
  if (!Number.isFinite(cell)) return false;
  if (filter.operator === "gt") return cell > n;
  if (filter.operator === "lt") return cell < n;
  return cell === n;
};

function OrcamentoPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listarOrcamentos);
  const insertFn = useServerFn(inserirLinhaOrcamento);
  const updateFn = useServerFn(atualizarLinhaOrcamento);
  const deleteFn = useServerFn(apagarLinhasOrcamento);
  const listVersoesFn = useServerFn(listarVersoesOrcamento);
  const criarVersaoFn = useServerFn(criarVersaoOrcamentoCsv);
  const setAtivaFn = useServerFn(definirVersaoAtiva);
  const apagarVersaoFn = useServerFn(apagarVersaoOrcamento);

  const versoesQ = useQuery({
    queryKey: ["orcamento-versoes"],
    queryFn: () => listVersoesFn(),
  });
  const versoes = (versoesQ.data ?? []) as Array<{
    id: string;
    nome: string;
    ativa: boolean;
    ano: number;
    created_at: string;
  }>;

  // Anos disponíveis (todos os anos que têm pelo menos uma versão)
  const anosDisponiveis = useMemo(() => {
    return Array.from(new Set(versoes.map((v) => v.ano))).sort((a, b) => b - a);
  }, [versoes]);

  const [anoSel, setAnoSel] = useState<number | null>(null);
  // Garante que anoSel está sincronizado com o que existe
  useEffect(() => {
    if (anosDisponiveis.length === 0) {
      if (anoSel !== null) setAnoSel(null);
      return;
    }
    if (anoSel === null || !anosDisponiveis.includes(anoSel)) {
      setAnoSel(anosDisponiveis[0]!);
    }
  }, [anosDisponiveis, anoSel]);

  const versoesDoAno = useMemo(
    () => versoes.filter((v) => v.ano === anoSel),
    [versoes, anoSel],
  );
  const versaoAtivaDoAno = versoesDoAno.find((v) => v.ativa) ?? null;
  const [versaoSelPorAno, setVersaoSelPorAno] = useState<Record<number, string>>({});
  const versaoSel = anoSel != null ? versaoSelPorAno[anoSel] ?? null : null;
  const versaoVisivel = versaoSel ?? versaoAtivaDoAno?.id ?? versoesDoAno[0]?.id ?? null;
  const versaoVisivelObj = versoes.find((v) => v.id === versaoVisivel) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["orcamentos", versaoVisivel],
    queryFn: () => listFn({ data: { versaoId: versaoVisivel } }),
    enabled: !!versaoVisivel,
  });

  const linhasRaw = (data ?? []) as Linha[];
  const linhas = useMemo(() => {
    const seen = new Map<string, Linha>();
    for (const l of linhasRaw) if (!seen.has(l.id)) seen.set(l.id, l);
    return Array.from(seen.values());
  }, [linhasRaw]);

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ["orcamentos"] });
    qc.invalidateQueries({ queryKey: ["orcamento-versoes"] });
    qc.invalidateQueries({ queryKey: ["resumo"] });
    qc.invalidateQueries({ queryKey: ["anos"] });
    qc.invalidateQueries({ queryKey: ["meses-disponiveis"] });
  };

  const updateMut = useMutation({
    mutationFn: (vars: Linha) => updateFn({ data: vars }),
    onSuccess: invalidarTudo,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao guardar"),
  });
  const insertMut = useMutation({
    mutationFn: (vars: Omit<Linha, "id"> & { versaoId: string }) =>
      insertFn({ data: vars }),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Linha adicionada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar"),
  });
  const deleteMut = useMutation({
    mutationFn: (ids: string[]) => deleteFn({ data: { ids } }),
    onSuccess: () => {
      invalidarTudo();
      setRowSelection({});
      toast.success("Linhas removidas");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao apagar"),
  });
  const uploadMut = useMutation({
    mutationFn: (vars: { nome: string; linhas: Omit<Linha, "id">[] }) =>
      criarVersaoFn({ data: { nome: vars.nome, ativar: true, linhas: vars.linhas } }),
    onSuccess: (r: any) => {
      invalidarTudo();
      if (typeof r?.ano === "number") {
        setAnoSel(r.ano);
        setVersaoSelPorAno((prev) => {
          const next = { ...prev };
          delete next[r.ano];
          return next;
        });
      }
      toast.success(`Nova versão criada (${r?.total ?? 0} linhas)`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro no upload"),
  });
  const setAtivaMut = useMutation({
    mutationFn: (id: string) => setAtivaFn({ data: { id } }),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Versão ativa atualizada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a ativar versão"),
  });
  const apagarVersaoMut = useMutation({
    mutationFn: (id: string) => apagarVersaoFn({ data: { id } }),
    onSuccess: () => {
      invalidarTudo();
      setVersaoSelPorAno({});
      toast.success("Versão apagada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao apagar versão"),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const onUploadCsv = async (file: File) => {
    try {
      const text = await file.text();
      const { parseOrcamentoCSV } = await import("@/lib/csv-parser");
      const res = parseOrcamentoCSV(text);

      if (res.cabecalhosEmFalta.length > 0) {
        toast.error(
          `Faltam cabeçalhos obrigatórios: ${res.cabecalhosEmFalta.join(", ")}. ` +
            `Aceito: centro de custos/projeto, descrição, mês (jan…dez ou 1-12), ano, valor, rubrica.`,
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const linhas: Omit<Linha, "id">[] = [];
      for (const agg of res.linhas) {
        for (let i = 0; i < 12; i++) {
          const v = agg.meses[i];
          if (!v) continue;
          linhas.push({
            projeto: agg.projeto,
            descricao: agg.descricao_conta,
            rubrica: agg.conta,
            tipo: agg.tipo,
            ano: agg.ano,
            mes: i + 1,
            valor: Math.round(v * 100) / 100,
          });
        }
      }

      if (linhas.length === 0) {
        toast.error("CSV sem linhas válidas (valores a zero ou em falta).");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const avisos: string[] = [];
      if (res.semValor) avisos.push(`${res.semValor} sem valor`);
      if (res.semMes) avisos.push(`${res.semMes} sem mês (distribuídas por 12 meses)`);
      if (res.semAno) avisos.push(`${res.semAno} sem ano (usado ${new Date().getFullYear()})`);
      if (avisos.length > 0) toast.message(`Avisos: ${avisos.join("; ")}`);

      const nome = new Date().toISOString().replace("T", " ").slice(0, 19);
      uploadMut.mutate({ nome, linhas });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro a ler CSV");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveCell = (row: Linha, patch: Partial<Linha>) => {
    const next = { ...row, ...patch } as Linha;
    if (JSON.stringify(next) === JSON.stringify(row)) return;
    updateMut.mutate(next);
  };

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([
    "select",
    "projeto",
    "descricao",
    "rubrica",
    "tipo",
    "ano",
    "mes",
    "valor",
  ]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<Linha>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        enableResizing: false,
        size: 36,
        minSize: 36,
        maxSize: 36,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Selecionar todos"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Selecionar"
          />
        ),
      },
      { ...textColumn("projeto", "Projeto", saveCell), size: 200 },
      { ...textColumn("descricao", "Descrição", saveCell), size: 280 },
      { ...textColumn("rubrica", "Rubrica", saveCell), size: 180 },
      {
        accessorKey: "tipo",
        header: sortHeader("Tipo"),
        filterFn: textFilterFn,
        meta: { filterType: "text" as const },
        size: 110,
        cell: ({ row }) => (
          <TipoCell row={row.original} save={saveCell} />
        ),
      },
      { ...numColumn("ano", "Ano", saveCell, 0), size: 90, enableGrouping: true },
      { ...numColumn("mes", "Mês", saveCell, 0), size: 90, enableGrouping: true },
      {
        accessorKey: "valor",
        header: sortHeader("Valor"),
        filterFn: numFilterFn,
        meta: { filterType: "number" as const },
        size: 130,
        enableGrouping: false,
        aggregationFn: "sum",
        cell: ({ row }) => (
          <EditableNumberCell
            value={row.original.valor}
            onSave={(v) => saveCell(row.original, { valor: v })}
            decimals={2}
            currency
            tone={row.original.tipo === "RECEITA" ? "receita" : "despesa"}
          />
        ),
        aggregatedCell: ({ getValue, row }) => {
          // Determine tone: if all subrows are same tipo, color accordingly; else use sign
          const subs = row.getLeafRows();
          const allReceita = subs.every((r) => (r.original as Linha).tipo === "RECEITA");
          const allDespesa = subs.every((r) => (r.original as Linha).tipo === "DESPESA");
          const n = Number(getValue() ?? 0);
          const tone = allReceita ? "receita" : allDespesa ? "despesa" : n >= 0 ? "receita" : "despesa";
          return (
            <div
              className={cn(
                "px-1 py-0.5 text-right text-sm font-semibold tabular-nums",
                tone === "receita"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {new Intl.NumberFormat("pt-PT", {
                style: "currency",
                currency: "EUR",
              }).format(n)}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({
    data: linhas,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      rowSelection,
      globalFilter,
      columnSizing,
      grouping,
      expanded,
    },
    getRowId: (r) => r.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
    globalFilterFn: "includesString",
  });

  const filteredFlatRows = table.getFilteredRowModel().flatRows;
  const summary = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    for (const r of filteredFlatRows) {
      const l = r.original as Linha;
      if (l.tipo === "RECEITA") receitas += Number(l.valor) || 0;
      else despesas += Number(l.valor) || 0;
    }
    return { receitas, despesas, saldo: receitas - despesas };
  }, [filteredFlatRows]);
  const fmtEur = (n: number) =>
    new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  const GROUPABLE: { id: string; label: string }[] = [
    { id: "projeto", label: "Projeto" },
    { id: "rubrica", label: "Rubrica" },
    { id: "tipo", label: "Tipo" },
    { id: "ano", label: "Ano" },
    { id: "mes", label: "Mês" },
  ];

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const visibleRows = table.getRowModel().rows;

  const reorderColumn = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const order = table.getState().columnOrder.length
      ? [...table.getState().columnOrder]
      : table.getAllLeafColumns().map((c) => c.id);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, sourceId);
    setColumnOrder(order);
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {linhas.length} linhas
            {anoSel != null && <> · Ano <span className="font-medium text-foreground">{anoSel}</span></>}
            {versaoVisivelObj && (
              <>
                {" · "}
                {versaoSel && versaoSel !== versaoAtivaDoAno?.id ? "A ver" : "Ativa"}:{" "}
                <span className="font-medium text-foreground">
                  {versaoVisivelObj.nome}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard label="Receitas" value={fmtEur(summary.receitas)} tone="receita" />
          <SummaryCard label="Despesas" value={fmtEur(summary.despesas)} tone="despesa" />
          <SummaryCard
            label="Saldo"
            value={fmtEur(summary.saldo)}
            tone={summary.saldo >= 0 ? "receita" : "despesa"}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          {anosDisponiveis.length > 0 && (
            <Select
              value={anoSel != null ? String(anoSel) : undefined}
              onValueChange={(v) => setAnoSel(Number(v))}
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {versoesDoAno.length > 0 && anoSel != null && (
            <Select
              value={versaoVisivel ?? undefined}
              onValueChange={(v) =>
                setVersaoSelPorAno((prev) => ({ ...prev, [anoSel]: v }))
              }
            >
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="Versão" />
              </SelectTrigger>
              <SelectContent>
                {versoesDoAno.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}
                    {v.ativa ? " (ativa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={versoesDoAno.length === 0}>
                Versões
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>
                Versão ativa do ano {anoSel ?? ""}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {versoesDoAno.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm"
                >
                  <Checkbox
                    checked={v.ativa}
                    onCheckedChange={(c) => {
                      if (c && !v.ativa) setAtivaMut.mutate(v.id);
                    }}
                  />
                  <span className="flex-1 truncate">{v.nome}</span>
                  {v.ativa && <Check className="h-3 w-3 text-primary" />}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      if (confirm(`Apagar versão "${v.nome}" e todas as suas linhas?`))
                        apagarVersaoMut.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadCsv(f);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploadMut.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploadMut.isPending ? "A importar…" : "Upload CSV"}
          </Button>
        </div>

        <div className="min-w-[200px] max-w-md flex-1 px-2">
          <Input
            placeholder="Pesquisar em todas as colunas…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="mr-2 h-4 w-4" />
                Agrupar
                {grouping.length > 0 && (
                  <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">
                    {grouping.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Agrupar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {GROUPABLE.map((g) => (
                <DropdownMenuCheckboxItem
                  key={g.id}
                  checked={grouping.includes(g.id)}
                  onCheckedChange={(v) => {
                    setGrouping((prev) =>
                      v ? [...prev.filter((x) => x !== g.id), g.id] : prev.filter((x) => x !== g.id),
                    );
                  }}
                >
                  {g.label}
                </DropdownMenuCheckboxItem>
              ))}
              {grouping.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => setGrouping([])}
                  >
                    Limpar agrupamento
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                  >
                    {c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            disabled={!versaoVisivel || anoSel == null}
            onClick={() => {
              if (!versaoVisivel || anoSel == null) {
                toast.error("Selecione uma versão primeiro");
                return;
              }
              insertMut.mutate({
                projeto: "Novo projeto",
                descricao: "",
                rubrica: "",
                tipo: "DESPESA",
                ano: anoSel,
                mes: 1,
                valor: 0,
                versaoId: versaoVisivel,
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Nova linha
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selectedIds.length === 0}
            onClick={() => {
              if (confirm(`Apagar ${selectedIds.length} linha(s)?`))
                deleteMut.mutate(selectedIds);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Apagar
            {selectedIds.length > 0 && ` (${selectedIds.length})`}
          </Button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="rounded-md border">
        <div className="max-h-[72vh] overflow-auto">
          <Table
            className="text-sm"
            style={{
              width: table.getTotalSize(),
              tableLayout: "fixed",
            }}
          >
            <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => {
                    const canDrag = h.column.id !== "select";
                    const isDragOver = dragOverCol === h.column.id;
                    return (
                      <TableHead
                        key={h.id}
                        style={{ width: h.getSize() }}
                        onDragOver={
                          canDrag
                            ? (e) => {
                                if (!dragColRef.current) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverCol !== h.column.id)
                                  setDragOverCol(h.column.id);
                              }
                            : undefined
                        }
                        onDragLeave={
                          canDrag
                            ? () => {
                                if (dragOverCol === h.column.id)
                                  setDragOverCol(null);
                              }
                            : undefined
                        }
                        onDrop={
                          canDrag
                            ? (e) => {
                                if (!dragColRef.current) return;
                                e.preventDefault();
                                const src = dragColRef.current;
                                dragColRef.current = null;
                                setDragOverCol(null);
                                if (src) reorderColumn(src, h.column.id);
                              }
                            : undefined
                        }
                        onDragEnd={() => {
                          dragColRef.current = null;
                          setDragOverCol(null);
                        }}
                        className={cn(
                          "group relative h-8 select-none whitespace-nowrap px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                          isDragOver && "bg-primary/10",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-1 pr-3">
                          {canDrag && (
                            <span
                              role="button"
                              aria-label={`Mover coluna ${h.column.id}`}
                              tabIndex={0}
                              draggable
                              onDragStart={(e) => {
                                dragColRef.current = h.column.id;
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => {
                                dragColRef.current = null;
                                setDragOverCol(null);
                              }}
                              className="-ml-1 inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1 overflow-hidden">
                            {h.isPlaceholder
                              ? null
                              : flexRender(
                                  h.column.columnDef.header,
                                  h.getContext(),
                                )}
                          </div>
                        </div>
                        {h.column.getCanResize() && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              h.getResizeHandler()(e);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              h.getResizeHandler()(e);
                            }}
                            onDragStart={(e) => e.preventDefault()}
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                            className={cn(
                              "absolute right-0 top-0 z-20 h-full w-2.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/60",
                              h.column.getIsResizing() && "bg-primary",
                            )}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
              {/* Filter sub-header */}
              <TableRow className="hover:bg-transparent">
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <TableHead
                    key={`f-${h.id}`}
                    style={{ width: h.getSize() }}
                    className="h-8 whitespace-nowrap px-2 py-1"
                  >
                    {h.column.getCanFilter() ? (
                      <FilterPopover column={h.column} />
                    ) : null}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    A carregar…
                  </TableCell>
                </TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Sem linhas.
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "h-8 border-b border-border/50",
                      row.getIsGrouped() && "bg-muted/40 font-medium",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isGrouped = cell.getIsGrouped();
                      const isAggregated = cell.getIsAggregated();
                      const isPlaceholder = cell.getIsPlaceholder();
                      return (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className="h-8 overflow-hidden whitespace-nowrap px-2 py-1 align-middle"
                        >
                          {isGrouped ? (
                            <button
                              type="button"
                              onClick={row.getToggleExpandedHandler()}
                              className="flex items-center gap-1 text-left hover:text-primary"
                              style={{ paddingLeft: `${row.depth * 12}px` }}
                            >
                              {row.getIsExpanded() ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="truncate">
                                {String(cell.getValue() ?? "—")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({row.subRows.length})
                              </span>
                            </button>
                          ) : isAggregated ? (
                            flexRender(
                              cell.column.columnDef.aggregatedCell ??
                                cell.column.columnDef.cell,
                              cell.getContext(),
                            )
                          ) : isPlaceholder ? null : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
            {!isLoading && visibleRows.length > 0 && (() => {
              const leafCols = table.getVisibleLeafColumns();
              const sumCols = leafCols.filter(
                (c) => (c.columnDef as any).aggregationFn === "sum",
              );
              if (sumCols.length === 0) return null;
              const filteredRows = table.getFilteredRowModel().rows;
              const totals = new Map<string, number>();
              for (const c of sumCols) {
                let s = 0;
                for (const r of filteredRows) {
                  const v = Number(r.getValue(c.id));
                  if (Number.isFinite(v)) s += v;
                }
                totals.set(c.id, s);
              }
              let labelPlaced = false;
              return (
                <TableFooter className="sticky bottom-0 z-10 bg-muted/70 backdrop-blur">
                  <TableRow className="border-t-2 hover:bg-transparent">
                    {leafCols.map((c) => {
                      const style = { width: c.getSize() };
                      if (totals.has(c.id)) {
                        const v = totals.get(c.id) ?? 0;
                        return (
                          <TableCell
                            key={c.id}
                            style={style}
                            className={cn(
                              "h-8 px-2 py-1 text-right font-semibold tabular-nums",
                              v >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {new Intl.NumberFormat("pt-PT", {
                              style: "currency",
                              currency: "EUR",
                            }).format(v)}
                          </TableCell>
                        );
                      }
                      if (!labelPlaced) {
                        labelPlaced = true;
                        return (
                          <TableCell
                            key={c.id}
                            style={style}
                            className="h-8 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            Total
                            <span className="ml-1 normal-case text-muted-foreground/70">
                              ({filteredRows.length})
                            </span>
                          </TableCell>
                        );
                      }
                      return <TableCell key={c.id} style={style} className="h-8 px-2 py-1" />;
                    })}
                  </TableRow>
                </TableFooter>
              );
            })()}
          </Table>

        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "receita" | "despesa";
}) {
  return (
    <div className="min-w-[140px] rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "receita"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}


/* Headers                                                                    */
/* -------------------------------------------------------------------------- */

function sortHeader(label: string) {
  return ({ column }: any) => (
    <button
      type="button"
      className="flex items-center gap-1 font-semibold uppercase tracking-wide"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Filter popover                                                             */
/* -------------------------------------------------------------------------- */

function FilterPopover({ column }: { column: any }) {
  const filterType = (column.columnDef.meta?.filterType ?? "text") as
    | "text"
    | "number";
  const current = column.getFilterValue() as FilterValue;
  const active = !!current?.value;
  const ops = filterType === "number" ? NUM_OPS : TEXT_OPS;

  const [operator, setOperator] = useState<string>(
    current?.operator ?? ops[0].value,
  );
  const [value, setValue] = useState<string>(current?.value ?? "");

  useEffect(() => {
    setOperator(current?.operator ?? ops[0].value);
    setValue(current?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.operator, current?.value]);

  const apply = (op: string, val: string) => {
    if (!val) column.setFilterValue(undefined);
    else column.setFilterValue({ operator: op, value: val });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-6 w-full items-center gap-1 rounded px-1.5 text-xs transition-colors",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Filter className="h-3 w-3" />
          <span className="truncate">
            {active
              ? `${ops.find((o) => o.value === current!.operator)?.label}: ${current!.value}`
              : "filtrar…"}
          </span>
          {active && (
            <X
              className="ml-auto h-3 w-3 shrink-0 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                column.setFilterValue(undefined);
              }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          <Select
            value={operator}
            onValueChange={(v) => {
              setOperator(v);
              apply(v, value);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ops.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            autoFocus
            type={filterType === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              apply(operator, e.target.value);
            }}
            placeholder="Valor…"
            className="h-8"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/* Editable cells (read mode by default, edit mode on click)                  */
/* -------------------------------------------------------------------------- */

function EditableTextCell({
  value,
  onSave,
  align = "left",
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") setEditing(true);
        }}
        className={cn(
          "min-h-6 cursor-text rounded px-1 py-0.5 text-sm hover:bg-muted/60",
          align === "right" && "text-right tabular-nums",
          !value && "text-muted-foreground/60",
        )}
      >
        {value ?? "—"}
      </div>
    );
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const v = draft.trim();
        if ((v === "" ? null : v) !== value) onSave(v === "" ? null : v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value ?? "");
          setEditing(false);
        }
      }}
      className={cn(
        "h-6 border-none bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary",
        align === "right" && "text-right tabular-nums",
      )}
    />
  );
}

function EditableNumberCell({
  value,
  onSave,
  decimals,
  currency,
  tone,
}: {
  value: number;
  onSave: (v: number) => void;
  decimals: number;
  currency?: boolean;
  tone?: "receita" | "despesa";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    if (!editing) setDraft(String(value ?? ""));
  }, [value, editing]);

  const formatted = currency
    ? new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: "EUR",
      }).format(value ?? 0)
    : decimals > 0
      ? new Intl.NumberFormat("pt-PT", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value ?? 0)
      : String(value ?? "");

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") setEditing(true);
        }}
        className={cn(
          "min-h-6 cursor-text rounded px-1 py-0.5 text-right text-sm tabular-nums hover:bg-muted/60",
          tone === "receita" && "font-medium text-emerald-600 dark:text-emerald-400",
          tone === "despesa" && "font-medium text-rose-600 dark:text-rose-400",
        )}
      >
        {formatted}
      </div>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      step={decimals === 0 ? 1 : 0.01}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = Number(draft);
        if (Number.isFinite(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(String(value ?? ""));
          setEditing(false);
        }
      }}
      className="h-6 border-none bg-transparent px-1 py-0 text-right text-sm tabular-nums shadow-none focus-visible:ring-1 focus-visible:ring-primary"
    />
  );
}

function TipoCell({
  row,
  save,
}: {
  row: Linha;
  save: (row: Linha, patch: Partial<Linha>) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "rounded px-1.5 py-0.5 text-xs font-medium hover:bg-muted/60",
          row.tipo === "RECEITA"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400",
        )}
      >
        {row.tipo}
      </button>
    );
  }
  return (
    <Select
      open
      value={row.tipo}
      onValueChange={(v) => {
        save(row, { tipo: v as Linha["tipo"] });
        setEditing(false);
      }}
      onOpenChange={(o) => {
        if (!o) setEditing(false);
      }}
    >
      <SelectTrigger className="h-6 border-none bg-transparent px-1 text-xs shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="DESPESA">DESPESA</SelectItem>
        <SelectItem value="RECEITA">RECEITA</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- */
/* Column definitions                                                         */
/* -------------------------------------------------------------------------- */

function textColumn(
  key: "projeto" | "descricao" | "rubrica",
  label: string,
  save: (row: Linha, patch: Partial<Linha>) => void,
): ColumnDef<Linha> {
  return {
    accessorKey: key,
    header: sortHeader(label),
    filterFn: textFilterFn,
    meta: { filterType: "text" as const },
    cell: ({ row }) => (
      <EditableTextCell
        value={(row.original as any)[key] ?? null}
        onSave={(v) => save(row.original, { [key]: v } as Partial<Linha>)}
      />
    ),
  };
}

function numColumn(
  key: "ano" | "mes" | "valor",
  label: string,
  save: (row: Linha, patch: Partial<Linha>) => void,
  decimals: number,
): ColumnDef<Linha> {
  return {
    accessorKey: key,
    header: sortHeader(label),
    filterFn: numFilterFn,
    meta: { filterType: "number" as const },
    cell: ({ row }) => (
      <EditableNumberCell
        value={(row.original as any)[key] as number}
        onSave={(v) => save(row.original, { [key]: v } as Partial<Linha>)}
        decimals={decimals}
      />
    ),
  };
}
