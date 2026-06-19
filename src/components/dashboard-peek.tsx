import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { detalhesIntervalo } from "@/lib/dashboard.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency, MESES_LONGOS } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PeekScope = {
  titulo: string;
  subtitulo?: string;
  anos: number[];
  mesIni: number;
  mesFim: number;
  projeto?: string | null;
  tipo?: "RECEITA" | "DESPESA" | null;
  rubrica?: string | null;
};

export function DashboardPeek({
  scope,
  open,
  onOpenChange,
}: {
  scope: PeekScope | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fn = useServerFn(detalhesIntervalo);
  const { data, isLoading } = useQuery({
    enabled: open && !!scope,
    queryKey: ["peek", scope],
    queryFn: () =>
      fn({
        data: {
          anos: scope!.anos,
          mesIni: scope!.mesIni,
          mesFim: scope!.mesFim,
          projeto: scope?.projeto ?? null,
          tipo: scope?.tipo ?? null,
          rubrica: scope?.rubrica ?? null,
        },
      }),
  });


  const totReceita = (data?.transacoes ?? []).reduce(
    (a, t: any) => a + (String(t.conta ?? "").startsWith("7") ? Number(t.credito ?? 0) - Number(t.debito ?? 0) : 0),
    0,
  );
  const totDespesa = (data?.transacoes ?? []).reduce(
    (a, t: any) => a + (String(t.conta ?? "").startsWith("6") ? Number(t.debito ?? 0) - Number(t.credito ?? 0) : 0),
    0,
  );
  const totOrc = (data?.orcamento ?? []).reduce((a, o: any) => a + Number(o.valor ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{scope?.titulo ?? "Detalhes"}</DialogTitle>
          {scope?.subtitulo && (
            <DialogDescription>{scope.subtitulo}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Receita realizada" value={currency.format(totReceita)} tone="receita" />
          <Kpi label="Despesa realizada" value={currency.format(totDespesa)} tone="despesa" />
          <Kpi label="Saldo" value={currency.format(totReceita - totDespesa)} />
          <Kpi label="Orçamentado" value={currency.format(totOrc)} />
        </div>

        <Tabs defaultValue="transacoes" className="mt-2">
          <TabsList>
            <TabsTrigger value="transacoes">
              Transações ({data?.transacoes.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="orcamento">
              Orçamento ({data?.orcamento.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transacoes" className="mt-3">
            <div className="max-h-[55vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-1 text-left">Data</th>
                    <th className="px-2 py-1 text-left">Conta</th>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-left">Projeto</th>
                    <th className="px-2 py-1 text-right">Crédito</th>
                    <th className="px-2 py-1 text-right">Débito</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={6} />
                  ) : (data?.transacoes ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem transações no intervalo.</td></tr>
                  ) : (
                    data!.transacoes.map((t: any) => {
                      const isRec = String(t.conta ?? "").startsWith("7");
                      return (
                        <tr key={t.id} className="border-t border-border/40">
                          <td className="px-2 py-1 whitespace-nowrap tabular-nums">{t.data ?? "—"}</td>
                          <td className="px-2 py-1 whitespace-nowrap font-mono text-xs">{t.conta}</td>
                          <td className="px-2 py-1">{t.descricao_conta ?? "—"}</td>
                          <td className="px-2 py-1 text-muted-foreground">{t.projeto_nome}</td>
                          <td className={cn("px-2 py-1 text-right tabular-nums", isRec && Number(t.credito) > 0 && "text-emerald-600 dark:text-emerald-400")}>
                            {Number(t.credito) ? currency.format(Number(t.credito)) : "—"}
                          </td>
                          <td className={cn("px-2 py-1 text-right tabular-nums", !isRec && Number(t.debito) > 0 && "text-rose-600 dark:text-rose-400")}>
                            {Number(t.debito) ? currency.format(Number(t.debito)) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {data && data.transacoes.length >= 1000 && (
              <p className="mt-2 text-xs text-muted-foreground">A mostrar as 1000 transações mais recentes do intervalo.</p>
            )}
          </TabsContent>

          <TabsContent value="orcamento" className="mt-3">
            <div className="max-h-[55vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                  <tr className="text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-1 text-left">Ano</th>
                    <th className="px-2 py-1 text-left">Mês</th>
                    <th className="px-2 py-1 text-left">Projeto</th>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    <th className="px-2 py-1 text-left">Descrição</th>
                    <th className="px-2 py-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={6} />
                  ) : (data?.orcamento ?? []).length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem linhas de orçamento no intervalo.</td></tr>
                  ) : (
                    data!.orcamento.map((o: any, i: number) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-2 py-1 tabular-nums">{o.ano}</td>
                        <td className="px-2 py-1">{MESES_LONGOS[(Number(o.mes) || 1) - 1]}</td>
                        <td className="px-2 py-1">{o.projeto_nome}</td>
                        <td className={cn("px-2 py-1 text-xs font-medium", o.tipo === "RECEITA" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {o.tipo === "RECEITA" ? "Receita" : "Despesa"}
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{o.descricao ?? "—"}</td>
                        <td className={cn("px-2 py-1 text-right tabular-nums font-medium", o.tipo === "RECEITA" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {currency.format(Number(o.valor ?? 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "receita" | "despesa" }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-0.5 text-base font-semibold tabular-nums",
        tone === "receita" && "text-emerald-600 dark:text-emerald-400",
        tone === "despesa" && "text-rose-600 dark:text-rose-400",
      )}>{value}</div>
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-t border-border/40">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-2 py-2">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
