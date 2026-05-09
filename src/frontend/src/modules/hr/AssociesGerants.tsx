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
  useAssociesGerants,
  useCreateAssocieGerant,
  useDeleteAssocieGerant,
  useParametresJuridiques,
  useUpdateAssocieGerant,
} from "@/hooks/useQueries";
import type { AssocieGerant } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Building2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Calculs charges sociales ────────────────────────────────────────────────
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

const STATUT_OPTIONS = [
  { value: "TNS", label: "TNS — Travailleur Non Salarié" },
  { value: "assimile", label: "Assimilé salarié" },
] as const;

const STATUT_BADGE: Record<string, string> = {
  TNS: "bg-violet-100 text-violet-800 border-violet-200",
  assimile: "bg-blue-100 text-blue-800 border-blue-200",
};

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
  const [search, setSearch] = useState("");

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
      nom: form.nom.trim(),
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

  // ── KPIs ───────────────────────────────────────────────────────────────────
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

  // ── Filtered list ──────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return associes;
    return associes.filter(
      (a) =>
        a.nom.toLowerCase().includes(q) || a.statut.toLowerCase().includes(q),
    );
  }, [associes, search]);

  const isPending = createMut.isPending || updateMut.isPending;

  // Preview calculations in the dialog
  const remuVal = Number.parseFloat(form.remuStr) || 0;
  const isTNSForm = form.statut === "TNS";
  const previewTNS = calcTNS(remuVal);
  const previewAssimile = calcAssimile(remuVal);

  return (
    <div className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
            <Building2 className="h-5 w-5 text-primary" />
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

      {/* ── Cartes récapitulatives ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Nombre de dirigeants
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{associes.length}</p>
            <p className="text-xs text-muted-foreground">associés / gérants</p>
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

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Total charges sociales / an
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-destructive">
              {fmtEur(totalCharges)}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtEur(totalCharges / 12)} / mois
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">
              Coût total dirigeants / an
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

      {/* ── Barre de recherche ────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou statut…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-ocid="associes.search_input"
        />
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Statut social</TableHead>
              <TableHead className="text-right">Rémunération / an</TableHead>
              <TableHead className="text-right">Charges sociales</TableHead>
              <TableHead className="text-right">Coût total</TableHead>
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
                  data-ocid="associes.empty_state"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Users className="h-10 w-10 opacity-20" />
                    <p className="font-medium">
                      {search
                        ? "Aucun résultat pour cette recherche"
                        : "Aucun associé/gérant enregistré"}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAdd}
                        data-ocid="associes.empty_add_button"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Ajouter
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayed.map((a, idx) => {
                const remu = a.remunerationAnnuelle;
                const isTNS = a.statut === "TNS";
                const tns = calcTNS(remu);
                const assimile = calcAssimile(remu);
                const charges = isTNS
                  ? tns.cotisations
                  : assimile.chargesSalariales + assimile.chargesPatronales;
                const cout = isTNS ? tns.coutTotal : assimile.coutEmployeur;
                const badgeClass =
                  STATUT_BADGE[a.statut] ??
                  "bg-muted text-foreground border-border";
                return (
                  <TableRow
                    key={a.id}
                    className="hover:bg-muted/30 transition-colors"
                    data-ocid={`associes.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium">{a.nom}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${badgeClass}`}
                      >
                        {isTNS ? "TNS" : "Assimilé sal."}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="tabular-nums">{fmtEur(remu)}</p>
                        <p className="text-xs text-muted-foreground">
                          {isTNS ? "net" : "brut"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-destructive tabular-nums">
                      {fmtEur(charges)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtEur(cout)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {fmtEur(cout / 12)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(a)}
                          data-ocid={`associes.edit_button.${idx + 1}`}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(a.id)}
                          data-ocid={`associes.delete_button.${idx + 1}`}
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
              {displayed.length} dirigeant{displayed.length > 1 ? "s" : ""}
              {search && associes.length !== displayed.length
                ? ` sur ${associes.length}`
                : ""}
            </span>
            <span>Coût mensuel total : {fmtEur(totalCout / 12)}</span>
          </div>
        )}
      </div>

      {/* ── Dialog ajout / édition ────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="associes.dialog">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'associé/gérant" : "Nouvel associé/gérant"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-nom">Nom complet</Label>
              <Input
                id="assoc-nom"
                placeholder="ex : Jean-Pierre Martin"
                value={form.nom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nom: e.target.value }))
                }
                data-ocid="associes.input"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-statut">Statut social</Label>
              <SearchableSelect
                id="assoc-statut"
                options={STATUT_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                value={form.statut}
                onChange={(v) => setForm((f) => ({ ...f, statut: v }))}
                placeholder="Statut social"
                searchPlaceholder="Rechercher…"
                data-ocid="associes.select"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assoc-remu">
                {isTNSForm
                  ? "Rémunération nette souhaitée (€ / an)"
                  : "Salaire brut (€ / an)"}
              </Label>
              <Input
                id="assoc-remu"
                type="text"
                inputMode="decimal"
                placeholder="ex : 36000"
                value={form.remuStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remuStr: e.target.value }))
                }
              />
            </div>

            {form.remuStr && remuVal > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1.5">
                {isTNSForm ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Cotisations TNS (45 %)
                      </span>
                      <strong className="text-destructive">
                        {fmtEur(previewTNS.cotisations)}
                      </strong>
                    </div>
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="font-medium">Coût total annuel</span>
                      <strong>{fmtEur(previewTNS.coutTotal)}</strong>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      Soit {fmtEur(previewTNS.coutTotal / 12)} / mois
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net perçu</span>
                      <strong>{fmtEur(previewAssimile.net)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Charges salariales
                      </span>
                      <strong className="text-destructive">
                        {fmtEur(previewAssimile.chargesSalariales)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Charges patronales
                      </span>
                      <strong className="text-destructive">
                        {fmtEur(previewAssimile.chargesPatronales)}
                      </strong>
                    </div>
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="font-medium">Coût employeur / an</span>
                      <strong>{fmtEur(previewAssimile.coutEmployeur)}</strong>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      Soit {fmtEur(previewAssimile.coutEmployeur / 12)} / mois
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
              disabled={isPending || !form.nom.trim()}
              data-ocid="associes.submit_button"
            >
              {isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
