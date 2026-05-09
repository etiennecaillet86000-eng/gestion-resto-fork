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
import { SearchableSelect } from "@/core/ui/SearchableSelect";
import {
  type LigneFraisFixes,
  useFraisFixes,
  useSaveFraisFixes,
} from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { LayoutList, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ── Catégories & badges ───────────────────────────────────────────────────────

const CATEGORIES = [
  "Loyer",
  "Énergie",
  "Assurance",
  "Abonnement SaaS",
  "Marketing",
  "Honoraires",
  "Autre",
] as const;

type Categorie = (typeof CATEGORIES)[number];

const CATEGORIE_BADGE: Record<Categorie, string> = {
  Loyer: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Énergie: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Assurance: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Abonnement SaaS": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  Marketing: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Honoraires: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  Autre: "bg-muted text-muted-foreground border-border",
};

// ── Form state ────────────────────────────────────────────────────────────────

interface FraisForm {
  nom: string;
  categorie: Categorie;
  /** Single monthly amount — maps to montantMensuelAvecRemu */
  montantMensuelStr: string;
}

const emptyForm = (): FraisForm => ({
  nom: "",
  categorie: "Autre",
  montantMensuelStr: "",
});

const SKELETON_ROWS = [0, 1, 2, 3, 4];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FraisFixes() {
  const { data: lignes = [], isLoading } = useFraisFixes();
  const saveMut = useSaveFraisFixes();

  // Local editable copy (allows CRUD-style add/remove/edit)
  const [rows, setRows] = useState<LigneFraisFixes[]>([]);
  const [dirty, setDirty] = useState(false);

  // Dialog state
  const [open, setOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<FraisForm>(emptyForm());

  useEffect(() => {
    if (lignes.length > 0 && !dirty) {
      setRows(lignes);
    }
  }, [lignes, dirty]);

  // KPI totals — use montantMensuelAvecRemu (complete monthly cost)
  const totalMensuel = useMemo(
    () => rows.reduce((s, r) => s + r.montantMensuelAvecRemu, 0),
    [rows],
  );

  function openAdd() {
    setEditingIdx(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(idx: number) {
    const row = rows[idx];
    if (!row) return;
    setEditingIdx(idx);
    setForm({
      nom: row.nom,
      categorie: (CATEGORIES.includes(row.nom as Categorie)
        ? row.nom
        : "Autre") as Categorie,
      montantMensuelStr:
        row.montantMensuelAvecRemu === 0
          ? ""
          : String(row.montantMensuelAvecRemu),
    });
    setOpen(true);
  }

  function handleDialogSave() {
    const montant = Number.parseFloat(form.montantMensuelStr) || 0;
    const newRow: LigneFraisFixes = {
      nom: form.nom.trim() || form.categorie,
      montantMensuelHorsRemu: montant,
      montantMensuelAvecRemu: montant,
    };
    if (editingIdx !== null) {
      setRows((prev) => prev.map((r, i) => (i === editingIdx ? newRow : r)));
    } else {
      setRows((prev) => [...prev, newRow]);
    }
    setDirty(true);
    setOpen(false);
  }

  function handleDelete(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  async function handleSave() {
    try {
      await saveMut.mutateAsync(rows);
      setDirty(false);
      toast.success("Frais fixes sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  function getCategorieBadge(nom: string): string {
    const cat = CATEGORIES.find((c) => c === nom) as Categorie | undefined;
    return cat
      ? (CATEGORIE_BADGE[cat] ?? CATEGORIE_BADGE.Autre)
      : CATEGORIE_BADGE.Autre;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Frais Fixes</h2>
          <p className="text-sm text-muted-foreground">
            Charges structurelles mensuelles et annuelles
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={openAdd}
            data-ocid="frais-fixes.open_modal_button"
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saveMut.isPending}
            data-ocid="frais-fixes.save_button"
          >
            {saveMut.isPending ? "Sauvegarde…" : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {/* KPI cards — 2 columns only */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Total Mensuel
              </p>
              <p className="text-xl font-bold text-primary">
                {fmtEur(totalMensuel)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Annuel</p>
              <p className="text-xl font-bold">{fmtEur(totalMensuel * 12)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main table */}
      {isLoading ? (
        <div className="space-y-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
          data-ocid="frais-fixes.empty_state"
        >
          <LayoutList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Aucun frais fixe enregistré</p>
          <p className="text-xs">
            Cliquez sur « Ajouter » pour saisir vos charges structurelles.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Détail des charges par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[130px]">Catégorie</TableHead>
                    <TableHead className="min-w-[180px]">Libellé</TableHead>
                    <TableHead className="text-right min-w-[160px]">
                      Mensuel
                    </TableHead>
                    <TableHead className="text-right min-w-[150px]">
                      Annuel
                    </TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={`${row.nom}-${idx}`}
                      data-ocid={`frais-fixes.item.${idx + 1}`}
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${getCategorieBadge(row.nom)}`}
                        >
                          {CATEGORIES.includes(row.nom as Categorie)
                            ? row.nom
                            : "Autre"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {row.nom}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {fmtEur(row.montantMensuelAvecRemu)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtEur(row.montantMensuelAvecRemu * 12)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(idx)}
                            data-ocid={`frais-fixes.edit_button.${idx + 1}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(idx)}
                            data-ocid={`frais-fixes.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/40 border-t-2">
                    <TableCell className="font-bold" colSpan={2}>
                      TOTAL
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {fmtEur(totalMensuel)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtEur(totalMensuel * 12)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="frais-fixes.dialog">
          <DialogHeader>
            <DialogTitle>
              {editingIdx !== null
                ? "Modifier le frais fixe"
                : "Ajouter un frais fixe"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Catégorie</Label>
              <SearchableSelect
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                value={form.categorie}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    categorie: v as Categorie,
                    nom: f.nom || v,
                  }))
                }
                placeholder="Choisir une catégorie"
                searchPlaceholder="Rechercher une catégorie…"
                data-ocid="frais-fixes.select"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Libellé (optionnel)</Label>
              <Input
                placeholder={form.categorie}
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="frais-fixes.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Montant mensuel €</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={form.montantMensuelStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, montantMensuelStr: e.target.value }))
                }
                data-ocid="frais-fixes.montant_input"
              />
            </div>
            {form.montantMensuelStr && (
              <div className="rounded-md bg-primary/10 border border-primary/20 px-4 py-2 text-sm">
                <span className="text-muted-foreground">Impact annuel : </span>
                <span className="font-semibold text-primary">
                  {fmtEur(
                    (Number.parseFloat(form.montantMensuelStr) || 0) * 12,
                  )}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="frais-fixes.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleDialogSave}
              disabled={!form.nom.trim() && form.categorie === "Autre"}
              data-ocid="frais-fixes.submit_button"
            >
              {editingIdx !== null ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
