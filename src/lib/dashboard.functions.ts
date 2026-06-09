import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resumoDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; mes: number }) =>
    z.object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ano, mes } = data;

    // Orçamentos ativos do ano
    const { data: orcs, error: errO } = await context.supabase
      .from("orcamentos")
      .select("*")
      .eq("ano", ano)
      .eq("ativo", true);
    if (errO) throw new Error(errO.message);

    const meses = ["m1","m2","m3","m4","m5","m6","m7","m8","m9","m10","m11","m12"] as const;

    const orcMensal = {
      RECEITA: Array(12).fill(0) as number[],
      DESPESA: Array(12).fill(0) as number[],
    };
    const porProjeto = new Map<string, { projeto: string; tipo: "RECEITA" | "DESPESA"; orcado: number }>();

    for (const o of orcs ?? []) {
      const arr = orcMensal[o.tipo as "RECEITA" | "DESPESA"];
      let totalProj = 0;
      meses.forEach((m, i) => {
        const v = Number((o as any)[m] ?? 0);
        arr[i] += v;
        if (i < mes) totalProj += v;
      });
      const key = `${o.projeto}|${o.tipo}`;
      const existing = porProjeto.get(key);
      if (existing) existing.orcado += totalProj;
      else porProjeto.set(key, { projeto: o.projeto, tipo: o.tipo, orcado: totalProj });
    }

    // Transações do ano agregadas na base de dados, para não truncar anos com muitos movimentos.
    const { data: txs, error: errT } = await context.supabase.rpc("resumo_transacoes_mensal", {
      p_ano: ano,
    });
    if (errT) throw new Error(errT.message);

    const realMensal = {
      RECEITA: Array(12).fill(0) as number[],
      DESPESA: Array(12).fill(0) as number[],
    };
    for (const t of txs ?? []) {
      const m = Number(t.mes);
      if (m >= 1 && m <= 12) {
        realMensal.RECEITA[m - 1] += Number(t.receita ?? 0);
        realMensal.DESPESA[m - 1] += Number(t.despesa ?? 0);
      }
    }

    const acumular = (arr: number[]) =>
      arr.slice(0, mes).reduce((a, b) => a + b, 0);

    const receitaOrc = acumular(orcMensal.RECEITA);
    const receitaReal = acumular(realMensal.RECEITA);
    const despesaOrc = acumular(orcMensal.DESPESA);
    const despesaReal = acumular(realMensal.DESPESA);

    const grafico = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      receitaOrc: orcMensal.RECEITA[i],
      receitaReal: realMensal.RECEITA[i],
      despesaOrc: orcMensal.DESPESA[i],
      despesaReal: realMensal.DESPESA[i],
    }));

    return {
      kpis: {
        receitaOrc, receitaReal,
        despesaOrc, despesaReal,
      },
      grafico,
      projetos: Array.from(porProjeto.values()),
    };
  });

export const anosDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [orcs, txs] = await Promise.all([
      context.supabase.from("orcamentos").select("ano"),
      context.supabase.rpc("anos_transacoes_disponiveis"),
    ]);
    const set = new Set<number>();
    (orcs.data ?? []).forEach((r) => set.add(r.ano));
    if (txs.error) throw new Error(txs.error.message);
    (txs.data ?? []).forEach((r) => set.add(r.ano));
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  });
