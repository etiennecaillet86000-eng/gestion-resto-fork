/**
 * Restaurant domain hooks — connects to the backend restaurant data layer.
 * Covers: Ingrédients, Recettes, Mouvements de stock, Ventes recettes,
 *         Mix produit par catégorie, Jours d'ouverture.
 */

import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import type {
  Ingredient,
  MouvementStock,
  Recette,
  VenteRecette,
  backendInterface,
} from "../backend.d";

export type { Ingredient, MouvementStock, Recette, VenteRecette };

function typed(actor: unknown): backendInterface {
  return actor as backendInterface;
}

function requireActor(actor: unknown): backendInterface {
  if (!actor)
    throw new Error("Backend non disponible — veuillez recharger la page");
  return actor as backendInterface;
}

// ── INGREDIENTS ───────────────────────────────────────────────────────────────

export function useIngredients() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Ingredient[]>({
    queryKey: ["ingredients"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getIngredients] actor is null, returning []");
        return [];
      }
      console.log("[getIngredients] fetching...");
      const result = await typed(actor).getIngredients();
      console.log("[getIngredients] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateIngredient() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Ingredient, "id">) => {
      const a = requireActor(actor);
      console.log("[createIngredient] payload:", JSON.stringify(v));
      return typed(a).createIngredient(
        v.nom,
        v.unite,
        v.prixUnitaireHT,
        v.seuilSecurite,
        v.stockInitial,
        v.famille ?? null,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useUpdateIngredient() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Ingredient) => {
      const a = requireActor(actor);
      console.log("[updateIngredient] payload:", JSON.stringify(v));
      return typed(a).updateIngredient(
        v.id,
        v.nom,
        v.unite,
        v.prixUnitaireHT,
        v.seuilSecurite,
        v.stockInitial,
        v.famille ?? null,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

export function useDeleteIngredient() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteIngredient] id:", id);
      return typed(a).deleteIngredient(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingredients"] }),
  });
}

// ── RECETTES ──────────────────────────────────────────────────────────────────

export function useRecettes() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Recette[]>({
    queryKey: ["recettes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getRecettes] actor is null, returning []");
        return [];
      }
      console.log("[getRecettes] fetching...");
      const result = await typed(actor).getRecettes();
      console.log("[getRecettes] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateRecette() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Recette, "id">) => {
      const a = requireActor(actor);
      console.log("[createRecette] payload:", JSON.stringify(v));
      return typed(a).createRecette(
        v.nom,
        v.categorie,
        v.categorieTVA,
        v.tauxTVA,
        v.ingredients,
        v.consommablesHT,
        v.prixVenteTTC,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recettes"] }),
  });
}

export function useUpdateRecette() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Recette) => {
      const a = requireActor(actor);
      console.log("[updateRecette] payload:", JSON.stringify(v));
      return typed(a).updateRecette(
        v.id,
        v.nom,
        v.categorie,
        v.categorieTVA,
        v.tauxTVA,
        v.ingredients,
        v.consommablesHT,
        v.prixVenteTTC,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recettes"] }),
  });
}

export function useDeleteRecette() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteRecette] id:", id);
      return typed(a).deleteRecette(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recettes"] }),
  });
}

// ── MOUVEMENTS DE STOCK ───────────────────────────────────────────────────────

export function useMouvementsStock() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<MouvementStock[]>({
    queryKey: ["mouvements"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getMouvements] actor is null, returning []");
        return [];
      }
      console.log("[getMouvements] fetching...");
      const result = await typed(actor).getMouvementsStock();
      console.log("[getMouvements] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateMouvement() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      ingredientId: string;
      date: string;
      typeOp: string;
      quantite: number;
      motif: string;
    }) => {
      const a = requireActor(actor);
      console.log("[createMouvement] payload:", JSON.stringify(v));
      return typed(a).createMouvement(
        v.ingredientId,
        v.date,
        v.typeOp,
        v.quantite,
        v.motif,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mouvements"] }),
  });
}

export function useDeleteMouvement() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteMouvement] id:", id);
      return typed(a).deleteMouvement(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mouvements"] });
      // Stock.tsx recomputes stockActuel from ingredients + mouvements —
      // invalidating both ensures the Inventaire re-renders with updated balance.
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
}

// ── VENTES RECETTES ───────────────────────────────────────────────────────────

export function useVentesRecettes() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<VenteRecette[]>({
    queryKey: ["ventes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getVentes] actor is null, returning []");
        return [];
      }
      console.log("[getVentes] fetching...");
      const result = await typed(actor).getVentesRecettes();
      console.log("[getVentes] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateVente() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { recetteId: string; date: string; quantite: number }) => {
      const a = requireActor(actor);
      console.log("[createVente] payload:", JSON.stringify(v));
      return typed(a).createVente(v.recetteId, v.date, v.quantite);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ventes"] }),
  });
}

export function useDeleteVente() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      venteId: string;
      mouvementIds: string[];
    }) => {
      const a = requireActor(actor);
      // 1. Supprimer les mouvements de sortie liés à la vente (en parallèle)
      if (payload.mouvementIds.length > 0) {
        console.log(
          "[deleteVente] suppression de",
          payload.mouvementIds.length,
          "mouvement(s) liés",
        );
        await Promise.all(
          payload.mouvementIds.map((mid) => typed(a).deleteMouvement(mid)),
        );
      }
      // 2. Supprimer la vente elle-même
      console.log("[deleteVente] id:", payload.venteId);
      return typed(a).deleteVente(payload.venteId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventes"] });
      qc.invalidateQueries({ queryKey: ["mouvements"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
}

// ── MIX PRODUIT PAR CATEGORIE ─────────────────────────────────────────────────

export function useMixProduitParCategorie() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<[string, number][]>({
    queryKey: ["mixProduit"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await typed(actor).getMixProduitParCategorie();
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveMixProduitParCategorie() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: [string, number][]) => {
      const a = requireActor(actor);
      return typed(a).saveMixProduitParCategorie(m);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mixProduit"] }),
  });
}

// ── JOURS OUVERTURE PAR SEMAINE ───────────────────────────────────────────────

export function useJoursOuvertureParSemaine() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<number>({
    queryKey: ["joursOuverture"],
    queryFn: async () => {
      if (!actor) return 6;
      const result = await typed(actor).getJoursOuvertureParSemaine();
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveJoursOuvertureParSemaine() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: number) => {
      const a = requireActor(actor);
      return typed(a).saveJoursOuvertureParSemaine(v);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["joursOuverture"] }),
  });
}
