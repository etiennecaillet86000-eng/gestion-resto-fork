/**
 * TabBusinessPlanReel.tsx — Business Plan Réel
 * Data: real ventes fetched from backend + businessPlanParams from store
 * Horizons: Mensuel | Annuel | 5 ans
 * Marge brute: weighted by mixCategories (real recipe data fallback via useStatsSimulateur)
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjectionStore } from "@/core/store/projectionStore";
import type { MixCategorie } from "@/core/utils/projectionMath";
import { getScenarioCoefficient } from "@/core/utils/projectionMath";
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
import { useStatsSimulateur } from "@/hooks/useStatsSimulateur";
import { fmtEur, fmtPct } from "@/utils/format";
import {
  BarChart3,
  CheckCircle2,
  Info,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PnLHorizon } from "./shared";
import {
  KpiCard,
  KpiSkeleton,
  MONTH_SHORT,
  PnLTable,
  TableSkeleton,
  prixHTFromTTC,
} from "./shared";

const JOURS_PAR_MOIS = 26;

// ── Weighted marge brute calculation ──────────────────────────────────────────

interface WeightedBreakdownRow {
  label: string;
  pctCA: number;
  margeRetenue: number;
  contribution: number;
  isReal: boolean;
}

function calcWeightedMarge(
  mixCategories: MixCategorie[],
  realByCategory: Map<string, number>,
): {
  weightedMarge: number;
  weightedFoodCost: number;
  breakdown: WeightedBreakdownRow[];
} {
  const totalPct = mixCategories.reduce((s, c) => s + c.pctCA, 0);
  const norm = totalPct > 0 ? totalPct : 100;
  let weightedMarge = 0;
  const breakdown: WeightedBreakdownRow[] = [];
  for (const cat of mixCategories) {
    const realMarge = realByCategory.get(cat.label);
    const margeRetenue =
      realMarge !== undefined ? realMarge : cat.margeBruteAvg;
    const weight = cat.pctCA / norm;
    const contribution = weight * margeRetenue;
    weightedMarge += contribution;
    breakdown.push({
      label: cat.label,
      pctCA: cat.pctCA,
      margeRetenue,
      contribution,
      isReal: realMarge !== undefined,
    });
  }
  return {
    weightedMarge,
    weightedFoodCost: 100 - weightedMarge,
    breakdown,
  };
}

// ── P&L builder ────────────────────────────────────────────────────────────────

function buildPnLRows(
  ca: number,
  cmp: number,
  salaires: number,
  loyer: number,
  autresFF: number,
  amortissement: number,
  tauxImposition: number,
  mixCategories: MixCategorie[],
  showMixBreakdown: boolean,
) {
  const margeBrute = ca - cmp;
  const totalFF = salaires + loyer + autresFF;
  const ebe = margeBrute - totalFF;
  const resultatExpl = ebe - amortissement;
  const impots = Math.max(resultatExpl, 0) * (tauxImposition / 100);
  const resultatNet = resultatExpl - impots;

  const rows = [
    { label: "Chiffre d'affaires HT", valeur: ca, pctCA: 100, isBold: true },
    ...(showMixBreakdown
      ? mixCategories.map((c) => ({
          label: `↳ ${c.label} (${c.pctCA.toFixed(0)}% du mix)`,
          valeur: ca * (c.pctCA / 100),
          isIndented: true,
        }))
      : []),
    { label: "", valeur: 0, isSeparator: true },
    {
      label: "(−) Coût des matières premières",
      valeur: -cmp,
      isNegative: cmp > 0,
    },
    {
      label: "Marge brute",
      valeur: margeBrute,
      isSubtotal: true,
      isBold: true,
      isPositive: margeBrute > 0,
    },
    { label: "", valeur: 0, isSeparator: true },
    {
      label: "(−) Charges fixes totales",
      valeur: -totalFF,
      isNegative: totalFF > 0,
      isBold: true,
    },
    {
      label: "  ↳ Salaires & rémunérations",
      valeur: -salaires,
      isIndented: true,
    },
    {
      label: "  ↳ Frais fixes (loyer & charges)",
      valeur: -loyer,
      isIndented: true,
    },
    { label: "  ↳ Mensualités d'emprunt", valeur: -autresFF, isIndented: true },
    { label: "", valeur: 0, isSeparator: true },
    {
      label: "Excédent Brut d'Exploitation (EBE)",
      valeur: ebe,
      isSubtotal: true,
      isBold: true,
    },
    {
      label: "(−) Dotations aux amortissements",
      valeur: -amortissement,
      isIndented: true,
    },
    {
      label: "Résultat d'exploitation",
      valeur: resultatExpl,
      isSubtotal: true,
      isBold: true,
    },
    {
      label: "(−) Impôts sur les bénéfices",
      valeur: -impots,
      isIndented: true,
    },
    {
      label: "RÉSULTAT NET",
      valeur: resultatNet,
      isTotal: true,
      isBold: true,
      isPositive: resultatNet > 0,
      isNegative: resultatNet < 0,
    },
  ];

  const seuilMensuel =
    margeBrute > 0 && ca > 0
      ? (totalFF + amortissement) / (margeBrute / ca)
      : 0;
  const margeSec =
    ca > seuilMensuel && seuilMensuel > 0
      ? ((ca - seuilMensuel) / ca) * 100
      : 0;

  return {
    rows,
    margeBrute,
    ebe,
    resultatExpl,
    resultatNet,
    seuilMensuel,
    margeSec,
  };
}

// ── Horizon tabs ───────────────────────────────────────────────────────────────

function HorizonTabs({
  value,
  onChange,
}: {
  value: PnLHorizon;
  onChange: (v: PnLHorizon) => void;
}) {
  const opts: { v: PnLHorizon; label: string }[] = [
    { v: "mensuel", label: "Mensuel" },
    { v: "annuel", label: "Annuel" },
    { v: "5ans", label: "5 ans" },
  ];
  return (
    <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === o.v
              ? "bg-card shadow text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid={`bp-reel.horizon.${o.v}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Mix product breakdown panel ────────────────────────────────────────────────

function MixBreakdownPanel({
  breakdown,
  weightedMarge,
}: {
  breakdown: WeightedBreakdownRow[];
  weightedMarge: number;
}) {
  if (breakdown.length === 0) return null;
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="pb-2 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Mix produit utilisé — calcul de la marge brute pondérée
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">% CA</TableHead>
              <TableHead className="text-right">Marge retenue</TableHead>
              <TableHead className="text-right">Contribution</TableHead>
              <TableHead className="text-right">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium text-sm">
                  {row.label}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {row.pctCA.toFixed(0)}%
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.margeRetenue.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right font-mono text-primary">
                  {row.contribution.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      row.isReal
                        ? "border-green-500/40 text-green-400 bg-green-500/5"
                        : "border-amber-500/40 text-amber-400 bg-amber-500/5"
                    }`}
                  >
                    {row.isReal ? "Recettes réelles" : "Paramétrage"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot>
            <TableRow className="bg-muted/30 border-t-2">
              <TableCell className="font-bold" colSpan={3}>
                Marge brute pondérée globale
              </TableCell>
              <TableCell className="text-right font-bold text-primary font-mono">
                {weightedMarge.toFixed(1)}%
              </TableCell>
              <TableCell />
            </TableRow>
          </tfoot>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Five-year year-by-year rows ─────────────────────────────────────────────────────

interface YearRow {
  label: string;
  ca: number;
  cmp: number;
  mb: number;
  totalFF: number;
  ebe: number;
  amor: number;
  re: number;
  imp: number;
  rn: number;
}

function build5YearRows(
  annualCA: number,
  annualCMP: number,
  annualSal: number,
  annualLoy: number,
  annualAutres: number,
  annualAmor: number,
  tauxImposition: number,
  growthCoeff: number,
): YearRow[] {
  return Array.from({ length: 5 }, (_, i) => {
    // Revenue + variable costs grow with compound coefficient
    // Fixed costs (loyer, emprunts) also grow; amortissements stay flat
    const g = growthCoeff ** i;
    const ca = annualCA * g;
    const cmp = annualCMP * g;
    const sal = annualSal * g;
    const loy = annualLoy * g;
    const autres = annualAutres * g;
    const amor = annualAmor; // amortissements are fixed
    const totalFF = sal + loy + autres;
    const mb = ca - cmp;
    const ebe = mb - totalFF;
    const re = ebe - amor;
    const imp = Math.max(re, 0) * (tauxImposition / 100);
    const rn = re - imp;
    return {
      label: `Année ${i + 1}`,
      ca,
      cmp,
      mb,
      totalFF,
      ebe,
      amor,
      re,
      imp,
      rn,
    };
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TabBusinessPlanReel() {
  const { params, mixCategories, businessPlanParams } = useProjectionStore();
  const bpp = businessPlanParams;

  const { data: ventes = [], isLoading: loadingVentes } = useVentesRecettes();
  const { data: recettes = [], isLoading: loadingRecettes } = useRecettes();
  const { data: fraisFixes = [], isLoading: loadingFF } = useFraisFixes();
  const { data: salaries = [], isLoading: loadSal } = useSalaries();
  const { data: associes = [], isLoading: loadAss } = useAssociesGerants();
  const { data: amortissements = [], isLoading: loadAmort } =
    useAmortissements();
  const { data: emprunts = [], isLoading: loadEmp } = useEmprunts();
  const { categoriesDistrib, isLoading: loadStats } = useStatsSimulateur();

  const isLoading =
    loadingVentes ||
    loadingRecettes ||
    loadingFF ||
    loadSal ||
    loadAss ||
    loadAmort ||
    loadEmp ||
    loadStats;

  const [horizon, setHorizon] = useState<PnLHorizon>("mensuel");
  const [showMix, setShowMix] = useState(false);
  const [showMixBreakdown, setShowMixBreakdown] = useState(false);

  const recetteMap = useMemo(
    () => new Map<string, Recette>(recettes.map((r) => [r.id, r])),
    [recettes],
  );

  // Real CA from actual ventes
  const reelCAMensuel = useMemo(
    () =>
      ventes.reduce((sum, v: VenteRecette) => {
        const r = recetteMap.get(v.recetteId);
        if (!r) return sum;
        return sum + prixHTFromTTC(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      }, 0),
    [ventes, recetteMap],
  );

  // Real average marge by category from useStatsSimulateur
  const realMargeByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of categoriesDistrib) m.set(d.categorie, d.margeAvg);
    return m;
  }, [categoriesDistrib]);

  // Weighted marge brute: mix categories × real recipe data (fallback to store)
  const { weightedMarge, weightedFoodCost, breakdown } = useMemo(
    () =>
      calcWeightedMarge(mixCategories as MixCategorie[], realMargeByCategory),
    [mixCategories, realMargeByCategory],
  );

  // Auto-aggregated charges from backend
  const salairesMensuel = useMemo(
    () =>
      salaries.reduce((s, e) => s + (e.salaireAnnuelBrut * 1.42) / 12, 0) +
      associes.reduce((a, x) => a + x.remunerationAnnuelle / 12, 0),
    [salaries, associes],
  );
  const ffMensuelDB = useMemo(
    () => fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0),
    [fraisFixes],
  );
  const amortissementMensuel = useMemo(
    () =>
      amortissements.reduce(
        (s, a) =>
          s + (Number(a.dureeMois) > 0 ? a.coutTotal / Number(a.dureeMois) : 0),
        0,
      ),
    [amortissements],
  );
  const empruntsMensuel = useMemo(
    () =>
      emprunts.reduce(
        (s, e) =>
          s + (Number(e.dureeMois) > 0 ? e.montant / Number(e.dureeMois) : 0),
        0,
      ),
    [emprunts],
  );

  const salaires = salairesMensuel;
  const loyer = ffMensuelDB;
  const autresFF = empruntsMensuel;
  const amortissement = amortissementMensuel;
  const tauxImposition = bpp.tauxImposition;
  const growthCoeff = bpp.growthCoefficient5ans;
  const scenarioCoeff = getScenarioCoefficient(params.scenario);
  const couvertsTotal = params.couvertsDejeunner + params.couvertsDiner;

  // 12-month rolling projection using weighted food cost ratio
  const monthlyData = useMemo(() => {
    const caBaseJour =
      couvertsTotal *
      (params.tauxRemplissage / 100) *
      params.ticketMoyen *
      scenarioCoeff;
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const mIdx = (now.getMonth() + i) % 12;
      const yearOffset = Math.floor((now.getMonth() + i) / 12);
      const inflation = (1 + params.inflationCharges / 100) ** yearOffset;
      const ca = caBaseJour * (params.seasonalite[mIdx] ?? 1) * JOURS_PAR_MOIS;
      const cmp = ca * (weightedFoodCost / 100); // weighted food cost
      const sal = salaires * inflation;
      const loy = loyer * inflation;
      const autres = autresFF * inflation;
      const amor = amortissement;
      const totalFF2 = sal + loy + autres;
      const mb = ca - cmp;
      const ebe = mb - totalFF2;
      const re = ebe - amor;
      const imp = Math.max(re, 0) * (tauxImposition / 100);
      const rn = re - imp;
      return {
        label: MONTH_SHORT[mIdx],
        year: now.getFullYear() + yearOffset,
        ca,
        cmp,
        mb,
        sal,
        loy,
        autres,
        totalFF: totalFF2,
        ebe,
        amor,
        re,
        imp,
        rn,
      };
    });
  }, [
    params,
    couvertsTotal,
    scenarioCoeff,
    salaires,
    loyer,
    autresFF,
    amortissement,
    weightedFoodCost,
    tauxImposition,
  ]);

  function sumM(key: keyof (typeof monthlyData)[0]) {
    return monthlyData.reduce((s, m) => s + (m[key] as number), 0);
  }

  const annualCA = sumM("ca");
  const annualCMP = sumM("cmp");
  const annualSal = sumM("sal");
  const annualLoy = sumM("loy");
  const annualAutres = sumM("autres");
  const annualAmor = sumM("amor");

  // Year-by-year 5-year projection using growth coefficient
  const fiveYearRows = useMemo(
    () =>
      build5YearRows(
        annualCA,
        annualCMP,
        annualSal,
        annualLoy,
        annualAutres,
        annualAmor,
        tauxImposition,
        growthCoeff,
      ),
    [
      annualCA,
      annualCMP,
      annualSal,
      annualLoy,
      annualAutres,
      annualAmor,
      tauxImposition,
      growthCoeff,
    ],
  );

  const pnl5ans = useMemo(
    () => ({
      ca: fiveYearRows.reduce((s, y) => s + y.ca, 0),
      cmp: fiveYearRows.reduce((s, y) => s + y.cmp, 0),
      mb: fiveYearRows.reduce((s, y) => s + y.mb, 0),
      totalFF: fiveYearRows.reduce((s, y) => s + y.totalFF, 0),
      ebe: fiveYearRows.reduce((s, y) => s + y.ebe, 0),
      amor: fiveYearRows.reduce((s, y) => s + y.amor, 0),
      rn: fiveYearRows.reduce((s, y) => s + y.rn, 0),
    }),
    [fiveYearRows],
  );

  // Aggregated PnL inputs depending on horizon
  const aggCA =
    horizon === "mensuel"
      ? (monthlyData[0]?.ca ?? 0)
      : horizon === "annuel"
        ? annualCA
        : pnl5ans.ca;
  const aggCMP =
    horizon === "mensuel"
      ? (monthlyData[0]?.cmp ?? 0)
      : horizon === "annuel"
        ? annualCMP
        : pnl5ans.cmp;
  const aggSal =
    horizon === "mensuel"
      ? (monthlyData[0]?.sal ?? 0)
      : horizon === "annuel"
        ? annualSal
        : fiveYearRows.reduce((s, y) => s + y.totalFF, 0); // total FF for 5-ans header KPI
  const aggLoy =
    horizon === "mensuel"
      ? (monthlyData[0]?.loy ?? 0)
      : horizon === "annuel"
        ? annualLoy
        : 0;
  const aggAutres =
    horizon === "mensuel"
      ? (monthlyData[0]?.autres ?? 0)
      : horizon === "annuel"
        ? annualAutres
        : 0;
  const aggAmor =
    horizon === "mensuel"
      ? (monthlyData[0]?.amor ?? 0)
      : horizon === "annuel"
        ? annualAmor
        : pnl5ans.amor;

  // For mensuel/annuel P&L table
  const { rows, resultatNet, seuilMensuel, margeSec } = buildPnLRows(
    aggCA,
    aggCMP,
    horizon === "5ans" ? aggSal : aggSal,
    horizon === "5ans" ? 0 : aggLoy,
    horizon === "5ans" ? 0 : aggAutres,
    aggAmor,
    tauxImposition,
    mixCategories as MixCategorie[],
    showMix,
  );

  const displayResultatNet = horizon === "5ans" ? pnl5ans.rn : resultatNet;
  const displayMargeBrute = horizon === "5ans" ? pnl5ans.mb : aggCA - aggCMP;
  const displayTotalCharges =
    horizon === "5ans"
      ? pnl5ans.totalFF + pnl5ans.amor
      : aggSal + aggLoy + aggAutres;
  const displayCA = horizon === "5ans" ? pnl5ans.ca : aggCA;
  const marge = displayCA > 0 ? (displayResultatNet / displayCA) * 100 : 0;

  const hLabel =
    horizon === "mensuel"
      ? "Mensuel"
      : horizon === "annuel"
        ? "Annuel (12 mois)"
        : "5 ans";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <KpiSkeleton cols={4} />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="bp-reel.tab.panel">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">Business Plan Réel</h3>
          <p className="text-sm text-muted-foreground">
            Projection basée sur les ventes réelles · Marge brute pondérée par
            le mix produit · Paramètres depuis Paramétrage
          </p>
        </div>
        <HorizonTabs value={horizon} onChange={setHorizon} />
      </div>

      {/* Growth coefficient note for 5-ans view */}
      {horizon === "5ans" && growthCoeff !== 1.0 && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription className="text-xs flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
            Coefficient de croissance appliqué :{" "}
            <strong className="text-primary">
              +{((growthCoeff - 1) * 100).toFixed(1)}% par an
            </strong>{" "}
            — chaque année est calculée sur la précédente × {growthCoeff}.
            Modifiable dans l'onglet Paramétrage.
          </AlertDescription>
        </Alert>
      )}
      {horizon === "5ans" && growthCoeff === 1.0 && (
        <Alert className="border-muted/50 bg-muted/10">
          <AlertDescription className="text-xs text-muted-foreground">
            Projection linéaire (coefficient de croissance = 1,0). Pour ajouter
            une croissance annuelle, ajustez le coefficient dans l'onglet
            Paramétrage.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label={`CA ${hLabel}`}
          value={fmtEur(displayCA)}
          sub={`Réel enregistré : ${fmtEur(reelCAMensuel)}`}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          accent
        />
        <KpiCard
          label="Marge brute"
          value={fmtEur(displayMargeBrute)}
          sub={`${weightedMarge.toFixed(1)}% pondérée`}
          icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
        />
        <KpiCard
          label="Charges"
          value={fmtEur(displayTotalCharges)}
          sub={`Amort. inclus : ${fmtEur(aggAmor)}`}
          icon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />}
        />
        <KpiCard
          label="Résultat Net"
          value={fmtEur(displayResultatNet)}
          sub={`Marge nette : ${fmtPct(marge)}`}
          icon={
            displayResultatNet >= 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )
          }
          positive={displayResultatNet >= 0}
        />
      </div>

      {/* No ventes warning */}
      {reelCAMensuel === 0 && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertDescription className="text-xs">
            ⚠️ Aucune vente enregistrée — la projection utilise les paramètres de
            simulation. Enregistrez des ventes dans l'onglet Ventes du jour pour
            affiner ce plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Mix breakdown toggle */}
      <button
        type="button"
        onClick={() => setShowMixBreakdown(!showMixBreakdown)}
        className="text-xs text-primary underline flex items-center gap-1"
        data-ocid="bp-reel.toggle_mix_detail_button"
      >
        <Info className="h-3 w-3" />
        {showMixBreakdown
          ? "Masquer le détail du mix produit"
          : "Voir le mix produit utilisé pour la marge pondérée"}
      </button>

      {showMixBreakdown && (
        <MixBreakdownPanel
          breakdown={breakdown}
          weightedMarge={weightedMarge}
        />
      )}

      {/* 5-ans: year-by-year table */}
      {horizon === "5ans" ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-muted/20">
            <CardTitle className="text-sm font-semibold">
              Projection sur 5 ans — année par année
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Année</TableHead>
                  <TableHead className="text-right">CA HT</TableHead>
                  <TableHead className="text-right">CMP</TableHead>
                  <TableHead className="text-right">Marge Brute</TableHead>
                  <TableHead className="text-right">Charges Fixes</TableHead>
                  <TableHead className="text-right">EBE</TableHead>
                  <TableHead className="text-right">Résultat Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiveYearRows.map((y, idx) => (
                  <TableRow
                    key={y.label}
                    className={idx % 2 === 1 ? "bg-muted/5" : ""}
                    data-ocid={`bp-reel.5ans.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium">{y.label}</TableCell>
                    <TableCell className="text-right text-primary font-semibold">
                      {fmtEur(y.ca)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtEur(y.cmp)}
                    </TableCell>
                    <TableCell className="text-right">{fmtEur(y.mb)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtEur(y.totalFF)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(y.ebe)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        y.rn >= 0 ? "text-green-400" : "text-destructive"
                      }`}
                    >
                      {fmtEur(y.rn)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <TableRow className="bg-muted/40 border-t-2 font-bold">
                  <TableCell className="font-bold">TOTAL 5 ANS</TableCell>
                  <TableCell className="text-right text-primary">
                    {fmtEur(pnl5ans.ca)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(pnl5ans.cmp)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(pnl5ans.mb)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(pnl5ans.totalFF)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(pnl5ans.ebe)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      pnl5ans.rn >= 0 ? "text-green-400" : "text-destructive"
                    }`}
                  >
                    {fmtEur(pnl5ans.rn)}
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </CardContent>
        </Card>
      ) : (
        /* Mensuel / Annuel: P&L compte de résultat */
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold">
                Compte de résultat — {hLabel}
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowMix(!showMix)}
                className="text-xs text-primary underline"
                data-ocid="bp-reel.toggle_mix_button"
              >
                {showMix
                  ? "Masquer détail mix"
                  : "Afficher détail par catégorie"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <PnLTable rows={rows} ca={aggCA} />
          </CardContent>
        </Card>
      )}

      {/* Monthly breakdown for annuel view */}
      {horizon === "annuel" && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-muted/20">
            <CardTitle className="text-sm font-semibold">
              Détail mensuel — 12 mois
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">CA HT</TableHead>
                  <TableHead className="text-right">CMP</TableHead>
                  <TableHead className="text-right">Marge Brute</TableHead>
                  <TableHead className="text-right">Charges Fixes</TableHead>
                  <TableHead className="text-right">EBE</TableHead>
                  <TableHead className="text-right">Résultat Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((m, idx) => (
                  <TableRow
                    key={`${m.label}-${m.year}`}
                    className={idx % 2 === 1 ? "bg-muted/5" : ""}
                    data-ocid={`bp-reel.monthly.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium text-xs">
                      {m.label} {m.year}
                    </TableCell>
                    <TableCell className="text-right text-primary font-semibold">
                      {fmtEur(m.ca)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtEur(m.cmp)}
                    </TableCell>
                    <TableCell className="text-right">{fmtEur(m.mb)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtEur(m.totalFF)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(m.ebe)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        m.rn >= 0 ? "text-green-400" : "text-destructive"
                      }`}
                    >
                      {fmtEur(m.rn)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <TableRow className="bg-muted/40 border-t-2 font-bold">
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell className="text-right text-primary">
                    {fmtEur(annualCA)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(annualCMP)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(annualCA - annualCMP)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(annualSal + annualLoy + annualAutres)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtEur(sumM("ebe"))}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      resultatNet >= 0 ? "text-green-400" : "text-destructive"
                    }`}
                  >
                    {fmtEur(resultatNet)}
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Seuil de rentabilité — only for mensuel/annuel */}
      {horizon !== "5ans" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card className="bg-muted/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Seuil de rentabilité
              </p>
              <p className="text-xl font-bold text-amber-400">
                {fmtEur(seuilMensuel)}/mois
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Marge de sécurité
              </p>
              <p
                className={`text-xl font-bold ${
                  margeSec >= 0 ? "text-green-400" : "text-destructive"
                }`}
              >
                {fmtPct(margeSec)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Marge brute pondérée
              </p>
              <p className="text-xl font-bold text-primary">
                {weightedMarge.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                Food cost : {weightedFoodCost.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
