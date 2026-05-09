/**
 * Recettes.tsx — Gestion CRUD des recettes avec composition et calcul de marge
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { MEASUREMENT_UNITS, RECIPE_CATEGORIES } from "@/core/constants";
import { SearchableSelect } from "@/core/ui/SearchableSelect";
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
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  PlusCircle,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Categories are now centralized in @/core/constants
const CATEGORIES = [...RECIPE_CATEGORIES];

const TVA_OPTS: { label: string; value: number }[] = [
  { label: "5,5 % — Alimentation / Vente à emporter", value: 5.5 },
  { label: "10 % — Restauration / Soft", value: 10 },
  { label: "20 % — Alcools", value: 20 },
];

const SKELETON_ROWS = [0, 1, 2, 3];
const SKELETON_COLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

type SortField = "nom" | "categorie" | "tauxTVA" | "prixVenteTTC" | "marge";
type SortDir = "asc" | "desc";

type FormState = Omit<Recette, "id"> & {
  prixStr: string;
  consommablesStr: string;
};

const emptyForm = (): FormState => ({
  nom: "",
  categorie: RECIPE_CATEGORIES[0],
  categorieTVA: TVA_OPTS[1].label,
  tauxTVA: 10,
  ingredients: [],
  consommablesHT: 0,
  prixVenteTTC: 0,
  prixStr: "",
  consommablesStr: "",
});

function margeColor(marge: number) {
  if (marge >= 65) return "text-green-500";
  if (marge >= 50) return "text-amber-500";
  return "text-red-500";
}

function margeBadge(marge: number) {
  if (marge >= 65) return "bg-green-500/10 text-green-600 border-green-500/20";
  if (marge >= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  return "bg-red-500/10 text-red-600 border-red-500/20";
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
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("Toutes");
  const [sortField, setSortField] = useState<SortField>("nom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [fcMin, setFcMin] = useState<string>("");
  const [fcMax, setFcMax] = useState<string>("");
  const [page, setPage] = useState(1);
  // Per-row ingredient search state — keyed by line index
  const [ingSearches, setIngSearches] = useState<Record<number, string>>({});
  const [openIngIdx, setOpenIngIdx] = useState<number | null>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 25;

  // Close ingredient combobox when clicking outside
  useEffect(() => {
    if (openIngIdx === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(e.target as Node)
      ) {
        setOpenIngIdx(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openIngIdx]);

  const ingredientsMap = useMemo(() => {
    const m = new Map<string, (typeof ingredients)[0]>();
    for (const ing of ingredients) m.set(ing.id, ing);
    return m;
  }, [ingredients]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setIngSearches({});
    setOpenIngIdx(null);
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
    setIngSearches({});
    setOpenIngIdx(null);
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

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handleCatChange(val: string) {
    setFilterCat(val);
    setPage(1);
  }

  const coutCalc = useMemo(
    () => coutMatiereHT(form, ingredientsMap),
    [form, ingredientsMap],
  );
  const prixTTC = Number.parseFloat(form.prixStr) || 0;
  const prHT = useMemo(
    () => prixHT(prixTTC, form.tauxTVA),
    [prixTTC, form.tauxTVA],
  );
  const margeCalc = useMemo(() => margeBrute(prHT, coutCalc), [prHT, coutCalc]);

  const canSave =
    !!form.nom &&
    !!form.prixStr &&
    !Number.isNaN(Number.parseFloat(form.prixStr)) &&
    (form.consommablesStr === "" ||
      !Number.isNaN(Number.parseFloat(form.consommablesStr)));

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
      consommablesHT: Number.parseFloat(form.consommablesStr) || 0,
      prixVenteTTC: Number.parseFloat(form.prixStr) || 0,
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

  const filteredRecettes = useMemo(() => {
    let list = recettes.map((r) => {
      const cout = coutMatiereHT(r, ingredientsMap);
      const ph = prixHT(r.prixVenteTTC, r.tauxTVA);
      const marge = margeBrute(ph, cout);
      return { r, cout, ph, marge };
    });
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (x) =>
          x.r.nom.toLowerCase().includes(q) ||
          x.r.categorie.toLowerCase().includes(q),
      );
    }
    if (filterCat !== "Toutes") {
      list = list.filter((x) => x.r.categorie === filterCat);
    }
    const min = fcMin !== "" ? Number.parseFloat(fcMin) : 0;
    const max = fcMax !== "" ? Number.parseFloat(fcMax) : 100;
    const foodCostOf = (x: { cout: number; ph: number }) =>
      x.ph > 0 ? (x.cout / x.ph) * 100 : 0;
    list = list.filter((x) => {
      const fc = foodCostOf(x);
      return fc >= min && fc <= max;
    });
    list.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;
      switch (sortField) {
        case "nom":
          valA = a.r.nom;
          valB = b.r.nom;
          break;
        case "categorie":
          valA = a.r.categorie;
          valB = b.r.categorie;
          break;
        case "tauxTVA":
          valA = a.r.tauxTVA;
          valB = b.r.tauxTVA;
          break;
        case "prixVenteTTC":
          valA = a.r.prixVenteTTC;
          valB = b.r.prixVenteTTC;
          break;
        case "marge":
          valA = a.marge;
          valB = b.marge;
          break;
        default:
          valA = a.r.nom;
          valB = b.r.nom;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [
    recettes,
    ingredientsMap,
    search,
    filterCat,
    sortField,
    sortDir,
    fcMin,
    fcMax,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecettes.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () =>
      filteredRecettes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRecettes, safePage],
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

  return (
    <div className="space-y-6" data-ocid="recettes.page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {/* Filtres */}
      <Card className="bg-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une recette..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-8"
                data-ocid="recettes.search_input"
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
                { value: "Toutes", label: "Toutes les catégories" },
                ...RECIPE_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
              value={filterCat}
              onChange={handleCatChange}
              placeholder="Catégorie"
              searchPlaceholder="Rechercher une catégorie…"
              className="w-[180px]"
              data-ocid="recettes.select"
            />
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="FC min %"
                value={fcMin}
                onChange={(e) => {
                  setFcMin(e.target.value);
                  setPage(1);
                }}
                className="w-[90px] text-sm"
                data-ocid="recettes.fc_min_input"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="FC max %"
                value={fcMax}
                onChange={(e) => {
                  setFcMax(e.target.value);
                  setPage(1);
                }}
                className="w-[90px] text-sm"
                data-ocid="recettes.fc_max_input"
              />
            </div>
            <Badge variant="secondary" className="text-xs px-3 py-1.5">
              {filteredRecettes.length} résultat
              {filteredRecettes.length !== 1 ? "s" : ""}
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
                onClick={() => toggleSort("categorie")}
              >
                Catégorie <SortIcon field="categorie" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/60"
                onClick={() => toggleSort("tauxTVA")}
              >
                TVA <SortIcon field="tauxTVA" />
              </TableHead>
              <TableHead className="text-right">Prix HT</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/60"
                onClick={() => toggleSort("prixVenteTTC")}
              >
                Prix TTC <SortIcon field="prixVenteTTC" />
              </TableHead>
              <TableHead className="text-right">Coût matière</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/60"
                onClick={() => toggleSort("marge")}
              >
                Marge <SortIcon field="marge" />
              </TableHead>
              <TableHead className="text-center">#Ing</TableHead>
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
            ) : filteredRecettes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground py-12"
                  data-ocid="recettes.empty_state"
                >
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>
                    {recettes.length === 0
                      ? "Aucune recette. Ajoutez vos plats et boissons."
                      : "Aucun résultat pour ce filtre."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ r, cout, ph, marge }, idx) => (
                <TableRow
                  key={r.id}
                  data-ocid={`recettes.item.${(safePage - 1) * PAGE_SIZE + idx + 1}`}
                >
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
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${margeBadge(marge)}`}
                    >
                      {fmtPct(marge)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {r.ingredients.length}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(r)}
                        data-ocid={`recettes.edit_button.${(safePage - 1) * PAGE_SIZE + idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setConfirmId(r.id)}
                        data-ocid={`recettes.delete_button.${(safePage - 1) * PAGE_SIZE + idx + 1}`}
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

      {/* Pagination */}
      {!isLoading && filteredRecettes.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {safePage} / {totalPages} — {filteredRecettes.length} résultat
            {filteredRecettes.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              data-ocid="recettes.pagination_prev"
            >
              ← Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              data-ocid="recettes.pagination_next"
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

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
                <SearchableSelect
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  value={form.categorie}
                  onChange={(v) => setForm((f) => ({ ...f, categorie: v }))}
                  placeholder="Catégorie"
                  searchPlaceholder="Rechercher…"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Taux TVA</Label>
                <SearchableSelect
                  options={TVA_OPTS.map((t) => ({
                    value: t.label,
                    label: t.label,
                  }))}
                  value={form.categorieTVA}
                  onChange={setTVA}
                  placeholder="TVA"
                  searchPlaceholder="Rechercher…"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Prix de vente TTC (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.prixStr}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      prixStr: e.target.value,
                      prixVenteTTC: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Consommables HT (€) — emballages, serviettes…</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.consommablesStr}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    consommablesStr: e.target.value,
                    consommablesHT: Number.parseFloat(e.target.value) || 0,
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
                const currentSearch = ingSearches[idx] ?? "";
                const isOpen = openIngIdx === idx;
                const filteredIngs = ingredients.filter((i) =>
                  i.nom.toLowerCase().includes(currentSearch.toLowerCase()),
                );
                const selectedIng = ingredientsMap.get(ri.ingredientId);
                return (
                  <div
                    key={`ri-${ri.ingredientId}-${idx}`}
                    className="flex gap-2 items-center"
                  >
                    {/* Custom combobox — ingredient selector with search */}
                    <div className="relative flex-1" ref={comboboxRef}>
                      <button
                        type="button"
                        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-ring"
                        onClick={() => setOpenIngIdx(isOpen ? null : idx)}
                        data-ocid={`recettes.ingredient_select.${idx + 1}`}
                      >
                        <span className="truncate text-left">
                          {selectedIng
                            ? `${selectedIng.nom} (${selectedIng.unite})`
                            : "Sélectionner…"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                      </button>
                      {isOpen && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                          <div className="p-2">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <input
                                className="w-full rounded border border-input bg-background pl-7 pr-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                                placeholder="Rechercher un ingrédient…"
                                value={currentSearch}
                                onChange={(e) =>
                                  setIngSearches((prev) => ({
                                    ...prev,
                                    [idx]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto pb-1">
                            {filteredIngs.length === 0 ? (
                              <p className="py-2 text-center text-xs text-muted-foreground">
                                Aucun résultat
                              </p>
                            ) : (
                              filteredIngs.map((i) => (
                                <button
                                  key={i.id}
                                  type="button"
                                  className={`flex w-full items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                                    i.id === ri.ingredientId
                                      ? "bg-accent/60 font-medium"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    updateLine(idx, {
                                      ingredientId: i.id,
                                      unite: i.unite,
                                    });
                                    setIngSearches((prev) => ({
                                      ...prev,
                                      [idx]: "",
                                    }));
                                    setOpenIngIdx(null);
                                  }}
                                >
                                  {i.nom}
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    ({i.unite})
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
                    <SearchableSelect
                      options={MEASUREMENT_UNITS.map((u) => ({
                        value: u,
                        label: u,
                      }))}
                      value={ri.unite}
                      onChange={(v) => updateLine(idx, { unite: v })}
                      placeholder="Unité"
                      searchPlaceholder="Unité…"
                      className="w-20"
                    />
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
