import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listarRubricas,
  listarContas,
  atribuirContasARubrica,
} from "@/lib/contas-rubricas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Save, ChevronsUpDown, X } from "lucide-react";
import { SummaryCard } from "@/components/data-grid";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader, useSortableRows, useColumnWidths } from "@/components/sortable-table";

export const Route = createFileRoute("/_authenticated/contas-rubricas")({
  component: ContasRubricasPage,
});

type Conta = {
  conta: string;
  descricao_conta: string | null;
  rubrica: string | null;
  linhas: number;
};

function ContasRubricasPage() {
  const rubricasFn = useServerFn(listarRubricas);
  const contasFn = useServerFn(listarContas);
  const saveFn = useServerFn(atribuirContasARubrica);
  const qc = useQueryClient();

  const { data: rubricas, isLoading } = useQuery({
    queryKey: ["rubricas-listagem"],
    queryFn: () => rubricasFn(),
  });
  const { data: contas } = useQuery({
    queryKey: ["contas-listagem"],
    queryFn: () => contasFn(),
  });

  // local edits: rubrica -> selected contas[]
  const [sel, setSel] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!rubricas) return;
    setSel(Object.fromEntries(rubricas.map((r) => [r.rubrica, [...r.contas]])));
  }, [rubricas]);

  const [filter, setFilter] = useState("");

  const mut = useMutation({
    mutationFn: async (items: Array<{ rubrica: string; contas: string[] }>) => {
      for (const v of items) await saveFn({ data: v });
      return items.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Rubrica guardada" : `${n} rubricas guardadas`);
      qc.invalidateQueries({ queryKey: ["rubricas-listagem"] });
      qc.invalidateQueries({ queryKey: ["contas-listagem"] });
      qc.invalidateQueries({ queryKey: ["contas-rubricas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const original = useMemo(
    () => new Map((rubricas ?? []).map((r) => [r.rubrica, [...r.contas].sort()])),
    [rubricas],
  );

  const isDirty = (rubrica: string) => {
    const a = [...(sel[rubrica] ?? [])].sort();
    const b = original.get(rubrica) ?? [];
    if (a.length !== b.length) return true;
    return a.some((x, i) => x !== b[i]);
  };

  const dirtyItems = useMemo(() => {
    return Object.entries(sel)
      .filter(([rub]) => isDirty(rub))
      .map(([rubrica, contas]) => ({ rubrica, contas }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, original]);

  const contasList = contas ?? [];
  const contaLinhas = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contasList) m.set(c.conta, c.linhas ?? 0);
    return m;
  }, [contasList]);

  // map conta -> rubrica currently assigned in the LOCAL edits
  const contaToRubrica = useMemo(() => {
    const m = new Map<string, string>();
    for (const [rub, list] of Object.entries(sel)) {
      for (const c of list) m.set(c, rub);
    }
    return m;
  }, [sel]);

  const totalContas = contasList.length;
  const contasAtribuidas = contaToRubrica.size;
  const contasSemRubrica = totalContas - contasAtribuidas;
  const movsSemRubrica = contasList.reduce(
    (a, c) => a + (contaToRubrica.get(c.conta) ? 0 : (c.linhas ?? 0)),
    0,
  );

  const filtered = (rubricas ?? []).filter((r) =>
    r.rubrica.toLowerCase().includes(filter.toLowerCase()),
  );

  const movimentosByRubrica = (rub: string) =>
    (sel[rub] ?? []).reduce((a, c) => a + (contaLinhas.get(c) ?? 0), 0);

  const { sorted, sort, toggle } = useSortableRows(
    filtered,
    {
      rubrica: (r) => r.rubrica,
      ncontas: (r) => (sel[r.rubrica]?.length ?? 0),
      movimentos: (r) => movimentosByRubrica(r.rubrica),
    },
    { id: "movimentos", dir: "desc" },
  );

  const { widths, startResize, resizingId } = useColumnWidths({
    rubrica: 220,
    ncontas: 90,
    movimentos: 110,
    atribuidas: 480,
  });



  const saveAll = () => {
    if (dirtyItems.length === 0) return;
    mut.mutate(dirtyItems);
  };

  const toggleConta = (rubrica: string, conta: string) => {
    setSel((prev) => {
      const next = { ...prev };
      // remove from any other rubrica
      for (const k of Object.keys(next)) {
        if (k !== rubrica) next[k] = next[k].filter((c) => c !== conta);
      }
      const cur = next[rubrica] ?? [];
      next[rubrica] = cur.includes(conta)
        ? cur.filter((c) => c !== conta)
        : [...cur, conta];
      return next;
    });
  };

  const removeConta = (rubrica: string, conta: string) => {
    setSel((prev) => ({
      ...prev,
      [rubrica]: (prev[rubrica] ?? []).filter((c) => c !== conta),
    }));
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rubricas / Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A cada rubrica do orçamento, atribui uma ou várias contas dos
            movimentos. Cada conta só pode pertencer a uma rubrica.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard label="Rubricas" value={String((rubricas ?? []).length)} tone="receita" />
          <SummaryCard label="Contas atribuídas" value={String(contasAtribuidas)} tone="receita" />
          <SummaryCard label="Contas sem rubrica" value={String(contasSemRubrica)} tone="despesa" />
          {movsSemRubrica > 0 && (
            <SummaryCard label="⚠ Mov. sem rubrica" value={`${new Intl.NumberFormat("pt-PT").format(movsSemRubrica)} mov.`} tone="despesa" />
          )}
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar rubricas…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Button
          onClick={saveAll}
          disabled={dirtyItems.length === 0 || mut.isPending}
          className="ml-auto"
        >
          <Save className="mr-2 h-4 w-4" />
          {dirtyItems.length > 0
            ? `Gravar ${dirtyItems.length} alteraç${dirtyItems.length === 1 ? "ão" : "ões"}`
            : "Gravar"}
        </Button>
      </div>

      <div className="overflow-auto rounded-md border">
        <Table style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <SortHeader id="rubrica" sort={sort} onToggle={toggle} width={widths.rubrica} onResizeStart={startResize} resizing={resizingId === "rubrica"}>
                Rubrica
              </SortHeader>
              <SortHeader id="ncontas" sort={sort} onToggle={toggle} align="right" width={widths.ncontas} onResizeStart={startResize} resizing={resizingId === "ncontas"}>
                Contas
              </SortHeader>
              <SortHeader id="movimentos" sort={sort} onToggle={toggle} align="right" width={widths.movimentos} onResizeStart={startResize} resizing={resizingId === "movimentos"}>
                Movimentos
              </SortHeader>
              <SortHeader id="atribuidas" sort={sort} onToggle={toggle} sortable={false} width={widths.atribuidas} onResizeStart={startResize} resizing={resizingId === "atribuidas"}>
                Contas atribuídas
              </SortHeader>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhuma rubrica encontrada no orçamento.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => {
                const selected = sel[r.rubrica] ?? [];
                const dirty = isDirty(r.rubrica);
                const mov = movimentosByRubrica(r.rubrica);
                return (
                  <TableRow
                    key={r.rubrica}
                    className={dirty ? "bg-primary/5" : undefined}
                  >
                    <TableCell className="px-3 py-2 align-top font-medium">
                      {r.rubrica}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-right tabular-nums">
                      {selected.length}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-right tabular-nums">
                      {mov}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selected.map((c) => {
                          const meta = contasList.find((x) => x.conta === c);
                          return (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="gap-1 font-mono text-xs"
                              title={meta?.descricao_conta ?? ""}
                            >
                              {c}
                              <button
                                type="button"
                                onClick={() => removeConta(r.rubrica, c)}
                                className="ml-0.5 rounded hover:bg-foreground/10"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                        <ContasPicker
                          contas={contasList}
                          selected={selected}
                          contaToRubrica={contaToRubrica}
                          currentRubrica={r.rubrica}
                          onToggle={(c) => toggleConta(r.rubrica, c)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {sorted.length > 0 && (
            <TableFooter className="bg-muted/70">
              <TableRow className="border-t-2 hover:bg-transparent">
                <TableCell className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                  <span className="ml-1 normal-case text-muted-foreground/70">
                    ({sorted.length})
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                  {new Intl.NumberFormat("pt-PT").format(
                    sorted.reduce((a, r) => a + (sel[r.rubrica]?.length ?? 0), 0),
                  )}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                  {new Intl.NumberFormat("pt-PT").format(
                    sorted.reduce((a, r) => a + movimentosByRubrica(r.rubrica), 0),
                  )}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>

      </div>
    </div>
  );
}

function ContasPicker({
  contas,
  selected,
  contaToRubrica,
  currentRubrica,
  onToggle,
}: {
  contas: Conta[];
  selected: string[];
  contaToRubrica: Map<string, string>;
  currentRubrica: string;
  onToggle: (conta: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = contas.filter((c) => {
    const owner = contaToRubrica.get(c.conta);
    if (owner && owner !== currentRubrica) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.conta.toLowerCase().includes(s) ||
      (c.descricao_conta ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
          Adicionar conta
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[440px] p-0" align="start">
        <div className="border-b p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar conta ou descrição…"
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="h-72">
          <div className="p-1">
            {filtered.map((c) => {
              const isSel = selected.includes(c.conta);
              return (
                <label
                  key={c.conta}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => onToggle(c.conta)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{c.conta}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {c.linhas} mov.
                      </span>
                    </div>
                    {c.descricao_conta && (
                      <div className="truncate text-xs text-muted-foreground">
                        {c.descricao_conta}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                Sem contas.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
