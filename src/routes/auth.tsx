import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Dashboard de Finanças" },
      { name: "description", content: "Aceda ao dashboard de controlo orçamental." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

async function handleGoogle() {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) {
    toast.error(result.error.message ?? "Erro ao entrar com Google");
  }
}

async function handleMicrosoft(email: string) {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) {
    toast.error("Indica o teu email organizacional.");
    return;
  }
  const { data, error } = await supabase.auth.signInWithSSO({
    domain,
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    toast.error(
      error.message?.includes("not found")
        ? `O domínio ${domain} não está configurado para Microsoft SSO.`
        : error.message ?? "Erro ao iniciar Microsoft SSO",
    );
    return;
  }
  if (data?.url) window.location.href = data.url;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [msOpen, setMsOpen] = useState(false);
  const [msEmail, setMsEmail] = useState("");

  const handleLogin = async (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) throw error;
      toast.success("Sessão iniciada");
      navigate({ to: "/", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto size-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mb-2">
            <Wallet className="size-6" />
          </div>
          <CardTitle>Dashboard de Finanças</CardTitle>
          <CardDescription>Controlo orçamental plurianual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
              Continuar com Google
            </Button>
            {!msOpen ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMsOpen(true)}
              >
                Continuar com Microsoft
              </Button>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleMicrosoft(msEmail);
                }}
              >
                <Input
                  type="email"
                  placeholder="email@organizacao.pt"
                  value={msEmail}
                  onChange={(e) => setMsEmail(e.target.value)}
                  required
                  autoFocus
                />
                <Button type="submit" variant="outline">Entrar</Button>
              </form>
            )}
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin(e.currentTarget);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "A entrar…" : "Entrar"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            O acesso é por convite. Se é a tua primeira vez, abre o link que recebeste por email para definir a palavra-passe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
