import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { parseCSV, type ParseResult } from "@/lib/csv-parser";
import { importarExtrato, historicoImportacoes, apagarMesExtrato } from "@/lib/extratos.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import {
  CurrencyCell,
  DataGrid,
  numFilterFn,
  sortHeader,
  textFilterFn,
} from "@/components/data-grid";

interface FileParsed {
  nome: string;
  result: ParseResult;
}

const PREVIEW_COLUMNS: ColumnDef<any, any>[] = [
  {
    accessorKey: "data",
    header: sortHeader("Data"),
    filterFn: textFilterFn,
    meta: { filterType: "text" },
    size: 110,
    cell: ({ getValue }) => (getValue() as string) ?? "—",
  },
  {
    accessorKey: "conta",
    header: sortHeader("Conta"),
    filterFn: textFilterFn,
    meta: { filterType: "text" },
    size: 100,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{(getValue() as string) ?? "—"}</span>
    ),
  },
  {
    accessorKey: "descricao_conta",
    header: sortHeader("Descrição"),
    filterFn: textFilterFn,
    meta: { filterType: "text" },
    size: 260,
    cell: ({ getValue }) => (getValue() as string) ?? "—",
  },
  {
    accessorKey: "num_documento",
    header: sortHeader("Nº Doc."),
    filterFn: textFilterFn,
    meta: { filterType: "text" },
    size: 110,
    cell: ({ getValue }) => (getValue() as string) ?? "—",
  },
  {
    accessorKey: "centro_custo",
    header: sortHeader("C. Custo"),
    filterFn: textFilterFn,
    meta: { filterType: "text" },
    size: 110,
    cell: ({ getValue }) => (getValue() as string) ?? "—",
  },
  {
    accessorKey: "debito",
    header: sortHeader("Débito"),
    filterFn: numFilterFn,
    meta: { filterType: "number" },
    size: 120,
    cell: ({ getValue }) => (
      <CurrencyCell value={Number(getValue() ?? 0)} tone="despesa" showZeroAsDash />
    ),
  },
  {
    accessorKey: "credito",
    header: sortHeader("Crédito"),
    filterFn: numFilterFn,
    meta: { filterType: "number" },
    size: 120,
    cell: ({ getValue }) => (
      <CurrencyCell value={Number(getValue() ?? 0)} tone="receita" showZeroAsDash />
    ),
  },
];

export function ImportarExtratosTab() {
  const qc = useQueryClient();
  const importarFn = useServerFn(importarExtrato);
  const historicoFn = useServerFn(historicoImportacoes);
  const apagarFn = useServerFn(apagarMesExtrato);

  const [files, setFiles] = useState<FileParsed[]>([]);
  const [importing, setImporting] = useState(false);

  const { data: historico = [] } = useQuery({
    queryKey: ["import-historico"],
    queryFn: () => historicoFn(),
  });

  const onDrop = useCallback(async (accepted: File[]) => {
    const novos: FileParsed[] = [];
    for (const f of accepted) {
      const text = await f.text();
      try {
        const result = parseCSV(text);
        novos.push({ nome: f.name, result });
      } catch (e: any) {
        toast.error(`${f.name}: ${e.message ?? "Falha a ler"}`);
      }
    }
    setFiles((prev) => [...prev, ...novos]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
  });

  const todasLinhas = files.flatMap((f) => f.result.linhas);
  const totalLinhas = todasLinhas.length;
  const linhasSemData = todasLinhas.filter((l) => !l.data).length;
  const mesesDetetados = Array.from(
    new Set(todasLinhas.map((l) => l.data?.slice(0, 7)).filter(Boolean) as string[]),
  ).sort();

  const handleImportar = async () => {
    if (totalLinhas === 0) {
      toast.error("Sem linhas para importar");
      return;
    }
    setImporting(true);
    try {
      const r = await importarFn({ data: { linhas: todasLinhas } });
      toast.success(
        `${r.inseridos} linhas importadas` +
          (r.ignoradas_sem_data ? ` · ${r.ignoradas_sem_data} ignoradas sem data` : ""),
      );
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["import-historico"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
      qc.invalidateQueries({ queryKey: ["anos"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro a importar");
    } finally {
      setImporting(false);
    }
  };

  const handleApagarMes = async (mesRefAlvo: string) => {
    if (!confirm(`Apagar todas as transações de ${mesRefAlvo}?`)) return;
    try {
      await apagarFn({ data: { mes_referencia: mesRefAlvo } });
      toast.success("Apagado");
      qc.invalidateQueries({ queryKey: ["import-historico"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  // preview = primeiras 10 do primeiro ficheiro
  const preview = files[0]?.result.linhas.slice(0, 10) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mês de referência</CardTitle>
          <CardDescription>
            O mês é determinado automaticamente a partir da data de cada linha do CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {mesesDetetados.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Carregue ficheiros para ver os meses detetados.
            </span>
          ) : (
            mesesDetetados.map((m) => (
              <Badge key={m} variant="secondary">{m}</Badge>
            ))
          )}
          {linhasSemData > 0 && (
            <Badge variant="destructive">{linhasSemData} sem data (serão ignoradas)</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">{isDragActive ? "Largue aqui os ficheiros…" : "Arraste CSV para aqui ou clique para selecionar"}</p>
            <p className="text-sm text-muted-foreground mt-1">Aceita múltiplos ficheiros. Separador e datas são detetados automaticamente.</p>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ficheiros a importar ({files.length})</CardTitle>
              <CardDescription>{totalLinhas} linhas no total</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFiles([])}>Limpar</Button>
              <Button onClick={handleImportar} disabled={importing || totalLinhas === 0}>
                <Upload className="size-4" /> {importing ? "A importar…" : `Importar ${totalLinhas} linhas`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{f.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.result.linhas.length} válidas · {f.result.invalidas} ignoradas · separador {f.result.separador}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}

            {preview.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">
                  Pré-visualização (10 primeiras linhas)
                </div>
                <DataGrid
                  data={preview as any[]}
                  columns={PREVIEW_COLUMNS}
                  getRowId={(_r: any, i?: number) => String(i ?? 0)}
                  showSearch={false}
                  showColumns={false}
                  maxHeight="40vh"
                  emptyMessage="Sem linhas."
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Importações recentes</CardTitle>
          <CardDescription>
            Últimos meses de referência com transações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataGrid
            data={historico as any[]}
            columns={[
              {
                accessorKey: "mes_referencia",
                header: sortHeader("Mês"),
                filterFn: textFilterFn,
                meta: { filterType: "text" },
                size: 140,
                cell: ({ getValue }) => (
                  <span className="font-medium">{getValue() as string}</span>
                ),
              },
              {
                accessorKey: "importado_em",
                header: sortHeader("Importado em"),
                filterFn: textFilterFn,
                meta: { filterType: "text" },
                size: 220,
                cell: ({ getValue }) =>
                  new Date(getValue() as string).toLocaleString("pt-PT"),
              },
              {
                id: "acoes",
                header: () => <span>Ações</span>,
                enableColumnFilter: false,
                enableSorting: false,
                enableGrouping: false,
                size: 140,
                cell: ({ row }) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApagarMes(row.original.mes_referencia)}
                  >
                    <Trash2 className="size-4" /> Apagar
                  </Button>
                ),
              },
            ]}
            getRowId={(r: any) => r.mes_referencia}
            showSearch={false}
            showColumns={false}
            maxHeight="50vh"
            emptyMessage="Sem importações."
          />
        </CardContent>
      </Card>
    </div>
  );
}
