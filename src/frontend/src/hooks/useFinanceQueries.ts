/**
 * Finance domain hooks — connects to the backend finance data layer.
 * Covers: Frais Fixes, Emprunts, Amortissements, Ventes, Salariés,
 *         Associés/Gérants, Paramètres Rentabilité & Juridiques.
 */

import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import type {
  AssocieGerant,
  Emprunt,
  LigneAmortissement,
  LigneFraisFixes,
  ParametresJuridiques,
  ParametresRentabilite,
  Salarie,
  VenteRecette,
  backendInterface,
} from "../backend.d";

export type {
  AssocieGerant,
  Emprunt,
  LigneAmortissement,
  LigneFraisFixes,
  ParametresJuridiques,
  ParametresRentabilite,
  Salarie,
  VenteRecette,
};

function typed(actor: unknown): backendInterface {
  return actor as backendInterface;
}

function requireActor(actor: unknown): backendInterface {
  if (!actor)
    throw new Error("Backend non disponible — veuillez recharger la page");
  return actor as backendInterface;
}

// ── FRAIS FIXES ──────────────────────────────────────────────────────────────

export function useFraisFixes() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<LigneFraisFixes[]>({
    queryKey: ["fraisFixes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getFraisFixes] actor is null, returning []");
        return [];
      }
      console.log("[getFraisFixes] fetching...");
      const result = await typed(actor).getFraisFixes();
      console.log("[getFraisFixes] got", result.length, "lignes");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveFraisFixes() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lignes: LigneFraisFixes[]) => {
      const a = requireActor(actor);
      console.log("[saveFraisFixes] payload:", JSON.stringify(lignes));
      return typed(a).saveFraisFixes(lignes);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fraisFixes"] }),
  });
}

// ── EMPRUNTS ──────────────────────────────────────────────────────────────────

export function useEmprunts() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Emprunt[]>({
    queryKey: ["emprunts"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getEmprunts] actor is null, returning []");
        return [];
      }
      console.log("[getEmprunts] fetching...");
      const result = await typed(actor).getEmprunts();
      console.log("[getEmprunts] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateEmprunt() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Emprunt, "id">) => {
      const a = requireActor(actor);
      console.log("[createEmprunt] payload:", JSON.stringify(v));
      return typed(a).createEmprunt(
        v.nom,
        v.montant,
        v.tauxAnnuel,
        v.dureeMois,
        v.dateDebut,
        v.differeMois,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emprunts"] }),
  });
}

export function useUpdateEmprunt() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Emprunt) => {
      const a = requireActor(actor);
      console.log("[updateEmprunt] payload:", JSON.stringify(v));
      return typed(a).updateEmprunt(
        v.id,
        v.nom,
        v.montant,
        v.tauxAnnuel,
        v.dureeMois,
        v.dateDebut,
        v.differeMois,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emprunts"] }),
  });
}

export function useDeleteEmprunt() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteEmprunt] id:", id);
      return typed(a).deleteEmprunt(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emprunts"] }),
  });
}

// ── AMORTISSEMENTS ────────────────────────────────────────────────────────────

export function useAmortissements() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<LigneAmortissement[]>({
    queryKey: ["amortissements"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getAmortissements] actor is null, returning []");
        return [];
      }
      console.log("[getAmortissements] fetching...");
      const result = await typed(actor).getAmortissements();
      console.log("[getAmortissements] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateAmortissement() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<LigneAmortissement, "id">) => {
      const a = requireActor(actor);
      console.log("[createAmortissement] payload:", JSON.stringify(v));
      return typed(a).createAmortissement(v.nom, v.coutTotal, v.dureeMois);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["amortissements"] }),
  });
}

export function useUpdateAmortissement() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: LigneAmortissement) => {
      const a = requireActor(actor);
      console.log("[updateAmortissement] payload:", JSON.stringify(v));
      return typed(a).updateAmortissement(
        v.id,
        v.nom,
        v.coutTotal,
        v.dureeMois,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["amortissements"] }),
  });
}

