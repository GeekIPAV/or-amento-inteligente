import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine,
} from "recharts";
import { Plus, Pencil, Trash2, DownloadCloud } from "lucide-react";
import {
  CurrencyCell,
  DataGrid,
  SummaryCard,
  fmtEur,
  numFilterFn,
  sortHeader,
  textFilterFn,
} from "@/components/data-grid";
import {
  listarPrevisoes,
  guardarPrevisao,
  apagarPrevisao,
  resumoMensal,
  importarDeFinanciamentos,
  type Previsao,
} from "@/lib/tesouraria.functions";
import { listarFinanciamentos, type Financiamento } from "@/lib/financiadores.functions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tesouraria")({
  component: TesourariaPage,
});

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CATEGORIAS = ["Financiamento", "Salários", "Renda", "Fornecedores", "Impostos", "Outros"] as const;
const ESTADOS = ["Previsto", "Em curso", "Realizado", "Cancelado"] as const;

const ESTADO_BADGE: Record<string, string> = {
  Previsto: "bg-slate-100 text-slate-700",
  "Em curso": "bg-amber-50 text-amber-700 border border-amber-200",
  Realizado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Cancelado: "bg-muted text-muted-foreground",
};

function TesourariaPage() {
  const qc = useQueryClient();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  const listPrevisoesFn = useServerFn(listarPrevisoes);
  const resumoMensalFn = useServerFn(resumoMensal);
  const guardarPrevisaoFn = useServerFn(guardarPrevisao);
  const apagarPrevisaoFn = useServerFn(apagarPrevisao);
  const importarFinFn = useServerFn(importarDeFinanciamentos);
  const listFinanciamentosFn = useServerFn(listarFinanciamentos);

  const { data: previsoes = [] } = useQuery({
    queryKey: ["previsoes", ano],
    queryFn: () => listPrevisoesFn({ data: { ano } }) as Promise<Previsao[]>,
  });
  const { data: resumo = [] } = useQuery({
    queryKey: ["previsoes-resumo", ano],
    queryFn: () => resumoMensalFn({ data: { ano } }),
  });
  const { data: financiamentos = [] } = useQuery({
    queryKey: ["financiamentos", null],
    queryFn: () =>
      listFinanciamentosFn({ data: { financiadorId: null } }) as Promise<Financiamento[]>,
  });

  const [sheet, setSheet] = useState<{ open: boolean; row: Previsao | null }>({ open: false, row: null });

  const saveM = useMutation({
    mutationFn: (p: any) => guardarPrevisaoFn({ data: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["previsoes"] });
      qc.invalidateQueries({ queryKey: ["previsoes-resumo"] });
      qc.invalidateQueries({ queryKey: ["alertas-count"] });
      toast.success("Previsão guardada");
      setSheet({ open: false, row: null });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a guardar"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => apagarPrevisaoFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["previsoes"] });
      qc.invalidateQueries({ queryKey: ["previsoes-resumo"] });
      toast.success("Previsão removida");
    },
  });

  const importM = useMutation({
    mutationFn: () => importarFinFn({ data: { ano } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["previsoes"] });
      qc.invalidateQueries({ queryKey: ["previsoes-resumo"] });
      toast.success(`${r.criados ?? 0} previsões importadas de financiamentos`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a importar"),
  });

  // Chart data
  const chartData = useMemo(() => {
    let saldoPrev = 0;
    let saldoReal = 0;
    return resumo.map((r) => {
      const entradasPrev = r.entradas_previstas;
      const saidasPrev = r.saidas_previstas;
      const entradasReais = r.entradas_reais;
      const saidasReais = r.saidas_reais;
      saldoPrev += entradasPrev - saidasPrev;
      saldoReal += entradasReais - saidasReais;
      return {
        mes: MESES_CURTOS[r.mes - 1],
        Entradas: entradasPrev,
        "Saídas": -saidasPrev,
        "Saldo Previsto": saldoPrev,
        "Saldo Real": saldoReal,
      };
    });
  }, [resumo]);

  const totais = useMemo(() => {
    const entradasPrev = resumo.reduce((a, r) => a + r.entradas_previstas, 0);
    const saidasPrev = resumo.reduce((a, r) => a + r.saidas_previstas, 0);
    const entradasReais = resumo.reduce((a, r) => a + r.entradas_reais, 0);
    const saidasReais = resumo.reduce((a, r) => a + r.saidas_reais, 0);
    return {
      entradasPrev,
      saidasPrev,
      saldoPrev: entradasPrev - saidasPrev,
      saldoReal: entradasReais - saidasReais,
    };
  }, [resumo]);

  // DataGrid columns
  const columns: ColumnDef<Previsao, any>[] = [
    {
      id: "data",
      accessorKey: "data",
      header: sortHeader("Data"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 100,
    },
    {
      id: "descricao",
      accessorKey: "descricao",
      header: sortHeader("Descrição"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 220,
    },
    {
      id: "categoria",
      accessorKey: "categoria",
      header: sortHeader("Categoria"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 130,
    },
    {
      id: "tipo",
      accessorKey: "tipo",
      header: sortHeader("Tipo"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 90,
      cell: ({ row }) => {
        const t = row.original.tipo;
        return (
          <span
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 text-xs",
              t === "Entrada"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200",
            )}
          >
            {t === "Saida" ? "Saída" : "Entrada"}
          </span>
        );
      },
    },
    {
      id: "valor",
      accessorKey: "valor",
      header: sortHeader("Valor"),
      filterFn: numFilterFn,
      meta: { filterType: "num", align: "right" },
      size: 130,
      cell: ({ row }) => {
        const v = row.original.tipo === "Saida" ? -row.original.valor : row.original.valor;
        return <CurrencyCell value={v} />;
      },
    },
    {
      id: "estado",
      accessorKey: "estado",
      header: sortHeader("Estado"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 110,
      cell: ({ row }) => (
        <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs", ESTADO_BADGE[row.original.estado])}>
          {row.original.estado}
        </span>
      ),
    },
    {
      id: "acoes",
      header: "",
      size: 90,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" onClick={() => setSheet({ open: true, row: row.original })}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (confirm("Remover esta previsão?")) delM.mutate(row.original.id);
            }}
          >
            <Trash2 className="size-3.5 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Previsão de Tesouraria</h1>
          <p className="text-sm text-muted-foreground">Entradas e saídas previstas vs. realizadas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => importM.mutate()} disabled={importM.isPending}>
            <DownloadCloud className="size-4 mr-2" />
            Importar de financiamentos
          </Button>
          <Button onClick={() => setSheet({ open: true, row: null })}>
            <Plus className="size-4 mr-2" />
            Nova previsão
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Entradas previstas" value={fmtEur(totais.entradasPrev)} valueClass="text-emerald-700" />
        <SummaryCard label="Saídas previstas" value={fmtEur(-totais.saidasPrev)} valueClass="text-red-600" />
        <SummaryCard label="Saldo previsto" value={fmtEur(totais.saldoPrev)} valueClass={totais.saldoPrev < 0 ? "text-red-600" : "text-foreground"} />
        <SummaryCard label="Saldo real" value={fmtEur(totais.saldoReal)} valueClass={totais.saldoReal < 0 ? "text-red-600" : "text-foreground"} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Fluxo mensal</h2>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(v) => fmtEur(v)} width={90} />
              <RTooltip formatter={(v: any) => fmtEur(Number(v))} />
              <Legend />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="Entradas" fill="#10b981" />
              <Bar dataKey="Saídas" fill="#ef4444" />
              <Line type="monotone" dataKey="Saldo Previsto" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Saldo Real" stroke="#1e293b" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Resumo mensal</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="text-left py-2 px-2">Mês</th>
                <th className="text-right py-2 px-2">Entradas previstas</th>
                <th className="text-right py-2 px-2">Saídas previstas</th>
                <th className="text-right py-2 px-2">Saldo previsto</th>
                <th className="text-right py-2 px-2">Entradas reais</th>
                <th className="text-right py-2 px-2">Saídas reais</th>
                <th className="text-right py-2 px-2">Saldo real</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => {
                const saldoP = r.entradas_previstas - r.saidas_previstas;
                const saldoR = r.entradas_reais - r.saidas_reais;
                return (
                  <tr key={r.mes} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-medium">{MESES_CURTOS[r.mes - 1]}</td>
                    <td className="text-right tabular-nums text-emerald-700">{fmtEur(r.entradas_previstas)}</td>
                    <td className="text-right tabular-nums text-red-600">{fmtEur(-r.saidas_previstas)}</td>
                    <td className={cn("text-right tabular-nums font-medium", saldoP < 0 && "text-red-600")}>{fmtEur(saldoP)}</td>
                    <td className="text-right tabular-nums text-emerald-700">{fmtEur(r.entradas_reais)}</td>
                    <td className="text-right tabular-nums text-red-600">{fmtEur(-r.saidas_reais)}</td>
                    <td className={cn("text-right tabular-nums font-medium", saldoR < 0 && "text-red-600")}>{fmtEur(saldoR)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DataGrid
        title={`Previsões (${previsoes.length})`}
        rows={previsoes}
        columns={columns}
        getRowId={(r) => r.id}
        emptyText="Sem previsões para este ano."
      />

      <PrevisaoSheet
        open={sheet.open}
        row={sheet.row}
        ano={ano}
        financiamentos={financiamentos}
        onClose={() => setSheet({ open: false, row: null })}
        onSave={(payload) => saveM.mutate(payload)}
        saving={saveM.isPending}
      />
    </div>
  );
}

function PrevisaoSheet({
  open,
  row,
  ano,
  financiamentos,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  row: Previsao | null;
  ano: number;
  financiamentos: Financiamento[];
  onClose: () => void;
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const isEdit = !!row?.id;
  const [data, setData] = useState(row?.data ?? `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`);
  const [descricao, setDescricao] = useState(row?.descricao ?? "");
  const [tipo, setTipo] = useState<"Entrada" | "Saida">(row?.tipo ?? "Saida");
  const [categoria, setCategoria] = useState<string>(row?.categoria ?? "");
  const [valor, setValor] = useState<string>(row?.valor ? String(row.valor) : "");
  const [estado, setEstado] = useState<string>(row?.estado ?? "Previsto");
  const [recorrente, setRecorrente] = useState<boolean>(row?.recorrente ?? false);
  const [meses, setMeses] = useState<string>(row?.recorrencia_meses ? String(row.recorrencia_meses) : "3");
  const [financiamentoId, setFinanciamentoId] = useState<string>(row?.financiamento_id ?? "");
  const [notas, setNotas] = useState<string>(row?.notas ?? "");

  // reset on open
  useMemo(() => {
    if (!open) return;
    setData(row?.data ?? `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`);
    setDescricao(row?.descricao ?? "");
    setTipo(row?.tipo ?? "Saida");
    setCategoria(row?.categoria ?? "");
    setValor(row?.valor ? String(row.valor) : "");
    setEstado(row?.estado ?? "Previsto");
    setRecorrente(row?.recorrente ?? false);
    setMeses(row?.recorrencia_meses ? String(row.recorrencia_meses) : "3");
    setFinanciamentoId(row?.financiamento_id ?? "");
    setNotas(row?.notas ?? "");
  }, [open, row, ano]);

  const handleSave = () => {
    if (!descricao.trim() || !data || !valor) {
      toast.error("Preencha data, descrição e valor");
      return;
    }
    onSave({
      id: row?.id,
      data,
      descricao: descricao.trim(),
      tipo,
      categoria: categoria || null,
      valor: Math.abs(Number(valor)),
      estado,
      recorrente: !isEdit && recorrente,
      recorrencia_meses: !isEdit && recorrente ? Number(meses) : null,
      financiamento_id: financiamentoId || null,
      notas: notas || null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar previsão" : "Nova previsão"}</SheetTitle>
          <SheetDescription>Entrada ou saída prevista de tesouraria</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">Entrada</SelectItem>
                  <SelectItem value="Saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria || "_none"} onValueChange={(v) => setCategoria(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (€)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === "Entrada" && (
            <div>
              <Label>Ligar a financiamento</Label>
              <Select value={financiamentoId || "_none"} onValueChange={(v) => setFinanciamentoId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {financiamentos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.financiador_nome} — {f.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isEdit && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="rec" checked={recorrente} onCheckedChange={(v) => setRecorrente(!!v)} />
                <Label htmlFor="rec" className="cursor-pointer">Recorrente (mensal)</Label>
              </div>
              {recorrente && (
                <div>
                  <Label>Número de meses (até 24)</Label>
                  <Input type="number" min={1} max={24} value={meses} onChange={(e) => setMeses(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Guardar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
