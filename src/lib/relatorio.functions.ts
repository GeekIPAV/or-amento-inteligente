import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotaRelatorio = {
  id: string;
  ano: number;
  projeto: string;
  rubrica: string;
  nota: string;
};

export const listarNotasRelatorio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; projeto?: string | null }) =>
    z
      .object({
        ano: z.number().int(),
        projeto: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("relatorio_notas")
      .select("id, ano, projeto, rubrica, nota")
      .eq("ano", data.ano);
    if (data.projeto) q = q.eq("projeto", data.projeto);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as NotaRelatorio[];
  });

export const guardarNotaRelatorio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ano: z.number().int(),
        projeto: z.string().default("__all__"),
        rubrica: z.string().default("__geral__"),
        nota: z.string().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      ano: data.ano,
      projeto: data.projeto || "__all__",
      rubrica: data.rubrica || "__geral__",
      nota: data.nota ?? "",
    };
    const { error } = await context.supabase
      .from("relatorio_notas")
      .upsert(payload, { onConflict: "ano,projeto,rubrica" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
