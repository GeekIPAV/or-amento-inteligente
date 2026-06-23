import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DashboardPeek, type PeekScope } from "@/components/dashboard-peek";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line,
} from "recharts";

import { z } from "zod";
import { resumoDashboard, anosDisponiveis, mesesDisponiveis } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { currency, percent, MESES_CURTOS, MESES_LONGOS } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import {
  CurrencyCell,
  DataGrid,
  numFilterFn,
  sortHeader,
  textFilterFn,
} from "@/components/data-grid";

type ProjRow = {
  projeto: string;
  nome?: string | null;
  orcadoReceita: number;
  orcadoDespesa: number;
  realizadoReceita: number;
  realizadoDespesa: number;
  resultado: number;
  execReceita: number;
  execDespesa: number;
};

type RubRow = {
  rubrica: string;
  orcadoReceita: number;
  orcadoDespesa: number;
  realizadoReceita: number;
  realizadoDespesa: number;
  resultado: number;
  execReceita: number;
  execDespesa: number;
};


function execReceitaCell({ row, getValue }: any) {
  const v = Number(getValue() ?? 0);
  if (row.original.orcadoReceita === 0) return <span className="text-muted-foreground">—</span>;
  const cls = v >= 0.9 ? "text-emerald-600" : v >= 0.5 ? "text-amber-600" : "text-rose-600";
  return <div className={cn("text-right tabular-nums font-medium", cls)}>{percent(v)}</div>;
}
function execDespesaCell({ row, getValue }: any) {
  const v = Number(getValue() ?? 0);
  if (row.original.orcadoDespesa === 0) return <span className="text-muted-foreground">—</span>;
  const cls = v <= 1.0 ? "text-emerald-600" : v <= 1.1 ? "text-amber-600" : "text-rose-600";
  return <div className={cn("text-right tabular-nums font-medium", cls)}>{percent(v)}</div>;
}


