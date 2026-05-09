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
import {
  useCreateSalarie,
  useDeleteSalarie,
  useSalaries,
  useUpdateSalarie,
} from "@/hooks/useQueries";
import type { Salarie } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Charges patronales ≈ 42 % du brut ─────────────────────────────────────────
function calcSalarie(brut: number) {
  const cotisations = brut * 0.42;
  return { brut, cotisations, coutTotal: brut + cotisations };
}

type SortKey = "nom" | "poste" | "salaireAnnuelBrut" | "coutTotal";
type SortDir = "asc" | "desc";

interface SalarieForm {
  nom: string;
  poste: string;
  brutStr: string;
}

const emptyForm = (): SalarieForm => ({ nom: "", poste: "", brutStr: "" });

const SKELETON_ROWS = [0, 1, 2];

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== column)
    return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 inline h-3 w-3" />
  );
}

export default function SalairesCotisations() {
  const { data: salaries = [], isLoading } = useSalaries();
  const createMut = useCreateSalarie();
  const updateMut = useUpdateSalarie();
  const deleteMut = useDeleteSalarie();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Salarie | null>(null);
  const [form, setForm] = useState<SalarieForm>(emptyForm());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(s: Salarie) {
    setEditing(s);
    setForm({
      nom: s.nom,
      poste: s.poste,
      brutStr: s.salaireAnnuelBrut === 0 ? "" : String(s.salaireAnnuelBrut),
    });
    setOpen(true);
  }

  async function handleSave() {
    const data: Omit<Salarie, "id"> = {
      nom: form.nom.trim(),
      poste: form.poste.trim(),
      salaireAnnuelBrut: Number.parseFloat(form.brutStr) || 0,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ ...data, id: editing.id });
        toast.success("Salarié mis à jour");
      } else {
        await createMut.mutateAsync(data);
        toast.success("Salarié créé");
      }
      setOpen(false);
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Salarié supprimé");
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalMasseSalariale = salaries.reduce(
    (sum, s) => sum + calcSalarie(s.salaireAnnuelBrut).coutTotal,
    0,
  );
  const totalBrut = salaries.reduce((sum, s) => sum + s.salaireAnnuelBrut, 0);
  const totalCotisations = totalMasseSalariale - totalBrut;

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? salaries.filter(
          (s) =>
            s.nom.toLowerCase().includes(q) ||
            s.poste.toLowerCase().includes(q),
        )
      : salaries;
    return [...filtered].sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "coutTotal") {
        va = calcSalarie(a.salaireAnnuelBrut).coutTotal;
        vb = calcSalarie(b.salaireAnnuelBrut).coutTotal;
      } else {
        va = a[sortKey];
        vb = b[sortKey];
      }
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc"
          ? va.localeCompare(vb, "fr")
          : vb.localeCompare(va, "fr");
      }
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
  }, [salaries, search, sortKey, sortDir]);

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              Salariés &amp; Cotisations
            </h2>
            <p className="text-sm text-muted-foreground">
              Charges patronales estimées à 42 % du salaire brut
            </p>
          </div>
        </div>
        <Button onClick={openAdd} data-ocid="salaries.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un salarié
        </Button>
      </div>

      {/* ── Cartes récapitulatives ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Effectif total
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{salaries.length}</p>
            <p className="text-xs text-muted-foreground">salariés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Masse salariale brute / an
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmtEur(totalBrut)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtEur(totalBrut / 12)} / mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Charges patronales / an
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-destructive">
              {fmtEur(totalCotisations)}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtEur(totalCotisations / 12)} / mois
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Coût total employeur / an
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmtEur(totalMasseSalariale)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtEur(totalMasseSalariale / 12)} / mois
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Barre de recherche ────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou poste…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-ocid="salaries.search_input"
        />
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("nom")}
              >
                Nom{" "}
                <SortIcon column="nom" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort("poste")}
              >
                Poste
                <SortIcon column="poste" sortKey={sortKey} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => toggleSort("salaireAnnuelBrut")}
              >
                Salaire brut / an
                <SortIcon
                  column="salaireAnnuelBrut"
                  sortKey={sortKey}
                  sortDir={sortDir}
                />
              </TableHead>
              <TableHead className="text-right">Charges (42 %)</TableHead>
              <TableHead
                className="text-right cursor-pointer select-none"
                onClick={() => toggleSort("coutTotal")}
              >
                Coût total / an
                <SortIcon
                  column="coutTotal"
                  sortKey={sortKey}
                  sortDir={sortDir}
                />
              </TableHead>
              <TableHead className="text-right">Coût / mois</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              SKELETON_ROWS.map((r) => (
                <TableRow key={r}>
                  {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayed.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-12"
                  data-ocid="salaries.empty_state"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Users className="h-10 w-10 opacity-20" />
                    <p className="font-medium">
                      {search
                        ? "Aucun résultat pour cette recherche"
                        : "Aucun salarié enregistré"}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAdd}
                        data-ocid="salaries.empty_add_button"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter un
                        salarié
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayed.map((s, idx) => {
                const calc = calcSalarie(s.salaireAnnuelBrut);
                return (
                  <TableRow
                    key={s.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-ocid={`salaries.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium">{s.nom}</TableCell>
                    <TableCell>
                      {s.poste ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {s.poste}
                        </Badge>
                      ) : (
                        <span className="italic text-muted-foreground opacity-50">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtEur(s.salaireAnnuelBrut)}
                    </TableCell>
                    <TableCell className="text-right text-destructive tabular-nums">
                      {fmtEur(calc.cotisations)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtEur(calc.coutTotal)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {fmtEur(calc.coutTotal / 12)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(s)}
                          data-ocid={`salaries.edit_button.${idx + 1}`}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s.id)}
                          data-ocid={`salaries.delete_button.${idx + 1}`}
                          aria-label="Supprimer"
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
        {!isLoading && displayed.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              {displayed.length} salarié{displayed.length > 1 ? "s" : ""}
              {search && salaries.length !== displayed.length
                ? ` sur ${salaries.length}`
                : ""}
            </span>
            <span>Coût total : {fmtEur(totalMasseSalariale / 12)} / mois</span>
          </div>
        )}
      </div>

      {/* ── Dialog ajout / édition ────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="salaries.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le salarié" : "Nouveau salarié"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sal-nom">Nom complet</Label>
              <Input
                id="sal-nom"
                placeholder="ex : Marie Dupont"
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="salaries.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sal-poste">Poste</Label>
              <Input
                id="sal-poste"
                placeholder="ex : Commis de cuisine"
                value={form.poste}
                onChange={(e) =>
                  setForm((f) => ({ ...f, poste: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sal-brut">Salaire annuel brut (€)</Label>
              <Input
                id="sal-brut"
                type="text"
                inputMode="decimal"
                placeholder="ex : 24000"
                value={form.brutStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brutStr: e.target.value }))
                }
              />
            </div>

            {form.brutStr &&
              (() => {
                const c = calcSalarie(Number.parseFloat(form.brutStr) || 0);
                return (
                  <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Charges patronales (42 %)
                      </span>
                      <strong className="text-destructive">
                        {fmtEur(c.cotisations)}
                      </strong>
                    </div>
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="font-medium">Coût total annuel</span>
                      <strong>{fmtEur(c.coutTotal)}</strong>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      Soit {fmtEur(c.coutTotal / 12)} / mois
                    </p>
                  </div>
                );
              })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="salaries.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !form.nom.trim()}
              data-ocid="salaries.submit_button"
            >
              {isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
