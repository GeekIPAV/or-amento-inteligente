import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AlertaSeveridade = "critica" | "aviso" | "info";

export type AlertaRow = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  severidade: AlertaSeveridade;
  link_rota: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any;
  lido: boolean;
  resolvido: boolean;
  chave: string | null;
  created_at: string;
};

export const contarAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("alertas_financeiros")
      .select("id", { count: "exact", head: true })
      .eq("resolvido", false);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const listarAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filtro: z.enum(["todos", "criticos", "avisos", "resolvidos"]).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const filtro = data?.filtro ?? "todos";
    let q = context.supabase
      .from("alertas_financeiros")
      .select("id, tipo, titulo, descricao, severidade, link_rota, dados, lido, resolvido, chave, created_at")
      .order("created_at", { ascending: false });
    if (filtro === "resolvidos") q = q.eq("resolvido", true);
    else if (filtro === "criticos") q = q.eq("resolvido", false).eq("severidade", "critica");
    else if (filtro === "avisos") q = q.eq("resolvido", false).eq("severidade", "aviso");
    else q = q.eq("resolvido", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AlertaRow[];
  });

export const resolverAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alertas_financeiros")
      .update({ resolvido: true, lido: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarAlertaLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alertas_financeiros")
      .update({ lido: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const gerarAlertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const in30ISO = in30.toISOString().slice(0, 10);

    type NovoAlerta = {
      tipo: string;
      titulo: string;
      descricao: string;
      severidade: AlertaSeveridade;
      link_rota: string;
      dados: Record<string, unknown>;
      chave: string;
    };
    const novos: NovoAlerta[] = [];

    // 1. PAGAMENTO_EM_ATRASO + PAGAMENTO_PREVISTO_30D
    const { data: fins } = await supabase
      .from("financiamentos")
      .select("id, descricao, estado, data_prevista_pagamento, valor_aprovado, financiador_id, financiadores(nome)")
      .not("data_prevista_pagamento", "is", null);
    for (const f of (fins ?? []) as any[]) {
      const estado = f.estado;
      if (["Pago", "Cancelado", "Rejeitado"].includes(estado)) continue;
      const data = f.data_prevista_pagamento as string;
      const finNome = f.financiadores?.nome ?? "—";
      if (data < todayISO) {
        novos.push({
          tipo: "pagamento_em_atraso",
          titulo: `Pagamento em atraso: ${f.descricao}`,
          descricao: `Previsto para ${data}, ${finNome}`,
          severidade: "critica",
          link_rota: "/financiadores",
          dados: { financiamento_id: f.id, valor: f.valor_aprovado, data_prevista: data },
          chave: `fin:${f.id}:atraso`,
        });
      } else if (data <= in30ISO && estado !== "Pago") {
        const dias = Math.ceil((new Date(data).getTime() - today.getTime()) / 86400000);
        novos.push({
          tipo: "pagamento_previsto_30d",
          titulo: `Pagamento esperado: ${f.descricao}`,
          descricao: `Previsto para ${data} (em ${dias} dias)`,
          severidade: "aviso",
          link_rota: "/financiadores",
          dados: { financiamento_id: f.id, valor: f.valor_aprovado, data_prevista: data },
          chave: `fin:${f.id}:30d`,
        });
      }
    }

    // 2. SEM_MOVIMENTOS_MES — mês anterior
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const { count: cntPrev } = await supabase
      .from("transacoes_extrato")
      .select("id", { count: "exact", head: true })
      .eq("mes_referencia", prevYM);
    if ((cntPrev ?? 0) === 0) {
      novos.push({
        tipo: "sem_movimentos_mes",
        titulo: `Sem movimentos importados: ${prevYM}`,
        descricao: `Nenhum extrato foi importado para ${prevYM}`,
        severidade: "aviso",
        link_rota: "/importar-extratos",
        dados: { mes: prevYM },
        chave: `sem_mov:${prevYM}`,
      });
    }

    // 3. SALDO_NEGATIVO_PREVISTO — próximos 3 meses
    const startISO = `${today.getFullYear()}-01-01`;
    const { data: prevs } = await supabase
      .from("previsoes_tesouraria")
      .select("data, tipo, valor, estado")
      .gte("data", startISO)
      .neq("estado", "Cancelado");
    const saldoPorMes = new Map<string, number>();
    for (const p of (prevs ?? []) as any[]) {
      const ym = String(p.data).slice(0, 7);
      const v = Number(p.valor) || 0;
      const delta = p.tipo === "Entrada" ? v : -v;
      saldoPorMes.set(ym, (saldoPorMes.get(ym) ?? 0) + delta);
    }
    const ymsSorted = Array.from(saldoPorMes.keys()).sort();
    let acc = 0;
    const horizonte: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      horizonte.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    for (const ym of ymsSorted) {
      acc += saldoPorMes.get(ym) ?? 0;
      if (horizonte.includes(ym) && acc < 0) {
        novos.push({
          tipo: "saldo_negativo_previsto",
          titulo: `Saldo previsto negativo em ${ym}`,
          descricao: `Saldo acumulado previsto: €${acc.toFixed(2)}`,
          severidade: "critica",
          link_rota: "/tesouraria",
          dados: { mes: ym, saldo: acc },
          chave: `saldo_neg:${ym}`,
        });
      }
    }

    // Upsert idempotente: ignora se já existe alerta não-resolvido com mesma chave
    if (novos.length > 0) {
      const chaves = novos.map((n) => n.chave);
      const { data: existentes } = await supabase
        .from("alertas_financeiros")
        .select("chave")
        .eq("resolvido", false)
        .in("chave", chaves);
      const jaExiste = new Set((existentes ?? []).map((e: any) => e.chave));
      const inserir = novos.filter((n) => !jaExiste.has(n.chave));
      if (inserir.length > 0) {
        const { error } = await supabase.from("alertas_financeiros").insert(inserir);
        if (error) throw new Error(error.message);
        return { criados: inserir.length };
      }
    }
    return { criados: 0 };
  });
