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
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Charges patronales ≈ 42 % du brut ────────────────────────────────────────
function calcSalarie(brut: number) {
  const cotisations = brut * 0.42;
  return {
    brut,
    cotisations,
    coutTotal: brut + cotisations,
  };
}

interface SalarieForm {
  nom: string;
  poste: string;
  brutStr: string;
}

const emptyForm = (): SalarieForm => ({ nom: "", poste: "", brutStr: "" });

const SKELETON_ROWS = [0, 1, 2];

export default function SalairesCotisations() {
  const { data: salaries = [], isLoading } = useSalaries();
  const createMut = useCreateSalarie();
  const updateMut = useUpdateSalarie();
  const deleteMut = useDeleteSalarie();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Salarie | null>(null);
  const [form, setForm] = useState<SalarieForm>(emptyForm());

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
      nom: form.nom,
      poste: form.poste,
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

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalMasseSalariale = salaries.reduce(
    (sum, s) => sum + calcSalarie(s.salaireAnnuelBrut).coutTotal,
    0,
  );
  const totalBrut = salaries.reduce((sum, s) => sum + s.salaireAnnuelBrut, 0);

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
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

      {/* ── Cartes récapitulatives ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Nombre de salariés
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{salaries.length}</p>
            <p className="text-xs text-muted-foreground">employés</p>
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

      {/* ── Tableau ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead className="text-right">Salaire annuel brut</TableHead>
              <TableHead className="text-right">
                Charges patronales (~42 %)
              </TableHead>
              <TableHead className="text-right">Coût total annuel</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              SKELETON_ROWS.map((r) => (
                <TableRow key={r}>
                  {[0, 1, 2, 3, 4, 5].map((c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : salaries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-10"
                  data-ocid="salaries.empty_state"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-30" />
                    <p>Aucun salarié enregistré.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openAdd}
                      data-ocid="salaries.empty_add_button"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter un salarié
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              salaries.map((s, idx) => {
                const calc = calcSalarie(s.salaireAnnuelBrut);
                return (
                  <TableRow key={s.id} data-ocid={`salaries.item.${idx + 1}`}>
                    <TableCell className="font-medium">{s.nom}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.poste || <span className="italic opacity-50">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(s.salaireAnnuelBrut)}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {fmtEur(calc.cotisations)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmtEur(calc.coutTotal)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(s)}
                          data-ocid={`salaries.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(s.id)}
                          data-ocid={`salaries.delete_button.${idx + 1}`}
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

      {/* ── Dialog ajout / édition ───────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="salaries.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le salarié" : "Nouveau salarié"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sal-nom">Nom</Label>
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
                placeholder="0"
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
                  <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                    <p>
                      Charges patronales (42 %) :{" "}
                      <strong>{fmtEur(c.cotisations)}</strong>
                    </p>
                    <p>
                      Coût total annuel : <strong>{fmtEur(c.coutTotal)}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
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
              disabled={isPending || !form.nom}
              data-ocid="salaries.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
