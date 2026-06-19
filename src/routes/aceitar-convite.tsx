import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/aceitar-convite")({
  ssr: false,
  head: () => ({ meta: [{ title: "Definir palavra-passe" }] }),
  component: AceitarConvitePage,
});

function AceitarConvitePage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finish = (session: { user: { email?: string | null } } | null) => {
      if (cancelled) return;
      if (!session) {
        toast.error("Convite inválido ou expirado. Pede um novo convite.");
        navigate({ to: "/auth" });
        return;
      }
      setEmail(session.user.email ?? null);
      setReady(true);
    };

    (async () => {
      // 1) Fluxo PKCE: ?code=... no query string
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errDesc = url.searchParams.get("error_description") ?? url.hash.match(/error_description=([^&]+)/)?.[1];
      if (errDesc) {
        toast.error(decodeURIComponent(errDesc));
        navigate({ to: "/auth" });
        return;
      }
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth" });
          return;
        }
        // limpar URL
        window.history.replaceState({}, "", window.location.pathname);
        finish(data.session);
        return;
      }

      // 2) Fluxo implicit: #access_token=... no hash — supabase processa, esperar via listener
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        finish(data.session);
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          sub.subscription.unsubscribe();
          finish(session);
        }
      });

      // timeout de segurança
      setTimeout(async () => {
        if (cancelled) return;
        const { data: again } = await supabase.auth.getSession();
        if (!again.session) {
          sub.subscription.unsubscribe();
          finish(null);
        }
      }, 3000);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const submit = async () => {
    if (password.length < 8) {
      toast.error("A palavra-passe tem de ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Palavra-passe definida. Bem-vindo!");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Definir palavra-passe</CardTitle>
          <CardDescription>
            {ready && email ? `Conta: ${email}` : "A validar convite…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw">Palavra-passe</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready || loading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirmar</Label>
            <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready || loading} />
          </div>
          <Button className="w-full" onClick={submit} disabled={!ready || loading}>
            {loading ? "A guardar…" : "Definir palavra-passe"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
