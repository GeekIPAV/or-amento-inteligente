import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tipoSchema = z.enum(["RECEITA", "DESPESA"]);

const linhaSchema = z.object({
  id: z.string().uuid().optional(),
  projeto: z.string().trim().min(1).max(120),
  conta: z.string().trim().max(60).nullable().optional(),
  descricao_conta: z.string().trim().max(240).nullable().optional(),
  m1: z.number().default(0),
  m2: z.number().default(0),
  m3: z.number().default(0),
  m4: z.number().default(0),
  m5: z.number().default(0),
  m6: z.number().default(0),
  m7: z.number().default(0),
  m8: z.number().default(0),
  m9: z.number().default(0),
  m10: z.number().default(0),
  m11: z.number().default(0),
  m12: z.number().default(0),
});

const importLinhaSchema = z.object({
  centro_custo: z.string().nullable(),
  conta: z.string(),
  descricao_conta: z.string().nullable(),
  data: z.string(), // YYYY-MM-DD
  debito: z.number(),
  credito: z.number(),
});

const aggLinhaSchema = z.object({
  ano: z.number().int(),
  projeto: z.string().trim().min(1).max(200),
  conta: z.string().trim().max(120).nullable(),
  descricao_conta: z.string().trim().max(400).nullable(),
  tipo: tipoSchema,
  meses: z.array(z.number()).length(12),
});

export const listarVersoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; tipo: "RECEITA" | "DESPESA" }) =>
    z.object({ ano: z.number().int(), tipo: tipoSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("orcamentos")
      .select("versao, ativo, created_at")
      .eq("ano", data.ano)
      .eq("tipo", data.tipo)
      .order("versao", { ascending: false });
    if (error) throw new Error(error.message);
    const map = new Map<number, { versao: number; ativo: boolean; created_at: string }>();
    (rows ?? []).forEach((r) => {
      if (!map.has(r.versao)) map.set(r.versao, r as any);
    });
    return Array.from(map.values());
  });

export const carregarOrcamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; tipo: "RECEITA" | "DESPESA"; versao?: number }) =>
    z.object({ ano: z.number().int(), tipo: tipoSchema, versao: z.number().int().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("orcamentos")
      .select("*")
      .eq("ano", data.ano)
      .eq("tipo", data.tipo);
    if (data.versao != null) q = q.eq("versao", data.versao);
    else q = q.eq("ativo", true);
    const { data: rows, error } = await q.order("projeto");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listarAnos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orcamentos")
      .select("ano")
      .order("ano", { ascending: false });
    if (error) throw new Error(error.message);
    const anos = Array.from(new Set((data ?? []).map((r) => r.ano)));
    return anos;
  });

export const guardarLinhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      ano: number;
      tipo: "RECEITA" | "DESPESA";
      versao: number;
      linhas: z.input<typeof linhaSchema>[];
      apagar?: string[];
    }) =>
      z
        .object({
          ano: z.number().int(),
          tipo: tipoSchema,
          versao: z.number().int(),
          linhas: z.array(linhaSchema),
          apagar: z.array(z.string().uuid()).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verifica que a versão é a ativa
    const { data: ativo, error: errAtivo } = await context.supabase
      .from("orcamentos")
      .select("versao")
      .eq("ano", data.ano)
      .eq("tipo", data.tipo)
      .eq("ativo", true)
      .limit(1);
    if (errAtivo) throw new Error(errAtivo.message);
    const versaoAtiva = ativo?.[0]?.versao;
    if (versaoAtiva !== undefined && versaoAtiva !== data.versao) {
      throw new Error("Apenas a versão ativa pode ser editada.");
    }

    if (data.apagar && data.apagar.length > 0) {
      const { error } = await context.supabase
        .from("orcamentos")
        .delete()
        .in("id", data.apagar);
      if (error) throw new Error(error.message);
    }

    for (const l of data.linhas) {
      const payload = {
        projeto: l.projeto,
        conta: l.conta ?? null,
        descricao_conta: l.descricao_conta ?? null,
        ano: data.ano,
        tipo: data.tipo,
        versao: data.versao,
        ativo: true,
        m1: l.m1, m2: l.m2, m3: l.m3, m4: l.m4, m5: l.m5, m6: l.m6,
        m7: l.m7, m8: l.m8, m9: l.m9, m10: l.m10, m11: l.m11, m12: l.m12,
        created_by: context.userId,
      };
      if (l.id) {
        const { error } = await context.supabase
          .from("orcamentos")
          .update(payload)
          .eq("id", l.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase.from("orcamentos").insert(payload);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });

export const criarNovaVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; tipo: "RECEITA" | "DESPESA" }) =>
    z.object({ ano: z.number().int(), tipo: tipoSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: atual, error } = await context.supabase
      .from("orcamentos")
      .select("*")
      .eq("ano", data.ano)
      .eq("tipo", data.tipo)
      .eq("ativo", true);
    if (error) throw new Error(error.message);

    const maxVersao = (atual ?? []).reduce((m, r) => Math.max(m, r.versao), 0);
    const novaVersao = maxVersao + 1;

    // Marca atuais como inativos
    if (atual && atual.length > 0) {
      const { error: errUpd } = await context.supabase
        .from("orcamentos")
        .update({ ativo: false })
        .eq("ano", data.ano)
        .eq("tipo", data.tipo)
        .eq("ativo", true);
      if (errUpd) throw new Error(errUpd.message);

      const novas = atual.map((r) => ({
        projeto: r.projeto,
        conta: r.conta ?? null,
        descricao_conta: r.descricao_conta ?? null,
        ano: r.ano,
        tipo: r.tipo,
        versao: novaVersao,
        ativo: true,
        m1: r.m1, m2: r.m2, m3: r.m3, m4: r.m4, m5: r.m5, m6: r.m6,
        m7: r.m7, m8: r.m8, m9: r.m9, m10: r.m10, m11: r.m11, m12: r.m12,
        created_by: context.userId,
      }));
      const { error: errIns } = await context.supabase.from("orcamentos").insert(novas);
      if (errIns) throw new Error(errIns.message);
    }
    return { versao: novaVersao };
  });

