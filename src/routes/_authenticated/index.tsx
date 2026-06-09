import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { z } from "zod";
import { resumoDashboard, anosDisponiveis } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { currency, percent, MESES_CURTOS, MESES_LONGOS } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  ano: z.number().int().optional(),
  mes: z.number().int().min(1).max(12).optional(),
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
          <span>Orçado</span><span>{currency.format(orcado)}</span>
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
  const ano = search.ano ?? new Date().getFullYear();
  const mes = search.mes ?? new Date().getMonth() + 1;

  const anosFn = useServerFn(anosDisponiveis);
  const { data: anos = [] } = useQuery({ queryKey: ["anos"], queryFn: () => anosFn() });

  const resumoFn = useServerFn(resumoDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["resumo", ano, mes],
    queryFn: () => resumoFn({ data: { ano, mes } }),
  });

  const set = (patch: Partial<{ ano: number; mes: number }>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...patch }) });

  const projetos = useMemo(() => {
    if (!data) return [];
    return data.projetos
      .map((p) => ({ ...p, desvio: p.orcado /* sem realizado por projeto */ }))
      .sort((a, b) => b.orcado - a.orcado);
  }, [data]);

  const anosLista = anos.length ? anos : [ano];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard Principal</h1>
          <p className="text-sm text-muted-foreground">Análise acumulada até {MESES_LONGOS[mes - 1]} de {ano}</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(ano)} onValueChange={(v) => set({ ano: Number(v) })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosLista.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(mes)} onValueChange={(v) => set({ mes: Number(v) })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_LONGOS.map((nome, i) => (
                <SelectItem key={i} value={String(i + 1)}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Receita Realizada" orcado={data?.kpis.receitaOrc ?? 0} realizado={data?.kpis.receitaReal ?? 0} modo="receita" />
        <KpiCard titulo="Despesa Realizada" orcado={data?.kpis.despesaOrc ?? 0} realizado={data?.kpis.despesaReal ?? 0} modo="despesa" />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Wallet className="size-4" /> Resultado Orçado</CardDescription>
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
          <Tabs defaultValue="receita">
            <TabsList>
              <TabsTrigger value="receita">Receita</TabsTrigger>
              <TabsTrigger value="despesa">Despesa</TabsTrigger>
            </TabsList>
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
                    <Bar dataKey={t === "receita" ? "receitaOrc" : "despesaOrc"} name="Orçado" fill="hsl(220 70% 60%)" />
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
          <CardDescription>Valores orçados acumulados até {MESES_LONGOS[mes - 1]}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Orçado (acum.)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              ) : projetos.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem orçamentos ativos para {ano}.</TableCell></TableRow>
              ) : projetos.map((p) => (
                <TableRow key={`${p.projeto}-${p.tipo}`}>
                  <TableCell className="font-medium">{p.projeto}</TableCell>
                  <TableCell>{p.tipo === "RECEITA" ? "Receita" : "Despesa"}</TableCell>
                  <TableCell className="text-right">{currency.format(p.orcado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
