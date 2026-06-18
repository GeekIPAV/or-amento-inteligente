import Papa from "papaparse";

export interface ParsedLinha {
  conta: string | null;
  descricao_conta: string | null;
  data: string | null; // ISO YYYY-MM-DD
  num_documento: string | null;
  diario: string | null;
  movimento: string | null;
  centro_custo: string | null;
  debito: number;
  credito: number;
}

export interface ParseResult {
  linhas: ParsedLinha[];
  invalidas: number;
  total: number;
  separador: string;
  cabecalhos: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const MAPA: Record<keyof ParsedLinha, string[]> = {
  conta: ["conta", "numconta", "ncontas", "ncc", "ncconta"],
  descricao_conta: ["descricaoconta", "descricao", "designacao", "designacaoconta", "nomeconta"],
  data: ["data", "datadoc", "datamov", "datamovimento"],
  num_documento: ["numdocumento", "ndocumento", "ndoc", "documento", "ndocum"],
  diario: ["diario"],
  movimento: ["movimento", "ndocinterno", "lancamento"],
  centro_custo: ["centrocusto", "ccusto", "cc"],
  debito: ["debito", "dr", "valordebito"],
  credito: ["credito", "cr", "valorcredito"],
};

function findCol(headers: string[], variantes: string[]): string | null {
  for (const h of headers) {
    if (variantes.includes(norm(h))) return h;
  }
  return null;
}

function parseNumber(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === "" || s === "-") return 0;
  // Remove espaços e moeda
  let n = s.replace(/[€\s]/g, "");
  // Se tiver vírgula e ponto, assume ponto = milhar, vírgula = decimal (PT)
  if (n.includes(",") && n.includes(".")) {
    n = n.replace(/\./g, "").replace(",", ".");
  } else if (n.includes(",")) {
    n = n.replace(",", ".");
  }
  const f = parseFloat(n);
  return Number.isFinite(f) ? f : 0;
}

function parseData(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const validDate = (y: string, mo: string, d: string) => {
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
    return `${y}-${mo}-${d}`;
  };
  // ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validDate(m[1], m[2], m[3]);
  // DD/MM/YYYY ou DD-MM-YYYY
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
    return validDate(y, mo, d);
  }
  return null;
}

export function parseCSV(text: string): ParseResult {
  // Detecta separador
  const sample = text.slice(0, 2000);
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  let delimiter = ",";
  if (tabs > semicolons && tabs > commas) delimiter = "\t";
  else if (semicolons >= commas) delimiter = ";";

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });

  const headers = result.meta.fields ?? [];
  const cols = {
    conta: findCol(headers, MAPA.conta),
    descricao_conta: findCol(headers, MAPA.descricao_conta),
    data: findCol(headers, MAPA.data),
    num_documento: findCol(headers, MAPA.num_documento),
    diario: findCol(headers, MAPA.diario),
    movimento: findCol(headers, MAPA.movimento),
    centro_custo: findCol(headers, MAPA.centro_custo),
    debito: findCol(headers, MAPA.debito),
    credito: findCol(headers, MAPA.credito),
  };

  const linhas: ParsedLinha[] = [];
  let invalidas = 0;

  for (const row of result.data) {
    if (!row || typeof row !== "object") continue;

    const conta = cols.conta ? String(row[cols.conta] ?? "").trim() : "";

    // 1. Ignorar tudo o que não seja um número de conta real (Saldos, Totais, etc)
    if (!/^\d/.test(conta)) {
      invalidas++;
      continue;
    }

    const rawData = cols.data ? String(row[cols.data] ?? "").trim() : "";
    const doc = cols.num_documento ? String(row[cols.num_documento] ?? "").trim() : "";
    const mov = cols.movimento ? String(row[cols.movimento] ?? "").trim() : "";
    const descricao = cols.descricao_conta ? String(row[cols.descricao_conta] ?? "").trim() : "";
    const textoLinha = norm([conta, descricao, doc, mov].join(" "));

    // 2. Ignorar Aberturas (mês 00), Fechos/Apuramentos (mês 14) e documentos de apuramento
    if (
      /[\/\-.](00|14)[\/\-.]/.test(rawData) ||
      textoLinha.includes("apuramento") ||
      textoLinha.includes("saldoinicial") ||
      textoLinha.includes("saldonoperiodo") ||
      textoLinha.includes("saldoacumulado")
    ) {
      invalidas++;
      continue;
    }

    const dataIso = cols.data ? parseData(row[cols.data]) : null;
    if (rawData && !dataIso) {
      invalidas++;
      continue;
    }

    const debito = cols.debito ? parseNumber(row[cols.debito]) : 0;
    const credito = cols.credito ? parseNumber(row[cols.credito]) : 0;

    // 3. Ignorar linhas sem valores
    if (debito === 0 && credito === 0) {
      invalidas++;
      continue;
    }

    linhas.push({
      conta,
      descricao_conta: cols.descricao_conta ? String(row[cols.descricao_conta] ?? "").trim() || null : null,
      data: dataIso,
      num_documento: cols.num_documento ? String(row[cols.num_documento] ?? "").trim() || null : null,
      diario: cols.diario ? String(row[cols.diario] ?? "").trim() || null : null,
      movimento: cols.movimento ? String(row[cols.movimento] ?? "").trim() || null : null,
      centro_custo: cols.centro_custo ? String(row[cols.centro_custo] ?? "").trim() || null : null,
      debito,
      credito,
    });
  }

  return {
    linhas,
    invalidas,
    total: result.data.length,
    separador: delimiter === "\t" ? "TAB" : delimiter,
    cabecalhos: headers,
  };
}

