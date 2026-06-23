import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PrevisaoTipo = "Entrada" | "Saida";
export type PrevisaoEstado = "Previsto" | "Em curso" | "Realizado" | "Cancelado";

export type Previsao = {
  id: string;
  data: string;
  descricao: string;
  tipo: PrevisaoTipo;
  categoria: string | null;
  valor: number;
  projeto: string | null;
  estado: PrevisaoEstado;
  recorrente: boolean;
  recorrencia_meses: number | null;
  notas: string | null;
  financiamento_id: string | null;
};

export const listarPrevisoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ano: z.number().int() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const start = `${data.ano}-01-01`;
    const end = `${data.ano}-12-31`;
    const { data: rows, error } = await context.supabase
      .from("previsoes_tesouraria")
      .select(
        "id, data, descricao, tipo, categoria, valor, projeto, estado, recorrente, recorrencia_meses, notas, financiamento_id",
      )
      .gte("data", start)
      .lte("data", end)
      .order("data", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      valor: Number(r.valor) || 0,
    })) as Previsao[];
  });

const previsaoSchema = z.object({
  id: z.string().uuid().optional(),
  data: z.string().min(1),
  descricao: z.string().min(1),
  tipo: z.enum(["Entrada", "Saida"]),
  categoria: z.string().nullable().optional(),
  valor: z.number(),
  projeto: z.string().nullable().optional(),
  estado: z.enum(["Previsto", "Em curso", "Realizado", "Cancelado"]).default("Previsto"),
  recorrente: z.boolean().default(false),
  recorrencia_meses: z.number().int().min(1).max(24).nullable().optional(),
  notas: z.string().nullable().optional(),
  financiamento_id: z.string().uuid().nullable().optional(),
});

export const guardarPrevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => previsaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase
        .from("previsoes_tesouraria")
        .update(rest)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }

    // Expand recurrence (up to 24 occurrences)
    const rows: any[] = [];
    const base = new Date(rest.data);
    const ocorrencias =
      rest.recorrente && rest.recorrencia_meses && rest.recorrencia_meses > 0
        ? Math.min(rest.recorrencia_meses, 24)
        : 1;
    for (let i = 0; i < ocorrencias; i++) {
      const d = new Date(base);
      d.setMonth(base.getMonth() + i);
      rows.push({ ...rest, data: d.toISOString().slice(0, 10) });
    }
    const { data: inserted, error } = await context.supabase
      .from("previsoes_tesouraria")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    return { criados: inserted?.length ?? 0 };
  });

export const apagarPrevisao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("previsoes_tesouraria")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type ResumoMes = {
  mes: number;
  entradas_previstas: number;
  saidas_previstas: number;
  entradas_reais: number;
  saidas_reais: number;
};

export const resumoMensal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ano: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const start = `${data.ano}-01-01`;
    const end = `${data.ano}-12-31`;

    const [{ data: prevs }, { data: reais, error: erReais }] = await Promise.all([
      context.supabase
        .from("previsoes_tesouraria")
        .select("data, tipo, valor, estado")
        .gte("data", start)
        .lte("data", end)
        .neq("estado", "Cancelado"),
      context.supabase.rpc("resumo_transacoes_mensal", { p_ano: data.ano }),
    ]);
    if (erReais) throw new Error(erReais.message);

    const out: ResumoMes[] = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      entradas_previstas: 0,
      saidas_previstas: 0,
      entradas_reais: 0,
      saidas_reais: 0,
    }));

    for (const p of (prevs ?? []) as any[]) {
      const m = Number(String(p.data).slice(5, 7));
      const v = Number(p.valor) || 0;
      if (p.tipo === "Entrada") out[m - 1].entradas_previstas += v;
      else out[m - 1].saidas_previstas += v;
    }
    for (const r of (reais ?? []) as any[]) {
      out[r.mes - 1].entradas_reais = Number(r.receita) || 0;
      out[r.mes - 1].saidas_reais = Number(r.despesa) || 0;
    }
    return out;
  });

export const importarDeFinanciamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ano: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const start = `${data.ano}-01-01`;
    const end = `${data.ano}-12-31`;
    const { data: fins, error } = await context.supabase
      .from("financiamentos")
      .select("id, descricao, valor_aprovado, valor_recebido, data_prevista_pagamento, estado")
      .not("data_prevista_pagamento", "is", null)
      .gte("data_prevista_pagamento", start)
      .lte("data_prevista_pagamento", end)
      .not("estado", "in", "(Pago,Cancelado,Rejeitado)");
    if (error) throw new Error(error.message);

    // Skip ones already linked
    const ids = (fins ?? []).map((f: any) => f.id);
    if (ids.length === 0) return { criados: 0 };
    const { data: existentes } = await context.supabase
      .from("previsoes_tesouraria")
      .select("financiamento_id")
      .in("financiamento_id", ids);
    const jaExiste = new Set(
      (existentes ?? []).map((e: any) => e.financiamento_id).filter(Boolean),
    );

    const novos = (fins ?? [])
      .filter((f: any) => !jaExiste.has(f.id))
      .map((f: any) => ({
        data: f.data_prevista_pagamento,
        descricao: f.descricao,
        tipo: "Entrada" as const,
        categoria: "Financiamento",
        valor: Number(f.valor_aprovado) - Number(f.valor_recebido),
        estado: "Previsto" as const,
        recorrente: false,
        financiamento_id: f.id,
      }))
      .filter((r) => r.valor > 0);

    if (novos.length === 0) return { criados: 0 };
    const { error: erIns } = await context.supabase
      .from("previsoes_tesouraria")
      .insert(novos);
    if (erIns) throw new Error(erIns.message);
    return { criados: novos.length };
  });
