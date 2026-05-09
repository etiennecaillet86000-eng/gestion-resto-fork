/**
 * Ingredients.tsx — Gestion CRUD des ingrédients
 * RÈGLE : Aucun calcul métier dans ce composant — uniquement UI & backend calls.
 * famille est synchronisé avec le backend via getFamilles / setFamilles.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INGREDIENT_FAMILIES, MEASUREMENT_UNITS } from "@/core/constants";
import { SearchableSelect } from "@/core/ui/SearchableSelect";
import {
  useCreateIngredient,
  useDeleteIngredient,
  useFamilles,
  useIngredients,
  useSetFamilles,
  useUpdateIngredient,
} from "@/hooks/useQueries";
import type { Ingredient } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────────────────────

const UNITES = MEASUREMENT_UNITS;

/** Seed list used when the backend has no families yet */
const FAMILIES_SEED = [...INGREDIENT_FAMILIES] as string[];

const SKELETON_ROWS = [0, 1, 2, 3, 4];
const SKELETON_COLS = [0, 1, 2, 3, 4, 5, 6, 7];

type SortField =
  | "nom"
  | "famille"
  | "prixUnitaireHT"
  | "seuilSecurite"
  | "stockInitial";
type SortDir = "asc" | "desc";

interface FormState {
  nom: string;
  unite: string;
  famille: string;
  prixStr: string;
  seuilStr: string;
  stockStr: string;
}

function makeEmptyForm(familles: string[]): FormState {
  return {
    nom: "",
    unite: "Kg",
    famille: familles[0] ?? FAMILIES_SEED[0],
    prixStr: "",
    seuilStr: "",
    stockStr: "",
  };
}

function parseNum(s: string): number {
  return Number.parseFloat(s.replace(",", ".")) || 0;
}

function validNum(s: string): boolean {
  if (!s) return true;
  return !Number.isNaN(Number.parseFloat(s.replace(",", ".")));
}

