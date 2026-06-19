import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ProjRpc = { projeto: string; nome_projeto?: string; receita: number; despesa: number };
type RubRpc = { rubrica: string; receita: number; despesa: number };

async function rubricaRange(
  supabase: any,
  ano: number,
  mesIni: number,
  mesFim: number,
): Promise<Map<string, { rubrica: string; receita: number; despesa: number }>> {
  const { data: ate, error: e1 } = await supabase.rpc("resumo_transacoes_rubrica", {
    p_ano: ano,
    p_mes: mesFim,
  });
  if (e1) throw new Error(e1.message);
  let antes: RubRpc[] = [];
  if (mesIni > 1) {
    const { data, error } = await supabase.rpc("resumo_transacoes_rubrica", {
      p_ano: ano,
      p_mes: mesIni - 1,
    });
    if (error) throw new Error(error.message);
    antes = (data ?? []) as RubRpc[];
  }
  const antesMap = new Map<string, RubRpc>();
  for (const r of antes) antesMap.set(String(r.rubrica), r);

  const map = new Map<string, { rubrica: string; receita: number; despesa: number }>();
  for (const r of (ate ?? []) as RubRpc[]) {
    const key = String(r.rubrica);
    const prev = antesMap.get(key);
    map.set(key, {
      rubrica: key,
      receita: Number(r.receita ?? 0) - Number(prev?.receita ?? 0),
      despesa: Number(r.despesa ?? 0) - Number(prev?.despesa ?? 0),
    });
  }
  return map;
}

async function projetoRange(
  supabase: any,
  ano: number,
  mesIni: number,
  mesFim: number,
): Promise<Map<string, { projeto: string; nome: string; receita: number; despesa: number }>> {
  const { data: ate, error: e1 } = await supabase.rpc("resumo_transacoes_projeto", {
    p_ano: ano,
    p_mes: mesFim,
  });
  if (e1) throw new Error(e1.message);
  let antes: ProjRpc[] = [];
  if (mesIni > 1) {
    const { data, error } = await supabase.rpc("resumo_transacoes_projeto", {
      p_ano: ano,
      p_mes: mesIni - 1,
    });
    if (error) throw new Error(error.message);
    antes = (data ?? []) as ProjRpc[];
  }
  const antesMap = new Map<string, ProjRpc>();
  for (const r of antes) antesMap.set(String(r.projeto), r);

  const map = new Map<string, { projeto: string; nome: string; receita: number; despesa: number }>();
  for (const r of (ate ?? []) as ProjRpc[]) {
    const key = String(r.projeto);
    const prev = antesMap.get(key);
    const receita = Number(r.receita ?? 0) - Number(prev?.receita ?? 0);
    const despesa = Number(r.despesa ?? 0) - Number(prev?.despesa ?? 0);
    map.set(key, {
      projeto: key,
      nome: String(r.nome_projeto ?? key),
      receita,
      despesa,
    });
  }
  return map;
}

