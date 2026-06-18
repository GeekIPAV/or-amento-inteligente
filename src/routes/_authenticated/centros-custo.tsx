import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listarCentrosCusto, guardarNomeProjeto } from "@/lib/centros-custo.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/centros-custo")({
  component: CentrosCustoPage,
});

function CentrosCustoPage() {
  const listFn = useServerFn(listarCentrosCusto);
  const saveFn = useServerFn(guardarNomeProjeto);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["centros-custo"],
    queryFn: () => listFn(),
  });

  const [nomes, setNomes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setNomes(Object.fromEntries(data.map((r) => [r.centro_custo, r.nome_projeto])));
  }, [data]);

  const mut = useMutation({
    mutationFn: (v: { centro_custo: string; nome_projeto: string }) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Nome do projeto guardado");
      qc.invalidateQueries({ queryKey: ["centros-custo"] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Centros de Custo</h1>
        <p className="text-sm text-muted-foreground">
          Atribui um nome de projeto a cada centro de custo. É esse nome que aparece no dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapeamento de Projetos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Nome do Projeto</TableHead>
                <TableHead className="text-right">Movimentos</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              ) : (data?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem centros de custo importados.</TableCell></TableRow>
              ) : data!.map((r) => {
                const original = r.nome_projeto;
                const valor = nomes[r.centro_custo] ?? "";
                const dirty = valor.trim() !== "" && valor !== original;
                return (
                  <TableRow key={r.centro_custo}>
                    <TableCell className="font-mono text-sm">{r.centro_custo}</TableCell>
                    <TableCell>
                      <Input
                        value={valor}
                        onChange={(e) =>
                          setNomes((p) => ({ ...p, [r.centro_custo]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && dirty) {
                            mut.mutate({ centro_custo: r.centro_custo, nome_projeto: valor.trim() });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.linhas}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "ghost"}
                        disabled={!dirty || mut.isPending}
                        onClick={() => mut.mutate({ centro_custo: r.centro_custo, nome_projeto: valor.trim() })}
                      >
                        <Save className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
