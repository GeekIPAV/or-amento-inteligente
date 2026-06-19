import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Plus,
  Trash2,
  Upload,
  Check,
} from "lucide-react";
import { toast } from "sonner";

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

const COLUMN_KEYS = ["projeto", "descricao", "rubrica", "tipo", "ano", "mes", "valor"] as const;

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
    created_at: string;
  }>;
  const versaoAtiva = versoes.find((v) => v.ativa) ?? null;
  const [versaoSel, setVersaoSel] = useState<string | null>(null);
  const versaoVisivel = versaoSel ?? versaoAtiva?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["orcamentos", versaoVisivel],
    queryFn: () => listFn({ data: { versaoId: versaoVisivel } }),
    enabled: !!versaoVisivel,
  });

  const linhas = (data ?? []) as Linha[];

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
    mutationFn: (vars: Omit<Linha, "id">) => insertFn({ data: vars }),
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
      setVersaoSel(null);
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
      setVersaoSel(null);
      toast.success("Versão apagada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao apagar versão"),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const onUploadCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        try {
          const parsed: Omit<Linha, "id">[] = [];
          for (const [i, raw] of res.data.entries()) {
            const projeto = (raw.projeto ?? "").trim();
            if (!projeto) continue;
            const tipoStr = (raw.tipo ?? "").trim().toUpperCase();
            if (tipoStr !== "RECEITA" && tipoStr !== "DESPESA")
              throw new Error(`Linha ${i + 2}: tipo deve ser RECEITA ou DESPESA`);
            const ano = Number(raw.ano);
            const mes = Number(raw.mes);
            const valorStr = String(raw.valor ?? "0").replace(/\s/g, "").replace(",", ".");
            const valor = Number(valorStr);
            if (!Number.isInteger(ano)) throw new Error(`Linha ${i + 2}: ano inválido`);
            if (!Number.isInteger(mes) || mes < 1 || mes > 12)
              throw new Error(`Linha ${i + 2}: mês inválido`);
            if (!Number.isFinite(valor)) throw new Error(`Linha ${i + 2}: valor inválido`);
            parsed.push({
              projeto,
              descricao: (raw.descricao ?? "").trim() || null,
              rubrica: (raw.rubrica ?? "").trim() || null,
              tipo: tipoStr as "RECEITA" | "DESPESA",
              ano,
              mes,
              valor,
            });
          }
          if (parsed.length === 0) throw new Error("CSV sem linhas válidas");
          const nome = new Date()
            .toISOString()
            .replace("T", " ")
            .slice(0, 19);
          uploadMut.mutate({ nome, linhas: parsed });
        } catch (e: any) {
          toast.error(e?.message ?? "Erro a ler CSV");
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        toast.error(err.message ?? "Erro a ler CSV");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
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
    ...COLUMN_KEYS,
  ]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<Linha>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        size: 40,
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
      textCol("projeto", "Projeto", saveCell),
      textCol("descricao", "Descrição", saveCell),
      textCol("rubrica", "Rubrica", saveCell),
      {
        accessorKey: "tipo",
        header: sortHeader("Tipo"),
        cell: ({ row }) => (
          <Select
            value={row.original.tipo}
            onValueChange={(v) =>
              saveCell(row.original, { tipo: v as Linha["tipo"] })
            }
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DESPESA">DESPESA</SelectItem>
              <SelectItem value="RECEITA">RECEITA</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      numCol("ano", "Ano", saveCell, 0),
      numCol("mes", "Mês", saveCell, 0),
      numCol("valor", "Valor", saveCell, 2),
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
    },
    getRowId: (r) => r.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const dragCol = useRef<string | null>(null);
  const onDragStart = (id: string) => (e: React.DragEvent) => {
    dragCol.current = id;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const src = dragCol.current;
    dragCol.current = null;
    if (!src || src === targetId) return;
    const order = [...columnOrder];
    const from = order.indexOf(src);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, src);
    setColumnOrder(order);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orçamento</h1>
          <p className="text-sm text-muted-foreground">
            {linhas.length} linhas
            {versaoAtiva && (
              <> · Ativa: <span className="font-medium">{versaoAtiva.nome}</span></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {versoes.length > 0 && (
            <Select
              value={versaoVisivel ?? undefined}
              onValueChange={(v) => setVersaoSel(v)}
            >
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder="Versão" />
              </SelectTrigger>
              <SelectContent>
                {versoes.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome}{v.ativa ? " (ativa)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={versoes.length === 0}>
                Versões
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Versão usada no dashboard</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {versoes.map((v) => (
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
              {versoes.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Sem versões.
                </div>
              )}
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

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Pesquisar…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-64"
          />
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
            onClick={() =>
              insertMut.mutate({
                projeto: "Novo projeto",
                descricao: "",
                rubrica: "",
                tipo: "DESPESA",
                ano: new Date().getFullYear(),
                mes: 1,
                valor: 0,
              })
            }
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
            <Trash2 className="mr-2 h-4 w-4" /> Apagar ({selectedIds.length})
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => {
                    const canDrag = h.column.id !== "select";
                    return (
                      <TableHead
                        key={h.id}
                        draggable={canDrag}
                        onDragStart={canDrag ? onDragStart(h.column.id) : undefined}
                        onDragOver={canDrag ? onDragOver : undefined}
                        onDrop={canDrag ? onDrop(h.column.id) : undefined}
                        className={canDrag ? "cursor-move" : ""}
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanFilter() && (
                          <Input
                            value={(h.column.getFilterValue() as string) ?? ""}
                            onChange={(e) =>
                              h.column.setFilterValue(e.target.value)
                            }
                            placeholder="filtrar…"
                            className="mt-1 h-7 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    A carregar…
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Sem linhas.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function sortHeader(label: string) {
  return ({ column }: any) => (
    <button
      type="button"
      className="flex items-center gap-1 font-medium"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function textCol(
  key: "projeto" | "descricao" | "rubrica",
  label: string,
  save: (row: any, patch: any) => void,
): ColumnDef<Linha> {
  return {
    accessorKey: key,
    header: sortHeader(label),
    cell: ({ row }) => (
      <Input
        defaultValue={(row.original as any)[key] ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim();
          save(row.original, { [key]: v === "" ? null : v });
        }}
        className="h-8 min-w-[140px]"
      />
    ),
  };
}

function numCol(
  key: "ano" | "mes" | "valor",
  label: string,
  save: (row: any, patch: any) => void,
  decimals: number,
): ColumnDef<Linha> {
  return {
    accessorKey: key,
    header: sortHeader(label),
    filterFn: (row, id, filterValue) => {
      if (!filterValue) return true;
      const v = String(row.getValue(id) ?? "");
      return v.includes(String(filterValue));
    },
    cell: ({ row }) => (
      <Input
        type="number"
        step={decimals === 0 ? 1 : 0.01}
        defaultValue={(row.original as any)[key]}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          save(row.original, { [key]: n });
        }}
        className="h-8 w-[110px] text-right"
      />
    ),
  };
}
