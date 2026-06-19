import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listarProjetos,
  listarCentrosCustoDisponiveis,
  atribuirCentrosCustoAProjeto,
} from "@/lib/centros-custo.functions";
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

export const Route = createFileRoute("/_authenticated/centros-custo")({
  component: CentrosCustoPage,
});

type Projeto = {
  projeto: string;
  centros_custo: string[];
  num_centros: number;
};
type CC = { centro_custo: string; projeto: string | null; linhas: number };

function CentrosCustoPage() {
  const projetosFn = useServerFn(listarProjetos);
  const ccFn = useServerFn(listarCentrosCustoDisponiveis);
  const saveFn = useServerFn(atribuirCentrosCustoAProjeto);
  const qc = useQueryClient();

  const { data: projetos, isLoading } = useQuery({
    queryKey: ["projetos-listagem"],
    queryFn: () => projetosFn(),
  });
  const { data: ccs } = useQuery({
    queryKey: ["centros-custo-disponiveis"],
    queryFn: () => ccFn(),
  });

  const [sel, setSel] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!projetos) return;
    setSel(
      Object.fromEntries(projetos.map((p) => [p.projeto, [...p.centros_custo]])),
    );
  }, [projetos]);

  const [filter, setFilter] = useState("");

  const mut = useMutation({
    mutationFn: async (
      items: Array<{ projeto: string; centros_custo: string[] }>,
    ) => {
      for (const v of items) await saveFn({ data: v });
      return items.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Projeto guardado" : `${n} projetos guardados`);
      qc.invalidateQueries({ queryKey: ["projetos-listagem"] });
      qc.invalidateQueries({ queryKey: ["centros-custo-disponiveis"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const original = useMemo(
    () =>
      new Map(
        (projetos ?? []).map((p) => [p.projeto, [...p.centros_custo].sort()]),
      ),
    [projetos],
  );

  const isDirty = (projeto: string) => {
    const a = [...(sel[projeto] ?? [])].sort();
    const b = original.get(projeto) ?? [];
    if (a.length !== b.length) return true;
    return a.some((x, i) => x !== b[i]);
  };

  const dirtyItems = useMemo(() => {
    return Object.entries(sel)
      .filter(([p]) => isDirty(p))
      .map(([projeto, centros_custo]) => ({ projeto, centros_custo }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, original]);

  const ccList = ccs ?? [];
  const ccToProjeto = useMemo(() => {
    const m = new Map<string, string>();
    for (const [p, list] of Object.entries(sel)) {
      for (const c of list) m.set(c, p);
    }
    return m;
  }, [sel]);

  const totalCC = ccList.length;
  const ccAtribuidos = ccToProjeto.size;
  const ccSemProjeto = totalCC - ccAtribuidos;

  const filtered = (projetos ?? []).filter((p) =>
    p.projeto.toLowerCase().includes(filter.toLowerCase()),
  );

  const saveAll = () => {
    if (dirtyItems.length === 0) return;
    mut.mutate(dirtyItems);
  };

  const toggleCC = (projeto: string, cc: string) => {
    setSel((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k !== projeto) next[k] = next[k].filter((c) => c !== cc);
      }
      const cur = next[projeto] ?? [];
      next[projeto] = cur.includes(cc)
        ? cur.filter((c) => c !== cc)
        : [...cur, cc];
      return next;
    });
  };

  const removeCC = (projeto: string, cc: string) => {
    setSel((prev) => ({
      ...prev,
      [projeto]: (prev[projeto] ?? []).filter((c) => c !== cc),
    }));
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Projetos / Centros de Custo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A cada projeto do orçamento, atribui um ou vários centros de custo
            dos movimentos. Cada centro de custo só pode pertencer a um projeto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard
            label="Projetos"
            value={String((projetos ?? []).length)}
            tone="receita"
          />
          <SummaryCard
            label="CC atribuídos"
            value={String(ccAtribuidos)}
            tone="receita"
          />
          <SummaryCard
            label="CC sem projeto"
            value={String(ccSemProjeto)}
            tone="despesa"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar projetos…"
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
          Nenhum projeto encontrado no orçamento.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const selected = sel[p.projeto] ?? [];
            const dirty = isDirty(p.projeto);
            return (
              <div
                key={p.projeto}
                className={`rounded-md border p-3 ${dirty ? "border-primary/60 bg-primary/5" : ""}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[200px] flex-shrink-0">
                    <div className="font-medium">{p.projeto}</div>
                    <div className="text-xs text-muted-foreground">
                      {selected.length} CC{selected.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {selected.map((c) => (
                      <Badge
                        key={c}
                        variant="secondary"
                        className="gap-1 font-mono text-xs"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => removeCC(p.projeto, c)}
                          className="ml-0.5 rounded hover:bg-foreground/10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <CCPicker
                      ccs={ccList}
                      selected={selected}
                      ccToProjeto={ccToProjeto}
                      currentProjeto={p.projeto}
                      onToggle={(c) => toggleCC(p.projeto, c)}
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

function CCPicker({
  ccs,
  selected,
  ccToProjeto,
  currentProjeto,
  onToggle,
}: {
  ccs: CC[];
  selected: string[];
  ccToProjeto: Map<string, string>;
  currentProjeto: string;
  onToggle: (cc: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = ccs.filter((c) => {
    const owner = ccToProjeto.get(c.centro_custo);
    if (owner && owner !== currentProjeto) return false;
    if (!q) return true;
    return c.centro_custo.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
          Adicionar CC
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="border-b p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar centro de custo…"
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="h-72">
          <div className="p-1">
            {filtered.map((c) => {
              const isSel = selected.includes(c.centro_custo);
              return (
                <label
                  key={c.centro_custo}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => onToggle(c.centro_custo)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{c.centro_custo}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.linhas} movimento{c.linhas === 1 ? "" : "s"}
                    </div>
                  </div>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                Sem centros de custo.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
