import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useUIStore } from "@/core/store/uiStore";
import Sidebar from "@/core/ui/Sidebar";
import { ChefHat, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const PATH_TITLES: Record<string, string> = {
  "/": "Ingrédients",
  "/ingredients": "Ingrédients",
  "/operations": "Opérations",
  "/business-plan": "Business Plan Initial",
  "/business-plan-reel": "Business Plan Réel",
  "/recettes": "Fiches Techniques",
  "/simulateur": "Simulateur Carte",
  "/salaries": "Salariés & Cotisations",
  "/frais-fixes": "Frais Fixes",
  "/associes": "Associés & Gérants",
  "/emprunts": "Emprunts Bancaires",
  "/amortissements": "Amortissements",
  "/comptabilite": "Comptabilité",
  "/stock": "Gestion des Stocks",
  "/ventes": "Ventes du Jour",
  "/ventes-du-jour": "Ventes du Jour",
  "/rentabilite": "Rentabilité",
  "/marges": "Marges",
  "/parametres": "Paramètres",
};

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentRoute: string;
}

export function Layout({ children, onLogout, currentRoute }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { sidebarOpen: _sidebarOpen } = useUIStore();

  const title = PATH_TITLES[currentRoute] ?? "Gestion Resto";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (handles both desktop collapse and mobile overlay) */}
      <Sidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        currentRoute={currentRoute}
      />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header bar */}
        <header
          className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6 shadow-sm shrink-0"
          data-ocid="header.panel"
        >
          {/* Hamburger (mobile) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Ouvrir la navigation"
            data-ocid="header.menu_button"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {/* Brand (mobile only) */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ChefHat className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-sm text-foreground">
              Gestion Resto
            </span>
          </div>

          {/* Page title (desktop) */}
          <h1
            className="hidden md:block text-base font-semibold text-foreground font-display truncate"
            data-ocid="header.page_title"
          >
            {title}
          </h1>

          <div className="flex-1" />

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-muted-foreground hover:text-foreground gap-2"
            data-ocid="header.logout_button"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Déconnexion</span>
          </Button>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto" data-ocid="main.content">
          <div className="p-4 md:p-6 min-h-[calc(100vh-4rem-2.5rem)]">
            {children}
          </div>

          {/* Footer */}
          <footer className="border-t border-border py-3 px-6 bg-muted/40 no-print">
            <p className="text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()}. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary transition-colors"
              >
                caffeine.ai
              </a>
            </p>
          </footer>
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
