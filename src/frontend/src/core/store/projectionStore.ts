import { RECIPE_CATEGORIES } from "@/core/constants";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  HorizonType,
  ProjectionParams,
  ScenarioType,
} from "../types/projection";
import type { MixCategorie } from "../utils/projectionMath";

const DEFAULT_PARAMS: ProjectionParams = {
  horizon: 12,
  scenario: "realiste",
  couvertsDejeunner: 30,
  couvertsDiner: 40,
  tauxRemplissage: 70,
  ticketMoyen: 28,
  seasonalite: [1.0, 0.9, 1.0, 1.1, 1.0, 0.85, 1.2, 1.3, 1.0, 0.95, 0.9, 1.15],
  inflationCharges: 2.5,
  foodCostRatio: 30,
};

// RECIPE_CATEGORIES is imported from @/core/constants — 7 categories
// Distribute 100% evenly: first 2 get 15%, last 5 get 14% → total = 100%
const MIX_PCT_DEFAULTS = [
  15, // Entrée
  15, // Plats
  14, // Snacking
  14, // Boisson
  14, // Dessert
  14, // Accompagnement
  14, // Formules
];

const DEFAULT_MIX_CATEGORIES: MixCategorie[] = RECIPE_CATEGORIES.map(
  (label, i) => ({
    label,
    pctCA: MIX_PCT_DEFAULTS[i] ?? Math.round(100 / RECIPE_CATEGORIES.length),
    margeBruteAvg: 70,
  }),
);

export interface BusinessPlanParams {
  /** Taux d'imposition sur les bénéfices (%) */
  tauxImposition: number;
  /** Coefficient de croissance annuelle pour la projection 5 ans (ex: 1.03 = +3%/an) */
  growthCoefficient5ans: number;
}

const DEFAULT_BP_PARAMS: BusinessPlanParams = {
  tauxImposition: 25,
  growthCoefficient5ans: 1.0,
};

interface ProjectionState {
  scenario: ScenarioType;
  horizon: HorizonType;
  comparisonMode: boolean;
  params: ProjectionParams;

  // ── Mix produit categories (Paramétrage tab) ──────────────────────────────
  mixCategories: MixCategorie[];

  // ── Business plan params (Paramétrage tab) ────────────────────────────────
  businessPlanParams: BusinessPlanParams;

  // ── Mix produit projection results (shared with Operations) ─────────────
  /** Seuil de rentabilité mensuel calculé depuis le mix produits (€) */
  mixProduitSeuilMensuel: number;
  /** Marge brute globale pondérée par le mix (%) */
  mixProduitMargeGlobale: number;
  /** CA projeté mensuel depuis le mix produits (€) */
  mixProduitCAProjeteMensuel: number;

  setScenario: (s: ScenarioType) => void;
  setHorizon: (h: HorizonType) => void;
  setComparisonMode: (v: boolean) => void;
  updateParams: (partial: Partial<ProjectionParams>) => void;
  updateSeasonalite: (monthIndex: number, value: number) => void;
  resetParams: () => void;
  updateMixCategories: (categories: MixCategorie[]) => void;
  updateBusinessPlanParams: (partial: Partial<BusinessPlanParams>) => void;
  /** Called by TabRentabiliteMixProduits to export its computed values */
  setMixProduitResults: (seuil: number, marge: number, ca: number) => void;
}

export const useProjectionStore = create<ProjectionState>()(
  persist(
    (set) => ({
      scenario: "realiste",
      horizon: 12,
      comparisonMode: false,
      params: { ...DEFAULT_PARAMS },
      mixCategories: DEFAULT_MIX_CATEGORIES,
      businessPlanParams: { ...DEFAULT_BP_PARAMS },

      mixProduitSeuilMensuel: 0,
      mixProduitMargeGlobale: 0,
      mixProduitCAProjeteMensuel: 0,

      setScenario: (s) =>
        set((state) => ({
          scenario: s,
          params: { ...state.params, scenario: s },
        })),

      setHorizon: (h) =>
        set((state) => ({
          horizon: h,
          params: { ...state.params, horizon: h },
        })),

      setComparisonMode: (v) => set({ comparisonMode: v }),

      updateParams: (partial) =>
        set((state) => ({
          params: { ...state.params, ...partial },
        })),

      updateSeasonalite: (monthIndex, value) =>
        set((state) => {
          const next = [
            ...state.params.seasonalite,
          ] as ProjectionParams["seasonalite"];
          next[monthIndex] = value;
          return { params: { ...state.params, seasonalite: next } };
        }),

      resetParams: () =>
        set({
          scenario: "realiste",
          horizon: 12,
          comparisonMode: false,
          params: { ...DEFAULT_PARAMS },
        }),

      updateMixCategories: (categories) => set({ mixCategories: categories }),

      updateBusinessPlanParams: (partial) =>
        set((state) => ({
          businessPlanParams: { ...state.businessPlanParams, ...partial },
        })),

      setMixProduitResults: (seuil, marge, ca) =>
        set({
          mixProduitSeuilMensuel: seuil,
          mixProduitMargeGlobale: marge,
          mixProduitCAProjeteMensuel: ca,
        }),
    }),
    { name: "projection-store" },
  ),
);
