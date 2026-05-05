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
  useAmortissements,
  useCreateAmortissement,
  useDeleteAmortissement,
  useUpdateAmortissement,
} from "@/hooks/useQueries";
import type { LigneAmortissement } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const YEARS_N = [1, 2, 3, 4, 5];

function getDotationAnnuelle(a: LigneAmortissement, year: number): number {
  const dureeAns = Number(a.dureeMois);
  if (dureeAns <= 0) return 0;
  return year <= dureeAns ? a.coutTotal / dureeAns : 0;
}

interface AmortForm {
  nom: string;
  coutStr: string;
  dureeStr: string;
}

const emptyForm = (): AmortForm => ({ nom: "", coutStr: "", dureeStr: "" });

const SKELETON_ROWS = [0, 1, 2];

export default function Amortissements() {
  const { data: amortissements = [], isLoading } = useAmortissements();
  const createMut = useCreateAmortissement();
  const updateMut = useUpdateAmortissement();
  const deleteMut = useDeleteAmortissement();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LigneAmortissement | null>(null);
  const [form, setForm] = useState<AmortForm>(emptyForm());

  const amortissables = amortissements.filter((a) => Number(a.dureeMois) > 0);
  const totalParAnnee = YEARS_N.map((n) =>
    amortissables.reduce((sum, a) => sum + getDotationAnnuelle(a, n), 0),
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(a: LigneAmortissement) {
    setEditing(a);
    setForm({
      nom: a.nom,
      coutStr: a.coutTotal === 0 ? "" : String(a.coutTotal),
      dureeStr: a.dureeMois === 0n ? "" : String(a.dureeMois),
    });
    setOpen(true);
  }

  async function handleSave() {
    const cout = Number.parseFloat(form.coutStr) || 0;
    const duree = Number.parseInt(form.dureeStr) || 0;
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          nom: form.nom,
          coutTotal: cout,
          dureeMois: BigInt(duree),
        });
        toast.success("Amortissement mis à jour");
      } else {
        await createMut.mutateAsync({
          nom: form.nom,
          coutTotal: cout,
          dureeMois: BigInt(duree),
        });
        toast.success("Amortissement créé");
      }
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Amortissement supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Amortissements</h2>
          <p className="text-sm text-muted-foreground">
            Plan d'amortissement linéaire sur 5 ans
          </p>
        </div>
        <Button onClick={openAdd} data-ocid="amortissements.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : amortissables.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
          data-ocid="amortissements.empty_state"
        >
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucun bien amortissable enregistré.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Plan d'amortissement sur 5 ans
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[180px]">Désignation</TableHead>
                    <TableHead className="text-right">Coût total</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    {YEARS_N.map((n) => (
                      <TableHead key={n} className="text-right">
                        Année {n}
                      </TableHead>
                    ))}
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amortissables.map((a, idx) => {
                    const dureeAns = Number(a.dureeMois);
                    const dotation = a.coutTotal / dureeAns;
                    return (
                      <TableRow
                        key={a.id}
                        data-ocid={`amortissements.item.${idx + 1}`}
                      >
                        <TableCell className="font-medium">{a.nom}</TableCell>
                        <TableCell className="text-right">
                          {fmtEur(a.coutTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {dureeAns} an{dureeAns > 1 ? "s" : ""}
                        </TableCell>
                        {YEARS_N.map((n) => (
                          <TableCell
                            key={n}
                            className={`text-right text-sm ${
                              n <= dureeAns
                                ? "font-medium text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            {n <= dureeAns ? fmtEur(dotation) : "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(a)}
                              data-ocid={`amortissements.edit_button.${idx + 1}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(a.id)}
                              data-ocid={`amortissements.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/40 font-bold border-t-2">
                    <TableCell colSpan={3}>TOTAL DOTATIONS</TableCell>
                    {YEARS_N.map((n, i) => (
                      <TableCell key={n} className="text-right font-bold">
                        {fmtEur(totalParAnnee[i] ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="amortissements.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'amortissement" : "Nouvel amortissement"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Désignation du bien</Label>
              <Input
                placeholder="Ex : Four professionnel"
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="amortissements.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Coût total HT (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={form.coutStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, coutStr: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>
                Durée d'amortissement (années, 0 = non amortissable)
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="5"
                value={form.dureeStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dureeStr: e.target.value }))
                }
              />
              {form.coutStr && form.dureeStr && Number(form.dureeStr) > 0 && (
                <p className="text-xs text-primary font-medium">
                  Dotation annuelle :{" "}
                  {fmtEur(
                    (Number.parseFloat(form.coutStr) || 0) /
                      (Number.parseInt(form.dureeStr) || 1),
                  )}{" "}
                  / an
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="amortissements.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !form.nom || !form.coutStr}
              data-ocid="amortissements.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
