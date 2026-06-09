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
  // ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY ou DD-MM-YYYY
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;
    return `${y}-${mo}-${d}`;
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
    const debito = cols.debito ? parseNumber(row[cols.debito]) : 0;
    const credito = cols.credito ? parseNumber(row[cols.credito]) : 0;
    const conta = cols.conta ? String(row[cols.conta] ?? "").trim() : "";
    if (!conta && debito === 0 && credito === 0) {
      invalidas++;
      continue;
    }
    linhas.push({
      conta: conta || null,
      descricao_conta: cols.descricao_conta ? String(row[cols.descricao_conta] ?? "").trim() || null : null,
      data: cols.data ? parseData(row[cols.data]) : null,
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