function ResumoProjetosGrid({
  projetos,
  isLoading,
  ano,
  onRowClick,
}: {
  projetos: ProjRow[];
  isLoading: boolean;
  ano: number;
  onRowClick?: (p: ProjRow) => void;
}) {

  const columns: ColumnDef<ProjRow, any>[] = [
    {
      id: "nome",
      accessorFn: (r) => r.nome ?? r.projeto,
      header: sortHeader("Projeto"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 240,
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "orcadoReceita",
      header: sortHeader("Rec. Orç."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
    },
    {
      accessorKey: "realizadoReceita",
      header: sortHeader("Rec. Real."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
    },
    {
      accessorKey: "orcadoDespesa",
      header: sortHeader("Desp. Orç."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
    },
    {
      accessorKey: "realizadoDespesa",
      header: sortHeader("Desp. Real."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
    },
    {
      accessorKey: "resultado",
      header: sortHeader("Resultado"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />,
    },
    {
      accessorKey: "execReceita",
      header: sortHeader("Exec. Rec."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 110,
      enableGrouping: false,
      cell: execReceitaCell,
    },
    {
      accessorKey: "execDespesa",
      header: sortHeader("Exec. Desp."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 110,
      enableGrouping: false,
      cell: execDespesaCell,
    },
  ];

  return (
    <DataGrid<ProjRow>
      data={projetos}
      columns={columns}
      getRowId={(r) => r.projeto}
      isLoading={isLoading}
      searchPlaceholder="Pesquisar projetos…"
      emptyMessage={`Sem dados para ${ano}.`}
      maxHeight="60vh"
      onRowClick={onRowClick}
    />
  );
}




function ResumoRubricasGrid({
  rubricas,
  isLoading,
  ano,
  onRowClick,
}: {
  rubricas: RubRow[];
  isLoading: boolean;
  ano: number;
  onRowClick?: (r: RubRow) => void;
}) {

  const columns: ColumnDef<RubRow, any>[] = [
    {
      accessorKey: "rubrica",
      header: sortHeader("Rubrica"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 240,
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "orcadoReceita",
      header: sortHeader("Rec. Orç."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
    },
    {
      accessorKey: "realizadoReceita",
      header: sortHeader("Rec. Real."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
    },
    {
      accessorKey: "orcadoDespesa",
      header: sortHeader("Desp. Orç."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
    },
    {
      accessorKey: "realizadoDespesa",
      header: sortHeader("Desp. Real."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" />,
    },
    {
      accessorKey: "resultado",
      header: sortHeader("Resultado"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 130,
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />,
    },
    {
      accessorKey: "execReceita",
      header: sortHeader("Exec. Rec."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 110,
      enableGrouping: false,
      cell: execReceitaCell,
    },
    {
      accessorKey: "execDespesa",
      header: sortHeader("Exec. Desp."),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 110,
      enableGrouping: false,
      cell: execDespesaCell,
    },
  ];

  return (
    <DataGrid<RubRow>
      data={rubricas}
      columns={columns}
      getRowId={(r) => r.rubrica}
      isLoading={isLoading}
      searchPlaceholder="Pesquisar rubricas…"
      emptyMessage={`Sem rubricas com correspondência para ${ano}. Atribui contas às rubricas em Rubricas / Contas.`}
      maxHeight="60vh"
      onRowClick={onRowClick}
    />

  );
}





const searchSchema = z.object({

  ano: z.number().int().optional(),
  mes: z.number().int().min(1).max(12).optional(),
  mesCum: z.boolean().optional(),
  anosCum: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Dashboard — Finanças" }] }),
  component: Dashboard,
});

function KpiCard({
  titulo, orcado, realizado, modo,
}: { titulo: string; orcado: number; realizado: number; modo: "receita" | "despesa" }) {
  const desvio = modo === "receita" ? realizado - orcado : orcado - realizado;
  const exec = orcado === 0 ? 0 : realizado / orcado;
  const positivo = desvio >= 0;
  const Icon = modo === "receita" ? TrendingUp : TrendingDown;
  const desvioLabel = modo === "receita"
    ? (positivo ? "Desvio (receita extra)" : "Em falta")
    : (positivo ? "Desvio (poupança)" : "Sobrecusto");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className={cn("size-4", modo === "receita" ? "text-emerald-600" : "text-rose-600")} />
          {titulo}
        </CardDescription>
        <CardTitle className="text-2xl">{currency.format(realizado)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Orçamentado</span><span>{currency.format(orcado)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{desvioLabel}</span>
          <span className={cn("font-medium", positivo ? "text-emerald-600" : "text-rose-600")}>
            {currency.format(desvio)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Execução</span>
          <span className="font-medium">{percent(exec)}</span>
        </div>
      </CardContent>
    </Card>
  );
}


function Dashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });

  const anosFn = useServerFn(anosDisponiveis);
  const { data: anos = [] } = useQuery({ queryKey: ["anos"], queryFn: () => anosFn() });

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const ano = search.ano ?? (anos.length ? (anos.includes(anoAtual) ? anoAtual : anos[0]) : anoAtual);
  const mes = search.mes ?? null;
  const mesCum = search.mesCum ?? true;
  const anosCum = search.anosCum ?? false;

  const mesesFn = useServerFn(mesesDisponiveis);
  const { data: mesesComDados = [] } = useQuery({
    queryKey: ["meses-disponiveis", ano],
    queryFn: () => mesesFn({ data: { ano } }),
  });

  const resumoFn = useServerFn(resumoDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["resumo", ano, mes, mesCum, anosCum],
    queryFn: () => resumoFn({ data: { ano, mes: mes ?? undefined, mesCumulativo: mesCum, anosCumulativo: anosCum } }),
  });

  const set = (patch: Partial<{ ano: number; mes: number | null; mesCum: boolean; anosCum: boolean }>) =>
    navigate({ search: (prev: any) => {
      const next: any = { ...prev, ...patch };
      if (next.mes === null) delete next.mes;
      return next;
    } });

  const projetos: ProjRow[] = useMemo(() => {
    if (!data) return [];
    return (data.projetos as any[])
      .map((p) => {
        const orcadoReceita = Number(p.orcadoReceita ?? 0);
        const orcadoDespesa = Number(p.orcadoDespesa ?? 0);
        const realizadoReceita = Number(p.realizadoReceita ?? 0);
        const realizadoDespesa = Number(p.realizadoDespesa ?? 0);
        return {
          projeto: p.projeto,
          nome: p.nome,
          orcadoReceita,
          orcadoDespesa,
          realizadoReceita,
          realizadoDespesa,
          resultado: realizadoReceita - realizadoDespesa,
          execReceita: orcadoReceita === 0 ? 0 : realizadoReceita / orcadoReceita,
          execDespesa: orcadoDespesa === 0 ? 0 : realizadoDespesa / orcadoDespesa,
        } as ProjRow;
      })
      .sort((a, b) => {
        const ma = Math.max(a.orcadoReceita, a.orcadoDespesa, a.realizadoReceita, a.realizadoDespesa);
        const mb = Math.max(b.orcadoReceita, b.orcadoDespesa, b.realizadoReceita, b.realizadoDespesa);
        return mb - ma;
      });
  }, [data]);

  const rubricas: RubRow[] = useMemo(() => {
    if (!data || !(data as any).rubricas) return [];
    return ((data as any).rubricas as any[])
      .map((r) => {
        const orcadoReceita = Number(r.orcadoReceita ?? 0);
        const orcadoDespesa = Number(r.orcadoDespesa ?? 0);
        const realizadoReceita = Number(r.realizadoReceita ?? 0);
        const realizadoDespesa = Number(r.realizadoDespesa ?? 0);
        return {
          rubrica: r.rubrica,
          orcadoReceita,
          orcadoDespesa,
          realizadoReceita,
          realizadoDespesa,
          resultado: realizadoReceita - realizadoDespesa,
          execReceita: orcadoReceita === 0 ? 0 : realizadoReceita / orcadoReceita,
          execDespesa: orcadoDespesa === 0 ? 0 : realizadoDespesa / orcadoDespesa,
        } as RubRow;
      })
      .sort((a, b) => {
        const ma = Math.max(a.orcadoReceita, a.orcadoDespesa, a.realizadoReceita, a.realizadoDespesa);
        const mb = Math.max(b.orcadoReceita, b.orcadoDespesa, b.realizadoReceita, b.realizadoDespesa);
        return mb - ma;
      });
  }, [data]);




  const anosLista = anos.length ? anos : [ano];
  const anosAlvo: number[] = (data?.intervalo as any)?.anosAlvo ?? [ano];

  const [peek, setPeek] = useState<PeekScope | null>(null);
  const openMonth = (m: number, tipo?: "RECEITA" | "DESPESA") => {
    const multi = anosAlvo.length > 1;
    setPeek({
      titulo: `${MESES_LONGOS[m - 1]}${multi ? ` · ${anosAlvo[0]}–${anosAlvo[anosAlvo.length - 1]}` : ` ${ano}`}${tipo ? ` · ${tipo === "RECEITA" ? "Receitas" : "Despesas"}` : ""}`,
      subtitulo: "Detalhes do mês",
      anos: anosAlvo,
      mesIni: m,
      mesFim: m,
      tipo: tipo ?? null,
    });
  };
  const openProjeto = (projeto: string, nome: string, tipo?: "RECEITA" | "DESPESA") => {
    setPeek({
      titulo: nome,
      subtitulo: `${descricaoPeriodo}${tipo ? ` · ${tipo === "RECEITA" ? "Receitas" : "Despesas"}` : ""}`,
      anos: anosAlvo,
      mesIni: (data?.intervalo as any)?.mesIni ?? 1,
      mesFim: (data?.intervalo as any)?.mesFim ?? 12,
      projeto,
      tipo: tipo ?? null,
    });
  };
  const openRubrica = (rubrica: string) => {
    setPeek({
      titulo: rubrica,
      subtitulo: `Rubrica · ${descricaoPeriodo}`,
      anos: anosAlvo,
      mesIni: (data?.intervalo as any)?.mesIni ?? 1,
      mesFim: (data?.intervalo as any)?.mesFim ?? 12,
      rubrica,
    });
  };



  const descricaoPeriodo = (() => {
    const anoTxt = anosCum ? `até ${ano}` : `${ano}`;
    if (mes == null) return `Ano completo ${anoTxt}`;
    if (mesCum) return `Jan–${MESES_LONGOS[mes - 1]} ${anoTxt}`;
    return `${MESES_LONGOS[mes - 1]} ${anoTxt}`;
  })();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Principal</h1>
          <p className="text-sm text-muted-foreground">{descricaoPeriodo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={String(ano)} onValueChange={(v) => set({ ano: Number(v) })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {anosLista.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={anosCum} onCheckedChange={(v) => set({ anosCum: Boolean(v) })} />
              Cumulativo
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={mes == null ? "all" : String(mes)}
              onValueChange={(v) => set({ mes: v === "all" ? null : Number(v) })}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ano inteiro</SelectItem>
                {MESES_LONGOS.map((nome, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {nome}{mesesComDados.length > 0 && !mesesComDados.includes(i + 1) ? " · sem mov." : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className={cn(
              "flex items-center gap-1.5 text-xs cursor-pointer select-none",
              mes == null ? "text-muted-foreground/50" : "text-muted-foreground",
            )}>
              <Checkbox
                checked={mesCum}
                disabled={mes == null}
                onCheckedChange={(v) => set({ mesCum: Boolean(v) })}
              />
              Cumulativo
            </label>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Receita Realizada" orcado={data?.kpis.receitaOrc ?? 0} realizado={data?.kpis.receitaReal ?? 0} modo="receita" />
        <KpiCard titulo="Despesa Realizada" orcado={data?.kpis.despesaOrc ?? 0} realizado={data?.kpis.despesaReal ?? 0} modo="despesa" />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Wallet className="size-4" /> Resultado Orçamentado</CardDescription>
            <CardTitle className="text-2xl">{currency.format((data?.kpis.receitaOrc ?? 0) - (data?.kpis.despesaOrc ?? 0))}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Target className="size-4" /> Resultado Realizado</CardDescription>
            <CardTitle className="text-2xl">{currency.format((data?.kpis.receitaReal ?? 0) - (data?.kpis.despesaReal ?? 0))}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orçamentado vs Realizado por mês</CardTitle>
          <CardDescription>Clica numa barra para ver os detalhes · {descricaoPeriodo}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ambos">
            <TabsList>
              <TabsTrigger value="ambos">Ambos</TabsTrigger>
              <TabsTrigger value="receita">Receita</TabsTrigger>
              <TabsTrigger value="despesa">Despesa</TabsTrigger>
            </TabsList>
            <TabsContent value="ambos" className="h-80 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data?.grafico ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tickFormatter={(m) => MESES_CURTOS[m - 1]} />
                  <YAxis tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => currency.format(v)} labelFormatter={(m) => MESES_LONGOS[(m as number) - 1]} />
                  <Legend />
                  <Bar dataKey="receitaOrc" name="Rec. Orç." fill="hsl(160 50% 70%)" cursor="pointer" onClick={(d: any) => openMonth(d.mes, "RECEITA")} />
                  <Bar dataKey="receitaReal" name="Rec. Real." fill="hsl(160 60% 40%)" cursor="pointer" onClick={(d: any) => openMonth(d.mes, "RECEITA")} />
                  <Bar dataKey="despesaOrc" name="Desp. Orç." fill="hsl(0 50% 75%)" cursor="pointer" onClick={(d: any) => openMonth(d.mes, "DESPESA")} />
                  <Bar dataKey="despesaReal" name="Desp. Real." fill="hsl(0 65% 50%)" cursor="pointer" onClick={(d: any) => openMonth(d.mes, "DESPESA")} />
                  <Line
                    type="monotone"
                    dataKey="resultado"
                    name="Resultado"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>

            {(["receita", "despesa"] as const).map((t) => (
              <TabsContent key={t} value={t} className="h-80 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.grafico ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tickFormatter={(m) => MESES_CURTOS[m - 1]} />
                    <YAxis tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v)} />
                    <Tooltip
                      formatter={(v: number) => currency.format(v)}
                      labelFormatter={(m) => MESES_LONGOS[(m as number) - 1]}
                    />
                    <Legend />
                    <Bar dataKey={t === "receita" ? "receitaOrc" : "despesaOrc"} name={"Orçamentado"} fill="hsl(220 70% 60%)" cursor="pointer" onClick={(d: any) => openMonth(d.mes, t === "receita" ? "RECEITA" : "DESPESA")} />
                    <Bar dataKey={t === "receita" ? "receitaReal" : "despesaReal"} name="Realizado" fill={t === "receita" ? "hsl(160 70% 45%)" : "hsl(0 70% 55%)"} cursor="pointer" onClick={(d: any) => openMonth(d.mes, t === "receita" ? "RECEITA" : "DESPESA")} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Resumo por Projeto</CardTitle>
          <CardDescription>Centros de custo · {descricaoPeriodo}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tabela">
            <TabsList>
              <TabsTrigger value="tabela">Tabela</TabsTrigger>
              <TabsTrigger value="grafico">Gráfico</TabsTrigger>
            </TabsList>
            <TabsContent value="tabela" className="mt-4">
              <ResumoProjetosGrid projetos={projetos} isLoading={isLoading} ano={ano} onRowClick={(p) => openProjeto(p.projeto, p.nome ?? p.projeto)} />
            </TabsContent>
            <TabsContent value="grafico" className="mt-4">
              {projetos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados para apresentar.</p>
              ) : (
                <div style={{ height: Math.max(280, projetos.length * 44 + 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={projetos.map((p) => ({
                        projeto: p.nome ?? p.projeto,
                        "Rec. Orç.": p.orcadoReceita,
                        "Rec. Real.": p.realizadoReceita,
                        "Desp. Orç.": p.orcadoDespesa,
                        "Desp. Real.": p.realizadoDespesa,
                        _projeto: p.projeto,
                        _nome: p.nome ?? p.projeto,
                      }))}
                      layout="vertical"
                      margin={{ left: 20, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v as number)} />
                      <YAxis type="category" dataKey="projeto" width={180} />
                      <Tooltip formatter={(v: number) => currency.format(v)} />
                      <Legend />
                      <Bar dataKey="Rec. Orç." fill="hsl(160 50% 70%)" cursor="pointer" onClick={(d: any) => openProjeto(d._projeto, d._nome, "RECEITA")} />
                      <Bar dataKey="Rec. Real." fill="hsl(160 60% 40%)" cursor="pointer" onClick={(d: any) => openProjeto(d._projeto, d._nome, "RECEITA")} />
                      <Bar dataKey="Desp. Orç." fill="hsl(0 50% 75%)" cursor="pointer" onClick={(d: any) => openProjeto(d._projeto, d._nome, "DESPESA")} />
                      <Bar dataKey="Desp. Real." fill="hsl(0 65% 50%)" cursor="pointer" onClick={(d: any) => openProjeto(d._projeto, d._nome, "DESPESA")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </TabsContent>
          </Tabs>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por Rubrica</CardTitle>
          <CardDescription>
            Comparação entre orçamentado e executado, via match conta → rubrica · {descricaoPeriodo}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tabela">
            <TabsList>
              <TabsTrigger value="tabela">Tabela</TabsTrigger>
              <TabsTrigger value="grafico">Gráfico</TabsTrigger>
            </TabsList>
            <TabsContent value="tabela" className="mt-4">
              <ResumoRubricasGrid rubricas={rubricas} isLoading={isLoading} ano={ano} onRowClick={(r) => openRubrica(r.rubrica)} />
            </TabsContent>
            <TabsContent value="grafico" className="mt-4">
              {rubricas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados para apresentar.</p>
              ) : (
                <div style={{ height: Math.max(280, rubricas.length * 32 + 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rubricas.map((r) => ({
                        rubrica: r.rubrica,
                        "Rec. Orç.": r.orcadoReceita,
                        "Rec. Real.": r.realizadoReceita,
                        "Desp. Orç.": r.orcadoDespesa,
                        "Desp. Real.": r.realizadoDespesa,
                      }))}
                      layout="vertical"
                      margin={{ left: 20, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v as number)} />
                      <YAxis type="category" dataKey="rubrica" width={200} />
                      <Tooltip formatter={(v: number) => currency.format(v)} />
                      <Legend />
                      <Bar dataKey="Rec. Orç." fill="hsl(160 50% 70%)" />
                      <Bar dataKey="Rec. Real." fill="hsl(160 60% 40%)" />
                      <Bar dataKey="Desp. Orç." fill="hsl(0 50% 75%)" />
                      <Bar dataKey="Desp. Real." fill="hsl(0 65% 50%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>

          </Tabs>

        </CardContent>
      </Card>

      <DashboardPeek scope={peek} open={!!peek} onOpenChange={(v) => { if (!v) setPeek(null); }} />

    </div>
  );

}
