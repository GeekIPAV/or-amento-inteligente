import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  listarAnos, listarVersoes, carregarOrcamento, guardarLinhas, criarNovaVersao, adicionarProjeto,
  importarExtratoOrcamento,
} from "@/lib/orcamentos.functions";
import { parseCSV } from "@/lib/csv-parser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { currency, MESES_CURTOS } from "@/lib/format";
import { Plus, Save, GitBranch, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

const searchSchema = z.object({
  ano: z.number().int().optional(),
  tipo: z.enum(["RECEITA", "DESPESA"]).optional(),
  versao: z.number().int().optional(),
});

export const Route = createFileRoute("/_authenticated/orcamento")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Orçamento — Finanças" }] }),
  component: OrcamentoPage,
});

const meses = ["m1","m2","m3","m4","m5","m6","m7","m8","m9","m10","m11","m12"] as const;
type Mes = (typeof meses)[number];

interface Linha {
  id?: string;
  projeto: string;
  conta?: string | null;
  descricao_conta?: string | null;
  m1: number; m2: number; m3: number; m4: number; m5: number; m6: number;
  m7: number; m8: number; m9: number; m10: number; m11: number; m12: number;
  dirty?: boolean;
}

function OrcamentoPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/orcamento" });
  const qc = useQueryClient();

  const ano = search.ano ?? new Date().getFullYear();
  const tipo = search.tipo ?? "RECEITA";

  const anosFn = useServerFn(listarAnos);
  const versoesFn = useServerFn(listarVersoes);
  const carregarFn = useServerFn(carregarOrcamento);
  const guardarFn = useServerFn(guardarLinhas);
  const novaVersaoFn = useServerFn(criarNovaVersao);
  const addProjetoFn = useServerFn(adicionarProjeto);

  const { data: anos = [] } = useQuery({ queryKey: ["orc-anos"], queryFn: () => anosFn() });
  const { data: versoes = [] } = useQuery({
    queryKey: ["orc-versoes", ano, tipo],
    queryFn: () => versoesFn({ data: { ano, tipo } }),
  });

  const versaoAtiva = versoes.find((v) => v.ativo)?.versao;
  const versao = search.versao ?? versaoAtiva;
  const isAtiva = versao === versaoAtiva;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["orc-linhas", ano, tipo, versao],
    queryFn: () => carregarFn({ data: { ano, tipo, versao } }),
    enabled: versao !== undefined || (versoes.length === 0),
  });

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [apagar, setApagar] = useState<string[]>([]);
  const [novoProjeto, setNovoProjeto] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setLinhas(
      (rows ?? []).map((r: any) => ({
        id: r.id,
        projeto: r.projeto,
        m1: Number(r.m1), m2: Number(r.m2), m3: Number(r.m3), m4: Number(r.m4),
        m5: Number(r.m5), m6: Number(r.m6), m7: Number(r.m7), m8: Number(r.m8),
        m9: Number(r.m9), m10: Number(r.m10), m11: Number(r.m11), m12: Number(r.m12),
      })),
    );
    setApagar([]);
  }, [rows]);

  const set = (patch: Partial<{ ano: number; tipo: "RECEITA" | "DESPESA"; versao: number }>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...patch }) });

  const updateCell = (idx: number, field: "projeto" | Mes, value: string) => {
    setLinhas((prev) => {
      const next = [...prev];
      const l = { ...next[idx], dirty: true };
      if (field === "projeto") l.projeto = value;
      else (l as any)[field] = Number(value.replace(",", ".")) || 0;
      next[idx] = l;
      return next;
    });
  };

  const removeLinha = (idx: number) => {
    setLinhas((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.id) setApagar((a) => [...a, removed.id!]);
      return next;
    });
  };

  const totalLinha = (l: Linha) => meses.reduce((s, m) => s + l[m], 0);
  const totalColuna = (m: Mes) => linhas.reduce((s, l) => s + l[m], 0);
  const totalGeral = linhas.reduce((s, l) => s + totalLinha(l), 0);

  const guardar = async () => {
    if (!isAtiva || versao === undefined) return;
    try {
      const dirty = linhas.filter((l) => l.dirty || !l.id);
      await guardarFn({
        data: {
          ano, tipo, versao,
          linhas: dirty.map((l) => ({
            id: l.id, projeto: l.projeto,
            m1: l.m1, m2: l.m2, m3: l.m3, m4: l.m4, m5: l.m5, m6: l.m6,
            m7: l.m7, m8: l.m8, m9: l.m9, m10: l.m10, m11: l.m11, m12: l.m12,
          })),
          apagar,
        },
      });
      toast.success("Orçamento guardado");
      qc.invalidateQueries({ queryKey: ["orc-linhas"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro a guardar");
    }
  };

  const criarVersao = async () => {
    try {
      const r = await novaVersaoFn({ data: { ano, tipo } });
      toast.success(`Versão ${r.versao} criada`);
      qc.invalidateQueries({ queryKey: ["orc-versoes"] });
      qc.invalidateQueries({ queryKey: ["orc-linhas"] });
      set({ versao: r.versao });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const adicionar = async () => {
    if (!novoProjeto.trim()) return;
    try {
      await addProjetoFn({ data: { ano, tipo, projeto: novoProjeto.trim() } });
      setNovoProjeto("");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["orc-linhas"] });
      qc.invalidateQueries({ queryKey: ["orc-versoes"] });
      qc.invalidateQueries({ queryKey: ["orc-anos"] });
      toast.success("Projeto adicionado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const anosLista = useMemo(() => {
    const set = new Set<number>(anos);
    set.add(ano);
    const atual = new Date().getFullYear();
    [atual - 1, atual, atual + 1].forEach((a) => set.add(a));
    return Array.from(set).sort((a, b) => b - a);
  }, [anos, ano]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orçamento</h1>
          <p className="text-sm text-muted-foreground">Defina as metas mensais por projeto.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={String(ano)} onValueChange={(v) => set({ ano: Number(v), versao: undefined })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosLista.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={(v) => set({ tipo: v as any, versao: undefined })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="RECEITA">Receita</SelectItem>
              <SelectItem value="DESPESA">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={versao !== undefined ? String(versao) : ""}
            onValueChange={(v) => set({ versao: Number(v) })}
            disabled={versoes.length === 0}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Versão" /></SelectTrigger>
            <SelectContent>
              {versoes.map((v) => (
                <SelectItem key={v.versao} value={String(v.versao)}>
                  v{v.versao} {v.ativo ? "(ativa)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={criarVersao} disabled={!isAtiva || versoes.length === 0}>
            <GitBranch className="size-4" /> Criar Nova Versão
          </Button>
          <Button onClick={guardar} disabled={!isAtiva}>
            <Save className="size-4" /> Guardar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {tipo === "RECEITA" ? "Receitas" : "Despesas"} {ano}
              {versao !== undefined && (
                <Badge variant={isAtiva ? "default" : "secondary"}>
                  v{versao} {isAtiva ? "ativa" : "histórico"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isAtiva ? "Edição inline. Clique nas células para alterar." : "Versão de histórico (apenas leitura)."}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!isAtiva && versoes.length > 0}>
                <Plus className="size-4" /> Adicionar Projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="novo">Nome do projeto</Label>
                <Input id="novo" value={novoProjeto} onChange={(e) => setNovoProjeto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionar()} />
              </div>
              <DialogFooter>
                <Button onClick={adicionar}>Adicionar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px] sticky left-0 bg-card">Projeto</TableHead>
                  {MESES_CURTOS.map((m) => <TableHead key={m} className="text-right">{m}</TableHead>)}
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
                ) : linhas.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground">Sem projetos. Use "Adicionar Projeto".</TableCell></TableRow>
                ) : linhas.map((l, i) => (
                  <TableRow key={l.id ?? `new-${i}`}>
                    <TableCell className="sticky left-0 bg-card">
                      <Input
                        value={l.projeto}
                        onChange={(e) => updateCell(i, "projeto", e.target.value)}
                        disabled={!isAtiva}
                        className="h-8"
                      />
                    </TableCell>
                    {meses.map((m) => (
                      <TableCell key={m} className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={l[m]}
                          onChange={(e) => updateCell(i, m, e.target.value)}
                          disabled={!isAtiva}
                          className="h-8 text-right w-24"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{currency.format(totalLinha(l))}</TableCell>
                    <TableCell>
                      {isAtiva && (
                        <Button variant="ghost" size="icon" onClick={() => removeLinha(i)}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {linhas.length > 0 && (
                <tfoot>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-muted/40 font-semibold">Total</TableCell>
                    {meses.map((m) => (
                      <TableCell key={m} className="text-right font-semibold bg-muted/40">
                        {currency.format(totalColuna(m))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold bg-muted/40">{currency.format(totalGeral)}</TableCell>
                    <TableCell className="bg-muted/40"></TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
