import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileSpreadsheet, Upload, LogOut, Wallet, Table as TableIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orcamento", label: "Orçamento", icon: FileSpreadsheet },
  { to: "/movimentos", label: "Movimentos", icon: TableIcon },
  { to: "/importar-extratos", label: "Importar Extratos", icon: Upload },
] as const;

export function AppShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2">
          <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Finanças</div>
            <div className="text-xs text-muted-foreground">Controlo Orçamental</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="size-4" /> Terminar sessão
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