export const importarExtratoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { ano: number; linhas: z.input<typeof importLinhaSchema>[] }) =>
      z.object({
        ano: z.number().int(),
        linhas: z.array(importLinhaSchema),
      }).parse(d),
  )
  .handler(async ({ data, context }) => {
    type Agg = {
      projeto: string;
      conta: string;
      descricao_conta: string | null;
      tipo: "RECEITA" | "DESPESA";
      meses: number[]; // 12 posições
    };
    const buckets = new Map<string, Agg>();

    for (const l of data.linhas) {
      const conta = (l.conta ?? "").trim();
      if (!conta) continue;
      const first = conta[0];
      const tipo: "RECEITA" | "DESPESA" | null =
        first === "7" ? "RECEITA" : first === "6" ? "DESPESA" : null;
      if (!tipo) continue;

      const m = /^(\d{4})-(\d{2})-\d{2}/.exec(l.data);
      if (!m) continue;
      const year = Number(m[1]);
      const mes = Number(m[2]);
      if (year !== data.ano || mes < 1 || mes > 12) continue;

      const valor =
        tipo === "RECEITA"
          ? Number(l.credito) - Number(l.debito)
          : Number(l.debito) - Number(l.credito);
      if (!Number.isFinite(valor) || valor === 0) continue;

      const projeto = (l.centro_custo ?? "").trim() || "(Sem projeto)";
      const key = `${projeto}||${conta}||${tipo}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          projeto,
          conta,
          descricao_conta: l.descricao_conta?.trim() || null,
          tipo,
          meses: new Array(12).fill(0),
        };
        buckets.set(key, bucket);
      }
      bucket.meses[mes - 1] += valor;
    }

    const aggregated = Array.from(buckets.values());
    if (aggregated.length === 0) {
      throw new Error("Nenhuma linha válida encontrada (verifique contas 6xx/7xx e datas).");
    }

    const result: Record<"RECEITA" | "DESPESA", { versao: number; linhas: number }> = {
      RECEITA: { versao: 0, linhas: 0 },
      DESPESA: { versao: 0, linhas: 0 },
    };

    for (const tipo of ["RECEITA", "DESPESA"] as const) {
      const linhas = aggregated.filter((a) => a.tipo === tipo);
      if (linhas.length === 0) continue;

      // Próxima versão
      const { data: existentes, error: errSel } = await context.supabase
        .from("orcamentos")
        .select("versao")
        .eq("ano", data.ano)
        .eq("tipo", tipo);
      if (errSel) throw new Error(errSel.message);
      const maxVersao = (existentes ?? []).reduce((m, r) => Math.max(m, r.versao), 0);
      const novaVersao = maxVersao + 1;

      // Desativa anteriores
      const { error: errUpd } = await context.supabase
        .from("orcamentos")
        .update({ ativo: false })
        .eq("ano", data.ano)
        .eq("tipo", tipo)
        .eq("ativo", true);
      if (errUpd) throw new Error(errUpd.message);

      const payload = linhas.map((l) => ({
        projeto: l.projeto,
        conta: l.conta,
        descricao_conta: l.descricao_conta,
        ano: data.ano,
        tipo,
        versao: novaVersao,
        ativo: true,
        m1: l.meses[0], m2: l.meses[1], m3: l.meses[2], m4: l.meses[3],
        m5: l.meses[4], m6: l.meses[5], m7: l.meses[6], m8: l.meses[7],
        m9: l.meses[8], m10: l.meses[9], m11: l.meses[10], m12: l.meses[11],
        created_by: context.userId,
      }));

      // Insere em lotes para evitar payloads gigantes
      const BATCH = 500;
      for (let i = 0; i < payload.length; i += BATCH) {
        const { error } = await context.supabase
          .from("orcamentos")
          .insert(payload.slice(i, i + BATCH));
        if (error) throw new Error(error.message);
      }

      result[tipo] = { versao: novaVersao, linhas: payload.length };
    }

    return result;
  });

export const adicionarProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; tipo: "RECEITA" | "DESPESA"; projeto: string }) =>
    z.object({
      ano: z.number().int(),
      tipo: tipoSchema,
      projeto: z.string().trim().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Procura a versão ativa; se não houver, cria versão 1
    const { data: ativo } = await context.supabase
      .from("orcamentos")
      .select("versao")
      .eq("ano", data.ano)
      .eq("tipo", data.tipo)
      .eq("ativo", true)
      .limit(1);
    const versao = ativo?.[0]?.versao ?? 1;

    const { error } = await context.supabase.from("orcamentos").insert({
      projeto: data.projeto,
      ano: data.ano,
      tipo: data.tipo,
      versao,
      ativo: true,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importarOrcamentoAgregado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { linhas: z.input<typeof aggLinhaSchema>[] }) =>
      z.object({ linhas: z.array(aggLinhaSchema).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Agrupa por (ano, tipo) para criar uma nova versão por combinação
    const groups = new Map<string, { ano: number; tipo: "RECEITA" | "DESPESA"; rows: typeof data.linhas }>();
    for (const l of data.linhas) {
      const key = `${l.ano}||${l.tipo}`;
      let g = groups.get(key);
      if (!g) { g = { ano: l.ano, tipo: l.tipo, rows: [] }; groups.set(key, g); }
      g.rows.push(l);
    }

    const result: { ano: number; tipo: "RECEITA" | "DESPESA"; versao: number; linhas: number }[] = [];

    for (const g of groups.values()) {
      const { data: existentes, error: errSel } = await context.supabase
        .from("orcamentos")
        .select("versao")
        .eq("ano", g.ano)
        .eq("tipo", g.tipo);
      if (errSel) throw new Error(errSel.message);
      const maxVersao = (existentes ?? []).reduce((m, r) => Math.max(m, r.versao), 0);
      const novaVersao = maxVersao + 1;

      const { error: errUpd } = await context.supabase
        .from("orcamentos")
        .update({ ativo: false })
        .eq("ano", g.ano)
        .eq("tipo", g.tipo)
        .eq("ativo", true);
      if (errUpd) throw new Error(errUpd.message);

      const payload = g.rows.map((l) => ({
        projeto: l.projeto,
        conta: l.conta,
        descricao_conta: l.descricao_conta,
        ano: g.ano,
        tipo: g.tipo,
        versao: novaVersao,
        ativo: true,
        m1: l.meses[0], m2: l.meses[1], m3: l.meses[2], m4: l.meses[3],
        m5: l.meses[4], m6: l.meses[5], m7: l.meses[6], m8: l.meses[7],
        m9: l.meses[8], m10: l.meses[9], m11: l.meses[10], m12: l.meses[11],
        created_by: context.userId,
      }));

      const BATCH = 500;
      for (let i = 0; i < payload.length; i += BATCH) {
        const { error } = await context.supabase
          .from("orcamentos")
          .insert(payload.slice(i, i + BATCH));
        if (error) throw new Error(error.message);
      }
      result.push({ ano: g.ano, tipo: g.tipo, versao: novaVersao, linhas: payload.length });
    }
    return result;
  });
