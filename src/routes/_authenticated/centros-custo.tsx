import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  listarCentrosCusto,
  guardarNomeProjeto,
} from "@/lib/centros-custo.functions";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/centros-custo")({
  component: CentrosCustoPage,
});

type Row = { centro_custo: string; nome_projeto: string; linhas: number };

function CentrosCustoPage() {
  const listFn = useServerFn(listarCentrosCusto);
  const saveFn = useServerFn(guardarNomeProjeto);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["centros-custo"],
    queryFn: () => listFn(),
  });

  const [nomes, setNomes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setNomes(
      Object.fromEntries(data.map((r) => [r.centro_custo, r.nome_projeto])),
    );
  }, [data]);

  const mut = useMutation({
    mutationFn: (v: { centro_custo: string; nome_projeto: string }) =>
      saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Nome do projeto guardado");
      qc.invalidateQueries({ queryKey: ["centros-custo"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data ?? []) as Row[];

  const totalLinhas = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.linhas || 0), 0),
    [rows],
  );

  const columns = useMemo<ColumnDef<Row, any>[]>(
    () => [
      {
        accessorKey: "centro_custo",
        header: sortHeader("Centro de Custo"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 200,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "nome_projeto",
        header: sortHeader("Nome do Projeto"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 320,
        enableGrouping: false,
        cell: ({ row }) => {
          const r = row.original;
          const original = r.nome_projeto;
          const valor = nomes[r.centro_custo] ?? "";
          const dirty = valor.trim() !== "" && valor !== original;
          return (
            <div className="flex items-center gap-2">
              <Input
                value={valor}
                onChange={(e) =>
                  setNomes((p) => ({ ...p, [r.centro_custo]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty) {
                    mut.mutate({
                      centro_custo: r.centro_custo,
                      nome_projeto: valor.trim(),
                    });
                  }
                }}
                className="h-7 text-sm"
              />
              <Button
                size="sm"
                variant={dirty ? "default" : "ghost"}
                disabled={!dirty || mut.isPending}
                onClick={() =>
                  mut.mutate({
                    centro_custo: r.centro_custo,
                    nome_projeto: valor.trim(),
                  })
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
          <div className="text-right tabular-nums">{Number(getValue() ?? 0)}</div>
        ),
        aggregatedCell: ({ getValue }) => (
          <div className="text-right font-semibold tabular-nums">
            {Number(getValue() ?? 0)}
          </div>
        ),
      },
    ],
    [nomes, mut],
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centros de Custo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atribui um nome de projeto a cada centro de custo — usado no
            dashboard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard
            label="Centros"
            value={String(rows.length)}
            tone="receita"
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
        getRowId={(r) => r.centro_custo}
        isLoading={isLoading}
        searchPlaceholder="Pesquisar centros de custo…"
        emptyMessage="Sem centros de custo importados."
      />
    </div>
  );
}
