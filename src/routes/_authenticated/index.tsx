import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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
  tipo: "RECEITA" | "DESPESA";
  orcado: number;
  realizado: number;
  desvio: number;
  exec: number;
};

function ResumoProjetosGrid({
  projetos,
  isLoading,
  ano,
}: {
  projetos: ProjRow[];
  isLoading: boolean;
  ano: number;
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
      accessorKey: "tipo",
      header: sortHeader("Tipo"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 110,
      cell: ({ getValue }) => {
        const t = getValue() as string;
        return (
          <span
            className={cn(
              "text-xs font-medium",
              t === "RECEITA"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {t === "RECEITA" ? "Receita" : "Despesa"}
          </span>
        );
      },
    },
    {
      accessorKey: "orcado",
      header: sortHeader("Orçamentado"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 140,
      aggregationFn: "sum",
      cell: ({ row, getValue }) => (
        <CurrencyCell
          value={Number(getValue() ?? 0)}
          tone={row.original.tipo === "RECEITA" ? "receita" : "despesa"}
        />
      ),
      aggregatedCell: ({ getValue }) => (
        <CurrencyCell value={Number(getValue() ?? 0)} />
      ),
    },
    {
      accessorKey: "realizado",
      header: sortHeader("Realizado"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 140,
      aggregationFn: "sum",
      cell: ({ row, getValue }) => (
        <CurrencyCell
          value={Number(getValue() ?? 0)}
          tone={row.original.tipo === "RECEITA" ? "receita" : "despesa"}
        />
      ),
      aggregatedCell: ({ getValue }) => (
        <CurrencyCell value={Number(getValue() ?? 0)} />
      ),
    },
    {
      accessorKey: "desvio",
      header: sortHeader("Desvio"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 140,
      aggregationFn: "sum",
      cell: ({ getValue }) => (
        <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />
      ),
      aggregatedCell: ({ getValue }) => (
        <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />
      ),
    },
    {
      accessorKey: "exec",
      header: sortHeader("Execução"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 110,
      enableGrouping: false,
      cell: ({ row, getValue }) =>
        row.original.orcado === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="text-right tabular-nums">
            {percent(Number(getValue() ?? 0))}
          </div>
        ),
    },
  ];

  return (
    <DataGrid<ProjRow>
      data={projetos}
      columns={columns}
      getRowId={(r) => `${r.projeto}-${r.tipo}`}
      isLoading={isLoading}
      searchPlaceholder="Pesquisar projetos…"
      groupable={[{ id: "tipo", label: "Tipo" }]}
      emptyMessage={`Sem dados para ${ano}.`}
      maxHeight="60vh"
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
  const desvio = orcado - realizado;
  const exec = orcado === 0 ? 0 : realizado / orcado;
  const positivo = modo === "receita" ? realizado >= orcado : realizado <= orcado;
  const Icon = modo === "receita" ? TrendingUp : TrendingDown;
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
          <span className="text-muted-foreground">Desvio</span>
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

  const projetos = useMemo(() => {
    if (!data) return [];
    return data.projetos
      .map((p: any) => {
        const desvio = p.tipo === "RECEITA" ? p.realizado - p.orcado : p.orcado - p.realizado;
        const exec = p.orcado === 0 ? 0 : p.realizado / p.orcado;
        return { ...p, desvio, exec };
      })
      .sort((a, b) => Math.max(b.orcado, b.realizado) - Math.max(a.orcado, a.realizado));
  }, [data]);

  const anosLista = anos.length ? anos : [ano];

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
          <CardDescription>Visão mensal completa do ano {ano}</CardDescription>
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
                <BarChart data={data?.grafico ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" tickFormatter={(m) => MESES_CURTOS[m - 1]} />
                  <YAxis tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => currency.format(v)} labelFormatter={(m) => MESES_LONGOS[(m as number) - 1]} />
                  <Legend />
                  <Bar dataKey="receitaOrc" name="Receita Orçada" fill="hsl(160 70% 75%)" />
                  <Bar dataKey="receitaReal" name="Receita Realizada" fill="hsl(160 70% 45%)" />
                  <Bar dataKey="despesaOrc" name="Despesa Orçada" fill="hsl(0 70% 80%)" />
                  <Bar dataKey="despesaReal" name="Despesa Realizada" fill="hsl(0 70% 55%)" />
                </BarChart>
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
                    <Bar dataKey={t === "receita" ? "receitaOrc" : "despesaOrc"} name={"Orçamentado\n"} fill="hsl(220 70% 60%)" />
                    <Bar dataKey={t === "receita" ? "receitaReal" : "despesaReal"} name="Realizado" fill={t === "receita" ? "hsl(160 70% 45%)" : "hsl(0 70% 55%)"} />
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
              <ResumoProjetosGrid projetos={projetos} isLoading={isLoading} ano={ano} />
            </TabsContent>
            <TabsContent value="grafico" className="mt-4">
              <Tabs defaultValue="ambos">
                <TabsList>
                  <TabsTrigger value="ambos">Ambos</TabsTrigger>
                  <TabsTrigger value="receita">Receita</TabsTrigger>
                  <TabsTrigger value="despesa">Despesa</TabsTrigger>
                </TabsList>
                {(["ambos", "receita", "despesa"] as const).map((t) => {
                  const dados = t === "ambos"
                    ? projetos.map((p) => ({
                        projeto: `${p.nome ?? p.projeto} (${p.tipo === "RECEITA" ? "R" : "D"})`,
                        Orçamentado: p.orcado,
                        Realizado: p.realizado,
                        _tipo: p.tipo,
                      }))
                    : projetos
                        .filter((p) => p.tipo === (t === "receita" ? "RECEITA" : "DESPESA"))
                        .map((p) => ({ projeto: p.nome ?? p.projeto, Orçamentado: p.orcado, Realizado: p.realizado, _tipo: p.tipo }));
                  const altura = Math.max(280, dados.length * 36 + 60);
                  const corReal = t === "despesa" ? "hsl(0 70% 55%)" : "hsl(160 70% 45%)";
                  return (
                    <TabsContent key={t} value={t} className="mt-4">
                      {dados.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12">Sem dados para apresentar.</p>
                      ) : (
                        <div style={{ height: altura }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dados} layout="vertical" margin={{ left: 20, right: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis type="number" tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v as number)} />
                              <YAxis type="category" dataKey="projeto" width={180} />
                              <Tooltip formatter={(v: number) => currency.format(v)} />
                              <Legend />
                              <Bar dataKey="Orçamentado" fill="hsl(220 70% 60%)" />
                              <Bar dataKey="Realizado" fill={corReal} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
