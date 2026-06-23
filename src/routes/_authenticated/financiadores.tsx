import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
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
  listarFinanciadores,
  listarFinanciamentos,
  guardarFinanciador,
  guardarFinanciamento,
  apagarFinanciador,
  apagarFinanciamento,
  type Financiador,
  type Financiamento,
} from "@/lib/financiadores.functions";
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
import { AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financiadores")({
  component: FinanciadoresPage,
});

const TIPO_BADGE: Record<string, string> = {
  Público: "bg-blue-50 text-blue-700 border border-blue-200",
  Privado: "bg-amber-50 text-amber-700 border border-amber-200",
  UE: "bg-purple-50 text-purple-700 border border-purple-200",
  Outro: "bg-slate-100 text-slate-700 border border-slate-200",
};

const ESTADO_BADGE: Record<string, string> = {
  "Em candidatura": "bg-slate-100 text-slate-700",
  Aprovado: "bg-blue-50 text-blue-700 border border-blue-200",
  "Parcialmente pago": "bg-amber-50 text-amber-700 border border-amber-200",
  Pago: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejeitado: "bg-red-50 text-red-700",
  Cancelado: "bg-muted text-muted-foreground",
};

const ESTADOS = [
  "Em candidatura",
  "Aprovado",
  "Parcialmente pago",
  "Pago",
  "Rejeitado",
  "Cancelado",
] as const;

const TIPOS = ["Público", "Privado", "UE", "Outro"] as const;

