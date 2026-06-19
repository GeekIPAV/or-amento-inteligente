import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listUsuarios,
  criarUsuario,
  removerUsuario,
  atualizarRole,
  type AdminUser,
} from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, UserPlus, ShieldCheck, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Utilizadores" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsuarios);
  const criarFn = useServerFn(criarUsuario);
  const removerFn = useServerFn(removerUsuario);
  const roleFn = useServerFn(atualizarRole);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ email: "", password: "", role: "user" as "user" | "admin" });

  const criar = useMutation({
    mutationFn: () => criarFn({ data: form }),
    onSuccess: () => {
      toast.success("Utilizador criado.");
      setOpen(false);
      setForm({ email: "", password: "", role: "user" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar utilizador."),
  });

  const remover = useMutation({
    mutationFn: (id: string) => removerFn({ data: { userId: id } }),
    onSuccess: () => {
      toast.success("Utilizador removido.");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover utilizador."),
  });

  const mudarRole = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "user" }) => roleFn({ data: vars }),
    onSuccess: () => {
      toast.success("Permissão atualizada.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar permissão."),
  });

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso negado</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Administração de Utilizadores</h1>
          <p className="text-sm text-muted-foreground">Gere quem tem acesso à aplicação.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 size-4" />Novo utilizador</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar utilizador</DialogTitle>
              <DialogDescription>O utilizador receberá acesso imediato com a palavra-passe que definires.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="nome@empresa.pt"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Palavra-passe</Label>
                <Input
                  id="password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Permissão</Label>
                <Select value={form.role} onValueChange={(v: "user" | "admin") => setForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilizador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={criar.isPending}>Cancelar</Button>
              <Button
                onClick={() => criar.mutate()}
                disabled={criar.isPending || !form.email || form.password.length < 8}
              >
                {criar.isPending ? "A criar…" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilizadores</CardTitle>
          <CardDescription>{users?.length ?? 0} no total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-40">Permissão</TableHead>
                  <TableHead className="w-40">Criado</TableHead>
                  <TableHead className="w-40">Último acesso</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
                ) : !users?.length ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sem utilizadores.</TableCell></TableRow>
                ) : (
                  users.map((u) => {
                    const role = (u.roles.includes("admin") ? "admin" : "user") as "admin" | "user";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.email ?? "—"}
                          {!u.email_confirmed_at && (
                            <span className="ml-2 rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-400">por confirmar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={role}
                            onValueChange={(v: "admin" | "user") => mudarRole.mutate({ userId: u.id, role: v })}
                            disabled={mudarRole.isPending}
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user"><span className="flex items-center gap-2"><Shield className="size-3.5" />Utilizador</span></SelectItem>
                              <SelectItem value="admin"><span className="flex items-center gap-2"><ShieldCheck className="size-3.5" />Administrador</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString("pt-PT")}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-PT") : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(u)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover utilizador?</AlertDialogTitle>
            <AlertDialogDescription>
              Vais remover permanentemente <strong>{toDelete?.email}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remover.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remover.isPending}
              onClick={() => toDelete && remover.mutate(toDelete.id)}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {remover.isPending ? "A remover…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
