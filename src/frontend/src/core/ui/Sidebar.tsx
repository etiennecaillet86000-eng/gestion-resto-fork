import { useUIStore } from "@/core/store/uiStore";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Boxes,
  Calculator,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Handshake,
  History,
  Landmark,
  LayoutDashboard,
  LineChart,
  LogOut,
  PackageOpen,
  Settings,
  Users,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "⚡ EXPLOITATION",
    items: [
      {
        path: "/operations",
        label: "Opérations",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "🍳 CUISINE & LOGISTIQUE",
    items: [
      {
        path: "/ingredients",
        label: "Ingrédients",
        icon: <PackageOpen className="h-4 w-4" />,
      },
      {
        path: "/recettes",
        label: "Recettes",
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        path: "/simulateur",
        label: "Simulateur carte",
        icon: <FlaskConical className="h-4 w-4" />,
      },
      {
        path: "/stock",
        label: "Stocks",
        icon: <Boxes className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "👥 RESSOURCES & STRUCTURE",
    items: [
      {
        path: "/salaries",
        label: "Salariés",
        icon: <Users className="h-4 w-4" />,
      },
      {
        path: "/associes",
        label: "Associés & Gérants",
        icon: <Handshake className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "💰 FINANCE",
    items: [
      {
        path: "/projections",
        label: "Projections Financières",
        icon: <LineChart className="h-4 w-4" />,
      },
      {
        path: "/comptabilite",
        label: "Comptabilité",
        icon: <Calculator className="h-4 w-4" />,
      },
      {
        path: "/frais-fixes",
        label: "Frais Fixes",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        path: "/emprunts",
        label: "Emprunts",
        icon: <Landmark className="h-4 w-4" />,
      },
      {
        path: "/amortissements",
        label: "Amortissements",
        icon: <History className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "⚙️ PARAMÈTRES",
    items: [
      {
        path: "/parametres",
        label: "Paramètres",
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  currentRoute,
}: SidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_SECTIONS.map((s) => [s.title, true])),
  );
  const { sidebarOpen, toggleSidebar } = useUIStore();

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  function isActive(path: string) {
    if (path === "/ingredients") {
      return currentRoute === "/" || currentRoute === "/ingredients";
    }
    return currentRoute === path || currentRoute.startsWith(`${path}/`);
  }

  function navigate(path: string) {
    window.location.hash = path;
    onClose();
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onClose}
          onKeyUp={(e) => e.key === "Escape" && onClose()}
          aria-hidden="true"
          role="presentation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 z-30 transition-all duration-300",
          /* Desktop: always visible, collapsible */
          "hidden md:flex",
          sidebarOpen ? "w-60" : "w-14",
          /* Mobile: fixed overlay */
          isOpen && "!flex fixed inset-y-0 left-0 w-72 shadow-2xl",
        )}
        data-ocid="sidebar.panel"
      >
        {/* Brand header */}
        <div className="flex items-center gap-3 px-3 h-14 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ChefHat className="h-4 w-4 text-primary-foreground" />
          </div>
          {(sidebarOpen || isOpen) && (
            <span className="font-display font-bold text-sidebar-foreground truncate flex-1">
              Gestion Resto
            </span>
          )}
          {/* Desktop toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-auto text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors hidden md:block"
            aria-label={
              sidebarOpen ? "Réduire la sidebar" : "Agrandir la sidebar"
            }
            data-ocid="sidebar.toggle"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {/* Mobile close button */}
          {isOpen && (
            <button
              type="button"
              onClick={onClose}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors md:hidden"
              aria-label="Fermer"
              data-ocid="sidebar.close_button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {NAV_SECTIONS.map((section) => {
            const expanded = openSections[section.title] !== false;
            const showLabels = sidebarOpen || isOpen;
            return (
              <div key={section.title} className="mb-1">
                {/* Section header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    "w-full flex items-center px-2 py-1 rounded-md text-xs font-semibold tracking-wide",
                    "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors",
                    !showLabels && "justify-center",
                  )}
                  data-ocid={`sidebar.section.${section.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.toggle`}
                >
                  {showLabels ? (
                    <>
                      <span className="flex-1 text-left truncate">
                        {section.title}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform shrink-0",
                          expanded ? "rotate-0" : "-rotate-90",
                        )}
                      />
                    </>
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-sidebar-foreground/30" />
                  )}
                </button>

                {/* Sub-items */}
                {(expanded || !showLabels) && (
                  <div
                    className={cn(
                      "space-y-0.5 mt-0.5",
                      showLabels &&
                        "ml-1 pl-2 border-l border-sidebar-border/40",
                    )}
                  >
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      return (
                        <button
                          type="button"
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                            !showLabels && "justify-center px-0",
                            active
                              ? "bg-primary/20 text-primary font-medium"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                          )}
                          title={!showLabels ? item.label : undefined}
                          data-ocid={`sidebar.nav.${item.label
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/\p{M}/gu, "")
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "")}.link`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          {showLabels && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom: logout in sidebar for desktop */}
        <div className="border-t border-sidebar-border p-2 shrink-0">
          <div
            className={cn(
              "text-xs text-sidebar-foreground/30 px-2 py-1",
              !sidebarOpen && !isOpen && "hidden",
            )}
          >
            <LogOut className="h-3 w-3 inline mr-1" />
            <span>Gestion Resto v1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
