import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tipoSchema = z.enum(["RECEITA", "DESPESA"]);

const linhaSchema = z.object({
  id: z.string().uuid().optional(),
  projeto: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(400).nullable().optional(),
  rubrica: z.string().trim().max(200).nullable().optional(),
  tipo: tipoSchema,
  ano: z.number().int(),
  mes: z.number().int().min(1).max(12),
  valor: z.number(),
});

async function getVersaoAtivaId(supabase: any): Promise<string | null> {
  const { data, error } = await supabase
    .from("orcamento_versoes")
    .select("id")
    .eq("ativa", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export const listarVersoesOrcamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orcamento_versoes")
      .select("id, nome, ativa, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const definirVersaoAtiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Desativa todas, depois ativa a escolhida (índice único impede colisão)
    const { error: e1 } = await context.supabase
      .from("orcamento_versoes")
      .update({ ativa: false })
      .eq("ativa", true);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await context.supabase
      .from("orcamento_versoes")
      .update({ ativa: true })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const apagarVersaoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orcamento_versoes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const criarVersaoOrcamentoCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().trim().min(1).max(120),
        ativar: z.boolean().optional().default(true),
        linhas: z.array(linhaSchema.omit({ id: true })).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.ativar) {
      const { error: eDes } = await context.supabase
        .from("orcamento_versoes")
        .update({ ativa: false })
        .eq("ativa", true);
      if (eDes) throw new Error(eDes.message);
    }
    const { data: versao, error: eV } = await context.supabase
      .from("orcamento_versoes")
      .insert({ nome: data.nome, ativa: data.ativar, created_by: context.userId })
      .select()
      .single();
    if (eV) throw new Error(eV.message);

    const rows = data.linhas.map((l) => ({
      ...l,
      versao_id: versao.id,
      created_by: context.userId,
    }));
    // Chunk inserts
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await context.supabase
        .from("orcamentos")
        .insert(rows.slice(i, i + CHUNK));
      if (error) {
        await context.supabase.from("orcamento_versoes").delete().eq("id", versao.id);
        throw new Error(error.message);
      }
    }
    return { versao_id: versao.id, total: rows.length };
  });

export const listarOrcamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ versaoId: z.string().uuid().nullable().optional() }).optional().parse(d),
  )
  .handler(async ({ data, context }) => {
    let versaoId = data?.versaoId ?? null;
    if (!versaoId) versaoId = await getVersaoAtivaId(context.supabase);
    if (!versaoId) return [];
    const all: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: chunk, error } = await context.supabase
        .from("orcamentos")
        .select("id, projeto, descricao, rubrica, tipo, ano, mes, valor")
        .eq("versao_id", versaoId)
        .order("ano", { ascending: false })
        .order("projeto", { ascending: true })
        .order("mes", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!chunk || chunk.length === 0) break;
      all.push(...chunk);
      if (chunk.length < PAGE) break;
    }
    return all;
  });

export const inserirLinhaOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linhaSchema.omit({ id: true }).parse(d))
  .handler(async ({ data, context }) => {
    const versaoId = await getVersaoAtivaId(context.supabase);
    if (!versaoId) {
      throw new Error("Não existe versão de orçamento ativa. Faça upload de um CSV primeiro.");
    }
    const { error, data: row } = await context.supabase
      .from("orcamentos")
      .insert({ ...data, versao_id: versaoId, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const atualizarLinhaOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    linhaSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("orcamentos")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const apagarLinhasOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orcamentos")
      .delete()
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
