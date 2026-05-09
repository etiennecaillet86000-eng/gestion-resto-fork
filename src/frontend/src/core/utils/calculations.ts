import type { Ingredient, Recette, RecetteIngredient } from "../types";

// ── Unit conversion ───────────────────────────────────────────────────────────

/**
 * Returns a factor to convert a recipe ingredient unit to the base ingredient unit.
 *
 * Ingredient.prixUnitaireHT is always expressed per the ingredient's own unite:
 *   - If ingredient.unite = 'Kg', price is per kg → recipe qty in 'g' must be ÷ 1000
 *   - If ingredient.unite = 'L',  price is per l  → recipe qty in 'ml' must be ÷ 1000
 *                                                  → recipe qty in 'cl' must be ÷ 100
 *
 * Matching is case-insensitive.
 */
export function convertUnitFactor(
  recipeUnite: string,
  baseUnite: string,
): number {
  const r = recipeUnite.toLowerCase().trim();
  const b = baseUnite.toLowerCase().trim();

  // Same unit — no conversion needed
  if (r === b) return 1;

  // Weight conversions
  if ((b === "kg" || b === "kilo" || b === "kilos") && r === "g")
    return 1 / 1000;

  // Volume conversions (base is litres)
  if (b === "l" || b === "litre" || b === "litres") {
    if (r === "ml" || r === "millilitre" || r === "millilitres")
      return 1 / 1000;
    if (r === "cl" || r === "centilitre" || r === "centilitres") return 1 / 100;
  }

  // All other unit pairs: treat as compatible (factor = 1)
  return 1;
}

// ── Cost calculations ─────────────────────────────────────────────────────────

/**
 * Calculates the total material cost HT for a recipe.
 * Automatically converts recipe ingredient units to the base ingredient unit
 * before applying the price (e.g. g→Kg, ml→L, cl→L).
 */
export function coutMatiereHT(
  recette: { ingredients: RecetteIngredient[]; consommablesHT: number },
  ingredientsMap: Map<string, Pick<Ingredient, "prixUnitaireHT" | "unite">>,
): number {
  const total = recette.ingredients.reduce((sum, ri) => {
    const ing = ingredientsMap.get(ri.ingredientId);
    if (!ing) return sum;
    const factor = convertUnitFactor(ri.unite, ing.unite);
    return sum + ri.quantite * factor * ing.prixUnitaireHT;
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