export const resumoDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      ano: number;
      mes?: number | null;
      mesCumulativo?: boolean;
      anosCumulativo?: boolean;
    }) =>
      z
        .object({
          ano: z.number().int(),
          mes: z.number().int().min(1).max(12).nullish(),
          mesCumulativo: z.boolean().optional().default(true),
          anosCumulativo: z.boolean().optional().default(false),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { ano, mes, mesCumulativo, anosCumulativo } = data;

    // Intervalo de meses a considerar para KPIs e tabela de projetos.
    const mesIni = mes == null ? 1 : mesCumulativo ? 1 : mes;
    const mesFim = mes == null ? 12 : mes;

    // Lista de anos
    let anosAlvo: number[] = [ano];
    if (anosCumulativo) {
      const { data: rows, error } = await context.supabase.rpc("anos_transacoes_disponiveis");
      if (error) throw new Error(error.message);
      const todos = new Set<number>([ano]);
      (rows ?? []).forEach((r: any) => todos.add(Number(r.ano)));
      const { data: orcAnos } = await context.supabase.from("orcamentos").select("ano");
      (orcAnos ?? []).forEach((r: any) => todos.add(Number(r.ano)));
      anosAlvo = Array.from(todos).filter((a) => a <= ano).sort((a, b) => a - b);
    }

    // Versões ativas do orçamento (uma por ano) para os anos alvo
    const { data: versoesAtivas } = await context.supabase
      .from("orcamento_versoes")
      .select("id, ano")
      .eq("ativa", true)
      .in("ano", anosAlvo);
    const versaoIds = (versoesAtivas ?? []).map((v: any) => v.id as string);

    // Orçamentos
    const orcs: Array<{ projeto: string; tipo: string; mes: number; ano: number; valor: number; rubrica: string | null }> = [];
    if (versaoIds.length > 0) {
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: chunk, error: errO } = await context.supabase
          .from("orcamentos")
          .select("projeto, tipo, mes, ano, valor, rubrica")
          .in("versao_id", versaoIds)
          .range(from, from + PAGE - 1);
        if (errO) throw new Error(errO.message);
        if (!chunk || chunk.length === 0) break;
        orcs.push(...(chunk as typeof orcs));
        if (chunk.length < PAGE) break;
      }
    }


    // Mapping: orçamento.projeto -> conjunto de nome_display (via centro_custo_projetos + centros_custo_meta)
    const { data: ccpRows } = await context.supabase
      .from("centro_custo_projetos")
      .select("centro_custo, nome_projeto");
    const { data: metaRows } = await context.supabase
      .from("centros_custo_meta")
      .select("centro_custo, nome_display");
    const nomeByCC = new Map<string, string>(
      (metaRows ?? []).map((m: any) => [m.centro_custo, m.nome_display]),
    );
    const nomesByOrcProjeto = new Map<string, Set<string>>();
    for (const row of (ccpRows ?? []) as Array<{ centro_custo: string; nome_projeto: string }>) {
      const nome = nomeByCC.get(row.centro_custo) ?? row.centro_custo;
      if (!nomesByOrcProjeto.has(row.nome_projeto)) {
        nomesByOrcProjeto.set(row.nome_projeto, new Set());
      }
      nomesByOrcProjeto.get(row.nome_projeto)!.add(nome);
    }

    // KPIs orçamentados (filtrados por meses)
    let receitaOrc = 0;
    let despesaOrc = 0;
    // Gráfico mensal do ANO selecionado (sempre os 12 meses)
    const orcMensal = {
      RECEITA: Array(12).fill(0) as number[],
      DESPESA: Array(12).fill(0) as number[],
    };
    // Por projeto (filtrado) — chaveado por nome_display
    const porProjeto = new Map<string, { projeto: string; orcado: number }>();
    // Por rubrica (filtrado) — uma linha por rubrica, sem split por tipo
    const porRubrica = new Map<string, { rubrica: string; orcado: number }>();

    for (const o of orcs) {
      const tipo = o.tipo as "RECEITA" | "DESPESA";
      const m = Number(o.mes);
      const v = Number(o.valor ?? 0);
      if (m >= 1 && m <= 12) {
        orcMensal[tipo][m - 1] += v;
      }
      if (m < mesIni || m > mesFim) continue;
      if (tipo === "RECEITA") receitaOrc += v;
      else despesaOrc += v;

      const nomes = nomesByOrcProjeto.get(o.projeto);
      const targets = nomes && nomes.size > 0 ? Array.from(nomes) : ["(Sem projeto)"];
      for (const nome of targets) {
        const pe = porProjeto.get(nome);
        if (pe) pe.orcado += v;
        else porProjeto.set(nome, { projeto: nome, orcado: v });
      }

      const rub = (o.rubrica ?? "").trim();
      if (rub) {
        const re = porRubrica.get(rub);
        if (re) re.orcado += v;
        else porRubrica.set(rub, { rubrica: rub, orcado: v });
      }
    }



    // Realizados — mensal (gráfico): soma em todos os anos alvo
    const realMensal = {
      RECEITA: Array(12).fill(0) as number[],
      DESPESA: Array(12).fill(0) as number[],
    };
    for (const y of anosAlvo) {
      const { data: txs, error } = await context.supabase.rpc("resumo_transacoes_mensal", {
        p_ano: y,
      });
      if (error) throw new Error(error.message);
      for (const t of txs ?? []) {
        const m = Number(t.mes);
        if (m >= 1 && m <= 12) {
          realMensal.RECEITA[m - 1] += Number(t.receita ?? 0);
          realMensal.DESPESA[m - 1] += Number(t.despesa ?? 0);
        }
      }
    }


    // Realizados — KPIs e projetos (intervalo + multi-ano) — chaveado por nome_display
    let receitaReal = 0;
    let despesaReal = 0;
    type ProjRow = { projeto: string; nome: string; orcado: number; realizado: number };
    const projMap = new Map<string, ProjRow>();
    for (const p of porProjeto.values()) {
      projMap.set(p.projeto, { projeto: p.projeto, nome: p.projeto, orcado: p.orcado, realizado: 0 });
    }

    for (const y of anosAlvo) {
      const m = await projetoRange(context.supabase, y, mesIni, mesFim);
      for (const r of m.values()) {
        receitaReal += r.receita;
        despesaReal += r.despesa;
        const exec = Number(r.receita ?? 0) + Number(r.despesa ?? 0);
        if (exec === 0) continue;
        const e = projMap.get(r.projeto);
        if (e) { e.realizado += exec; e.nome = r.nome; }
        else projMap.set(r.projeto, { projeto: r.projeto, nome: r.nome, orcado: 0, realizado: exec });
      }
    }


    // Realizados — por rubrica (intervalo + multi-ano), via match conta→rubrica.
    // Soma receita + despesa como valor absoluto executado por rubrica.
    type RubRow = { rubrica: string; orcado: number; realizado: number };
    const rubMap = new Map<string, RubRow>();
    for (const r of porRubrica.values()) {
      rubMap.set(r.rubrica, { ...r, realizado: 0 });
    }
    for (const y of anosAlvo) {
      const m = await rubricaRange(context.supabase, y, mesIni, mesFim);
      for (const r of m.values()) {
        const exec = Number(r.receita ?? 0) + Number(r.despesa ?? 0);
        if (exec === 0) continue;
        const e = rubMap.get(r.rubrica);
        if (e) e.realizado += exec;
        else rubMap.set(r.rubrica, { rubrica: r.rubrica, orcado: 0, realizado: exec });
      }
    }


    const grafico = Array.from({ length: mesFim - mesIni + 1 }, (_, i) => {
      const idx = mesIni - 1 + i;
      return {
        mes: idx + 1,
        receitaOrc: orcMensal.RECEITA[idx],
        receitaReal: realMensal.RECEITA[idx],
        despesaOrc: orcMensal.DESPESA[idx],
        despesaReal: realMensal.DESPESA[idx],
      };
    });

    return {
      kpis: { receitaOrc, receitaReal, despesaOrc, despesaReal },
      grafico,
      projetos: Array.from(projMap.values()),
      rubricas: Array.from(rubMap.values()),
      intervalo: { ano, mesIni, mesFim, anosCumulativo, anosAlvo },
    };
  });



