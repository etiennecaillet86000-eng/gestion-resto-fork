import { RECIPE_CATEGORIES } from "@/core/constants";
import type { RecipeCategory } from "@/core/constants";
import { coutMatiereHT, margeBrute, prixHT } from "@/core/utils/calculations";
import {
  useIngredients,
  useRecettes,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type { Recette } from "@/hooks/useQueries";
/**
 * useStatsSimulateur.ts — Calculs statistiques pour le simulateur carte
 * Se base sur les hooks React Query existants (recettes, ingrédients, ventes).
 */
import { useMemo } from "react";

export interface StatRecette {
  recette: Recette;
  coutHT: number;
  prixHTCalc: number;
  margePercent: number;
  foodCostPercent: number;
  nbVentes: number;
  caTotal: number;
  categoriePerf: "excellent" | "bon" | "moyen" | "faible";
}

export interface CategoryStat {
  category: RecipeCategory;
  count: number;
  avgFoodCost: number;
  avgMarge: number;
}

export interface StatsSimulateur {
  stats: StatRecette[];
  totalRecettes: number;
  totalIngredients: number;
  margeMoyenne: number;
  meilleurePlat: StatRecette | null;
  platAOptimiser: StatRecette | null;
  categoriesDistrib: { categorie: string; count: number; margeAvg: number }[];
  categoryStats: CategoryStat[];
  isLoading: boolean;
}

function categoriePerf(marge: number): StatRecette["categoriePerf"] {
  if (marge >= 65) return "excellent";
  if (marge >= 50) return "bon";
  if (marge >= 30) return "moyen";
  return "faible";
}

export function useStatsSimulateur(): StatsSimulateur {
  const { data: recettes = [], isLoading: loadingR } = useRecettes();
  const { data: ingredients = [], isLoading: loadingI } = useIngredients();
  const { data: ventes = [], isLoading: loadingV } = useVentesRecettes();

  const ingredientsMap = useMemo(() => {
    const m = new Map<string, (typeof ingredients)[0]>();
    for (const ing of ingredients) m.set(ing.id, ing);
    return m;
  }, [ingredients]);

  const ventesParRecette = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of ventes) {
      m.set(v.recetteId, (m.get(v.recetteId) ?? 0) + v.quantite);
    }
    return m;
  }, [ventes]);

  /**
   * A recipe is valid (non-phantom) if:
   * 1. It has a price > 0
   * 2. Its composition is non-empty
   * 3. Every ingredientId resolves to a known ingredient
   */
  const validRecettes = useMemo(() => {
    return recettes.filter((r) => {
      if (r.prixVenteTTC <= 0) return false;
      if (!r.ingredients || r.ingredients.length === 0) return false;
      return r.ingredients.every((ri) => ingredientsMap.has(ri.ingredientId));
    });
  }, [recettes, ingredientsMap]);

  const stats: StatRecette[] = useMemo(() => {
    return (
      validRecettes
        .map((r) => {
          const coutHT = coutMatiereHT(r, ingredientsMap);
          const prixHTCalc = prixHT(r.prixVenteTTC, r.tauxTVA);
          const margePercent = margeBrute(prixHTCalc, coutHT);
          const foodCostPercent =
            prixHTCalc > 0 ? (coutHT / prixHTCalc) * 100 : 0;
          const nbVentes = ventesParRecette.get(r.id) ?? 0;
          const caTotal = nbVentes * r.prixVenteTTC;
          return {
            recette: r,
            coutHT,
            prixHTCalc,
            margePercent,
            foodCostPercent,
            nbVentes,
            caTotal,
            categoriePerf: categoriePerf(margePercent),
          };
        })
        // Filter out corrupted/phantom entries with impossible food cost
        .filter((s) => s.foodCostPercent <= 200)
    );
  }, [validRecettes, ingredientsMap, ventesParRecette]);

  const margeMoyenne = useMemo(() => {
    if (stats.length === 0) return 0;
    return stats.reduce((s, r) => s + r.margePercent, 0) / stats.length;
  }, [stats]);

  const meilleurePlat = useMemo(
    () =>
      stats.length === 0
        ? null
        : stats.reduce((best, cur) =>
            cur.margePercent > best.margePercent ? cur : best,
          ),
    [stats],
  );

  const platAOptimiser = useMemo(
    () =>
      stats.length === 0
        ? null
        : stats.reduce((worst, cur) =>
            cur.margePercent < worst.margePercent ? cur : worst,
          ),
    [stats],
  );

  const categoriesDistrib = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const s of stats) {
      const cat = s.recette.categorie;
      const prev = map.get(cat) ?? { sum: 0, count: 0 };
      map.set(cat, { sum: prev.sum + s.margePercent, count: prev.count + 1 });
    }
    return [...map.entries()].map(([categorie, v]) => ({
      categorie,
      count: v.count,
      margeAvg: v.count > 0 ? v.sum / v.count : 0,
    }));
  }, [stats]);

  /** Structured stats for each canonical RECIPE_CATEGORY — consumed by Business Plan Réel */
  const categoryStats: CategoryStat[] = useMemo(() => {
    return RECIPE_CATEGORIES.map((category) => {
      const subset = stats.filter((s) => s.recette.categorie === category);
      const count = subset.length;
      const avgFoodCost =
        count > 0
          ? subset.reduce((acc, s) => acc + s.foodCostPercent, 0) / count
          : 0;
      const avgMarge =
        count > 0
          ? subset.reduce((acc, s) => acc + s.margePercent, 0) / count
          : 0;
      return { category, count, avgFoodCost, avgMarge };
    });
  }, [stats]);

  return {
    stats,
    totalRecettes: validRecettes.length,
    totalIngredients: ingredients.length,
    margeMoyenne,
    meilleurePlat,
    platAOptimiser,
    categoriesDistrib,
    categoryStats,
    isLoading: loadingR || loadingI || loadingV,
  };
}

/**
 * Convenience hook — returns only the per-category aggregates.
 * Consumed by TabBusinessPlanReel for weighted gross-margin calculation.
 */
export function useCategoryStats(): {
  categoryStats: CategoryStat[];
  isLoading: boolean;
} {
  const { categoryStats, isLoading } = useStatsSimulateur();
  return { categoryStats, isLoading };
}
