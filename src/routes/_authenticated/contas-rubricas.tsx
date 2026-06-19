import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listarRubricas,
  listarContasDisponiveis,
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

export const Route = createFileRoute("/_authenticated/contas-rubricas")({
  component: ContasRubricasPage,
});

type Rubrica = { rubrica: string; contas: string[]; num_contas: number };
type Conta = {
  conta: string;
  descricao_conta: string | null;
  rubrica: string | null;
};

function ContasRubricasPage() {
  const rubricasFn = useServerFn(listarRubricas);
  const contasFn = useServerFn(listarContasDisponiveis);
  const saveFn = useServerFn(atribuirContasARubrica);
  const qc = useQueryClient();

  const { data: rubricas, isLoading } = useQuery({
    queryKey: ["rubricas-listagem"],
    queryFn: () => rubricasFn(),
  });
  const { data: contas } = useQuery({
    queryKey: ["contas-disponiveis"],
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
      qc.invalidateQueries({ queryKey: ["contas-disponiveis"] });
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

  const filtered = (rubricas ?? []).filter((r) =>
    r.rubrica.toLowerCase().includes(filter.toLowerCase()),
  );

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

      {isLoading ? (
        <div className="text-sm text-muted-foreground">A carregar…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Nenhuma rubrica encontrada no orçamento.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const selected = sel[r.rubrica] ?? [];
            const dirty = isDirty(r.rubrica);
            return (
              <div
                key={r.rubrica}
                className={`rounded-md border p-3 ${dirty ? "border-primary/60 bg-primary/5" : ""}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[200px] flex-shrink-0">
                    <div className="font-medium">{r.rubrica}</div>
                    <div className="text-xs text-muted-foreground">
                      {selected.length} conta{selected.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
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
                </div>
              </div>
            );
          })}
        </div>
      )}
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
      <PopoverContent className="w-[420px] p-0" align="start">
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
              const owner = contaToRubrica.get(c.conta);
              const inOther = owner && owner !== currentRubrica;
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{c.conta}</span>
                      {inOther && (
                        <span className="text-[10px] text-muted-foreground">
                          (em: {owner})
                        </span>
                      )}
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
