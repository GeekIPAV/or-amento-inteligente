import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listarMovimentos } from "@/lib/extratos.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

type SortKey = keyof Mov;

const fmt = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

const COLUNAS: { key: SortKey; label: string; numeric?: boolean; align?: "right" }[] = [
  { key: "data", label: "Data" },
  { key: "mes_referencia", label: "Mês Ref." },
  { key: "conta", label: "Conta" },
  { key: "descricao_conta", label: "Descrição Conta" },
  { key: "num_documento", label: "Nº Doc." },
  { key: "diario", label: "Diário" },
  { key: "movimento", label: "Movimento" },
  { key: "centro_custo", label: "C. Custo" },
  { key: "debito", label: "Débito", numeric: true, align: "right" },
  { key: "credito", label: "Crédito", numeric: true, align: "right" },
];

function MovimentosPage() {
  const fn = useServerFn(listarMovimentos);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["movimentos"],
    queryFn: () => fn(),
  });

  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const setFiltro = (k: string, v: string) =>
    setFiltros((p) => ({ ...p, [k]: v }));

  const filtered = useMemo(() => {
    return (rows as Mov[]).filter((r) => {
      for (const c of COLUNAS) {
        const f = filtros[c.key]?.trim().toLowerCase();
        if (!f) continue;
        const v = r[c.key];
        if (v === null || v === undefined) return false;
        if (!String(v).toLowerCase().includes(f)) return false;
      }
      return true;
    });
  }, [rows, filtros]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const resumo = useMemo(() => {
    let deb = 0,
      cred = 0;
    for (const r of sorted) {
      deb += Number(r.debito) || 0;
      cred += Number(r.credito) || 0;
    }
    return { deb, cred, saldo: cred - deb, linhas: sorted.length };
  }, [sorted]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const mesesDisponiveis = useMemo(() => {
    return Array.from(new Set((rows as Mov[]).map((r) => r.mes_referencia))).sort();
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Movimentos</h1>
        <p className="text-sm text-muted-foreground">
          Todos os movimentos importados dos extratos.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Linhas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{resumo.linhas}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Débito</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{fmt.format(resumo.deb)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Crédito</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">{fmt.format(resumo.cred)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo</CardTitle></CardHeader>
          <CardContent className={cn("text-2xl font-semibold", resumo.saldo >= 0 ? "text-emerald-600" : "text-destructive")}>
            {fmt.format(resumo.saldo)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Tabela de Movimentos</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={filtros.mes_referencia ?? "__all__"}
              onValueChange={(v) => setFiltro("mes_referencia", v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Mês de referência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os meses</SelectItem>
                {mesesDisponiveis.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltros({})}
              disabled={Object.values(filtros).every((v) => !v)}
            >
              <X className="size-4 mr-1" /> Limpar filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  {COLUNAS.map((c) => (
                    <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        {c.label}
                        {sortKey === c.key ? (
                          sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  {COLUNAS.map((c) => (
                    <TableHead key={c.key + "-f"} className="py-1">
                      <Input
                        value={filtros[c.key] ?? ""}
                        onChange={(e) => setFiltro(c.key, e.target.value)}
                        placeholder="Filtrar…"
                        className="h-7 text-xs"
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={COLUNAS.length} className="text-center text-muted-foreground py-8">
                      A carregar…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUNAS.length} className="text-center text-muted-foreground py-8">
                      Sem resultados.
                    </TableCell>
                  </TableRow>
                )}
                {sorted.slice(0, 1000).map((r) => (
                  <TableRow key={r.id}>
                    {COLUNAS.map((c) => {
                      const v = r[c.key];
                      if (c.numeric) {
                        const n = Number(v) || 0;
                        return (
                          <TableCell key={c.key} className="text-right tabular-nums">
                            {n === 0 ? <span className="text-muted-foreground">—</span> : fmt.format(n)}
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={c.key} className="text-sm">
                          {v ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {sorted.length > 1000 && (
            <p className="text-xs text-muted-foreground mt-2">
              A mostrar as primeiras 1000 de {sorted.length} linhas. Use filtros para refinar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