export function useDeleteAmortissement() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteAmortissement] id:", id);
      return typed(a).deleteAmortissement(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["amortissements"] }),
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
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteVente] id:", id);
      return typed(a).deleteVente(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ventes"] }),
  });
}

// ── SALARIES ──────────────────────────────────────────────────────────────────

export function useSalaries() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Salarie[]>({
    queryKey: ["salaries"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getSalaries] actor is null, returning []");
        return [];
      }
      console.log("[getSalaries] fetching...");
      const result = await typed(actor).getSalaries();
      console.log("[getSalaries] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateSalarie() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<Salarie, "id">) => {
      const a = requireActor(actor);
      console.log("[createSalarie] payload:", JSON.stringify(v));
      return typed(a).createSalarie(v.nom, v.poste, v.salaireAnnuelBrut);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

export function useUpdateSalarie() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Salarie) => {
      const a = requireActor(actor);
      console.log("[updateSalarie] payload:", JSON.stringify(v));
      return typed(a).updateSalarie(v.id, v.nom, v.poste, v.salaireAnnuelBrut);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

export function useDeleteSalarie() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteSalarie] id:", id);
      return typed(a).deleteSalarie(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

// ── ASSOCIES / GERANTS ────────────────────────────────────────────────────────

export function useAssociesGerants() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<AssocieGerant[]>({
    queryKey: ["associes"],
    queryFn: async () => {
      if (!actor) {
        console.warn("[getAssocies] actor is null, returning []");
        return [];
      }
      console.log("[getAssocies] fetching...");
      const result = await typed(actor).getAssociesGerants();
      console.log("[getAssocies] got", result.length, "items");
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateAssocieGerant() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Omit<AssocieGerant, "id">) => {
      const a = requireActor(actor);
      console.log("[createAssocieGerant] payload:", JSON.stringify(v));
      return typed(a).createAssocieGerant(
        v.nom,
        v.statut,
        v.remunerationAnnuelle,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["associes"] }),
  });
}

export function useUpdateAssocieGerant() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AssocieGerant) => {
      const a = requireActor(actor);
      console.log("[updateAssocieGerant] payload:", JSON.stringify(v));
      return typed(a).updateAssocieGerant(
        v.id,
        v.nom,
        v.statut,
        v.remunerationAnnuelle,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["associes"] }),
  });
}

export function useDeleteAssocieGerant() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      const a = requireActor(actor);
      console.log("[deleteAssocieGerant] id:", id);
      return typed(a).deleteAssocieGerant(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["associes"] }),
  });
}

// ── PARAMETRES RENTABILITE ────────────────────────────────────────────────────

export function useParametres() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<ParametresRentabilite>({
    queryKey: ["parametres"],
    queryFn: async () => {
      if (!actor)
        return {
          ticketMoyenHT: 0,
          nbClientsParSemaine: 0,
          nbSemainesSaison: 0,
          tauxFoodCostParCategorie: [],
        };
      console.log("[getParametres] fetching...");
      const result = await typed(actor).getParametres();
      console.log("[getParametres] result:", JSON.stringify(result));
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveParametres() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ParametresRentabilite) => {
      const a = requireActor(actor);
      console.log("[saveParametres] payload:", JSON.stringify(p));
      return typed(a).saveParametres(p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parametres"] }),
  });
}

// ── PARAMETRES JURIDIQUES ─────────────────────────────────────────────────────

export function useParametresJuridiques() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<ParametresJuridiques>({
    queryKey: ["parametresJuridiques"],
    queryFn: async () => {
      if (!actor)
        return {
          formeJuridique: "EI",
          regimeFiscal: "IR",
          regimeSocial: "TNS",
        };
      console.log("[getParametresJuridiques] fetching...");
      const result = await typed(actor).getParametresJuridiques();
      console.log("[getParametresJuridiques] result:", JSON.stringify(result));
      return result;
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveParametresJuridiques() {
  const { actor } = useActor(createActor);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ParametresJuridiques) => {
      const a = requireActor(actor);
      console.log("[saveParametresJuridiques] payload:", JSON.stringify(p));
      return typed(a).saveParametresJuridiques(p);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["parametresJuridiques"] }),
  });
}
