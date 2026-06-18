import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const linhaSchema = z.object({
  conta: z.string().nullable().optional(),
  descricao_conta: z.string().nullable().optional(),
  data: z.string().nullable().optional(), // ISO YYYY-MM-DD
  num_documento: z.string().nullable().optional(),
  diario: z.string().nullable().optional(),
  movimento: z.string().nullable().optional(),
  centro_custo: z.string().nullable().optional(),
  debito: z.number().default(0),
  credito: z.number().default(0),
});

export const importarExtrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { mes_referencia?: string; linhas: z.input<typeof linhaSchema>[] }) =>
      z
        .object({
          mes_referencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
          linhas: z.array(linhaSchema).min(1).max(20000),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload: any[] = [];
    let semData = 0;
    for (const l of data.linhas) {
      let mes = data.mes_referencia;
      if (l.data && /^\d{4}-\d{2}-\d{2}/.test(l.data)) {
        mes = l.data.slice(0, 7);
      }
      if (!mes) {
        semData++;
        continue;
      }
      payload.push({ ...l, mes_referencia: mes, importado_por: context.userId });
    }

    // Insere em chunks de 500
    const chunkSize = 500;
    let inseridos = 0;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await context.supabase.from("transacoes_extrato").insert(chunk);
      if (error) throw new Error(error.message);
      inseridos += chunk.length;
    }
    return { inseridos, ignoradas_sem_data: semData };
  });


export const historicoImportacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transacoes_extrato")
      .select("mes_referencia, importado_em")
      .order("importado_em", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    // Agrega por (mes_referencia, dia)
    const map = new Map<string, { mes_referencia: string; importado_em: string; linhas: number }>();
    (data ?? []).forEach((r) => {
      const k = `${r.mes_referencia}|${r.importado_em.slice(0, 16)}`;
      const e = map.get(k);
      if (e) e.linhas += 1;
      else map.set(k, { mes_referencia: r.mes_referencia, importado_em: r.importado_em, linhas: 1 });
    });
    return Array.from(map.values()).slice(0, 10);
  });

export const apagarMesExtrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mes_referencia: string }) =>
    z.object({ mes_referencia: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transacoes_extrato")
      .delete()
      .eq("mes_referencia", data.mes_referencia);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarMovimentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const all: any[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await context.supabase
        .from("transacoes_extrato")
        .select("id, conta, descricao_conta, data, num_documento, diario, movimento, centro_custo, debito, credito, mes_referencia")
        .order("data", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  });