export default function Ingredients() {
  const { data: ingredients = [], isLoading } = useIngredients();
  const createMut = useCreateIngredient();
  const updateMut = useUpdateIngredient();
  const deleteMut = useDeleteIngredient();

  // Families are shared across all users — stored in the backend.
  const { data: backendFamilles = [], isLoading: famillesLoading } =
    useFamilles();
  const setFamillesMut = useSetFamilles();

  // Use backend families, or fall back to seed list when backend is empty.
  const familles = useMemo(
    () => (backendFamilles.length > 0 ? backendFamilles : FAMILIES_SEED),
    [backendFamilles],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<FormState>(() => makeEmptyForm(familles));
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("nom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterFamille, setFilterFamille] = useState<string>("Toutes");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  /** Returns the stored famille for an ingredient, falling back to first family. */
  function getFamille(ing: Ingredient): string {
    return ing.famille ?? familles[0] ?? FAMILIES_SEED[0];
  }

  const openAdd = useCallback(() => {
    setEditing(null);
    setForm(makeEmptyForm(familles));
    setOpen(true);
  }, [familles]);

  const openEdit = useCallback(
    (ing: Ingredient) => {
      setEditing(ing);
      setForm({
        nom: ing.nom,
        unite: ing.unite,
        famille: ing.famille ?? familles[0] ?? FAMILIES_SEED[0],
        prixStr: ing.prixUnitaireHT === 0 ? "" : String(ing.prixUnitaireHT),
        seuilStr: ing.seuilSecurite === 0 ? "" : String(ing.seuilSecurite),
        stockStr: ing.stockInitial === 0 ? "" : String(ing.stockInitial),
      });
      setOpen(true);
    },
    [familles],
  );

  const canSave =
    !!form.nom &&
    validNum(form.prixStr) &&
    !!form.prixStr &&
    validNum(form.seuilStr) &&
    validNum(form.stockStr);

  async function handleSave() {
    if (!canSave) {
      toast.error("Corrigez les champs invalides.");
      return;
    }
    const famille = form.famille || null;
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          nom: form.nom,
          unite: form.unite,
          prixUnitaireHT: parseNum(form.prixStr),
          seuilSecurite: form.seuilStr ? parseNum(form.seuilStr) : 0,
          stockInitial: form.stockStr ? parseNum(form.stockStr) : 0,
          famille: famille ?? undefined,
        });
        toast.success("Ingrédient mis à jour");
      } else {
        await createMut.mutateAsync({
          nom: form.nom,
          unite: form.unite,
          prixUnitaireHT: parseNum(form.prixStr),
          seuilSecurite: form.seuilStr ? parseNum(form.seuilStr) : 0,
          stockInitial: form.stockStr ? parseNum(form.stockStr) : 0,
          famille: famille ?? undefined,
        });
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

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handleFamilleChange(val: string) {
    setFilterFamille(val);
    setPage(1);
  }

  const filtered = useMemo(() => {
    let list = [...ingredients];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.nom.toLowerCase().includes(q));
    }
    if (filterFamille !== "Toutes") {
      list = list.filter((i) => (i.famille ?? familles[0]) === filterFamille);
    }
    list.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;
      if (sortField === "nom") {
        valA = a.nom;
        valB = b.nom;
      } else if (sortField === "famille") {
        valA = a.famille ?? familles[0] ?? "";
        valB = b.famille ?? familles[0] ?? "";
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [ingredients, search, filterFamille, sortField, sortDir, familles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const alertCount = useMemo(
    () =>
      ingredients.filter(
        (i) => i.seuilSecurite > 0 && i.stockInitial < i.seuilSecurite,
      ).length,
    [ingredients],
  );

  const isPending = createMut.isPending || updateMut.isPending;

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ChevronDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  }

  // ── Famille management handlers ──────────────────────────────────────────────
  // These are only needed if users can add custom families; for now families come
  // from seed and can be extended by calling setFamillesMut with the new list.
  // The current UI surfaces the list from the backend without inline editing —
  // that keeps this component focused on ingredient CRUD.
  // If backend was empty on first load we auto-seed it once it resolves.
  // Auto-seed backend with defaults if it has never been initialised.
  useEffect(() => {
    if (
      !famillesLoading &&
      backendFamilles.length === 0 &&
      !setFamillesMut.isPending
    ) {
      setFamillesMut.mutate(FAMILIES_SEED);
    }
  }, [backendFamilles.length, famillesLoading, setFamillesMut]);

  return (
    <div className="space-y-6" data-ocid="ingredients.page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <PackageOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ingrédients</h2>
            <p className="text-sm text-muted-foreground">
              Matières premières — prix, stock initial et seuils d&apos;alerte
            </p>
          </div>
          {alertCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {alertCount} alerte{alertCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button onClick={openAdd} data-ocid="ingredients.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un ingrédient
        </Button>
      </div>

      {/* Filtres */}
      <Card className="bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un ingrédient..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-8"
                data-ocid="ingredients.search_input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <SearchableSelect
              options={[
                { value: "Toutes", label: "Toutes les familles" },
                ...familles.map((f) => ({ value: f, label: f })),
              ]}
              value={filterFamille}
              onChange={handleFamilleChange}
              placeholder="Famille"
              searchPlaceholder="Rechercher une famille…"
              className="w-[200px]"
              data-ocid="ingredients.select"
            />
            <Badge variant="secondary" className="text-xs px-3 py-1.5">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => toggleSort("nom")}
              >
                Nom <SortIcon field="nom" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => toggleSort("famille")}
              >
                Famille <SortIcon field="famille" />
              </TableHead>
              <TableHead>Unité</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/60 text-right"
                onClick={() => toggleSort("prixUnitaireHT")}
              >
                Prix HT <SortIcon field="prixUnitaireHT" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/60 text-right"
                onClick={() => toggleSort("seuilSecurite")}
              >
                Seuil alerte <SortIcon field="seuilSecurite" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/60 text-right"
                onClick={() => toggleSort("stockInitial")}
              >
                Stock initial <SortIcon field="stockInitial" />
              </TableHead>
              <TableHead className="text-center">Statut</TableHead>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-12"
                  data-ocid="ingredients.empty_state"
                >
                  <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>
                    {ingredients.length === 0
                      ? "Aucun ingrédient. Ajoutez vos matières premières."
                      : "Aucun résultat pour ce filtre."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((ing, idx) => {
                const enAlerte =
                  ing.seuilSecurite > 0 && ing.stockInitial < ing.seuilSecurite;
                const famille = getFamille(ing);
                return (
                  <TableRow
                    key={ing.id}
                    data-ocid={`ingredients.item.${(safePage - 1) * PAGE_SIZE + idx + 1}`}
                    className={enAlerte ? "bg-destructive/5" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {enAlerte && (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        )}
                        {ing.nom}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {famille}
                      </Badge>
                    </TableCell>
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
                    <TableCell className="text-center">
                      {enAlerte ? (
                        <Badge variant="destructive" className="text-xs">
                          RUPTURE
                        </Badge>
                      ) : ing.seuilSecurite === 0 ? (
                        <Badge variant="secondary" className="text-xs">
                          N/D
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600"
                        >
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(ing)}
                          data-ocid={`ingredients.edit_button.${(safePage - 1) * PAGE_SIZE + idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmId(ing.id)}
                          data-ocid={`ingredients.delete_button.${(safePage - 1) * PAGE_SIZE + idx + 1}`}
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

      {/* Pagination */}
      {!isLoading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {safePage} / {totalPages} — {filtered.length} résultat
            {filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              data-ocid="ingredients.pagination_prev"
            >
              ← Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              data-ocid="ingredients.pagination_next"
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Résumé famille */}
      {!isLoading && ingredients.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Résumé par famille</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {familles
                .filter((f) =>
                  ingredients.some((i) => (i.famille ?? familles[0]) === f),
                )
                .map((f) => {
                  const count = ingredients.filter(
                    (i) => (i.famille ?? familles[0]) === f,
                  ).length;
                  return (
                    <Badge
                      key={f}
                      variant={filterFamille === f ? "default" : "secondary"}
                      className="cursor-pointer text-xs"
                      onClick={() =>
                        setFilterFamille(filterFamille === f ? "Toutes" : f)
                      }
                    >
                      {f} ({count})
                    </Badge>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Unité</Label>
                <SearchableSelect
                  options={UNITES.map((u) => ({ value: u, label: u }))}
                  value={form.unite}
                  onChange={(v) => setForm((f) => ({ ...f, unite: v }))}
                  placeholder="Unité"
                  searchPlaceholder="Rechercher…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Famille</Label>
                <SearchableSelect
                  options={familles.map((fa) => ({ value: fa, label: fa }))}
                  value={form.famille}
                  onChange={(v) => setForm((f) => ({ ...f, famille: v }))}
                  placeholder="Famille"
                  searchPlaceholder="Rechercher une famille…"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ing-prix">
                Prix unitaire HT (€ / {form.unite})
              </Label>
              <Input
                id="ing-prix"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={form.prixStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prixStr: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ing-seuil">Seuil sécurité ({form.unite})</Label>
                <Input
                  id="ing-seuil"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={form.seuilStr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, seuilStr: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ing-stock">Stock initial ({form.unite})</Label>
                <Input
                  id="ing-stock"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={form.stockStr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stockStr: e.target.value }))
                  }
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
            <DialogTitle>Supprimer l&apos;ingrédient ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. L&apos;ingrédient sera définitivement
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
