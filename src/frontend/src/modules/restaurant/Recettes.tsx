import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useCreateRecette,
  useDeleteRecette,
  useIngredients,
  useRecettes,
  useUpdateRecette,
} from "@/hooks/useQueries";
import type { Recette, RecetteIngredient } from "@/hooks/useQueries";
import {
  coutMatiereHT,
  fmtEur,
  fmtPct,
  margeBrute,
  prixHT,
} from "@/utils/format";
import { BookOpen, Pencil, Plus, PlusCircle, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORIES = [
  "Entrées",
  "Plats",
  "Desserts",
  "Boissons",
  "Cocktails",
  "Boissons froides (hors alcool)",
  "Sandwichs froids et Wraps",
  "Plats chauds",
  "Desserts maison",
  "Accompagnements",
];

const TVA_OPTS: { label: string; value: number }[] = [
  { label: "5,5 % — Alimentation / Vente à emporter", value: 5.5 },
  { label: "10 % — Restauration / Soft", value: 10 },
  { label: "20 % — Alcools", value: 20 },
];

const UNITES = ["kg", "g", "L", "cl", "ml", "U", "pièce"];
const SKELETON_ROWS = [0, 1, 2, 3];
const SKELETON_COLS = [0, 1, 2, 3, 4, 5, 6, 7];

type FormState = Omit<Recette, "id"> & {
  prixStr: string;
  consommablesStr: string;
};

const emptyForm = (): FormState => ({
  nom: "",
  categorie: CATEGORIES[0],
  categorieTVA: TVA_OPTS[1].label,
  tauxTVA: 10,
  ingredients: [],
  consommablesHT: 0,
  prixVenteTTC: 0,
  prixStr: "",
  consommablesStr: "",
});

function margeColor(marge: number) {
  if (marge >= 60) return "text-green-500";
  if (marge >= 30) return "text-amber-500";
  return "text-red-500";
}

export default function Recettes() {
  const { data: recettes = [], isLoading } = useRecettes();
  const { data: ingredients = [] } = useIngredients();
  const createMut = useCreateRecette();
  const updateMut = useUpdateRecette();
  const deleteMut = useDeleteRecette();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recette | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const ingredientsMap = useMemo(() => {
    const m = new Map<string, (typeof ingredients)[0]>();
    for (const ing of ingredients) m.set(ing.id, ing);
    return m;
  }, [ingredients]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(r: Recette) {
    setEditing(r);
    const matchedTva = TVA_OPTS.find((t) => t.value === r.tauxTVA);
    setForm({
      nom: r.nom,
      categorie: r.categorie,
      categorieTVA: matchedTva?.label ?? r.categorieTVA,
      tauxTVA: r.tauxTVA,
      ingredients: r.ingredients.map((i) => ({ ...i })),
      consommablesHT: r.consommablesHT,
      prixVenteTTC: r.prixVenteTTC,
      prixStr: r.prixVenteTTC === 0 ? "" : String(r.prixVenteTTC),
      consommablesStr: r.consommablesHT === 0 ? "" : String(r.consommablesHT),
    });
    setOpen(true);
  }

  function setTVA(label: string) {
    const opt = TVA_OPTS.find((t) => t.label === label);
    setForm((f) => ({
      ...f,
      categorieTVA: label,
      tauxTVA: opt?.value ?? f.tauxTVA,
    }));
  }

  function addIngredientLine() {
    if (ingredients.length === 0) return;
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        {
          ingredientId: ingredients[0].id,
          quantite: 0,
          unite: ingredients[0].unite,
        },
      ],
    }));
  }

  function updateLine(idx: number, patch: Partial<RecetteIngredient>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ri, i) =>
        i === idx ? { ...ri, ...patch } : ri,
      ),
    }));
  }

  function removeLine(idx: number) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== idx),
    }));
  }

  const coutCalc = useMemo(
    () => coutMatiereHT(form, ingredientsMap),
    [form, ingredientsMap],
  );
  const prixTTC = parseNumber(form.prixStr);
  const prHT = useMemo(
    () => prixHT(prixTTC, form.tauxTVA),
    [prixTTC, form.tauxTVA],
  );
  const margeCalc = useMemo(() => margeBrute(prHT, coutCalc), [prHT, coutCalc]);

  const canSave =
    !!form.nom &&
    validateNumber(form.prixStr) &&
    validateNumber(form.consommablesStr);

  async function handleSave() {
    if (!canSave) {
      toast.error("Corrigez les champs invalides avant de sauvegarder.");
      return;
    }
    const payload: Omit<Recette, "id"> = {
      nom: form.nom,
      categorie: form.categorie,
      categorieTVA: form.categorieTVA,
      tauxTVA: form.tauxTVA,
      ingredients: form.ingredients,
      consommablesHT: parseNumber(form.consommablesStr),
      prixVenteTTC: parseNumber(form.prixStr),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ ...payload, id: editing.id });
        toast.success("Recette mise à jour");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Recette créée");
      }
      setOpen(false);
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function confirmDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Recette supprimée");
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setConfirmId(null);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Recettes</h2>
            <p className="text-sm text-muted-foreground">
              Produits vendus — composition, prix et marges
            </p>
          </div>
        </div>
        <Button onClick={openAdd} data-ocid="recettes.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter une recette
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>TVA</TableHead>
              <TableHead className="text-right">Prix HT</TableHead>
              <TableHead className="text-right">Prix TTC</TableHead>
              <TableHead className="text-right">Coût matière</TableHead>
              <TableHead className="text-right">Marge %</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              SKELETON_ROWS.map((row) => (
                <TableRow key={row}>
                  {SKELETON_COLS.map((col) => (
                    <TableCell key={col}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : recettes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                  data-ocid="recettes.empty_state"
                >
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Aucune recette. Ajoutez vos plats et boissons.</p>
                </TableCell>
              </TableRow>
            ) : (
              recettes.map((r, idx) => {
                const cout = coutMatiereHT(r, ingredientsMap);
                const ph = prixHT(r.prixVenteTTC, r.tauxTVA);
                const marge = margeBrute(ph, cout);
                return (
                  <TableRow key={r.id} data-ocid={`recettes.item.${idx + 1}`}>
                    <TableCell className="font-medium">{r.nom}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {r.categorie}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.tauxTVA} %
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmtEur(ph)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(r.prixVenteTTC)}
                    </TableCell>
                    <TableCell className="text-right">{fmtEur(cout)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${margeColor(marge)}`}
                    >
                      {fmtPct(marge)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                          data-ocid={`recettes.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmId(r.id)}
                          data-ocid={`recettes.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="recettes.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la recette" : "Nouvelle recette"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Nom de la recette</Label>
                <Input
                  value={form.nom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nom: e.target.value }))
                  }
                  placeholder="Ex: Burger Classique"
                  data-ocid="recettes.input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Catégorie</Label>
                <Select
                  value={form.categorie}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, categorie: v }))
                  }
                >
                  <SelectTrigger data-ocid="recettes.select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Taux TVA</Label>
                <Select value={form.categorieTVA} onValueChange={setTVA}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TVA_OPTS.map((t) => (
                      <SelectItem key={t.label} value={t.label}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Prix de vente TTC (€)</Label>
                <NumericInput
                  placeholder="0.00"
                  value={form.prixStr}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      prixStr: v,
                      prixVenteTTC: validateNumber(v)
                        ? parseNumber(v)
                        : f.prixVenteTTC,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Consommables HT (€) — emballages, serviettes…</Label>
              <NumericInput
                placeholder="0.00"
                value={form.consommablesStr}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    consommablesStr: v,
                    consommablesHT: validateNumber(v)
                      ? parseNumber(v)
                      : f.consommablesHT,
                  }))
                }
              />
            </div>

            {/* Récap calculs */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/60 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">
                  Coût matière HT
                </p>
                <p className="font-semibold">{fmtEur(coutCalc)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">
                  Prix HT calculé
                </p>
                <p className="font-semibold">{fmtEur(prHT)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">
                  Marge brute
                </p>
                <p className={`font-semibold ${margeColor(margeCalc)}`}>
                  {fmtPct(margeCalc)}
                </p>
              </div>
            </div>

            {/* Ingrédients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Composition — ingrédients</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredientLine}
                  disabled={ingredients.length === 0}
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
              </div>
              {form.ingredients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
                  Aucun ingrédient ajouté
                </p>
              )}
              {form.ingredients.map((ri, idx) => {
                const ing = ingredientsMap.get(ri.ingredientId);
                return (
                  <div
                    key={`ri-${ri.ingredientId}-${idx}`}
                    className="flex gap-2 items-center"
                  >
                    <Select
                      value={ri.ingredientId}
                      onValueChange={(v) => {
                        const found = ingredientsMap.get(v);
                        updateLine(idx, {
                          ingredientId: v,
                          unite: found?.unite ?? ri.unite,
                        });
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.nom} ({i.unite})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Qté"
                      className="w-24"
                      value={ri.quantite || ""}
                      onChange={(e) =>
                        updateLine(idx, {
                          quantite: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <Select
                      value={ri.unite}
                      onValueChange={(v) => updateLine(idx, { unite: v })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITES.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                      {ing ? fmtEur(ri.quantite * ing.prixUnitaireHT) : "—"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeLine(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="recettes.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !canSave}
              data-ocid="recettes.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <DialogContent data-ocid="recettes.confirm_dialog">
          <DialogHeader>
            <DialogTitle>Supprimer la recette ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              data-ocid="recettes.cancel_button"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId && confirmDelete(confirmId)}
              disabled={deleteMut.isPending}
              data-ocid="recettes.confirm_button"
            >
              {deleteMut.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
