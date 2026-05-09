/**
 * constants.ts — Single source of truth for domain constants.
 * Import from here everywhere; never redeclare locally.
 */

// ── Recipe categories ─────────────────────────────────────────────────────────

export const RECIPE_CATEGORIES = [
  "Entrée",
  "Plats",
  "Snacking",
  "Boisson",
  "Dessert",
  "Accompagnement",
  "Formules",
] as const;

/** Union type of all valid recipe category strings */
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

// ── Ingredient families ───────────────────────────────────────────────────────

export const INGREDIENT_FAMILIES = [
  "Viandes & Volailles",
  "Marée",
  "B.O.F",
  "Fruits & Légumes",
  "Épicerie Sèche",
  "Épicerie Sucrée",
  "Boissons",
  "Produits Laitiers",
  "Surgelés",
  "Autres",
] as const;

/** Union type of all valid ingredient family strings */
export type IngredientFamily = (typeof INGREDIENT_FAMILIES)[number];

// ── Measurement units ────────────────────────────────────────────────────────

export const MEASUREMENT_UNITS = ["Kg", "L", "U"] as const;

/** Union type of all valid measurement unit strings */
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];
