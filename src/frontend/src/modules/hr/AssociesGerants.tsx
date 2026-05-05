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
  useAssociesGerants,
  useCreateAssocieGerant,
  useDeleteAssocieGerant,
  useParametresJuridiques,
  useUpdateAssocieGerant,
} from "@/hooks/useQueries";
import type { AssocieGerant } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function calcTNS(net: number) {
  return { net, cotisations: net * 0.45, coutTotal: net * 1.45 };
}

function calcAssimile(brut: number) {
  return {
    brut,
    chargesSalariales: brut * 0.22,
    net: brut * 0.78,
    chargesPatronales: brut * 0.42,
    coutEmployeur: brut * 1.42,
  };
}

interface AssocieForm {
  nom: string;
  statut: string;
  remuStr: string;
}

const emptyForm = (statut = "TNS"): AssocieForm => ({
  nom: "",
  statut,
  remuStr: "",
});

const SKELETON_ROWS = [0, 1, 2];

export default function AssociesGerants() {
  const { data: parametres } = useParametresJuridiques();
  const defaultStatut = parametres?.regimeSocial ?? "TNS";
  const { data: associes = [], isLoading } = useAssociesGerants();
  const createMut = useCreateAssocieGerant();
  const updateMut = useUpdateAssocieGerant();
  const deleteMut = useDeleteAssocieGerant();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssocieGerant | null>(null);
  const [form, setForm] = useState<AssocieForm>(emptyForm(defaultStatut));

  function openAdd() {
    setEditing(null);
    setForm(emptyForm(defaultStatut));
    setOpen(true);
  }

  function openEdit(a: AssocieGerant) {
    setEditing(a);
    setForm({
      nom: a.nom,
      statut: a.statut,
      remuStr:
        a.remunerationAnnuelle === 0 ? "" : String(a.remunerationAnnuelle),
    });
    setOpen(true);
  }

  async function handleSave() {
    const data: Omit<AssocieGerant, "id"> = {
      nom: form.nom,
      statut: form.statut,
      remunerationAnnuelle: Number.parseFloat(form.remuStr) || 0,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ ...data, id: editing.id });
        toast.success("Associé mis à jour");
      } else {
        await createMut.mutateAsync(data);
        toast.success("Associé créé");
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
      toast.success("Associé supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalRemunerations = associes.reduce(
    (sum, a) => sum + a.remunerationAnnuelle,
    0,
  );
  const totalCharges = associes.reduce((sum, a) => {
    const remu = a.remunerationAnnuelle;
    return (
      sum +
      (a.statut === "TNS"
        ? calcTNS(remu).cotisations
        : calcAssimile(remu).chargesSalariales +
          calcAssimile(remu).chargesPatronales)
    );
  }, 0);
  const totalCout = associes.reduce((sum, a) => {
    const remu = a.remunerationAnnuelle;
    return (
      sum +
      (a.statut === "TNS"
        ? calcTNS(remu).coutTotal
        : calcAssimile(remu).coutEmployeur)
    );
  }, 0);

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Associés &amp; Gérants</h2>
            <p className="text-sm text-muted-foreground">
              Rémunération et charges sociales des dirigeants
            </p>
          </div>
        </div>
        <Button onClick={openAdd} data-ocid="associes.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {/* ── Cartes récapitulatives ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Nombre d'associés / gérants
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{associes.length}</p>
            <p className="text-xs text-muted-foreground">dirigeants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total rémunérations / an
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmtEur(totalRemunerations)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtEur(totalRemunerations / 12)} / mois
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Coût total charges + rémunérations / an
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmtEur(totalCout)}</p>
            <p className="text-xs text-muted-foreground">
              dont {fmtEur(totalCharges)} de charges
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">
                Rémunération annuelle
              </TableHead>
              <TableHead className="text-right">Charges sociales</TableHead>
              <TableHead className="text-right">Coût total</TableHead>
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
            ) : associes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-10"
                  data-ocid="associes.empty_state"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 opacity-30" />
                    <p>Aucun associé/gérant. Cliquez sur Ajouter.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              associes.map((a, idx) => {
                const remu = a.remunerationAnnuelle;
                const isTNS = a.statut === "TNS";
                const tns = calcTNS(remu);
                const assimile = calcAssimile(remu);
                const charges = isTNS
                  ? tns.cotisations
                  : assimile.chargesSalariales + assimile.chargesPatronales;
                const cout = isTNS ? tns.coutTotal : assimile.coutEmployeur;
                return (
                  <TableRow key={a.id} data-ocid={`associes.item.${idx + 1}`}>
                    <TableCell className="font-medium">{a.nom}</TableCell>
                    <TableCell>
                      <Badge
                        variant={isTNS ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {isTNS ? "TNS" : "Assimilé sal."}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p>{fmtEur(remu)}</p>
                        <p className="text-xs text-muted-foreground">
                          {isTNS ? "net" : "brut"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {fmtEur(charges)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmtEur(cout)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(a)}
                          data-ocid={`associes.edit_button.${idx + 1}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(a.id)}
                          data-ocid={`associes.delete_button.${idx + 1}`}
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

      {/* ── Dialog ajout / édition ──────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="associes.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'associé/gérant" : "Nouvel associé/gérant"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-nom">Nom</Label>
              <Input
                id="assoc-nom"
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="associes.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-statut">Statut social</Label>
              <Select
                value={form.statut}
                onValueChange={(v) => setForm((f) => ({ ...f, statut: v }))}
              >
                <SelectTrigger id="assoc-statut" data-ocid="associes.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TNS">
                    TNS — Travailleur Non Salarié
                  </SelectItem>
                  <SelectItem value="assimile">Assimilé salarié</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-remu">
                {form.statut === "TNS"
                  ? "Rémunération nette souhaitée (€ / an)"
                  : "Salaire brut (€ / an)"}
              </Label>
              <Input
                id="assoc-remu"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={form.remuStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remuStr: e.target.value }))
                }
              />
            </div>
            {form.remuStr && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                {form.statut === "TNS" ? (
                  <>
                    <p>
                      Cotisations TNS (45 %) :{" "}
                      <strong>
                        {fmtEur(
                          calcTNS(Number.parseFloat(form.remuStr) || 0)
                            .cotisations,
                        )}
                      </strong>
                    </p>
                    <p>
                      Coût total :{" "}
                      <strong>
                        {fmtEur(
                          calcTNS(Number.parseFloat(form.remuStr) || 0)
                            .coutTotal,
                        )}
                      </strong>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Net perçu :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(Number.parseFloat(form.remuStr) || 0)
                            .net,
                        )}
                      </strong>
                    </p>
                    <p>
                      Charges salariales :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(Number.parseFloat(form.remuStr) || 0)
                            .chargesSalariales,
                        )}
                      </strong>
                    </p>
                    <p>
                      Charges patronales :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(Number.parseFloat(form.remuStr) || 0)
                            .chargesPatronales,
                        )}
                      </strong>
                    </p>
                    <p>
                      Coût employeur :{" "}
                      <strong>
                        {fmtEur(
                          calcAssimile(Number.parseFloat(form.remuStr) || 0)
                            .coutEmployeur,
                        )}
                      </strong>
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="associes.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !form.nom}
              data-ocid="associes.submit_button"
            >
              {isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
