/**
 * ingredientFamilyStore.ts — Local persistence for ingredient families.
 * The backend Ingredient type has no `famille` field, so we store the
 * mapping client-side via Zustand + localStorage.
 */
import { INGREDIENT_FAMILIES } from "@/core/constants";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IngredientFamilyState {
  /** Map from ingredient ID → famille label */
  families: Record<string, string>;
  setFamily: (ingredientId: string, famille: string) => void;
  getFamily: (ingredientId: string) => string;
  removeFamily: (ingredientId: string) => void;
}

export const useIngredientFamilyStore = create<IngredientFamilyState>()(
  persist(
    (set, get) => ({
      families: {},

      setFamily: (ingredientId, famille) =>
        set((state) => ({
          families: { ...state.families, [ingredientId]: famille },
        })),

      getFamily: (ingredientId) =>
        get().families[ingredientId] ?? INGREDIENT_FAMILIES[0],

      removeFamily: (ingredientId) =>
        set((state) => {
          const next = { ...state.families };
          delete next[ingredientId];
          return { families: next };
        }),
    }),
    { name: "ingredient-family-store" },
  ),
);
