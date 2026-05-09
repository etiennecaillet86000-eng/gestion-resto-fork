/**
 * TabRentabiliteMixProduit.tsx — Rentabilité Mix Produit
 * Reads mixCategories + params from store. No param inputs here.
 * Horizons: Mensuel | Annuel | 5 ans
 */
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
import {
  calculateMixProduitRentabilite,
  getScenarioCoefficient,
} from "@/core/utils/projectionMath";
import type { MixCategorie } from "@/core/utils/projectionMath";
import {
  useAmortissements,
  useAssociesGerants,
  useEmprunts,
  useFraisFixes,
  useSalaries,
} from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import {
  BarChart3,
  CheckCircle2,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PnLHorizon } from "./shared";
import { KpiCard, KpiSkeleton, PnLTable } from "./shared";

const JOURS_PAR_MOIS = 26;

function HorizonTabs({
  value,
  onChange,
}: { value: PnLHorizon; onChange: (v: PnLHorizon) => void }) {
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
          data-ocid={`mix-produit.horizon.${o.v}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TabRentabiliteMixProduit() {
  const { params, mixCategories, businessPlanParams, setMixProduitResults } =
    useProjectionStore();
  const bpp = businessPlanParams;
  const { data: fraisFixes = [], isLoading: loadingFF } = useFraisFixes();
  const { data: salaries = [] } = useSalaries();
  const { data: associes = [] } = useAssociesGerants();
  const { data: amortissements = [] } = useAmortissements();
  const { data: emprunts = [] } = useEmprunts();
  const [horizon, setHorizon] = useState<PnLHorizon>("mensuel");

  const ffMensuelDB = useMemo(
    () => fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0),
    [fraisFixes],
  );

  // Auto-aggregated charges
  const salairesMensuel = useMemo(
    () =>
      salaries.reduce((s, e) => s + (e.salaireAnnuelBrut * 1.42) / 12, 0) +
      associes.reduce((a, x) => a + x.remunerationAnnuelle / 12, 0),
    [salaries, associes],
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

  const fraisFixesEffectif = salairesMensuel + ffMensuelDB + empruntsMensuel;

  const scenarioCoeff = getScenarioCoefficient(params.scenario);
  const couvertsTotal = params.couvertsDejeunner + params.couvertsDiner;
  const avgSaisonCoeff = params.seasonalite.reduce((s, v) => s + v, 0) / 12;

  // Average seasonality coefficient per period
  const saison = horizon === "mensuel" ? avgSaisonCoeff : avgSaisonCoeff;

  const effectiveCouvertsJour = couvertsTotal * scenarioCoeff * saison;

  const result = useMemo(() => {
    if ((mixCategories as MixCategorie[]).length === 0) return null;
    return calculateMixProduitRentabilite(
      mixCategories as MixCategorie[],
      effectiveCouvertsJour,
      params.tauxRemplissage,
      params.ticketMoyen,
      JOURS_PAR_MOIS,
      fraisFixesEffectif,
    );
  }, [mixCategories, effectiveCouvertsJour, params, fraisFixesEffectif]);

  // Export to store for Operations tab
  useEffect(() => {
    if (result) {
      setMixProduitResults(
        result.seuilMensuel,
        result.margeMoyennePonderee,
        result.caMensuel,
      );
    }
  }, [result, setMixProduitResults]);

  const mult = horizon === "mensuel" ? 1 : horizon === "annuel" ? 12 : 60;

  // Amortissement & imposition from store
  const amor = amortissementMensuel * mult;
  const tauxImp = bpp.tauxImposition;

  const caTotal = result ? result.caMensuel * mult : 0;
  const cmpTotal = result ? result.coutMatiereMensuel * mult : 0;
  const mbTotal = result ? result.margeBruteMensuelle * mult : 0;
  const ffTotal = fraisFixesEffectif * mult;
  const ebeTotal = mbTotal - ffTotal;
  const reTotal = ebeTotal - amor;
  const impTotal = Math.max(reTotal, 0) * (tauxImp / 100);
  const rnTotal = reTotal - impTotal;
  const margeNette = caTotal > 0 ? (rnTotal / caTotal) * 100 : 0;
  const seuilMensuel = result?.seuilMensuel ?? 0;
  const margeSec =
    caTotal > seuilMensuel * mult && seuilMensuel > 0
      ? ((caTotal - seuilMensuel * mult) / caTotal) * 100
      : 0;

  const hLabel =
    horizon === "mensuel"
      ? "Mensuel"
      : horizon === "annuel"
        ? "Annuel"
        : "5 ans";

  const pnlRows = [
    {
      label: "Chiffre d'affaires HT",
      valeur: caTotal,
      pctCA: 100,
      isBold: true,
    },
    ...(mixCategories as MixCategorie[]).map((c) => ({
      label: `\u21b3 ${c.label} (${c.pctCA.toFixed(0)}% du mix)`,
      valeur: caTotal * (c.pctCA / 100),
      isIndented: true,
    })),
    { label: "", valeur: 0, isSeparator: true },
    { label: "(−) Coût des matières premières", valeur: -cmpTotal },
    {
      label: `Marge brute pondérée (${result ? result.margeMoyennePonderee.toFixed(1) : 0}%)`,
      valeur: mbTotal,
      isSubtotal: true,
      isBold: true,
    },
    { label: "", valeur: 0, isSeparator: true },
    { label: "(−) Charges fixes totales", valeur: -ffTotal, isBold: true },
    {
      label: "  ↳ Salaires & associés",
      valeur: -salairesMensuel * mult,
      isIndented: true,
    },
    {
      label: "  ↳ Frais fixes",
      valeur: -ffMensuelDB * mult,
      isIndented: true,
    },
    {
      label: "  ↳ Emprunts",
      valeur: -empruntsMensuel * mult,
      isIndented: true,
    },
    { label: "", valeur: 0, isSeparator: true },
    { label: "EBE", valeur: ebeTotal, isSubtotal: true, isBold: true },
    { label: "(−) Amortissements", valeur: -amor, isIndented: true },
    {
      label: "Résultat d'exploitation",
      valeur: reTotal,
      isSubtotal: true,
      isBold: true,
    },
    { label: "(−) Impôts", valeur: -impTotal, isIndented: true },
    { label: "RÉSULTAT NET", valeur: rnTotal, isTotal: true, isBold: true },
    { label: "", valeur: 0, isSeparator: true },
    {
      label: "Seuil de rentabilité mensuel",
      valeur: seuilMensuel,
      isSubtotal: true,
    },
    {
      label: "Marge de sécurité",
      valeur: caTotal > 0 ? margeSec : 0,
      pctCA: margeSec,
      isSubtotal: true,
    },
  ];

  if (loadingFF) return <KpiSkeleton cols={4} />;

  return (
    <div className="space-y-6" data-ocid="mix-produit.tab.panel">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">Rentabilité Mix Produit</h3>
          <p className="text-sm text-muted-foreground">
            Projection basée sur les catégories de recettes · Paramètres depuis
            l’onglet Paramétrage
          </p>
        </div>
        <HorizonTabs value={horizon} onChange={setHorizon} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label={`CA Projeté (${hLabel})`}
          value={fmtEur(caTotal)}
          sub={`Scénario : ${params.scenario}`}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          accent
        />
        <KpiCard
          label="Coût Matières"
          value={fmtEur(cmpTotal)}
          sub={result ? fmtPct(100 - result.margeMoyennePonderee) : "—"}
          icon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />}
        />
        <KpiCard
          label="Marge Brute"
          value={fmtEur(mbTotal)}
          sub={result ? fmtPct(result.margeMoyennePonderee) : "—"}
          icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
        />
        <KpiCard
          label="Résultat Net"
          value={fmtEur(rnTotal)}
          sub={`Marge nette : ${fmtPct(margeNette)}`}
          icon={
            rnTotal >= 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )
          }
          positive={rnTotal >= 0}
        />
      </div>

      {/* P&L Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-muted/20">
          <CardTitle className="text-sm font-semibold">
            Compte de résultat — {hLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PnLTable rows={pnlRows} ca={caTotal} />
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-muted/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Point mort
            </p>
            <p className="text-lg font-bold text-amber-400">
              {result ? `${Math.ceil(result.couvertsPointMort)} cvts/j` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Seuil mensuel
            </p>
            <p className="text-lg font-bold text-amber-400">
              {fmtEur(seuilMensuel)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Marge de sécurité
            </p>
            <p
              className={`text-lg font-bold ${margeSec >= 0 ? "text-green-400" : "text-destructive"}`}
            >
              {fmtPct(margeSec)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Marge pondérée
            </p>
            <p className="text-lg font-bold text-primary">
              {result ? fmtPct(result.margeMoyennePonderee) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mix breakdown table */}
      {(mixCategories as MixCategorie[]).length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-muted/20">
            <CardTitle className="text-sm font-semibold">
              Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">% CA</TableHead>
                  <TableHead className="text-right">CA ({hLabel})</TableHead>
                  <TableHead className="text-right">Marge brute avg</TableHead>
                  <TableHead className="text-right">
                    Contribution marge
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(mixCategories as MixCategorie[]).map((cat, idx) => (
                  <TableRow
                    key={cat.label}
                    className={idx % 2 === 1 ? "bg-muted/5" : ""}
                    data-ocid={`mix-produit.category.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium text-sm">
                      {cat.label}
                    </TableCell>
                    <TableCell className="text-right">
                      {cat.pctCA.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-primary font-semibold">
                      {fmtEur(caTotal * (cat.pctCA / 100))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-400 font-medium">
                        {cat.margeBruteAvg.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(
                        caTotal * (cat.pctCA / 100) * (cat.margeBruteAvg / 100),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