// ===== Parser de Orçamento (formato pré-agregado por mês) =====
export interface OrcamentoLinhaAgg {
  ano: number;
  projeto: string;
  conta: string | null;
  descricao_conta: string | null;
  tipo: "RECEITA" | "DESPESA";
  meses: number[]; // 12 posições
}

export interface ParseOrcamentoResult {
  linhas: OrcamentoLinhaAgg[];
  invalidas: number;
  total: number;
  anos: number[];
}

const MESES_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const MAPA_ORC = {
  centro_custo: ["centrodecustos", "centrodecusto", "centrocusto", "ccusto", "cc", "projeto"],
  descricao: ["descricao", "descrição", "designacao", "rubricadetalhe"],
  mes: ["mes", "mês", "month"],
  ano: ["ano", "year"],
  valor: ["valor", "valordoseur", "valoreur", "montante"],
  rubrica: ["rubrica", "categoria", "conta"],
};

export function parseOrcamentoCSV(text: string): ParseOrcamentoResult {
  const sample = text.slice(0, 2000);
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  let delimiter = ",";
  if (tabs > semicolons && tabs > commas) delimiter = "\t";
  else if (semicolons > commas) delimiter = ";";

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });
  const headers: string[] = result.meta.fields ?? [];
  const find = (variantes: string[]) =>
    headers.find((h) => variantes.includes(norm(h))) ?? null;

  const cols = {
    cc: find(MAPA_ORC.centro_custo),
    desc: find(MAPA_ORC.descricao),
    mes: find(MAPA_ORC.mes),
    ano: find(MAPA_ORC.ano),
    valor: find(MAPA_ORC.valor),
    rubrica: find(MAPA_ORC.rubrica),
  };

  if (!cols.cc || !cols.mes || !cols.ano || !cols.valor) {
    return { linhas: [], invalidas: 0, total: result.data.length, anos: [] };
  }

  const buckets = new Map<string, OrcamentoLinhaAgg>();
  let invalidas = 0;
  const anos = new Set<number>();

  for (const row of result.data) {
    if (!row || typeof row !== "object") continue;
    const cc = String(row[cols.cc] ?? "").trim() || "(Sem projeto)";
    const mesRaw = norm(String(row[cols.mes] ?? "")).slice(0, 10);
    const ano = parseInt(String(row[cols.ano] ?? "").trim(), 10);
    const mes = MESES_PT[mesRaw] ?? MESES_PT[mesRaw.slice(0, 3)] ?? null;
    const valor = parseNumber(row[cols.valor]);
    if (!Number.isFinite(ano) || ano < 1900 || !mes || valor === 0) {
      invalidas++;
      continue;
    }
    anos.add(ano);
    const rubrica = cols.rubrica ? String(row[cols.rubrica] ?? "").trim() || null : null;
    const desc = cols.desc ? String(row[cols.desc] ?? "").trim() || null : null;
    const tipo: "RECEITA" | "DESPESA" = valor < 0 ? "DESPESA" : "RECEITA";
    const key = `${ano}||${cc}||${rubrica ?? ""}||${desc ?? ""}||${tipo}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ano, projeto: cc, conta: rubrica, descricao_conta: desc, tipo,
        meses: new Array(12).fill(0),
      };
      buckets.set(key, bucket);
    }
    bucket.meses[mes - 1] += Math.abs(valor);
  }

  return {
    linhas: Array.from(buckets.values()),
    invalidas,
    total: result.data.length,
    anos: Array.from(anos).sort(),
  };
}
