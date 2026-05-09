import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  dotationAnnuelleParAnnee,
  totalDotationsParAnnee,
} from "@/core/utils/finance";
import {
  useAmortissements,
  useAssociesGerants,
  useEmprunts,
  useFraisFixes,
  useRecettes,
  useSalaries,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type { Recette, VenteRecette } from "@/hooks/useQueries";
import { fmtEur, fmtPct, prixHT } from "@/utils/format";
import {
  Calculator,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import CAFTab from "./CAF";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "resultat" | "bilan" | "caf";

interface PLRow {
  libelle: string;
  montant: number;
  pctCA?: number;
  isHighlight?: "primary" | "green" | "red" | "section";
  sous?: PLRow[];
  indent?: number;
}

interface BilanLigne {
  libelle: string;
  montant: number;
  sous?: BilanLigne[];
  isTotalGroup?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(val: number, ca: number): number {
  return ca > 0 ? (val / ca) * 100 : 0;
}

// ── P&L Row ───────────────────────────────────────────────────────────────────

function PLTableRow({ row, ca }: { row: PLRow; ca: number }) {
  const [open, setOpen] = useState(false);
  const hasSub = (row.sous?.length ?? 0) > 0;
  const indent = row.indent ?? 0;

  const highlightClass =
    row.isHighlight === "primary"
      ? "bg-primary/10 font-bold border-t border-b border-primary/20"
      : row.isHighlight === "green"
        ? "bg-green-500/10 font-bold border-t border-b border-green-500/20"
        : row.isHighlight === "red"
          ? "bg-destructive/10 font-bold border-t border-b border-destructive/20"
          : row.isHighlight === "section"
            ? "bg-muted/50 font-semibold text-muted-foreground text-xs uppercase tracking-wider"
            : "";

  const amtColor =
    row.isHighlight === "green"
      ? row.montant >= 0
        ? "text-green-400"
        : "text-destructive"
      : row.montant < 0
        ? "text-destructive"
        : "";

  const barWidth =
    ca > 0 ? Math.min(100, Math.abs((row.montant / ca) * 100)) : 0;
  const barColor = row.montant >= 0 ? "bg-primary/60" : "bg-destructive/60";

  return (
    <>
      <TableRow
        className={`${highlightClass} ${hasSub ? "cursor-pointer hover:bg-muted/30" : ""} transition-colors`}
        onClick={() => hasSub && setOpen((v) => !v)}
      >
        <TableCell style={{ paddingLeft: `${0.75 + indent * 1.25}rem` }}>
          <span className="flex items-center gap-1.5">
            {hasSub &&
              (open ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ))}
            <span>{row.libelle}</span>
          </span>
        </TableCell>
        <TableCell className="w-32">
          {row.pctCA !== undefined && ca > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {row.pctCA.toFixed(1)}%
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className={`text-right font-mono text-sm ${amtColor}`}>
          {fmtEur(row.montant)}
        </TableCell>
      </TableRow>
      {hasSub &&
        open &&
        row.sous?.map((s) => <PLTableRow key={s.libelle} row={s} ca={ca} />)}
    </>
  );
}

// ── Compte de Résultat ────────────────────────────────────────────────────────

function CompteResultat() {
  const { data: ventes = [], isLoading: lv } = useVentesRecettes();
  const { data: recettes = [], isLoading: lr } = useRecettes();
  const { data: fraisFixes = [], isLoading: lff } = useFraisFixes();
  const { data: salaries = [], isLoading: ls } = useSalaries();
  const { data: amortissements = [] } = useAmortissements();
  const { data: emprunts = [] } = useEmprunts();
  const { data: associes = [] } = useAssociesGerants();

  const [periode, setPeriode] = useState<"annuel" | string>("annuel");
  const isLoading = lv || lr || lff || ls;

  const recetteMap = useMemo(
    () => new Map<string, Recette>(recettes.map((r) => [r.id, r])),
    [recettes],
  );

  // Months available in ventes
  const moisDispos = useMemo(() => {
    const set = new Set<string>();
    for (const v of ventes) {
      const d = new Date(v.date);
      if (!Number.isNaN(d.getTime())) {
        set.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        );
      }
    }
    return [...set].sort().reverse();
  }, [ventes]);

  // Filter ventes by period
  const ventesFiltrees = useMemo<VenteRecette[]>(() => {
    if (periode === "annuel") return ventes;
    return ventes.filter((v) => {
      const d = new Date(v.date);
      if (Number.isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === periode;
    });
  }, [ventes, periode]);

  // CA HT par catégorie
  const caParCategorie = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of ventesFiltrees) {
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      const ht = prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      map.set(r.categorie, (map.get(r.categorie) ?? 0) + ht);
    }
    return map;
  }, [ventesFiltrees, recetteMap]);

  const totalCA = useMemo(
    () => [...caParCategorie.values()].reduce((s, v) => s + v, 0),
    [caParCategorie],
  );

  const coeff = periode === "annuel" ? 1 : 1 / 12;

  // Charges
  const coutMatieres = useMemo(() => {
    let total = 0;
    for (const v of ventesFiltrees) {
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      total += r.consommablesHT * v.quantite;
    }
    return total;
  }, [ventesFiltrees, recetteMap]);

  const margeBrute = totalCA - coutMatieres;
  const totalFF =
    fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0) * 12 * coeff;
  const totalSalaires =
    salaries.reduce((s, sal) => s + sal.salaireAnnuelBrut, 0) * coeff;
  const totalRemu =
    associes.reduce((s, a) => s + a.remunerationAnnuelle, 0) * coeff;
  const totalAmort = totalDotationsParAnnee(amortissements, 1) * coeff;
  const interetsEmprunts = emprunts.reduce((s, e) => {
    const moisTaux = e.tauxAnnuel / 100 / 12;
    const intMensuel = e.montant * moisTaux;
    return s + intMensuel * 12 * coeff;
  }, 0);

  const ebe = margeBrute - totalFF - totalSalaires - totalRemu;
  const resultNet = ebe - totalAmort - interetsEmprunts;

  const rows: PLRow[] = [
    {
      libelle: "PRODUITS D'EXPLOITATION",
      montant: totalCA,
      isHighlight: "section",
    },
    {
      libelle: "Chiffre d'Affaires HT",
      montant: totalCA,
      pctCA: 100,
      indent: 1,
      sous: [...caParCategorie.entries()].map(([cat, montant]) => ({
        libelle: `↳ Ventes – ${cat}`,
        montant,
        pctCA: pct(montant, totalCA),
        indent: 2,
      })),
    },
    {
      libelle: "CHARGES D'EXPLOITATION",
      montant:
        coutMatieres +
        totalFF +
        totalSalaires +
        totalRemu +
        totalAmort +
        interetsEmprunts,
      isHighlight: "section",
    },
    {
      libelle: "Achats consommés (coût matières)",
      montant: coutMatieres,
      pctCA: pct(coutMatieres, totalCA),
      indent: 1,
    },
    {
      libelle: "MARGE BRUTE",
      montant: margeBrute,
      pctCA: pct(margeBrute, totalCA),
      isHighlight: "primary",
    },
    {
      libelle: "Frais de personnel (salaires bruts)",
      montant: totalSalaires,
      pctCA: pct(totalSalaires, totalCA),
      indent: 1,
    },
    {
      libelle: "Rémunérations gérants / associés",
      montant: totalRemu,
      pctCA: pct(totalRemu, totalCA),
      indent: 1,
    },
    {
      libelle: "Frais fixes (loyer, énergie, etc.)",
      montant: totalFF,
      pctCA: pct(totalFF, totalCA),
      indent: 1,
    },
    {
      libelle: "EBE — Excédent Brut d'Exploitation",
      montant: ebe,
      pctCA: pct(ebe, totalCA),
      isHighlight: "primary",
    },
    {
      libelle: "Dotations aux amortissements",
      montant: totalAmort,
      pctCA: pct(totalAmort, totalCA),
      indent: 1,
    },
    {
      libelle: "Intérêts sur emprunts",
      montant: interetsEmprunts,
      pctCA: pct(interetsEmprunts, totalCA),
      indent: 1,
    },
    {
      libelle: "RÉSULTAT NET",
      montant: resultNet,
      pctCA: pct(resultNet, totalCA),
      isHighlight: resultNet >= 0 ? "green" : "red",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">CA HT</p>
            <p className="text-xl font-bold text-primary">{fmtEur(totalCA)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Marge Brute</p>
            <p className="text-xl font-bold">{fmtEur(margeBrute)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(pct(margeBrute, totalCA))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">EBE</p>
            <p className="text-xl font-bold">{fmtEur(ebe)}</p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(pct(ebe, totalCA))}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`${
            resultNet >= 0
              ? "border-green-500/30 bg-green-500/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Résultat Net</p>
            <p
              className={`text-xl font-bold ${resultNet >= 0 ? "text-green-400" : "text-destructive"}`}
            >
              {fmtEur(resultNet)}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtPct(pct(resultNet, totalCA))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period selector + source badge */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select value={periode} onValueChange={setPeriode}>
            <SelectTrigger
              className="w-44 h-8 text-sm"
              data-ocid="comptabilite.resultat.periode_select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annuel">Annuel (toutes ventes)</SelectItem>
              {moisDispos.map((m) => {
                const [yr, mo] = m.split("-");
                const label = new Date(
                  Number(yr),
                  Number(mo) - 1,
                ).toLocaleString("fr-FR", {
                  month: "long",
                  year: "numeric",
                });
                return (
                  <SelectItem key={m} value={m}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Source : Ventes réelles
        </Badge>
      </div>

      {/* P&L Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Compte de Résultat
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Libellé</TableHead>
                <TableHead className="w-32">% du CA</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <PLTableRow key={row.libelle} row={row} ca={totalCA} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {ventes.length === 0 && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-4 py-3">
          💡 Enregistrez des ventes dans « Ventes du Jour » pour alimenter le
          compte de résultat.
        </p>
      )}
    </div>
  );
}

// ── Bilan ─────────────────────────────────────────────────────────────────────

function BilanRow({
  ligne,
  depth = 0,
  expanded,
  onToggle,
}: {
  ligne: BilanLigne;
  depth?: number;
  expanded: Set<string>;
  onToggle: (k: string) => void;
}) {
  const hasSub = (ligne.sous?.length ?? 0) > 0;
  const isOpen = expanded.has(ligne.libelle);

  return (
    <>
      <TableRow
        className={`${
          ligne.isTotalGroup
            ? "bg-muted/40 font-bold border-t-2"
            : depth === 0
              ? "bg-muted/10"
              : ""
        } ${hasSub ? "cursor-pointer hover:bg-muted/20" : ""} transition-colors`}
        onClick={() => hasSub && onToggle(ligne.libelle)}
      >
        <TableCell style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
          <span className="flex items-center gap-1.5">
            {hasSub &&
              (isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ))}
            {ligne.libelle}
          </span>
        </TableCell>
        <TableCell
          className={`text-right font-mono text-sm ${
            ligne.isTotalGroup
              ? "font-bold text-primary"
              : ligne.montant < 0
                ? "text-destructive"
                : ""
          }`}
        >
          {ligne.montant !== 0 ? fmtEur(ligne.montant) : "—"}
        </TableCell>
      </TableRow>
      {hasSub &&
        isOpen &&
        ligne.sous?.map((s) => (
          <BilanRow
            key={s.libelle}
            ligne={s}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

function Bilan() {
  const { data: amortissements = [], isLoading: la } = useAmortissements();
  const { data: emprunts = [], isLoading: le } = useEmprunts();
  const { data: fraisFixes = [], isLoading: lff } = useFraisFixes();
  const { data: salaries = [] } = useSalaries();
  const { data: associes = [] } = useAssociesGerants();
  const { data: ventes = [] } = useVentesRecettes();
  const { data: recettes = [] } = useRecettes();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isLoading = la || le || lff;

  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  // Actif immobilisé
  const totalImmos = amortissements.reduce((s, a) => s + a.coutTotal, 0);
  const totalAmortCum = totalDotationsParAnnee(amortissements, 1);
  const valeurNetteImmos = Math.max(0, totalImmos - totalAmortCum);

  // CA réel
  const recetteMap = useMemo(
    () => new Map<string, Recette>(recettes.map((r) => [r.id, r])),
    [recettes],
  );
  const totalCA = useMemo(() => {
    let sum = 0;
    for (const v of ventes) {
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      sum += prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
    }
    return sum;
  }, [ventes, recetteMap]);

  const totalFF =
    fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0) * 12;
  const totalSalaires = salaries.reduce(
    (s, sal) => s + sal.salaireAnnuelBrut,
    0,
  );
  const totalAmort = totalDotationsParAnnee(amortissements, 1);
  const interets = emprunts.reduce((s, e) => {
    const mois = e.tauxAnnuel / 100 / 12;
    return s + e.montant * mois * 12;
  }, 0);
  const resultNet = totalCA - totalFF - totalSalaires - totalAmort - interets;

  // Passif
  const capitalSocial = associes.reduce(
    (s, a) => s + a.remunerationAnnuelle,
    0,
  );
  const capitalEmprunts = emprunts.reduce((s, e) => s + e.montant, 0);
  const reservesEstimees = Math.max(0, valeurNetteImmos - capitalEmprunts);
  const capitalPropresTotal =
    capitalSocial + reservesEstimees + Math.max(0, resultNet);
  const dettesLT = emprunts.reduce((s, e) => {
    const annuite =
      calcMensualite(e.montant, e.tauxAnnuel, Number(e.dureeMois)) * 12;
    return s + Math.max(0, e.montant - annuite);
  }, 0);
  const dettesCT = Math.max(0, totalFF / 12 + totalSalaires / 12);

  const totalActif = valeurNetteImmos + Math.max(0, totalCA);
  const totalPassif = capitalPropresTotal + dettesLT + dettesCT;
  const isBalanced = Math.abs(totalActif - totalPassif) < 1;

  const actifLignes: BilanLigne[] = [
    {
      libelle: "Actif Immobilisé",
      montant: valeurNetteImmos,
      sous: [
        { libelle: "Immobilisations brutes", montant: totalImmos },
        { libelle: "— Amortissements cumulés (an 1)", montant: -totalAmortCum },
        { libelle: "Valeur nette comptable", montant: valeurNetteImmos },
      ],
    },
    {
      libelle: "Actif Circulant",
      montant: Math.max(0, totalCA),
      sous: [
        {
          libelle: "Chiffre d'affaires (trésorerie potentielle)",
          montant: Math.max(0, totalCA),
        },
      ],
    },
    { libelle: "TOTAL ACTIF", montant: totalActif, isTotalGroup: true },
  ];

  const passifLignes: BilanLigne[] = [
    {
      libelle: "Capitaux Propres",
      montant: capitalPropresTotal,
      sous: [
        { libelle: "Capital et rémunérations gérants", montant: capitalSocial },
        { libelle: "Réserves estimées", montant: reservesEstimees },
        { libelle: "Résultat net de l'exercice", montant: resultNet },
      ],
    },
    {
      libelle: "Dettes à Long Terme",
      montant: dettesLT,
      sous: emprunts.map((e) => ({ libelle: e.nom, montant: e.montant })),
    },
    {
      libelle: "Dettes à Court Terme",
      montant: dettesCT,
      sous: [
        { libelle: "Charges mensuelles (frais fixes)", montant: totalFF / 12 },
        {
          libelle: "Charges salariales mensuelles",
          montant: totalSalaires / 12,
        },
      ],
    },
    { libelle: "TOTAL PASSIF", montant: totalPassif, isTotalGroup: true },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance indicator */}
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
          isBalanced
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
        }`}
      >
        <span>{isBalanced ? "✓" : "⚠"}</span>
        <span>
          {isBalanced
            ? "Actif = Passif — bilan équilibré"
            : `Écart : ${fmtEur(Math.abs(totalActif - totalPassif))} (données partielles)`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actif */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-blue-500/5 border-b border-blue-500/10">
            <CardTitle className="text-sm font-semibold text-primary">
              Actif
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actifLignes.map((l) => (
                  <BilanRow
                    key={l.libelle}
                    ligne={l}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Passif */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-orange-500/5 border-b border-orange-500/10">
            <CardTitle className="text-sm font-semibold text-orange-400">
              Passif
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passifLignes.map((l) => (
                  <BilanRow
                    key={l.libelle}
                    ligne={l}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "resultat",
    label: "Compte de Résultat",
    icon: <FileText className="h-4 w-4" />,
  },
  { id: "bilan", label: "Bilan", icon: <Layers className="h-4 w-4" /> },
  {
    id: "caf",
    label: "Capacité d'Autofinancement",
    icon: <TrendingUp className="h-4 w-4" />,
  },
];

export default function Comptabilite() {
  const [tab, setTab] = useState<TabId>("resultat");

  return (
    <div className="space-y-6" data-ocid="comptabilite.page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">
            Comptabilité
          </h2>
          <p className="text-sm text-muted-foreground">
            Compte de résultat, bilan simplifié et capacité d'autofinancement
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit flex-wrap"
        data-ocid="comptabilite.tab"
      >
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={tab === t.id ? "default" : "ghost"}
            size="sm"
            className="gap-2"
            onClick={() => setTab(t.id)}
            data-ocid={`comptabilite.${t.id}.tab`}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </div>

      <Separator />

      {tab === "resultat" && <CompteResultat />}
      {tab === "bilan" && <Bilan />}
      {tab === "caf" && <CAFTab />}
    </div>
  );
}
