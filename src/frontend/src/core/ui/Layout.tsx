import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ChefHat, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentRoute: string;
}

export function Layout({ children, onLogout, currentRoute }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        currentRoute={currentRoute}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header */}
        <header
          className="bg-card border-b border-border h-14 flex items-center px-4 gap-3 shrink-0 shadow-sm no-print"
          data-ocid="header.panel"
        >
          <button
            type="button"
            className="sm:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 sm:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ChefHat className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-sm text-foreground">
              Gestion Resto
            </span>
          </div>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-muted-foreground hover:text-foreground gap-2"
            data-ocid="header.logout_button"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 min-h-[calc(100vh-3.5rem-2.5rem)]">
            {children}
          </div>

          {/* Footer */}
          <footer className="border-t border-border py-3 px-6 no-print bg-muted/40">
            <p className="text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()}. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                caffeine.ai
              </a>
            </p>
          </footer>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
