import type { Ingredient, Recette, RecetteIngredient } from "../types";

// ── Cost calculations ─────────────────────────────────────────────────────────

/**
 * Calculates the total material cost HT for a recipe
 */
export function coutMatiereHT(
  recette: { ingredients: RecetteIngredient[]; consommablesHT: number },
  ingredientsMap: Map<string, Pick<Ingredient, "prixUnitaireHT">>,
): number {
  const total = recette.ingredients.reduce((sum, ri) => {
    const ing = ingredientsMap.get(ri.ingredientId);
    return sum + (ing ? ri.quantite * ing.prixUnitaireHT : 0);
  }, 0);
  return total + recette.consommablesHT;
}

/**
 * Converts TTC price to HT price
 */
export function prixHT(prixTTC: number, tauxTVA: number): number {
  return prixTTC / (1 + tauxTVA / 100);
}

/**
 * Calculates gross margin percentage
 */
export function margeBrute(pHT: number, coutHT: number): number {
  if (pHT === 0) return 0;
  return ((pHT - coutHT) / pHT) * 100;
}

/**
 * Calculates food cost percentage
 */
export function tauxFoodCost(coutHT: number, prixHT: number): number {
  if (prixHT === 0) return 0;
  return (coutHT / prixHT) * 100;
}

// ── Revenue projections ───────────────────────────────────────────────────────

/**
 * Weekly revenue forecast: ticket × clients/day × opening days/week
 */
export function caHebdo(
  ticketMoyenHT: number,
  clientsParJour: number,
  joursOuverture: number,
): number {
  return ticketMoyenHT * clientsParJour * joursOuverture;
}

/**
 * Monthly revenue forecast
 */
export function caMensuel(caHebdoVal: number): number {
  return caHebdoVal * 4.33;
}

/**
 * Seasonal revenue forecast
 */
export function caSaison(caHebdoVal: number, nbSemaines: number): number {
  return caHebdoVal * nbSemaines;
}

// ── Business plan ─────────────────────────────────────────────────────────────

/**
 * Break-even point in revenue: fixed costs / margin rate
 */
export function seuilRentabilite(
  chargesFixesTotales: number,
  tauxMargeBrute: number,
): number {
  if (tauxMargeBrute <= 0) return 0;
  return chargesFixesTotales / (tauxMargeBrute / 100);
}

/**
 * Compound growth projection over 5 years
 */
export function compoundGrowth(base: number, rate: number): number[] {
  return [
    base,
    base * (1 + rate),
    base * (1 + rate) ** 2,
    base * (1 + rate) ** 3,
    base * (1 + rate) ** 4,
  ];
}

/**
 * Average margin rate weighted by category mix
 */
export function margeMoyenneGlobale(
  recettes: Recette[],
  ingredientsMap: Map<string, Ingredient>,
): number {
  if (recettes.length === 0) return 0;
  const ingPrixMap = new Map(
    [...ingredientsMap.entries()].map(([id, ing]) => [id, ing]),
  );
  const total = recettes.reduce(
    (acc, r) => {
      const cout = coutMatiereHT(r, ingPrixMap);
      const ph = prixHT(r.prixVenteTTC, r.tauxTVA);
      const marge = margeBrute(ph, cout);
      return { sumMarge: acc.sumMarge + marge, count: acc.count + 1 };
    },
    { sumMarge: 0, count: 0 },
  );
  return total.count > 0 ? total.sumMarge / total.count : 0;
}
