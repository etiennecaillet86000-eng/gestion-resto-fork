import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
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
  useCreateIngredient,
  useDeleteIngredient,
  useIngredients,
  useUpdateIngredient,
} from "@/hooks/useQueries";
import type { Ingredient } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const UNITES = ["kg", "g", "L", "cl", "ml", "U", "pièce", "botte", "sachet"];
const SKELETON_ROWS = [0, 1, 2, 3];
const SKELETON_COLS = [0, 1, 2, 3, 4, 5];

interface FormState {
  nom: string;
  unite: string;
  prixStr: string;
  seuilStr: string;
  stockStr: string;
}

const emptyForm = (): FormState => ({
  nom: "",
  unite: "kg",
  prixStr: "",
  seuilStr: "",
  stockStr: "",
});

export default function Ingredients() {
  const { data: ingredients = [], isLoading } = useIngredients();
  const createMut = useCreateIngredient();
  const updateMut = useUpdateIngredient();
  const deleteMut = useDeleteIngredient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      nom: ing.nom,
      unite: ing.unite,
      prixStr: ing.prixUnitaireHT === 0 ? "" : String(ing.prixUnitaireHT),
      seuilStr: ing.seuilSecurite === 0 ? "" : String(ing.seuilSecurite),
      stockStr: ing.stockInitial === 0 ? "" : String(ing.stockInitial),
    });
    setOpen(true);
  }

  const prixValid = validateNumber(form.prixStr);
  const seuilValid = form.seuilStr === "" || validateNumber(form.seuilStr);
  const stockValid = form.stockStr === "" || validateNumber(form.stockStr);
  const canSave = !!form.nom && prixValid && seuilValid && stockValid;

  async function handleSave() {
    if (!canSave) {
      toast.error("Corrigez les champs invalides.");
      return;
    }
    const data: Omit<Ingredient, "id"> = {
      nom: form.nom,
      unite: form.unite,
      prixUnitaireHT: parseNumber(form.prixStr),
      seuilSecurite: form.seuilStr ? parseNumber(form.seuilStr) : 0,
      stockInitial: form.stockStr ? parseNumber(form.stockStr) : 0,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ ...data, id: editing.id });
        toast.success("Ingrédient mis à jour");
      } else {
        await createMut.mutateAsync(data);
        toast.success("Ingrédient créé");
      }
      setOpen(false);
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function confirmDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Ingrédient supprimé");
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
            <UtensilsCrossed className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ingrédients</h2>
            <p className="text-sm text-muted-foreground">
              Matières premières — prix, stock initial et seuils d'alerte
            </p>
          </div>
        </div>
        <Button onClick={openAdd} data-ocid="ingredients.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un ingrédient
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead className="text-right">Prix unitaire HT</TableHead>
              <TableHead className="text-right">Seuil sécurité</TableHead>
              <TableHead className="text-right">Stock initial</TableHead>
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
            ) : ingredients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-12"
                  data-ocid="ingredients.empty_state"
                >
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Aucun ingrédient. Ajoutez vos matières premières.</p>
                </TableCell>
              </TableRow>
            ) : (
              ingredients.map((ing, idx) => (
                <TableRow
                  key={ing.id}
                  data-ocid={`ingredients.item.${idx + 1}`}
                >
                  <TableCell className="font-medium">{ing.nom}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {ing.unite}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(ing.prixUnitaireHT)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {ing.seuilSecurite > 0 ? (
                      `${ing.seuilSecurite} ${ing.unite}`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {ing.stockInitial > 0 ? (
                      `${ing.stockInitial} ${ing.unite}`
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(ing)}
                        data-ocid={`ingredients.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setConfirmId(ing.id)}
                        data-ocid={`ingredients.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="ingredients.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'ingrédient" : "Nouvel ingrédient"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ing-nom">Nom</Label>
              <Input
                id="ing-nom"
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                placeholder="Ex: Farine de blé"
                data-ocid="ingredients.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-unite">Unité</Label>
              <Select
                value={form.unite}
                onValueChange={(v) => setForm((f) => ({ ...f, unite: v }))}
              >
                <SelectTrigger id="ing-unite" data-ocid="ingredients.select">
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
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-prix">
                Prix unitaire HT (€ / {form.unite})
              </Label>
              <NumericInput
                id="ing-prix"
                placeholder="0.00"
                value={form.prixStr}
                onChange={(v) => setForm((f) => ({ ...f, prixStr: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ing-seuil">Seuil sécurité ({form.unite})</Label>
                <NumericInput
                  id="ing-seuil"
                  placeholder="0"
                  value={form.seuilStr}
                  onChange={(v) => setForm((f) => ({ ...f, seuilStr: v }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ing-stock">Stock initial ({form.unite})</Label>
                <NumericInput
                  id="ing-stock"
                  placeholder="0"
                  value={form.stockStr}
                  onChange={(v) => setForm((f) => ({ ...f, stockStr: v }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="ingredients.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !canSave}
              data-ocid="ingredients.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <DialogContent data-ocid="ingredients.confirm_dialog">
          <DialogHeader>
            <DialogTitle>Supprimer l'ingrédient ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. L'ingrédient sera définitivement
            supprimé.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              data-ocid="ingredients.cancel_button"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId && confirmDelete(confirmId)}
              disabled={deleteMut.isPending}
              data-ocid="ingredients.confirm_button"
            >
              {deleteMut.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
