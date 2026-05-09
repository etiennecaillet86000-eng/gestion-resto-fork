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
  dotationAnnuelleParAnnee,
  totalDotationsParAnnee,
  valeurResiduelle,
} from "@/core/utils/finance";
import {
  useAmortissements,
  useCreateAmortissement,
  useDeleteAmortissement,
  useUpdateAmortissement,
} from "@/hooks/useQueries";
import type { LigneAmortissement } from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Depreciation methods ────────────────────────────────────────────────────────

const METHODES = ["Linéaire", "Dégressif"] as const;
type Methode = (typeof METHODES)[number];

/**
 * Coefficients fiscaux dégressifs (France)
 * 3-4 ans → 1.25 | 5-6 ans → 1.75 | >6 ans → 2.25
 */
function getCoefficientFiscal(dureeAns: number): number {
  if (dureeAns <= 4) return 1.25;
  if (dureeAns <= 6) return 1.75;
  return 2.25;
}

interface LigneProjection {
  annee: number;
  dotation: number;
  vnc: number; // Valeur Nette Comptable en fin d'année
}

/**
 * Degressive depreciation plan (French fiscal method) with switch to linear
 * when linear becomes more favorable.
 */
function calculerProjectionDegressive(
  coutTotal: number,
  dureeAns: number,
): LigneProjection[] {
  const coeff = getCoefficientFiscal(dureeAns);
  const lignes: LigneProjection[] = [];
  let vnc = coutTotal;

  for (let a = 1; a <= dureeAns; a++) {
    const anneesRestantes = dureeAns - a + 1;
    const tauxDeg = (1 / dureeAns) * coeff;
    const dotDeg = vnc * tauxDeg;
    const dotLin = vnc / anneesRestantes; // Switch when linear > degressive
    const dotation = dotDeg >= dotLin ? dotDeg : dotLin;
    vnc = Math.max(0, vnc - dotation);
    lignes.push({ annee: a, dotation, vnc });
  }
  return lignes;
}

function calculerProjectionLineaire(
  coutTotal: number,
  dureeAns: number,
): LigneProjection[] {
  const dotation = coutTotal / dureeAns;
  return Array.from({ length: dureeAns }, (_, i) => ({
    annee: i + 1,
    dotation,
    vnc: Math.max(0, coutTotal - dotation * (i + 1)),
  }));
}

// ── Form types ─────────────────────────────────────────────────────────────────

interface AmortForm {
  nom: string;
  coutStr: string;
  dureeStr: string;
  methode: Methode;
}

const emptyForm = (): AmortForm => ({
  nom: "",
  coutStr: "",
  dureeStr: "",
  methode: "Linéaire",
});

