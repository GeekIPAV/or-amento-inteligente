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

    // Versão ativa do orçamento
    const { data: versaoAtiva } = await context.supabase
      .from("orcamento_versoes")
      .select("id")
      .eq("ativa", true)
      .maybeSingle();
    const versaoId = versaoAtiva?.id ?? null;

    // Orçamentos do ano (apenas versão ativa) — paginar para ultrapassar 1000
    const orcs: Array<{ projeto: string; tipo: string; mes: number; valor: number }> = [];
    if (versaoId) {
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: chunk, error: errO } = await context.supabase
          .from("orcamentos")
          .select("projeto, tipo, mes, valor")
          .eq("ano", ano)
          .eq("versao_id", versaoId)
          .range(from, from + PAGE - 1);
        if (errO) throw new Error(errO.message);
        if (!chunk || chunk.length === 0) break;
        orcs.push(...(chunk as typeof orcs));
        if (chunk.length < PAGE) break;
      }
    }



    const orcMensal = {
      RECEITA: Array(12).fill(0) as number[],
      DESPESA: Array(12).fill(0) as number[],
    };
    const porProjeto = new Map<string, { projeto: string; tipo: "RECEITA" | "DESPESA"; orcado: number }>();

    for (const o of orcs ?? []) {
      const tipo = o.tipo as "RECEITA" | "DESPESA";
      const m = Number(o.mes);
      const v = Number(o.valor ?? 0);
      if (m >= 1 && m <= 12) orcMensal[tipo][m - 1] += v;
      const key = `${o.projeto}|${tipo}`;
      const existing = porProjeto.get(key);
      const contribuiAcumulado = m <= mes ? v : 0;
      if (existing) existing.orcado += contribuiAcumulado;
      else porProjeto.set(key, { projeto: o.projeto, tipo, orcado: contribuiAcumulado });
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

    const { data: txsProj, error: errP } = await context.supabase.rpc("resumo_transacoes_projeto", {
      p_ano: ano,
      p_mes: mes,
    });
    if (errP) throw new Error(errP.message);

    type ProjRow = { projeto: string; nome: string; tipo: "RECEITA" | "DESPESA"; orcado: number; realizado: number };
    const projMap = new Map<string, ProjRow>();
    for (const p of porProjeto.values()) {
      projMap.set(`${p.projeto}|${p.tipo}`, { ...p, nome: p.projeto, realizado: 0 });
    }
    for (const t of (txsProj ?? []) as Array<{ projeto: string; nome_projeto?: string; receita: number; despesa: number }>) {
      const projeto = String(t.projeto ?? "(Sem projeto)");
      const nome = String(t.nome_projeto ?? projeto);
      const receita = Number(t.receita ?? 0);
      const despesa = Number(t.despesa ?? 0);
      if (receita !== 0) {
        const key = `${projeto}|RECEITA`;
        const r = projMap.get(key);
        if (r) { r.realizado += receita; r.nome = nome; }
        else projMap.set(key, { projeto, nome, tipo: "RECEITA", orcado: 0, realizado: receita });
      }
      if (despesa !== 0) {
        const key = `${projeto}|DESPESA`;
        const r = projMap.get(key);
        if (r) { r.realizado += despesa; r.nome = nome; }
        else projMap.set(key, { projeto, nome, tipo: "DESPESA", orcado: 0, realizado: despesa });
      }
    }

    // Aplicar mapeamento de nomes também a projetos que só têm orçamento
    const { data: mapas } = await context.supabase
      .from("centro_custo_projetos")
      .select("centro_custo, nome_projeto");
    const nomeByCC = new Map<string, string>((mapas ?? []).map((m) => [m.centro_custo, m.nome_projeto]));
    for (const r of projMap.values()) {
      const n = nomeByCC.get(r.projeto);
      if (n) r.nome = n;
    }

    return {
      kpis: {
        receitaOrc, receitaReal,
        despesaOrc, despesaReal,
      },
      grafico,
      projetos: Array.from(projMap.values()),
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

export const mesesDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number }) => z.object({ ano: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: meses, error } = await context.supabase.rpc("resumo_transacoes_mensal", {
      p_ano: data.ano,
    });
    if (error) throw new Error(error.message);
    return (meses ?? [])
      .map((r) => Number(r.mes))
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
      .sort((a, b) => a - b);
  });