export const detalhesIntervalo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      anos: number[];
      mesIni: number;
      mesFim: number;
      projeto?: string | null;
      tipo?: "RECEITA" | "DESPESA" | null;
    }) =>
      z
        .object({
          anos: z.array(z.number().int()).min(1),
          mesIni: z.number().int().min(1).max(12),
          mesFim: z.number().int().min(1).max(12),
          projeto: z.string().nullish(),
          tipo: z.enum(["RECEITA", "DESPESA"]).nullish(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { anos, mesIni, mesFim, projeto, tipo } = data;

    // Lista mes_referencia para o intervalo
    const meses: string[] = [];
    for (const a of anos) {
      for (let m = mesIni; m <= mesFim; m++) {
        meses.push(`${a}-${String(m).padStart(2, "0")}`);
      }
    }

    // Transações (limitado a 1000 para o peek)
    let q = context.supabase
      .from("transacoes_extrato")
      .select("id, data, conta, descricao_conta, num_documento, centro_custo, debito, credito, mes_referencia")
      .in("mes_referencia", meses)
      .order("data", { ascending: false })
      .limit(1000);
    if (tipo === "RECEITA") q = q.like("conta", "7%");
    else if (tipo === "DESPESA") q = q.like("conta", "6%");
    else q = q.or("conta.like.6%,conta.like.7%");
    if (projeto) {
      if (projeto === "(Sem projeto)")
        q = q.or("centro_custo.is.null,centro_custo.eq.");
      else q = q.eq("centro_custo", projeto);
    }
    const { data: txs, error: errT } = await q;
    if (errT) throw new Error(errT.message);

    // Versões ativas do orçamento (uma por ano)
    const { data: versoesAtivas } = await context.supabase
      .from("orcamento_versoes")
      .select("id, ano")
      .eq("ativa", true)
      .in("ano", anos);
    const versaoIds = (versoesAtivas ?? []).map((v: any) => v.id as string);

    let orcRows: any[] = [];
    if (versaoIds.length > 0) {
      let oq = context.supabase
        .from("orcamentos")
        .select("projeto, tipo, mes, ano, valor, descricao")
        .in("versao_id", versaoIds)
        .in("ano", anos)
        .gte("mes", mesIni)
        .lte("mes", mesFim)
        .order("ano", { ascending: true })
        .order("mes", { ascending: true });
      if (projeto) oq = oq.eq("projeto", projeto);
      if (tipo) oq = oq.eq("tipo", tipo);
      const { data: o, error: errO } = await oq;
      if (errO) throw new Error(errO.message);
      orcRows = o ?? [];
    }

    // Mapa de nomes
    const { data: mapas } = await context.supabase
      .from("centro_custo_projetos")
      .select("centro_custo, nome_projeto");
    const nomeByCC = new Map<string, string>(
      (mapas ?? []).map((m: any) => [m.centro_custo, m.nome_projeto]),
    );

    return {
      transacoes: (txs ?? []).map((t: any) => ({
        ...t,
        projeto_nome: nomeByCC.get(String(t.centro_custo ?? "")) ?? t.centro_custo ?? "(Sem projeto)",
      })),
      orcamento: orcRows.map((o: any) => ({
        ...o,
        projeto_nome: nomeByCC.get(String(o.projeto ?? "")) ?? o.projeto,
      })),
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
