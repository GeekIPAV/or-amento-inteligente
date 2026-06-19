import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  listarContas,
  listarRubricasDisponiveis,
  guardarRubricaConta,
} from "@/lib/contas-rubricas.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  DataGrid,
  SummaryCard,
  numFilterFn,
  sortHeader,
  textFilterFn,
} from "@/components/data-grid";

export const Route = createFileRoute("/_authenticated/contas-rubricas")({
  component: ContasRubricasPage,
});

type Row = {
  conta: string;
  descricao_conta: string | null;
  rubrica: string | null;
  linhas: number;
};

function ContasRubricasPage() {
  const listFn = useServerFn(listarContas);
  const rubricasFn = useServerFn(listarRubricasDisponiveis);
  const saveFn = useServerFn(guardarRubricaConta);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contas-rubricas"],
    queryFn: () => listFn(),
  });
  const { data: rubricas } = useQuery({
    queryKey: ["rubricas-disponiveis"],
    queryFn: () => rubricasFn(),
  });

  const [valores, setValores] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setValores(
      Object.fromEntries(data.map((r) => [r.conta, r.rubrica ?? ""])),
    );
  }, [data]);

  const mut = useMutation({
    mutationFn: async (items: Array<{ conta: string; rubrica: string }>) => {
      for (const v of items) await saveFn({ data: v });
      return items.length;
    },
    onSuccess: (n) => {
      toast.success(
        n === 1 ? "Rubrica guardada" : `${n} rubricas guardadas`,
      );
      qc.invalidateQueries({ queryKey: ["contas-rubricas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirtyItems = useMemo(() => {
    const map = new Map((data ?? []).map((r) => [r.conta, r.rubrica ?? ""]));
    return Object.entries(valores)
      .filter(([c, v]) => v.trim() !== "" && v !== map.get(c))
      .map(([conta, rubrica]) => ({ conta, rubrica: rubrica.trim() }));
  }, [valores, data]);

  const rows = (data ?? []) as Row[];
  const totalLinhas = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.linhas || 0), 0),
    [rows],
  );
  const semRubrica = useMemo(
    () => rows.filter((r) => !r.rubrica).length,
    [rows],
  );

  const rubricasList = rubricas ?? [];

  const columns = useMemo<ColumnDef<Row, any>[]>(
    () => [
      {
        accessorKey: "conta",
        header: sortHeader("Conta"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 140,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "descricao_conta",
        header: sortHeader("Descrição"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 280,
        cell: ({ getValue }) => (
          <span className="text-sm">{(getValue() as string) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "rubrica",
        header: sortHeader("Rubrica"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 340,
        enableGrouping: false,
        cell: ({ row }) => {
          const r = row.original;
          const original = r.rubrica ?? "";
          const valor = valores[r.conta] ?? "";
          const dirty = valor.trim() !== "" && valor !== original;
          const saveAll = () => {
            if (dirtyItems.length === 0) return;
            mut.mutate(dirtyItems);
          };
          // Include current value in options even if not in rubricasList
          const opts = Array.from(
            new Set(
              [...(rubricasList ?? []), original, valor].filter(
                (x) => x && x.trim() !== "",
              ),
            ),
          );
          return (
            <div className="flex items-center gap-2">
              <Select
                value={valor || undefined}
                onValueChange={(v) =>
                  setValores((p) => ({ ...p, [r.conta]: v }))
                }
              >
                <SelectTrigger className="h-7 text-sm">
                  <SelectValue placeholder="Escolher rubrica…" />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((rub) => (
                    <SelectItem key={rub} value={rub}>
                      {rub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={dirty ? "default" : "ghost"}
                disabled={!dirty || mut.isPending}
                onClick={saveAll}
                title={
                  dirtyItems.length > 1
                    ? `Guardar ${dirtyItems.length} alterações`
                    : "Guardar"
                }
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
      {
        accessorKey: "linhas",
        header: sortHeader("Movimentos"),
        filterFn: numFilterFn,
        meta: { filterType: "number" },
        size: 130,
        aggregationFn: "sum",
        cell: ({ getValue }) => (
          <div className="text-right tabular-nums">
            {Number(getValue() ?? 0)}
          </div>
        ),
        aggregatedCell: ({ getValue }) => (
          <div className="text-right font-semibold tabular-nums">
            {Number(getValue() ?? 0)}
          </div>
        ),
      },
    ],
    [valores, mut, dirtyItems, rubricasList],
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas / Rubricas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Associa cada conta dos movimentos a uma rubrica do orçamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard label="Contas" value={String(rows.length)} tone="receita" />
          <SummaryCard
            label="Sem rubrica"
            value={String(semRubrica)}
            tone="despesa"
          />
          <SummaryCard
            label="Movimentos"
            value={String(totalLinhas)}
            tone="receita"
          />
        </div>
      </div>

      <DataGrid<Row>
        data={rows}
        columns={columns}
        getRowId={(r) => r.conta}
        isLoading={isLoading}
        searchPlaceholder="Pesquisar contas…"
        emptyMessage="Sem contas importadas."
      />
    </div>
  );
}
