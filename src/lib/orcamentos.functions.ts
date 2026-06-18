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

export const listarOrcamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orcamentos")
      .select("id, projeto, descricao, rubrica, tipo, ano, mes, valor")
      .order("ano", { ascending: false })
      .order("projeto", { ascending: true })
      .order("mes", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const inserirLinhaOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linhaSchema.omit({ id: true }).parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("orcamentos")
      .insert({ ...data, created_by: context.userId })
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
