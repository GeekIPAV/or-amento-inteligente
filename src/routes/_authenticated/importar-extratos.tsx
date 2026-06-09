import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { parseCSV, type ParseResult } from "@/lib/csv-parser";
import { importarExtrato, historicoImportacoes, apagarMesExtrato } from "@/lib/extratos.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, Trash2 } from "lucide-react";
import { currency, MESES_LONGOS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/importar-extratos")({
  head: () => ({ meta: [{ title: "Importar Extratos — Finanças" }] }),
  component: ImportarExtratosPage,
});

interface FileParsed {
  nome: string;
  result: ParseResult;
}

function ImportarExtratosPage() {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar Extratos</h1>
        <p className="text-sm text-muted-foreground">Carregue ficheiros CSV de extratos contabilísticos.</p>
      </div>

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
              <div className="overflow-x-auto">
                <div className="text-sm font-medium mb-2">Pré-visualização (10 primeiras linhas)</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Nº Doc.</TableHead>
                      <TableHead>C. Custo</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.data ?? "—"}</TableCell>
                        <TableCell>{l.conta ?? "—"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{l.descricao_conta ?? "—"}</TableCell>
                        <TableCell>{l.num_documento ?? "—"}</TableCell>
                        <TableCell>{l.centro_custo ?? "—"}</TableCell>
                        <TableCell className="text-right">{currency.format(l.debito)}</TableCell>
                        <TableCell className="text-right">{currency.format(l.credito)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Importações recentes</CardTitle>
          <CardDescription>Últimos meses de referência com transações.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Importado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem importações.</TableCell></TableRow>
              ) : historico.map((h, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{h.mes_referencia}</TableCell>
                  <TableCell>{new Date(h.importado_em).toLocaleString("pt-PT")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleApagarMes(h.mes_referencia)}>
                      <Trash2 className="size-4" /> Apagar mês
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
