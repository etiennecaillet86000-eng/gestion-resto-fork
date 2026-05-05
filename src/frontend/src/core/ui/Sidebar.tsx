import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Landmark,
  Package,
  Receipt,
  Settings2,
  ShoppingBasket,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Restaurant",
    icon: ChefHat,
    items: [
      { label: "Ingrédients", to: "/", icon: ShoppingBasket },
      { label: "Recettes", to: "/recettes", icon: BookOpen },
      { label: "Stock", to: "/stock", icon: Package },
      { label: "Ventes du Jour", to: "/ventes", icon: ShoppingCart },
    ],
  },
  {
    label: "RH",
    icon: Users,
    items: [
      { label: "Salariés & Cotisations", to: "/salaries", icon: Users },
      { label: "Associés & Gérants", to: "/associes", icon: Users },
    ],
  },
  {
    label: "Finance",
    icon: DollarSign,
    items: [
      { label: "Frais Fixes", to: "/frais-fixes", icon: Receipt },
      { label: "Emprunts", to: "/emprunts", icon: Landmark },
      { label: "Amortissements", to: "/amortissements", icon: BarChart3 },
      { label: "Rentabilité", to: "/rentabilite", icon: TrendingUp },
      { label: "Marges", to: "/marges", icon: BarChart3 },
    ],
  },
  {
    label: "Paramètres",
    icon: Settings2,
    items: [
      {
        label: "Paramètres Juridiques",
        to: "/parametres",
        icon: Settings2,
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentRoute: string;
}

export function Sidebar({ collapsed, onToggle, currentRoute }: SidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_SECTIONS.map((s) => [s.label, true])),
  );

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(to: string) {
    if (to === "/") return currentRoute === "/";
    return currentRoute.startsWith(to);
  }

  function navigate(to: string) {
    window.location.hash = to;
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0",
        collapsed ? "w-14" : "w-60",
      )}
      data-ocid="sidebar.panel"
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <ChefHat className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-sidebar-foreground truncate">
            Gestion Resto
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-ocid="sidebar.toggle"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV_SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = openSections[section.label] !== false;
          return (
            <div key={section.label}>
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-semibold",
                  "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                  "transition-colors",
                )}
                data-ocid={`sidebar.${section.label.toLowerCase()}.toggle`}
              >
                <SectionIcon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isOpen ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </>
                )}
              </button>

              {/* Sub-items */}
              {(isOpen || collapsed) && (
                <div
                  className={cn(
                    "space-y-0.5",
                    !collapsed && "ml-1 pl-4 border-l border-sidebar-border/50",
                  )}
                >
                  {section.items.map((item) => {
                    const active = isActive(item.to);
                    const ItemIcon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.to}
                        onClick={() => navigate(item.to)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                          active
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                        )}
                        data-ocid={`sidebar.nav.${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}.link`}
                      >
                        {ItemIcon && <ItemIcon className="h-4 w-4 shrink-0" />}
                        {!collapsed && (
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
    </aside>
  );
}
