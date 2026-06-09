import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tipoSchema = z.enum(["RECEITA", "DESPESA"]);

const linhaSchema = z.object({
  id: z.string().uuid().optional(),
  projeto: z.string().trim().min(1).max(120),
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
