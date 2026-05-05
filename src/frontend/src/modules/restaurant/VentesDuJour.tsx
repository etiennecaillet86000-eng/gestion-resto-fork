import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateMouvement,
  useCreateVente,
  useDeleteVente,
  useIngredients,
  useRecettes,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type { Recette, VenteRecette } from "@/hooks/useQueries";
import {
  CalendarDays,
  Euro,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SKELETON_IDS = ["sk1", "sk2", "sk3"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function coutMatiereRecette(
  recette: Recette,
  ingredients: { id: string; prixUnitaireHT: number }[],
) {
  const ingMap = new Map(ingredients.map((i) => [i.id, i.prixUnitaireHT]));
  return (
    recette.ingredients.reduce((sum, ri) => {
      return sum + (ingMap.get(ri.ingredientId) ?? 0) * ri.quantite;
    }, 0) + recette.consommablesHT
  );
}

export default function VentesDuJour() {
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [formRecetteId, setFormRecetteId] = useState("");
  const [formQuantite, setFormQuantite] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: recettes = [], isLoading: loadingR } = useRecettes();
  const { data: ingredients = [], isLoading: loadingI } = useIngredients();
  const { data: allVentes = [], isLoading: loadingV } = useVentesRecettes();
  const createVente = useCreateVente();
  const createMouvement = useCreateMouvement();
  const deleteVente = useDeleteVente();

  const isLoading = loadingR || loadingI || loadingV;

  const ventesDuJour = allVentes.filter((v) => v.date === selectedDate);
  const recetteMap = new Map<string, Recette>(recettes.map((r) => [r.id, r]));

  const stats = ventesDuJour.reduce(
    (acc, v) => {
      const r = recetteMap.get(v.recetteId);
      if (!r) return acc;
      const prixHT = r.prixVenteTTC / (1 + r.tauxTVA / 100);
      const caHT = prixHT * v.quantite;
      const cout = coutMatiereRecette(r, ingredients) * v.quantite;
      return {
        caHT: acc.caHT + caHT,
        caTTC: acc.caTTC + r.prixVenteTTC * v.quantite,
        cout: acc.cout + cout,
        nbVentes: acc.nbVentes + 1,
      };
    },
    { caHT: 0, caTTC: 0, cout: 0, nbVentes: 0 },
  );

  const marge = stats.caHT - stats.cout;

  async function handleAjouter() {
    if (!formRecetteId) {
      toast.error("S\u00e9lectionnez une recette");
      return;
    }
    const qty = Math.max(1, Math.floor(Number(formQuantite) || 1));
    setSaving(true);
    try {
      const recette = recetteMap.get(formRecetteId);
      if (!recette) throw new Error("Recette introuvable");
      const tasks: Promise<unknown>[] = [
        createVente.mutateAsync({
          recetteId: formRecetteId,
          date: selectedDate,
          quantite: qty,
        }),
      ];
      for (const ri of recette.ingredients) {
        tasks.push(
          createMouvement.mutateAsync({
            ingredientId: ri.ingredientId,
            date: selectedDate,
            typeOp: "Sortie",
            quantite: ri.quantite * qty,
            motif: `Vente \u2014 ${recette.nom}`,
          }),
        );
      }
      await Promise.all(tasks);
      setFormQuantite("");
      toast.success("Vente enregistr\u00e9e");
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVente(id: string) {
    try {
      await deleteVente.mutateAsync(id);
      toast.success("Vente supprim\u00e9e");
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="space-y-6" data-ocid="ventes.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ventes du jour</h2>
            <p className="text-sm text-muted-foreground">
              Enregistrez les ventes \u2014 le stock se met \u00e0 jour
              automatiquement
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
            data-ocid="ventes.input"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          SKELETON_IDS.map((sk) => (
            <Skeleton key={sk} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Euro className="h-3.5 w-3.5" /> CA HT
                </div>
                <p className="text-xl font-bold">{fmtEur(stats.caHT)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Euro className="h-3.5 w-3.5" /> CA TTC
                </div>
                <p className="text-xl font-bold">{fmtEur(stats.caTTC)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Marge brute HT
                </div>
                <p className="text-xl font-bold">{fmtEur(marge)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="h-3.5 w-3.5" /> Nb ventes
                </div>
                <p className="text-xl font-bold">{stats.nbVentes}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Formulaire d'ajout rapide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Enregistrer une vente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 grid gap-1.5">
              <Label>Recette</Label>
              <Select value={formRecetteId} onValueChange={setFormRecetteId}>
                <SelectTrigger data-ocid="ventes.select">
                  <SelectValue placeholder="S\u00e9lectionner une recette..." />
                </SelectTrigger>
                <SelectContent>
                  {recettes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom} ({fmtEur(r.prixVenteTTC)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 grid gap-1.5">
              <Label>Quantit\u00e9</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={formQuantite}
                onChange={(e) => setFormQuantite(e.target.value)}
                placeholder="1"
                data-ocid="ventes.quantity_input"
              />
            </div>
            <Button
              onClick={handleAjouter}
              disabled={saving || !formRecetteId}
              data-ocid="ventes.submit_button"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Ajouter
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des ventes du jour */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">
            Ventes enregistr\u00e9es
            {ventesDuJour.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {ventesDuJour.length}
              </Badge>
            )}
          </h3>
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Recette</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Quantit\u00e9</TableHead>
                <TableHead className="text-right">Prix HT</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                SKELETON_IDS.map((sk) => (
                  <TableRow key={sk}>
                    {[0, 1, 2, 3, 4, 5].map((c) => (
                      <TableCell key={c}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : ventesDuJour.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-10"
                    data-ocid="ventes.empty_state"
                  >
                    <ShoppingCart className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune vente pour cette date</p>
                  </TableCell>
                </TableRow>
              ) : (
                ventesDuJour.map((v: VenteRecette, i: number) => {
                  const r = recetteMap.get(v.recetteId);
                  if (!r) return null;
                  const prixHTCalc = r.prixVenteTTC / (1 + r.tauxTVA / 100);
                  const totalHT = prixHTCalc * v.quantite;
                  return (
                    <TableRow key={v.id} data-ocid={`ventes.item.${i + 1}`}>
                      <TableCell className="font-medium">{r.nom}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {v.date}
                      </TableCell>
                      <TableCell className="text-right">{v.quantite}</TableCell>
                      <TableCell className="text-right text-sm">
                        {fmtEur(prixHTCalc)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmtEur(totalHT)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteVente(v.id)}
                          data-ocid={`ventes.delete_button.${i + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Totaux journaliers */}
        {ventesDuJour.length > 0 && (
          <div className="mt-4 flex justify-end gap-6 text-sm border-t pt-4">
            <div className="text-right">
              <p className="text-muted-foreground text-xs">CA total HT</p>
              <p className="font-bold text-lg">{fmtEur(stats.caHT)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Nombre de ventes</p>
              <p className="font-bold text-lg">{stats.nbVentes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
