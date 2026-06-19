import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listarProjetos,
  listarCentrosCustoDisponiveis,
  guardarCentroCusto,
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
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader, useSortableRows, useColumnWidths } from "@/components/sortable-table";


export const Route = createFileRoute("/_authenticated/centros-custo")({
  component: CentrosCustoPage,
});

type CC = {
  centro_custo: string;
  nome_display: string;
  projetos: string[];
  linhas: number;
};

function CentrosCustoPage() {
  const listFn = useServerFn(listarCentrosCustoDisponiveis);
  const projsFn = useServerFn(listarProjetos);
  const saveFn = useServerFn(guardarCentroCusto);
  const qc = useQueryClient();

  const { data: ccs, isLoading } = useQuery({
    queryKey: ["centros-custo-disponiveis"],
    queryFn: () => listFn(),
  });
  const { data: projetos } = useQuery({
    queryKey: ["projetos-disponiveis"],
    queryFn: () => projsFn(),
  });

  // edits per CC
  const [edits, setEdits] = useState<
    Record<string, { nome_display: string; projetos: string[] }>
  >({});
  useEffect(() => {
    if (!ccs) return;
    setEdits(
      Object.fromEntries(
        ccs.map((c) => [
          c.centro_custo,
          { nome_display: c.nome_display, projetos: [...c.projetos] },
        ]),
      ),
    );
  }, [ccs]);

  const [filter, setFilter] = useState("");

  const original = useMemo(
    () =>
      new Map(
        (ccs ?? []).map((c) => [
          c.centro_custo,
          {
            nome_display: c.nome_display,
            projetos: [...c.projetos].sort(),
          },
        ]),
      ),
    [ccs],
  );

  const isDirty = (cc: string) => {
    const a = edits[cc];
    const b = original.get(cc);
    if (!a || !b) return false;
    if (a.nome_display.trim() !== b.nome_display) return true;
    const ap = [...a.projetos].sort();
    if (ap.length !== b.projetos.length) return true;
    return ap.some((x, i) => x !== b.projetos[i]);
  };

  const dirtyItems = useMemo(() => {
    return Object.entries(edits)
      .filter(([cc, v]) => v.nome_display.trim() !== "" && isDirty(cc))
      .map(([centro_custo, v]) => ({
        centro_custo,
        nome_display: v.nome_display.trim(),
        projetos: v.projetos,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, original]);

  const mut = useMutation({
    mutationFn: async (
      items: Array<{
        centro_custo: string;
        nome_display: string;
        projetos: string[];
      }>,
    ) => {
      for (const v of items) await saveFn({ data: v });
      return items.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Guardado" : `${n} centros de custo guardados`);
      qc.invalidateQueries({ queryKey: ["centros-custo-disponiveis"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ccList = ccs ?? [];
  const filtered = ccList.filter((c) => {
    const s = filter.toLowerCase();
    if (!s) return true;
    const e = edits[c.centro_custo];
    return (
      c.centro_custo.toLowerCase().includes(s) ||
      (e?.nome_display ?? "").toLowerCase().includes(s)
    );
  });

  const { sorted, sort, toggle } = useSortableRows(
    filtered,
    {
      cc: (c) => c.centro_custo,
      linhas: (c) => c.linhas,
      nprojs: (c) => (edits[c.centro_custo]?.projetos.length ?? 0),
      nome: (c) => edits[c.centro_custo]?.nome_display ?? "",
    },
    { id: "linhas", dir: "desc" },
  );

  const { widths, startResize, resizingId } = useColumnWidths({
    cc: 180,
    linhas: 110,
    nprojs: 90,
    projetos: 360,
    nome: 260,
    acao: 80,
  });




  const comNome = ccList.filter(
    (c) => (edits[c.centro_custo]?.nome_display ?? "").trim() !== "",
  ).length;

  const projetoToCC = useMemo(() => {
    const m = new Map<string, string>();
    for (const [cc, e] of Object.entries(edits)) {
      for (const p of e.projetos) m.set(p, cc);
    }
    return m;
  }, [edits]);

  const projetosPorAtribuir = useMemo(() => {
    const lista = projetos ?? [];
    return lista.filter((p) => !projetoToCC.has(p)).length;
  }, [projetos, projetoToCC]);

  const toggleProjeto = (cc: string, projeto: string) => {
    setEdits((prev) => {
      const next: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) {
        if (k === cc) continue;
        next[k] = { ...v, projetos: v.projetos.filter((p) => p !== projeto) };
      }
      const cur = prev[cc] ?? { nome_display: "", projetos: [] };
      const has = cur.projetos.includes(projeto);
      next[cc] = {
        ...cur,
        projetos: has
          ? cur.projetos.filter((p) => p !== projeto)
          : [...cur.projetos, projeto],
      };
      return next;
    });
  };

  const setNome = (cc: string, nome: string) => {
    setEdits((prev) => {
      const cur = prev[cc] ?? { nome_display: "", projetos: [] };
      return { ...prev, [cc]: { ...cur, nome_display: nome } };
    });
  };

  const saveOne = (cc: string) => {
    const e = edits[cc];
    if (!e || e.nome_display.trim() === "") return;
    mut.mutate([
      {
        centro_custo: cc,
        nome_display: e.nome_display.trim(),
        projetos: e.projetos,
      },
    ]);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centros de Custo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Para cada centro de custo dos movimentos: escolhe um ou vários
            projetos do orçamento e define o Nome do Projeto que aparece em
            todo o lado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard
            label="Centros de Custo"
            value={String(ccList.length)}
            tone="receita"
          />
          <SummaryCard label="Com nome" value={String(comNome)} tone="receita" />
          <SummaryCard
            label="Sem nome"
            value={String(ccList.length - comNome)}
            tone="despesa"
          />
          <SummaryCard
            label="Projetos por atribuir"
            value={String(projetosPorAtribuir)}
            tone={projetosPorAtribuir > 0 ? "despesa" : "receita"}
          />

        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Pesquisar…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Button
          onClick={() => dirtyItems.length > 0 && mut.mutate(dirtyItems)}
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
              <SortHeader id="cc" sort={sort} onToggle={toggle} width={widths.cc} onResizeStart={startResize} resizing={resizingId === "cc"}>
                Centro de Custo
              </SortHeader>
              <SortHeader id="linhas" sort={sort} onToggle={toggle} align="right" width={widths.linhas} onResizeStart={startResize} resizing={resizingId === "linhas"}>
                Movimentos
              </SortHeader>
              <SortHeader id="nprojs" sort={sort} onToggle={toggle} align="right" width={widths.nprojs} onResizeStart={startResize} resizing={resizingId === "nprojs"}>
                Projetos
              </SortHeader>
              <SortHeader id="projetos" sort={sort} onToggle={toggle} sortable={false} width={widths.projetos} onResizeStart={startResize} resizing={resizingId === "projetos"}>
                Projetos do Orçamento
              </SortHeader>
              <SortHeader id="nome" sort={sort} onToggle={toggle} width={widths.nome} onResizeStart={startResize} resizing={resizingId === "nome"}>
                Nome do Projeto
              </SortHeader>
              <SortHeader id="acao" sort={sort} onToggle={toggle} sortable={false} width={widths.acao} resizable={false}>
                <span className="sr-only">Ação</span>
              </SortHeader>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Sem centros de custo.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((c) => {
                const e = edits[c.centro_custo] ?? { nome_display: "", projetos: [] };
                const dirty = isDirty(c.centro_custo);
                return (
                  <TableRow
                    key={c.centro_custo}
                    className={dirty ? "bg-primary/5" : undefined}
                  >
                    <TableCell className="px-3 py-2 align-top font-mono text-xs">
                      {c.centro_custo}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-right tabular-nums">
                      {c.linhas}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-right tabular-nums">
                      {e.projetos.length}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {e.projetos.map((p) => (
                          <Badge key={p} variant="secondary" className="gap-1 text-xs">
                            {p}
                            <button
                              type="button"
                              onClick={() => toggleProjeto(c.centro_custo, p)}
                              className="ml-0.5 rounded hover:bg-foreground/10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        <ProjetoPicker
                          projetos={projetos ?? []}
                          selected={e.projetos}
                          projetoToCC={projetoToCC}
                          currentCC={c.centro_custo}
                          onToggle={(p) => toggleProjeto(c.centro_custo, p)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top">
                      <Input
                        value={e.nome_display}
                        onChange={(ev) => setNome(c.centro_custo, ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" && dirty) saveOne(c.centro_custo);
                        }}
                        placeholder="Nome do projeto…"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2 align-top text-right">
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "ghost"}
                        disabled={!dirty || mut.isPending}
                        onClick={() => saveOne(c.centro_custo)}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}

function ProjetoPicker({
  projetos,
  selected,
  projetoToCC,
  currentCC,
  onToggle,
}: {
  projetos: string[];
  selected: string[];
  projetoToCC: Map<string, string>;
  currentCC: string;
  onToggle: (projeto: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = projetos.filter((p) => {
    const owner = projetoToCC.get(p);
    if (owner && owner !== currentCC) return false;
    return !q ? true : p.toLowerCase().includes(q.toLowerCase());
  });


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
          Adicionar projeto
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="border-b p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar projeto do orçamento…"
            className="h-8"
            autoFocus
          />
        </div>
        <ScrollArea className="h-72">
          <div className="p-1">
            {filtered.map((p) => {
              const isSel = selected.includes(p);
              return (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => onToggle(p)}
                  />
                  <span className="text-sm">{p}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                Sem projetos no orçamento.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
