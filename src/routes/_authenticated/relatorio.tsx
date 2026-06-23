import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SummaryCard, CurrencyCell } from "@/components/data-grid";
import { currency } from "@/lib/format";
import { resumoDashboard } from "@/lib/dashboard.functions";
import { listarFinanciamentos, type Financiamento } from "@/lib/financiadores.functions";
import { listarProjetos } from "@/lib/centros-custo.functions";
import { listarNotasRelatorio, guardarNotaRelatorio, type NotaRelatorio } from "@/lib/relatorio.functions";

export const Route = createFileRoute("/_authenticated/relatorio")({
  component: RelatorioPage,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["relatorio", "projetos"],
        queryFn: () => listarProjetos(),
      }),
    ),
});

type Vista = "execucao" | "financiador" | "resumo";

const TODOS = "__todos__";

function RelatorioPage() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const [projeto, setProjeto] = useState<string>(TODOS);
  const [vista, setVista] = useState<Vista>("execucao");

  const qc = useQueryClient();
  const resumoFn = useServerFn(resumoDashboard);
  const financiamentosFn = useServerFn(listarFinanciamentos);
  const notasFn = useServerFn(listarNotasRelatorio);
  const guardarNotaFn = useServerFn(guardarNotaRelatorio);

  const { data: projetos } = useSuspenseQuery(
    queryOptions({ queryKey: ["relatorio", "projetos"], queryFn: () => listarProjetos() }),
  );

  const resumoQ = useQuery({
    queryKey: ["relatorio", "resumo", ano],
    queryFn: () => resumoFn({ data: { ano, mes: 12, mesCumulativo: true } }),
  });

  const financiamentosQ = useQuery({
    queryKey: ["relatorio", "financiamentos", ano],
    queryFn: () => financiamentosFn({ data: { ano } }),
  });

  const notasQ = useQuery({
    queryKey: ["relatorio", "notas", ano, projeto],
    queryFn: () => notasFn({ data: { ano, projeto: projeto === TODOS ? null : projeto } }),
  });

  const saveNota = useMutation({
    mutationFn: (input: { rubrica: string; nota: string }) =>
      guardarNotaFn({
        data: {
          ano,
          projeto: projeto === TODOS ? "__all__" : projeto,
          rubrica: input.rubrica,
          nota: input.nota,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relatorio", "notas", ano] });
    },
    onError: (e: any) => toast.error(`Erro a guardar: ${e?.message ?? e}`),
  });

  const anos = useMemo(() => {
    const set = new Set<number>();
    for (let y = anoAtual - 3; y <= anoAtual + 1; y++) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, [anoAtual]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["relatorio"] });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background px-6 py-3">
        <h1 className="mr-4 text-lg font-semibold">Relatório de Execução</h1>

        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projeto} onValueChange={setProjeto}>
          <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os projetos</SelectItem>
            {projetos.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
          <TabsList>
            <TabsTrigger value="execucao">Execução Orçamental</TabsTrigger>
            <TabsTrigger value="financiador">Por Financiador</TabsTrigger>
            <TabsTrigger value="resumo">Resumo Executivo</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1 h-4 w-4" /> Atualizar
          </Button>
          <ExportCsvButton
            vista={vista}
            ano={ano}
            projeto={projeto}
            resumo={resumoQ.data}
            financiamentos={financiamentosQ.data}
          />
          {vista === "resumo" && (
            <CopyResumoButton
              ano={ano}
              resumo={resumoQ.data}
              financiamentos={financiamentosQ.data}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {vista === "execucao" && (
          <VistaExecucao
            loading={resumoQ.isLoading}
            resumo={resumoQ.data}
            projeto={projeto}
            notas={notasQ.data ?? []}
            onSaveNota={(rubrica, nota) => saveNota.mutate({ rubrica, nota })}
          />
        )}
        {vista === "financiador" && (
          <VistaFinanciador
            loading={financiamentosQ.isLoading}
            financiamentos={financiamentosQ.data ?? []}
          />
        )}
        {vista === "resumo" && (
          <VistaResumo
            ano={ano}
            resumo={resumoQ.data}
            financiamentos={financiamentosQ.data ?? []}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------- Vista: Execução Orçamental -------------------- */

type RubricaRow = {
  rubrica: string;
  orcadoReceita: number;
  orcadoDespesa: number;
  realizadoReceita: number;
  realizadoDespesa: number;
  orcado: number;
  realizado: number;
};

function VistaExecucao({
  loading,
  resumo,
  projeto,
  notas,
  onSaveNota,
}: {
  loading: boolean;
  resumo: any;
  projeto: string;
  notas: NotaRelatorio[];
  onSaveNota: (rubrica: string, nota: string) => void;
}) {
  const rubricas: RubricaRow[] = useMemo(() => resumo?.rubricas ?? [], [resumo]);
  // If specific project selected, filter by orçamento mapping is not available at rubrica level — show all rubricas.
  const filtered = rubricas;

  const notaMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notas) m.set(n.rubrica, n.nota);
    return m;
  }, [notas]);

  const totalReceitaOrc = filtered.reduce((s, r) => s + r.orcadoReceita, 0);
  const totalDespesaOrc = filtered.reduce((s, r) => s + r.orcadoDespesa, 0);
  const totalReceitaReal = filtered.reduce((s, r) => s + r.realizadoReceita, 0);
  const totalDespesaReal = filtered.reduce((s, r) => s + r.realizadoDespesa, 0);
  const resultadoOrc = totalReceitaOrc - totalDespesaOrc;
  const resultadoReal = totalReceitaReal - totalDespesaReal;

  if (loading) return <div className="text-sm text-muted-foreground">A carregar…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Receita orçamentada" value={currency.format(totalReceitaOrc)} tone="receita" />
        <SummaryCard label="Receita realizada" value={currency.format(totalReceitaReal)} tone="receita" />
        <SummaryCard label="Despesa orçamentada" value={currency.format(-Math.abs(totalDespesaOrc))} tone="despesa" />
        <SummaryCard label="Despesa realizada" value={currency.format(-Math.abs(totalDespesaReal))} tone="despesa" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Rubrica</th>
                <th className="px-3 py-2 text-right">Orç. Receita</th>
                <th className="px-3 py-2 text-right">Real Receita</th>
                <th className="px-3 py-2 text-right">Orç. Despesa</th>
                <th className="px-3 py-2 text-right">Real Despesa</th>
                <th className="px-3 py-2 text-right">Resultado</th>
                <th className="px-3 py-2 text-right">% Execução</th>
                <th className="px-3 py-2 text-left">Observações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground">
                    Sem dados para o período.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const orcadoTotal = r.orcadoReceita + r.orcadoDespesa;
                const realTotal = r.realizadoReceita + r.realizadoDespesa;
                const pct = orcadoTotal > 0 ? realTotal / orcadoTotal : 0;
                const result = r.realizadoReceita - r.realizadoDespesa;
                return (
                  <tr key={r.rubrica} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{r.rubrica}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><CurrencyCell value={r.orcadoReceita} tone="receita" showZeroAsDash /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><CurrencyCell value={r.realizadoReceita} tone="receita" showZeroAsDash /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><CurrencyCell value={r.orcadoDespesa} tone="despesa" showZeroAsDash /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><CurrencyCell value={r.realizadoDespesa} tone="despesa" showZeroAsDash /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><CurrencyCell value={result} tone="auto" /></td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <ExecPill pct={pct} />
                    </td>
                    <td className="px-3 py-2">
                      <InlineNote
                        initial={notaMap.get(r.rubrica) ?? ""}
                        onSave={(v) => onSaveNota(r.rubrica, v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right"><CurrencyCell value={totalReceitaOrc} tone="receita" /></td>
                <td className="px-3 py-2 text-right"><CurrencyCell value={totalReceitaReal} tone="receita" /></td>
                <td className="px-3 py-2 text-right"><CurrencyCell value={totalDespesaOrc} tone="despesa" /></td>
                <td className="px-3 py-2 text-right"><CurrencyCell value={totalDespesaReal} tone="despesa" /></td>
                <td className="px-3 py-2 text-right"><CurrencyCell value={resultadoReal} tone="auto" /></td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {resultadoOrc !== 0 ? `Orç: ${currency.format(resultadoOrc)}` : "—"}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Projeto: <span className="font-medium">{projeto === TODOS ? "Todos" : projeto}</span> · As observações são guardadas automaticamente.
      </p>
    </div>
  );
}

function ExecPill({ pct }: { pct: number }) {
  const tone =
    pct > 1
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      : pct > 0.8
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : pct > 0
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {(pct * 100).toFixed(0)}%
    </span>
  );
}

function InlineNote({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <Textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== initial) onSave(v);
      }}
      placeholder="Adicionar nota…"
      rows={1}
      className="min-h-[34px] resize-none text-xs"
    />
  );
}

/* -------------------- Vista: Por Financiador -------------------- */

function VistaFinanciador({
  loading,
  financiamentos,
}: {
  loading: boolean;
  financiamentos: Financiamento[];
}) {
  const grupos = useMemo(() => {
    const map = new Map<string, { nome: string; tipo: string; itens: Financiamento[] }>();
    for (const f of financiamentos) {
      const k = f.financiador_id;
      if (!map.has(k)) map.set(k, { nome: f.financiador_nome, tipo: f.financiador_tipo, itens: [] });
      map.get(k)!.itens.push(f);
    }
    return Array.from(map.entries()).map(([id, g]) => ({ id, ...g }));
  }, [financiamentos]);

  if (loading) return <div className="text-sm text-muted-foreground">A carregar…</div>;
  if (grupos.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Sem financiamentos para o ano selecionado.
      </div>
    );
  }

  const totalAprov = financiamentos.reduce((s, f) => s + Number(f.valor_aprovado), 0);
  const totalReceb = financiamentos.reduce((s, f) => s + Number(f.valor_recebido), 0);
  const totalReceber = financiamentos.reduce((s, f) => s + Number(f.por_receber), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard label="Total aprovado" value={currency.format(totalAprov)} tone="neutral" />
        <SummaryCard label="Total recebido" value={currency.format(totalReceb)} tone="receita" />
        <SummaryCard label="Por receber" value={currency.format(totalReceber)} tone="despesa" />
      </div>

      {grupos.map((g) => {
        const subAprov = g.itens.reduce((s, f) => s + Number(f.valor_aprovado), 0);
        const subReceb = g.itens.reduce((s, f) => s + Number(f.valor_recebido), 0);
        const subReceber = g.itens.reduce((s, f) => s + Number(f.por_receber), 0);
        return (
          <Card key={g.id} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{g.nome}</span>
                <Badge variant="outline">{g.tipo}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Aprovado <strong>{currency.format(subAprov)}</strong> ·
                Recebido <strong>{currency.format(subReceb)}</strong> ·
                Por receber <strong>{currency.format(subReceber)}</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-left">Projeto</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Aprovado</th>
                    <th className="px-3 py-2 text-right">Recebido</th>
                    <th className="px-3 py-2 text-right">Por Receber</th>
                  </tr>
                </thead>
                <tbody>
                  {g.itens.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{f.descricao}</td>
                      <td className="px-3 py-2 text-muted-foreground">{f.projeto ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant="secondary">{f.estado}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(Number(f.valor_aprovado))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(Number(f.valor_recebido))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency.format(Number(f.por_receber))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* -------------------- Vista: Resumo Executivo -------------------- */

function buildResumoText(ano: number, resumo: any, financiamentos: Financiamento[]) {
  if (!resumo) return "A carregar…";
  const k = resumo.kpis;
  const lines: string[] = [];
  lines.push(`RELATÓRIO DE EXECUÇÃO ${ano}`);
  lines.push("=".repeat(40));
  lines.push("");
  lines.push("EXECUÇÃO ORÇAMENTAL");
  lines.push(`  Receita orçamentada : ${currency.format(k.receitaOrc)}`);
  lines.push(`  Receita realizada   : ${currency.format(k.receitaReal)}`);
  lines.push(`  Despesa orçamentada : ${currency.format(k.despesaOrc)}`);
  lines.push(`  Despesa realizada   : ${currency.format(k.despesaReal)}`);
  lines.push(`  Resultado realizado : ${currency.format(k.receitaReal - k.despesaReal)}`);
  lines.push("");
  lines.push("FINANCIAMENTOS");
  const totalA = financiamentos.reduce((s, f) => s + Number(f.valor_aprovado), 0);
  const totalR = financiamentos.reduce((s, f) => s + Number(f.valor_recebido), 0);
  const totalP = financiamentos.reduce((s, f) => s + Number(f.por_receber), 0);
  lines.push(`  Total aprovado : ${currency.format(totalA)}`);
  lines.push(`  Total recebido : ${currency.format(totalR)}`);
  lines.push(`  Por receber    : ${currency.format(totalP)}`);
  lines.push("");
  lines.push("POR FINANCIADOR");
  const map = new Map<string, { aprov: number; receb: number }>();
  for (const f of financiamentos) {
    const key = f.financiador_nome;
    if (!map.has(key)) map.set(key, { aprov: 0, receb: 0 });
    const r = map.get(key)!;
    r.aprov += Number(f.valor_aprovado);
    r.receb += Number(f.valor_recebido);
  }
  for (const [nome, v] of map) {
    lines.push(`  ${nome.padEnd(30)} ${currency.format(v.aprov).padStart(14)} → ${currency.format(v.receb).padStart(14)}`);
  }
  return lines.join("\n");
}

function VistaResumo({
  ano,
  resumo,
  financiamentos,
}: {
  ano: number;
  resumo: any;
  financiamentos: Financiamento[];
}) {
  const texto = useMemo(() => buildResumoText(ano, resumo, financiamentos), [ano, resumo, financiamentos]);
  return (
    <Card className="p-4">
      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{texto}</pre>
    </Card>
  );
}

/* -------------------- Botões Exportar / Copiar -------------------- */

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(";"),
    )
    .join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExportCsvButton({
  vista,
  ano,
  projeto,
  resumo,
  financiamentos,
}: {
  vista: Vista;
  ano: number;
  projeto: string;
  resumo: any;
  financiamentos?: Financiamento[];
}) {
  const handle = () => {
    if (vista === "execucao") {
      const rows: (string | number)[][] = [
        ["Rubrica", "Orç. Receita", "Real Receita", "Orç. Despesa", "Real Despesa", "Resultado", "% Execução"],
      ];
      for (const r of resumo?.rubricas ?? []) {
        const orcadoTotal = r.orcadoReceita + r.orcadoDespesa;
        const realTotal = r.realizadoReceita + r.realizadoDespesa;
        const pct = orcadoTotal > 0 ? realTotal / orcadoTotal : 0;
        rows.push([
          r.rubrica,
          r.orcadoReceita,
          r.realizadoReceita,
          r.orcadoDespesa,
          r.realizadoDespesa,
          r.realizadoReceita - r.realizadoDespesa,
          `${(pct * 100).toFixed(1)}%`,
        ]);
      }
      downloadCsv(`relatorio-execucao-${ano}-${projeto === TODOS ? "todos" : projeto}.csv`, toCsv(rows));
    } else if (vista === "financiador") {
      const rows: (string | number)[][] = [
        ["Financiador", "Tipo", "Descrição", "Projeto", "Estado", "Aprovado", "Recebido", "Por Receber"],
      ];
      for (const f of financiamentos ?? []) {
        rows.push([
          f.financiador_nome,
          f.financiador_tipo,
          f.descricao,
          f.projeto ?? "",
          f.estado,
          Number(f.valor_aprovado),
          Number(f.valor_recebido),
          Number(f.por_receber),
        ]);
      }
      downloadCsv(`relatorio-financiadores-${ano}.csv`, toCsv(rows));
    } else {
      const txt = buildResumoText(ano, resumo, financiamentos ?? []);
      downloadCsv(`relatorio-resumo-${ano}.txt`, txt);
    }
    toast.success("Exportação concluída.");
  };
  return (
    <Button variant="outline" size="sm" onClick={handle}>
      <Download className="mr-1 h-4 w-4" /> Exportar
    </Button>
  );
}

function CopyResumoButton({
  ano,
  resumo,
  financiamentos,
}: {
  ano: number;
  resumo: any;
  financiamentos?: Financiamento[];
}) {
  const handle = async () => {
    const text = buildResumoText(ano, resumo, financiamentos ?? []);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumo copiado para o clipboard.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={handle}>
      <Copy className="mr-1 h-4 w-4" /> Copiar
    </Button>
  );
}
