// Re-export all shared types from useQueries (which re-exports from backend.d)
export type {
  Ingredient,
  Recette,
  RecetteIngredient,
  LigneFraisFixes,
  LigneAmortissement,
  ParametresRentabilite,
  MouvementStock,
  VenteRecette,
  Emprunt,
  AssocieGerant,
  Salarie,
  ParametresJuridiques,
} from "@/hooks/useQueries";

// ── Additional UI-only types ──────────────────────────────────────────────────

export interface NavItem {
  label: string;
  to: string;
  icon?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface KpiCard {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
}
