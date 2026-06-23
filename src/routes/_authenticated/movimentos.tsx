import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { listarMovimentos } from "@/lib/extratos.functions";
import {
  CurrencyCell,
  DataGrid,
  SummaryCard,
  fmtEur,
  numFilterFn,
  sortHeader,
  textFilterFn,
} from "@/components/data-grid";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImportarExtratosTab } from "@/components/ImportarExtratosTab";

export const Route = createFileRoute("/_authenticated/movimentos")({
  component: MovimentosPage,
});

type Mov = {
  id: string;
  conta: string | null;
  descricao_conta: string | null;
  data: string | null;
  num_documento: string | null;
  diario: string | null;
  movimento: string | null;
  centro_custo: string | null;
  debito: number;
  credito: number;
  mes_referencia: string;
};

function MovimentosPage() {
  const fn = useServerFn(listarMovimentos);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["movimentos"],
    queryFn: () => fn(),
  });
  const data = rows as Mov[];

  const summary = useMemo(() => {
    let receita = 0;
    let despesa = 0;
    let outros = 0;
    for (const r of data) {
      const conta = String(r.conta ?? "");
      if (conta.startsWith("7")) {
        receita += Number(r.credito) - Number(r.debito);
      } else if (conta.startsWith("6")) {
        despesa += Number(r.debito) - Number(r.credito);
      } else {
        outros += Number(r.credito) - Number(r.debito);
      }
    }
    return { receita, despesa, resultado: receita - despesa, outros, linhas: data.length };
  }, [data]);


  const columns = useMemo<ColumnDef<Mov, any>[]>(
    () => [
      {
        accessorKey: "data",
        header: sortHeader("Data"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 110,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "mes_referencia",
        header: sortHeader("Mês Ref."),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 110,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "conta",
        header: sortHeader("Conta"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 110,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "descricao_conta",
        header: sortHeader("Descrição Conta"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 240,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "num_documento",
        header: sortHeader("Nº Doc."),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 110,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "diario",
        header: sortHeader("Diário"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 90,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "movimento",
        header: sortHeader("Movimento"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 120,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "centro_custo",
        header: sortHeader("C. Custo"),
        filterFn: textFilterFn,
        meta: { filterType: "text" },
        size: 120,
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "debito",
        header: sortHeader("Débito"),
        filterFn: numFilterFn,
        meta: { filterType: "number" },
        size: 130,
        enableGrouping: false,
        aggregationFn: "sum",
        cell: ({ getValue }) => (
          <CurrencyCell
            value={Number(getValue() ?? 0)}
            tone="despesa"
            showZeroAsDash
          />
        ),
        aggregatedCell: ({ getValue }) => (
          <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />
        ),
      },
      {
        accessorKey: "credito",
        header: sortHeader("Crédito"),
        filterFn: numFilterFn,
        meta: { filterType: "number" },
        size: 130,
        enableGrouping: false,
        aggregationFn: "sum",
        cell: ({ getValue }) => (
          <CurrencyCell
            value={Number(getValue() ?? 0)}
            tone="receita"
            showZeroAsDash
          />
        ),
        aggregatedCell: ({ getValue }) => (
          <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.linhas} linhas importadas dos extratos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard label="Créditos" value={fmtEur(summary.cred)} tone="receita" />
          <SummaryCard label="Débitos" value={fmtEur(summary.deb)} tone="despesa" />
          <SummaryCard
            label="Saldo"
            value={fmtEur(summary.saldo)}
            tone={summary.saldo >= 0 ? "receita" : "despesa"}
          />
        </div>
      </div>

      <Tabs defaultValue="movimentos">
        <TabsList>
          <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>
        <TabsContent value="movimentos">
          <DataGrid<Mov>
            data={data}
            columns={columns}
            getRowId={(r) => r.id}
            isLoading={isLoading}
            searchPlaceholder="Pesquisar em todas as colunas…"
            groupable={[
              { id: "mes_referencia", label: "Mês Ref." },
              { id: "conta", label: "Conta" },
              { id: "centro_custo", label: "Centro de Custo" },
              { id: "diario", label: "Diário" },
            ]}
            emptyMessage="Sem movimentos."
          />
        </TabsContent>
        <TabsContent value="importar">
          <ImportarExtratosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