function FinanciadoresPage() {
  const qc = useQueryClient();
  const listFinanciadoresFn = useServerFn(listarFinanciadores);
  const listFinanciamentosFn = useServerFn(listarFinanciamentos);
  const guardarFinanciadorFn = useServerFn(guardarFinanciador);
  const guardarFinanciamentoFn = useServerFn(guardarFinanciamento);
  const apagarFinanciadorFn = useServerFn(apagarFinanciador);
  const apagarFinanciamentoFn = useServerFn(apagarFinanciamento);

  const [selectedFin, setSelectedFin] = useState<string | null>(null);
  const [sheetFinanciador, setSheetFinanciador] = useState<{ open: boolean; row: Financiador | null }>({
    open: false,
    row: null,
  });
  const [sheetFinanciamento, setSheetFinanciamento] = useState<{ open: boolean; row: Financiamento | null }>({
    open: false,
    row: null,
  });

  const { data: financiadores = [] } = useQuery({
    queryKey: ["financiadores"],
    queryFn: () => listFinanciadoresFn() as Promise<Financiador[]>,
  });

  const { data: financiamentos = [], isLoading } = useQuery({
    queryKey: ["financiamentos", selectedFin],
    queryFn: () =>
      listFinanciamentosFn({ data: { financiadorId: selectedFin } }) as Promise<Financiamento[]>,
  });

  const { data: todosFinanciamentos = [] } = useQuery({
    queryKey: ["financiamentos", null],
    queryFn: () =>
      listFinanciamentosFn({ data: { financiadorId: null } }) as Promise<Financiamento[]>,
    enabled: selectedFin !== null,
  });

  const todosParaSidebar = selectedFin === null ? financiamentos : todosFinanciamentos;

  const countsPorFin = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const f of todosParaSidebar) {
      const cur = map.get(f.financiador_id) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += Number(f.valor_aprovado) || 0;
      map.set(f.financiador_id, cur);
    }
    return map;
  }, [todosParaSidebar]);

  const saveFinanciadorM = useMutation({
    mutationFn: (payload: any) => guardarFinanciadorFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiadores"] });
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      toast.success("Financiador guardado");
      setSheetFinanciador({ open: false, row: null });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a guardar"),
  });

  const saveFinanciamentoM = useMutation({
    mutationFn: (payload: any) => guardarFinanciamentoFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      toast.success("Financiamento guardado");
      setSheetFinanciamento({ open: false, row: null });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a guardar"),
  });

  const deleteFinanciamentoM = useMutation({
    mutationFn: (id: string) => apagarFinanciamentoFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      toast.success("Financiamento removido");
    },
  });

  const deleteFinanciadorM = useMutation({
    mutationFn: (id: string) => apagarFinanciadorFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financiadores"] });
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      setSelectedFin(null);
      toast.success("Financiador removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a remover"),
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30ISO = in30.toISOString().slice(0, 10);

  const totalAprovado = financiamentos.reduce((a, f) => a + f.valor_aprovado, 0);
  const totalRecebido = financiamentos.reduce((a, f) => a + f.valor_recebido, 0);
  const porReceber = totalAprovado - totalRecebido;
  const emAtraso = financiamentos.filter(
    (f) => f.data_prevista_pagamento && f.data_prevista_pagamento < todayISO && f.estado !== "Pago",
  );
  const proximos30 = financiamentos.filter(
    (f) =>
      f.data_prevista_pagamento &&
      f.data_prevista_pagamento >= todayISO &&
      f.data_prevista_pagamento <= in30ISO &&
      f.estado !== "Pago" &&
      f.estado !== "Cancelado",
  );
  const totalProximos30 = proximos30.reduce((a, f) => a + (f.valor_aprovado - f.valor_recebido), 0);

  const columns: ColumnDef<Financiamento, any>[] = [
    {
      id: "financiador_nome",
      accessorKey: "financiador_nome",
      header: sortHeader("Financiador"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 180,
    },
    {
      id: "projeto",
      accessorFn: (r) => r.projeto ?? "—",
      header: sortHeader("Projeto"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 140,
    },
    {
      id: "ano",
      accessorKey: "ano",
      header: sortHeader("Ano"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      size: 80,
    },
    {
      id: "descricao",
      accessorKey: "descricao",
      header: sortHeader("Descrição"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      size: 240,
    },
    {
      id: "valor_aprovado",
      accessorKey: "valor_aprovado",
      header: sortHeader("Aprovado"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      size: 120,
    },
    {
      id: "valor_recebido",
      accessorKey: "valor_recebido",
      header: sortHeader("Recebido"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      aggregationFn: "sum",
      cell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" />,
      size: 120,
    },
    {
      id: "por_receber",
      accessorKey: "por_receber",
      header: sortHeader("Por receber"),
      filterFn: numFilterFn,
      meta: { filterType: "number" },
      aggregationFn: "sum",
      cell: ({ row, getValue }) => {
        const v = Number(getValue() ?? 0);
        const overdue =
          row.original.data_prevista_pagamento &&
          row.original.data_prevista_pagamento < todayISO &&
          row.original.estado !== "Pago";
        const tone = v <= 0 ? "receita" : overdue ? "despesa" : "auto";
        return <CurrencyCell value={v} tone={tone as any} />;
      },
      aggregatedCell: ({ getValue }) => <CurrencyCell value={Number(getValue() ?? 0)} tone="auto" />,
      size: 120,
    },
    {
      id: "data_prevista_pagamento",
      accessorFn: (r) => r.data_prevista_pagamento ?? "",
      header: sortHeader("Previsto"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      cell: ({ getValue }) => {
        const v = String(getValue() ?? "");
        if (!v) return <span className="text-muted-foreground">—</span>;
        return <span className="tabular-nums">{v}</span>;
      },
      size: 110,
    },
    {
      id: "estado",
      accessorKey: "estado",
      header: sortHeader("Estado"),
      filterFn: textFilterFn,
      meta: { filterType: "text" },
      cell: ({ getValue }) => {
        const v = String(getValue() ?? "");
        return (
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", ESTADO_BADGE[v] ?? "")}>
            {v}
          </span>
        );
      },
      size: 140,
    },
    {
      id: "acoes",
      header: "",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setSheetFinanciamento({ open: true, row: row.original })}
            aria-label="Editar"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-rose-600 hover:text-rose-700"
            onClick={() => {
              if (confirm("Remover este financiamento?")) deleteFinanciamentoM.mutate(row.original.id);
            }}
            aria-label="Remover"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
      size: 80,
    },
  ];

  return (
    <div className="p-6">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* LEFT PANEL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Financiadores</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSheetFinanciador({ open: true, row: null })}
            >
              <Plus className="size-3.5 mr-1" /> Novo
            </Button>
          </div>

          <button
            onClick={() => setSelectedFin(null)}
            className={cn(
              "w-full text-left rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/40",
              selectedFin === null && "bg-muted/60 border-l-2 border-l-primary",
            )}
          >
            <div className="font-medium">Todos os financiadores</div>
            <div className="text-xs text-muted-foreground">
              {todosParaSidebar.length} financiamentos
            </div>
          </button>

          {financiadores.map((f) => {
            const c = countsPorFin.get(f.id) ?? { count: 0, total: 0 };
            const active = selectedFin === f.id;
            return (
              <div
                key={f.id}
                className={cn(
                  "rounded-md border bg-card transition-colors hover:bg-muted/40 group",
                  active && "bg-muted/60 border-l-2 border-l-primary",
                )}
              >
                <button
                  onClick={() => setSelectedFin(f.id)}
                  className="w-full text-left px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{f.nome}</div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        TIPO_BADGE[f.tipo] ?? TIPO_BADGE.Outro,
                      )}
                    >
                      {f.tipo}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.count} financiamentos · {fmtEur(c.total)}
                  </div>
                </button>
                <div className="px-3 pb-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setSheetFinanciador({ open: true, row: f })}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-rose-600"
                    onClick={() => {
                      if (confirm(`Remover financiador "${f.nome}" e todos os financiamentos associados?`))
                        deleteFinanciadorM.mutate(f.id);
                    }}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <SummaryCard label="Total aprovado" value={fmtEur(totalAprovado)} tone="receita" />
            <SummaryCard label="Total recebido" value={fmtEur(totalRecebido)} tone="receita" />
            <SummaryCard
              label="Por receber"
              value={fmtEur(porReceber)}
              tone={porReceber > 0 ? "despesa" : "neutral"}
            />
            <SummaryCard
              label="Em atraso"
              value={String(emAtraso.length)}
              tone={emAtraso.length > 0 ? "despesa" : "receita"}
            />
          </div>

          {proximos30.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <div>
                {proximos30.length} pagamento{proximos30.length === 1 ? "" : "s"} esperado
                {proximos30.length === 1 ? "" : "s"} nos próximos 30 dias (total{" "}
                {fmtEur(totalProximos30)})
              </div>
            </div>
          )}

          <DataGrid<Financiamento>
            data={financiamentos}
            columns={columns}
            getRowId={(r) => r.id}
            isLoading={isLoading}
            emptyMessage="Sem financiamentos."
            groupable={[
              { id: "financiador_nome", label: "Financiador" },
              { id: "projeto", label: "Projeto" },
              { id: "ano", label: "Ano" },
              { id: "estado", label: "Estado" },
            ]}
            getRowClassName={(r) =>
              r.data_prevista_pagamento && r.data_prevista_pagamento < todayISO && r.estado !== "Pago"
                ? "bg-red-50/30 dark:bg-red-950/20"
                : undefined
            }
            toolbarExtra={
              <Button onClick={() => setSheetFinanciamento({ open: true, row: null })}>
                <Plus className="size-4 mr-2" /> Novo financiamento
              </Button>
            }
          />
        </div>
      </div>

      <FinanciadorSheet
        open={sheetFinanciador.open}
        row={sheetFinanciador.row}
        onClose={() => setSheetFinanciador({ open: false, row: null })}
        onSave={(p) => saveFinanciadorM.mutate(p)}
        saving={saveFinanciadorM.isPending}
      />
      <FinanciamentoSheet
        open={sheetFinanciamento.open}
        row={sheetFinanciamento.row}
        financiadores={financiadores}
        defaultFinanciadorId={selectedFin}
        onClose={() => setSheetFinanciamento({ open: false, row: null })}
        onSave={(p) => saveFinanciamentoM.mutate(p)}
        saving={saveFinanciamentoM.isPending}
      />
    </div>
  );
}

/* ---------- Sheets ---------- */

function FinanciadorSheet({
  open,
  row,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  row: Financiador | null;
  onClose: () => void;
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Público");
  const [contactoNome, setContactoNome] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [notas, setNotas] = useState("");

  useMemoSyncOpen(open, () => {
    setNome(row?.nome ?? "");
    setTipo((row?.tipo as any) ?? "Público");
    setContactoNome(row?.contacto_nome ?? "");
    setContactoEmail(row?.contacto_email ?? "");
    setNotas(row?.notas ?? "");
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-md w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{row ? "Editar financiador" : "Novo financiador"}</SheetTitle>
          <SheetDescription>Entidade que financia projetos.</SheetDescription>
        </SheetHeader>
        <div className="px-4 space-y-3 overflow-y-auto">
          <Field label="Nome *">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Contacto — nome">
            <Input value={contactoNome} onChange={(e) => setContactoNome(e.target.value)} />
          </Field>
          <Field label="Contacto — email">
            <Input
              type="email"
              value={contactoEmail}
              onChange={(e) => setContactoEmail(e.target.value)}
            />
          </Field>
          <Field label="Notas">
            <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Field>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!nome.trim() || saving}
            onClick={() =>
              onSave({
                id: row?.id,
                nome: nome.trim(),
                tipo,
                contacto_nome: contactoNome.trim() || null,
                contacto_email: contactoEmail.trim() || null,
                notas: notas.trim() || null,
              })
            }
          >
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FinanciamentoSheet({
  open,
  row,
  financiadores,
  defaultFinanciadorId,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  row: Financiamento | null;
  financiadores: Financiador[];
  defaultFinanciadorId: string | null;
  onClose: () => void;
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [financiadorId, setFinanciadorId] = useState<string>("");
  const [projeto, setProjeto] = useState("");
  const [ano, setAno] = useState<number>(currentYear);
  const [descricao, setDescricao] = useState("");
  const [valorAprovado, setValorAprovado] = useState<string>("0");
  const [valorRecebido, setValorRecebido] = useState<string>("0");
  const [percentagem, setPercentagem] = useState<string>("");
  const [dataAprov, setDataAprov] = useState<string>("");
  const [dataPrev, setDataPrev] = useState<string>("");
  const [dataReal, setDataReal] = useState<string>("");
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>("Aprovado");
  const [notas, setNotas] = useState("");

  useMemoSyncOpen(open, () => {
    setFinanciadorId(row?.financiador_id ?? defaultFinanciadorId ?? "");
    setProjeto(row?.projeto ?? "");
    setAno(row?.ano ?? currentYear);
    setDescricao(row?.descricao ?? "");
    setValorAprovado(String(row?.valor_aprovado ?? 0));
    setValorRecebido(String(row?.valor_recebido ?? 0));
    setPercentagem(row?.percentagem_projeto != null ? String(row.percentagem_projeto) : "");
    setDataAprov(row?.data_aprovacao ?? "");
    setDataPrev(row?.data_prevista_pagamento ?? "");
    setDataReal(row?.data_pagamento_real ?? "");
    setEstado((row?.estado as any) ?? "Aprovado");
    setNotas(row?.notas ?? "");
  });

  const canSave = financiadorId && descricao.trim() && ano > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-lg w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{row ? "Editar financiamento" : "Novo financiamento"}</SheetTitle>
          <SheetDescription>Detalhes do financiamento atribuído.</SheetDescription>
        </SheetHeader>
        <div className="px-4 space-y-4 overflow-y-auto">
          <Section title="FINANCIADOR">
            <Field label="Financiador *">
              <Select value={financiadorId} onValueChange={setFinanciadorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar…" />
                </SelectTrigger>
                <SelectContent>
                  {financiadores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Projeto" hint="Código do projeto do orçamento, ex: ERPI-2026">
              <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ano *">
                <Input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value) || currentYear)}
                />
              </Field>
            </div>
            <Field label="Descrição *">
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Field>
          </Section>
          <Section title="VALORES">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor aprovado (€)">
                <Input
                  type="number"
                  step="0.01"
                  value={valorAprovado}
                  onChange={(e) => setValorAprovado(e.target.value)}
                />
              </Field>
              <Field label="Valor recebido (€)">
                <Input
                  type="number"
                  step="0.01"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Percentagem do projeto (%)">
              <Input
                type="number"
                step="0.1"
                value={percentagem}
                onChange={(e) => setPercentagem(e.target.value)}
              />
            </Field>
          </Section>
          <Section title="DATAS & ESTADO">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de aprovação">
                <Input type="date" value={dataAprov} onChange={(e) => setDataAprov(e.target.value)} />
              </Field>
              <Field label="Data prevista">
                <Input type="date" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de pagamento real">
                <Input type="date" value={dataReal} onChange={(e) => setDataReal(e.target.value)} />
              </Field>
              <Field label="Estado">
                <Select value={estado} onValueChange={(v) => setEstado(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Section>
          <Section title="NOTAS">
            <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Section>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave || saving}
            onClick={() =>
              onSave({
                id: row?.id,
                financiador_id: financiadorId,
                projeto: projeto.trim() || null,
                descricao: descricao.trim(),
                ano,
                valor_aprovado: Number(valorAprovado) || 0,
                valor_recebido: Number(valorRecebido) || 0,
                percentagem_projeto: percentagem === "" ? null : Number(percentagem),
                data_aprovacao: dataAprov || null,
                data_prevista_pagamento: dataPrev || null,
                data_pagamento_real: dataReal || null,
                estado,
                notas: notas.trim() || null,
              })
            }
          >
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Re-run init function whenever sheet opens. */
function useMemoSyncOpen(open: boolean, fn: () => void) {
  useMemo(() => {
    if (open) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