const SKELETON_ROWS = [0, 1, 2];
const YEARS_N = [1, 2, 3, 4, 5];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Amortissements() {
  const { data: amortissements = [], isLoading } = useAmortissements();
  const createMut = useCreateAmortissement();
  const updateMut = useUpdateAmortissement();
  const deleteMut = useDeleteAmortissement();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LigneAmortissement | null>(null);
  const [form, setForm] = useState<AmortForm>(emptyForm());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [methodeMap, setMethodeMap] = useState<Record<string, Methode>>({});

  const amortissables = amortissements.filter((a) => Number(a.dureeMois) > 0);

  const kpis = useMemo(() => {
    const totalValeur = amortissables.reduce((s, a) => s + a.coutTotal, 0);
    const totalDotAn1 = totalDotationsParAnnee(amortissables, 1);
    const totalVncFin5 = amortissables.reduce(
      (s, a) => s + valeurResiduelle(a, Math.min(5, Number(a.dureeMois))),
      0,
    );
    return { totalValeur, totalDotAn1, totalVncFin5 };
  }, [amortissables]);

  // Pre-computed totals for footer
  const totalDotAnnuelle = amortissables.reduce(
    (sum, a) =>
      sum + (Number(a.dureeMois) > 0 ? a.coutTotal / Number(a.dureeMois) : 0),
    0,
  );
  const totalDotMensuelle = totalDotAnnuelle / 12;

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
      methode: methodeMap[a.id] ?? "Linéaire",
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
        setMethodeMap((prev) => ({ ...prev, [editing.id]: form.methode }));
        toast.success("Amortissement mis à jour");
      } else {
        const result = await createMut.mutateAsync({
          nom: form.nom,
          coutTotal: cout,
          dureeMois: BigInt(duree),
        });
        if (result && typeof result === "object" && "id" in result) {
          setMethodeMap((prev) => ({
            ...prev,
            [(result as LigneAmortissement).id]: form.methode,
          }));
        }
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

  const previewProjection = useMemo(() => {
    const cout = Number.parseFloat(form.coutStr) || 0;
    const duree = Number.parseInt(form.dureeStr) || 0;
    if (!cout || !duree) return [];
    return form.methode === "Dégressif"
      ? calculerProjectionDegressive(cout, duree)
      : calculerProjectionLineaire(cout, duree);
  }, [form.coutStr, form.dureeStr, form.methode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Amortissements</h2>
          <p className="text-sm text-muted-foreground">
            Plan d&apos;amortissement linéaire et dégressif
          </p>
        </div>
        <Button onClick={openAdd} data-ocid="amortissements.open_modal_button">
          <Plus className="mr-2 h-4 w-4" /> Ajouter
        </Button>
      </div>

      {/* KPI cards */}
      {amortissables.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Valeur totale du parc
              </p>
              <p className="text-xl font-bold">{fmtEur(kpis.totalValeur)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Dotation année 1
              </p>
              <p className="text-xl font-bold text-primary">
                {fmtEur(kpis.totalDotAn1)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                VNC estimée année 5
              </p>
              <p className="text-xl font-bold text-muted-foreground">
                {fmtEur(kpis.totalVncFin5)}
              </p>
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
      ) : amortissables.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
          data-ocid="amortissements.empty_state"
        >
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Aucun bien amortissable enregistré</p>
          <p className="text-xs">
            Ajoutez vos immobilisations pour générer le plan
            d&apos;amortissement.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Plan d&apos;amortissement sur {YEARS_N.length} ans
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/40">
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-8" />
                    <TableHead className="min-w-[180px]">Désignation</TableHead>
                    <TableHead className="text-right">Coût total</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead className="text-right bg-primary/5 border-l border-primary/20">
                      Dot. annuelle
                    </TableHead>
                    <TableHead className="text-right bg-primary/5">
                      Dot. mensuelle
                    </TableHead>
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
                    const methode = methodeMap[a.id] ?? "Linéaire";
                    const isExpanded = expandedId === a.id;
                    const dotAn = dureeAns > 0 ? a.coutTotal / dureeAns : 0;
                    const dotMens = dotAn / 12;

                    const projection =
                      methode === "Dégressif"
                        ? calculerProjectionDegressive(a.coutTotal, dureeAns)
                        : calculerProjectionLineaire(a.coutTotal, dureeAns);

                    return (
                      <>
                        <TableRow
                          key={a.id}
                          data-ocid={`amortissements.item.${idx + 1}`}
                          className="cursor-pointer hover:bg-muted/20"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : a.id)
                          }
                        >
                          <TableCell className="w-8 text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{a.nom}</TableCell>
                          <TableCell className="text-right">
                            {fmtEur(a.coutTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {dureeAns} an{dureeAns > 1 ? "s" : ""}
                          </TableCell>
                          <TableCell onClick={(ev) => ev.stopPropagation()}>
                            <Select
                              value={methode}
                              onValueChange={(v) =>
                                setMethodeMap((prev) => ({
                                  ...prev,
                                  [a.id]: v as Methode,
                                }))
                              }
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {METHODES.map((m) => (
                                  <SelectItem
                                    key={m}
                                    value={m}
                                    className="text-xs"
                                  >
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {/* Dotation annuelle */}
                          <TableCell className="text-right text-sm font-semibold text-primary bg-primary/5 border-l border-primary/20">
                            {dureeAns > 0 ? fmtEur(dotAn) : "—"}
                          </TableCell>
                          {/* Dotation mensuelle */}
                          <TableCell className="text-right text-sm font-medium text-primary/80 bg-primary/5">
                            {dureeAns > 0 ? fmtEur(dotMens) : "—"}
                          </TableCell>
                          {/* Dotations par anée */}
                          {YEARS_N.map((n) => {
                            const line = projection[n - 1];
                            return (
                              <TableCell
                                key={n}
                                className={`text-right text-sm ${
                                  n <= dureeAns
                                    ? "font-medium text-primary"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {n <= dureeAns && line
                                  ? fmtEur(line.dotation)
                                  : "—"}
                              </TableCell>
                            );
                          })}
                          <TableCell onClick={(ev) => ev.stopPropagation()}>
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

                        {/* Expanded detail projection */}
                        {isExpanded && (
                          <TableRow
                            key={`${a.id}-expanded`}
                            className="bg-muted/10"
                          >
                            <TableCell
                              colSpan={9 + YEARS_N.length}
                              className="p-0"
                            >
                              <div className="overflow-x-auto border-t border-border/50">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/20 text-xs">
                                      <TableHead className="py-2">
                                        Année
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Dotation annuelle
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        Dotation mensuelle
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        VNC fin d&apos;année
                                      </TableHead>
                                      <TableHead className="text-right py-2">
                                        % amorti
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {projection.map((l) => (
                                      <TableRow
                                        key={l.annee}
                                        className="text-xs hover:bg-transparent"
                                      >
                                        <TableCell className="py-1.5 font-medium">
                                          Année {l.annee}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5 text-primary font-semibold">
                                          {fmtEur(l.dotation)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5 text-primary/80">
                                          {fmtEur(l.dotation / 12)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5">
                                          {fmtEur(l.vnc)}
                                        </TableCell>
                                        <TableCell className="text-right py-1.5 text-muted-foreground">
                                          {a.coutTotal > 0
                                            ? `${(((a.coutTotal - l.vnc) / a.coutTotal) * 100).toFixed(1)} %`
                                            : "—"}
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
                <tfoot>
                  <TableRow className="bg-muted/50 border-t-2">
                    <TableCell colSpan={5} className="font-bold text-sm">
                      TOTAL DOTATIONS
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary bg-primary/5 border-l border-primary/20">
                      {fmtEur(totalDotAnnuelle)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary/80 bg-primary/5">
                      {fmtEur(totalDotMensuelle)}
                    </TableCell>
                    {YEARS_N.map((n) => (
                      <TableCell key={n} className="text-right font-bold">
                        {fmtEur(
                          amortissables.reduce(
                            (sum, a) => sum + dotationAnnuelleParAnnee(a, n),
                            0,
                          ),
                        )}
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                  <TableRow className="bg-primary/5 border-t">
                    <TableCell
                      colSpan={5}
                      className="text-xs text-muted-foreground py-2 italic"
                    >
                      Récapitulatif
                    </TableCell>
                    <TableCell className="py-2 border-l border-primary/20">
                      <div className="text-[10px] text-muted-foreground">
                        Annuel
                      </div>
                      <div className="text-sm font-bold text-primary">
                        {fmtEur(totalDotAnnuelle)}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-[10px] text-muted-foreground">
                        Mensuel
                      </div>
                      <div className="text-sm font-bold text-primary/80">
                        {fmtEur(totalDotMensuelle)}
                      </div>
                    </TableCell>
                    <TableCell
                      colSpan={YEARS_N.length + 1}
                      className="text-xs text-muted-foreground py-2"
                    >
                      Dotations par année ci-dessus →
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit dialog */}
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
            <div className="grid grid-cols-2 gap-3">
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
                <Label>Durée (années)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="5"
                  value={form.dureeStr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dureeStr: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Méthode d&apos;amortissement</Label>
              <Select
                value={form.methode}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, methode: v as Methode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                      {m === "Dégressif" && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (fiscal français)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {previewProjection.length > 0 && (
              <div className="rounded-md border bg-muted/10 overflow-hidden">
                <div className="px-3 py-2 bg-muted/20 text-xs font-semibold text-muted-foreground border-b">
                  Projection ({form.methode})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-3 py-1.5 font-medium">
                          Année
                        </th>
                        <th className="text-right px-3 py-1.5 font-medium">
                          Dot. annuelle
                        </th>
                        <th className="text-right px-3 py-1.5 font-medium">
                          Dot. mensuelle
                        </th>
                        <th className="text-right px-3 py-1.5 font-medium">
                          VNC
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewProjection.map((l) => (
                        <tr key={l.annee} className="border-b last:border-0">
                          <td className="px-3 py-1.5">{l.annee}</td>
                          <td className="text-right px-3 py-1.5 text-primary font-semibold">
                            {fmtEur(l.dotation)}
                          </td>
                          <td className="text-right px-3 py-1.5 text-primary/80">
                            {fmtEur(l.dotation / 12)}
                          </td>
                          <td className="text-right px-3 py-1.5 text-muted-foreground">
                            {fmtEur(l.vnc)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
