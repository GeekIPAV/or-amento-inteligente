import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  listarAlertas,
  resolverAlerta,
  gerarAlertas,
  type AlertaRow,
} from "@/lib/alertas.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: AlertasPage,
});

type Filtro = "todos" | "criticos" | "avisos" | "resolvidos";

function tempoRelativo(iso: string): string {
  const d = new Date(iso);
  const diffS = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffS < 60) return "agora mesmo";
  const min = Math.floor(diffS / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias} dia${dias === 1 ? "" : "s"}`;
  const meses = Math.floor(dias / 30);
  return `há ${meses} mês${meses === 1 ? "" : "es"}`;
}

function AlertaCard({ a, onResolver, onVer }: { a: AlertaRow; onResolver: () => void; onVer: () => void }) {
  const Icon = a.severidade === "critica" ? AlertOctagon : a.severidade === "aviso" ? AlertTriangle : Info;
  const iconCls =
    a.severidade === "critica"
      ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
      : a.severidade === "aviso"
      ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
      : "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400";
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-card p-4", a.resolvido && "opacity-60")}>
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", iconCls)}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{a.titulo}</div>
        {a.descricao && <div className="text-xs text-muted-foreground">{a.descricao}</div>}
        <div className="text-xs text-muted-foreground/60 mt-1">{tempoRelativo(a.created_at)}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {a.link_rota && (
          <Button size="sm" variant="outline" onClick={onVer}>
            Ver
          </Button>
        )}
        {!a.resolvido ? (
          <Button size="sm" variant="ghost" onClick={onResolver}>
            Resolver
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Resolvido</span>
        )}
      </div>
    </div>
  );
}

function AlertasPage() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listarAlertas);
  const resolverFn = useServerFn(resolverAlerta);
  const gerarFn = useServerFn(gerarAlertas);

  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas", filtro],
    queryFn: () => listFn({ data: { filtro } }),
  });

  // Generate alerts on mount (silent)
  useEffect(() => {
    gerarFn().then(() => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-count"] });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gerarM = useMutation({
    mutationFn: () => gerarFn(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-count"] });
      toast.success(res.criados > 0 ? `${res.criados} novo(s) alerta(s)` : "Sem novos alertas");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a gerar alertas"),
  });

  const resolverM = useMutation({
    mutationFn: (id: string) => resolverFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-count"] });
    },
  });

  // counts (only valid for "todos" or any non-resolved view)
  const activos = alertas.filter((a) => !a.resolvido);
  const criticos = activos.filter((a) => a.severidade === "critica").length;
  const avisos = activos.filter((a) => a.severidade === "aviso").length;
  const resolvidos = alertas.filter((a) => a.resolvido).length;

  // sort: critica > aviso > info; then by created_at desc
  const ordenados = [...alertas].sort((a, b) => {
    const order = { critica: 0, aviso: 1, info: 2 } as const;
    const d = (order[a.severidade] ?? 9) - (order[b.severidade] ?? 9);
    if (d !== 0) return d;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alertas</h1>
          <p className="text-sm text-muted-foreground">{activos.length} alertas activos</p>
        </div>
        <Button onClick={() => gerarM.mutate()} disabled={gerarM.isPending}>
          <RefreshCw className={cn("size-4 mr-2", gerarM.isPending && "animate-spin")} />
          Verificar agora
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<AlertOctagon className="size-5 text-red-600" />} label="Críticos" value={criticos} />
        <StatCard icon={<AlertTriangle className="size-5 text-amber-600" />} label="Avisos" value={avisos} />
        <StatCard icon={<CheckCircle2 className="size-5 text-emerald-600" />} label="Resolvidos" value={resolvidos} />
      </div>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="criticos">Críticos</TabsTrigger>
          <TabsTrigger value="avisos">Avisos</TabsTrigger>
          <TabsTrigger value="resolvidos">Resolvidos</TabsTrigger>
        </TabsList>
      </Tabs>

      {ordenados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-emerald-500" />
          <h3 className="mt-3 font-medium">Tudo em ordem</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sem alertas activos. Clica em "Verificar agora" para actualizar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordenados.map((a) => (
            <AlertaCard
              key={a.id}
              a={a}
              onResolver={() => resolverM.mutate(a.id)}
              onVer={() => a.link_rota && navigate({ to: a.link_rota as any })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div>{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
