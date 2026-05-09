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
  calcMensualite,
  capitalRestantApresNMois,
  coutTotalEmprunt,
  totalInterets,
} from "@/core/utils/finance";
import {
  type Emprunt,
  useCreateEmprunt,
  useDeleteEmprunt,
  useEmprunts,
  useUpdateEmprunt,
} from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import {
  ChevronDown,
  ChevronRight,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────────
interface LignTableau {
  mois: number;
  capitalDebut: number;
  mensualite: number;
  interets: number;
  capitalRembourse: number;
  capitalFin: number;
}

interface EmpruntForm {
  nom: string;
  montantStr: string;
  tauxStr: string;
  dureeStr: string;
  dateDebut: string;
  differeStr: string;
}

const emptyForm = (): EmpruntForm => ({
  nom: "",
  montantStr: "",
  tauxStr: "",
  dureeStr: "",
  dateDebut: new Date().toISOString().slice(0, 10),
  differeStr: "0",
});

function formFromEmprunt(e: Emprunt): EmpruntForm {
  return {
    nom: e.nom,
    montantStr: e.montant === 0 ? "" : String(e.montant),
    tauxStr: e.tauxAnnuel === 0 ? "" : String(e.tauxAnnuel),
    dureeStr: e.dureeMois === 0n ? "" : String(Number(e.dureeMois)),
    dateDebut: e.dateDebut,
    differeStr: String(Number(e.differeMois)),
  };
}

// ── Local amortization table calculation ───────────────────────────────────────

function buildTableau(emprunt: Emprunt): LignTableau[] {
  const dureeMois = Number(emprunt.dureeMois);
  const mensualite = calcMensualite(
    emprunt.montant,
    emprunt.tauxAnnuel,
    dureeMois,
  );
  const tauxMensuel = emprunt.tauxAnnuel / 100 / 12;
  const lignes: LignTableau[] = [];
  let capital = emprunt.montant;

  for (let i = 0; i < dureeMois; i++) {
    const interets = capital * tauxMensuel;
    const capitalRembourse = mensualite - interets;
    const capitalFin = Math.max(0, capital - capitalRembourse);
    lignes.push({
      mois: i + 1,
      capitalDebut: capital,
      mensualite,
      interets,
      capitalRembourse,
      capitalFin,
    });
    capital = capitalFin;
  }
  return lignes;
}

const SKELETON_ROWS = [0, 1, 2];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Emprunts() {
  const { data: emprunts = [], isLoading } = useEmprunts();
  const createMut = useCreateEmprunt();
  const updateMut = useUpdateEmprunt();
  const deleteMut = useDeleteEmprunt();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Emprunt | null>(null);
  const [form, setForm] = useState<EmpruntForm>(emptyForm());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const mensualitePreview = calcMensualite(
    Number.parseFloat(form.montantStr) || 0,
    Number.parseFloat(form.tauxStr) || 0,
    Number.parseInt(form.dureeStr) || 0,
  );

  // KPI aggregates
  const kpis = useMemo(() => {
    const totalMensuel = emprunts.reduce(
      (s, e) =>
        s + calcMensualite(e.montant, e.tauxAnnuel, Number(e.dureeMois)),
      0,
    );
    const totalCapital = emprunts.reduce((s, e) => s + e.montant, 0);
    const totalInteretsCumul = emprunts.reduce(
      (s, e) => s + totalInterets(e),
      0,
    );
    const totalCout = emprunts.reduce((s, e) => s + coutTotalEmprunt(e), 0);
    return { totalMensuel, totalCapital, totalInteretsCumul, totalCout };
  }, [emprunts]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(e: Emprunt) {
    setEditing(e);
    setForm(formFromEmprunt(e));
    setOpen(true);
  }

  async function handleSave() {
    const montant = Number.parseFloat(form.montantStr) || 0;
    const tauxAnnuel = Number.parseFloat(form.tauxStr) || 0;
    const dureeMois = BigInt(Number.parseInt(form.dureeStr) || 0);
    const differeMois = BigInt(Number.parseInt(form.differeStr) || 0);
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          nom: form.nom,
          montant,
          tauxAnnuel,
          dureeMois,
          dateDebut: form.dateDebut,
          differeMois,
        });
        toast.success("Emprunt mis à jour");
      } else {
        await createMut.mutateAsync({
          nom: form.nom,
          montant,
          tauxAnnuel,
          dureeMois,
          dateDebut: form.dateDebut,
          differeMois,
        });
        toast.success("Emprunt créé");
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
      toast.success("Emprunt supprimé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  const set =
    (k: keyof EmpruntForm) => (ev: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: ev.target.value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Emprunts</h2>
          <p className="text-sm text-muted-foreground">
            Suivi des emprunts bancaires et mensualités
          </p>
        </div>
        <Button onClick={openAdd} data-ocid="emprunts.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {/* KPI cards */}
      {emprunts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Total mensualités
              </p>
              <p className="text-xl font-bold text-primary">
                {fmtEur(kpis.totalMensuel)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Capital total
              </p>
              <p className="text-xl font-bold">{fmtEur(kpis.totalCapital)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Intérêts cumulés
              </p>
              <p className="text-xl font-bold text-destructive">
                {fmtEur(kpis.totalInteretsCumul)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Coût total</p>
              <p className="text-xl font-bold">{fmtEur(kpis.totalCout)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : emprunts.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
          data-ocid="emprunts.empty_state"
        >
          <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Aucun emprunt enregistré</p>
          <p className="text-xs">
            Ajoutez vos prêts bancaires pour suivre vos mensualités.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-3">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Tableau des emprunts
              <Badge variant="secondary">
                {emprunts.length} emprunt{emprunts.length > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-8" />
                    <TableHead className="min-w-[160px]">Nom</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Taux annuel</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead>Date début</TableHead>
                    <TableHead className="text-right">Mensualité</TableHead>
                    <TableHead className="text-right">
                      Intérêts totaux
                    </TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emprunts.map((e, idx) => {
                    const mensualite = calcMensualite(
                      e.montant,
                      e.tauxAnnuel,
                      Number(e.dureeMois),
                    );
                    const interetsTotaux = totalInterets(e);
                    const isExpanded = expandedId === e.id;
                    const tableau = isExpanded ? buildTableau(e) : [];

                    return (
                      <>
                        <TableRow
                          key={e.id}
                          data-ocid={`emprunts.item.${idx + 1}`}
                          className="cursor-pointer hover:bg-muted/20"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : e.id)
                          }
                        >
                          <TableCell className="w-8 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{e.nom}</TableCell>
                          <TableCell className="text-right">
                            {fmtEur(e.montant)}
                          </TableCell>
                          <TableCell className="text-right">
                            {e.tauxAnnuel} %
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(e.dureeMois)} mois
                          </TableCell>
                          <TableCell className="text-sm">
                            {e.dateDebut}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {fmtEur(mensualite)}
                          </TableCell>
                          <TableCell className="text-right text-destructive text-sm">
                            {fmtEur(interetsTotaux)}
                          </TableCell>
                          <TableCell onClick={(ev) => ev.stopPropagation()}>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(e)}
                                data-ocid={`emprunts.edit_button.${idx + 1}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(e.id)}
                                data-ocid={`emprunts.delete_button.${idx + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable amortization table */}
                        {isExpanded && (
                          <TableRow
                            key={`${e.id}-expanded`}
                            className="bg-muted/10"
                          >
                            <TableCell colSpan={9} className="p-0">
                              <div className="overflow-x-auto border-t border-border/50">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/20 text-xs">
                                      <TableHead className="py-2">
                                        Mois
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Capital début
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Mensualité
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Intérêts
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Capital remboursé
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Capital fin
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {tableau.map((l) => (
                                      <TableRow
                                        key={l.mois}
                                        className="text-xs hover:bg-transparent"
                                      >
                                        <TableCell className="py-1.5 font-medium">
                                          {l.mois}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5">
                                          {fmtEur(l.capitalDebut)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5 text-primary">
                                          {fmtEur(l.mensualite)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5 text-destructive">
                                          {fmtEur(l.interets)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5">
                                          {fmtEur(l.capitalRembourse)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5">
                                          {fmtEur(l.capitalFin)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="emprunts.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'emprunt" : "Nouvel emprunt"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Nom de l'emprunt</Label>
              <Input
                placeholder="Ex : Prêt matériel de cuisine"
                value={form.nom}
                onChange={set("nom")}
                data-ocid="emprunts.input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Montant (€)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.montantStr}
                  onChange={set("montantStr")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Taux annuel (%)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="3.5"
                  value={form.tauxStr}
                  onChange={set("tauxStr")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Durée (mois)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="60"
                  value={form.dureeStr}
                  onChange={set("dureeStr")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Différé (mois)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.differeStr}
                  onChange={set("differeStr")}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Date de début</Label>
              <Input
                type="date"
                value={form.dateDebut}
                onChange={set("dateDebut")}
              />
            </div>
            {form.montantStr && form.dureeStr && (
              <div className="rounded-md bg-primary/10 border border-primary/20 px-4 py-2 space-y-1">
                <p className="text-sm font-medium text-primary">
                  Mensualité estimée : {fmtEur(mensualitePreview)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Coût total :{" "}
                  {fmtEur(
                    mensualitePreview * (Number.parseInt(form.dureeStr) || 0),
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-ocid="emprunts.cancel_button"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isPending || !form.nom || !form.montantStr || !form.dureeStr
              }
              data-ocid="emprunts.submit_button"
            >
              {isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
