/**
 * TabCAF.tsx — Capacité d'Autofinancement
 * Correlates Business Initial, Business Plan Réel, and Rentabilité Mix
 * No param inputs here.
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
  useRecettes,
  useSalaries,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type { Recette, VenteRecette } from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import { AlertTriangle, BarChart3, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard, KpiSkeleton, MONTH_SHORT, prixHTFromTTC } from "./shared";

const JOURS_PAR_MOIS = 26;

interface SourceMetrics {
  label: string;
  caAnnuel: number;
  resultatNet: number;
  amortissements: number;
  seuilMensuel: number;
  margeNette: number;
  margeSec: number;
  cafMensuelle: number;
  cafAnnuelle: number;
  caf5ans: number;
  monthly12: number[];
}

function computeMetrics(
  label: string,
  caAnnuel: number,
  rnAnnuel: number,
  amor: number,
  seuil: number,
): SourceMetrics {
  const cafM = (rnAnnuel + amor) / 12;
  const margeNette = caAnnuel > 0 ? (rnAnnuel / caAnnuel) * 100 : 0;
  const margeSec =
    caAnnuel > seuil * 12 && seuil > 0
      ? ((caAnnuel - seuil * 12) / caAnnuel) * 100
      : 0;
  return {
    label,
    caAnnuel,
    resultatNet: rnAnnuel,
    amortissements: amor,
    seuilMensuel: seuil,
    margeNette,
    margeSec,
    cafMensuelle: cafM,
    cafAnnuelle: rnAnnuel + amor,
    caf5ans: (rnAnnuel + amor) * 5,
    monthly12: [],
  };
}

export default function TabCAF() {
  const { params, mixCategories, businessPlanParams } = useProjectionStore();
  const bpp = businessPlanParams;

  const { data: fraisFixes = [], isLoading: loadingFF } = useFraisFixes();
  const { data: ventes = [], isLoading: loadingVentes } = useVentesRecettes();
  const { data: recettes = [], isLoading: loadingRecettes } = useRecettes();
  const { data: salaries = [] } = useSalaries();
  const { data: associes = [] } = useAssociesGerants();
  const { data: amortissements = [] } = useAmortissements();
  const { data: emprunts = [] } = useEmprunts();

  const isLoading = loadingFF || loadingVentes || loadingRecettes;

  const ffMensuelDB = useMemo(
    () => fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0),
    [fraisFixes],
  );

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
  const amor = amortissementMensuel;
  const tauxImp = bpp.tauxImposition;

  const recetteMap = useMemo(
    () => new Map<string, Recette>(recettes.map((r) => [r.id, r])),
    [recettes],
  );

  const scenarioCoeff = getScenarioCoefficient(params.scenario);
  const couvertsTotal = params.couvertsDejeunner + params.couvertsDiner;
  const caBaseJour =
    couvertsTotal *
    (params.tauxRemplissage / 100) *
    params.ticketMoyen *
    scenarioCoeff;

  // ── Business Initial (12m) ──
  const biMonthly = useMemo(() => {
    const _caBaseJour = caBaseJour;
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const mIdx = (now.getMonth() + i) % 12;
      const ca =
        _caBaseJour * (params.seasonalite[mIdx % 12] ?? 1) * JOURS_PAR_MOIS;
      const cmp = ca * (params.foodCostRatio / 100);
      const mb = ca - cmp;
      const ff = fraisFixesEffectif;
      const ebe = mb - ff;
      const re = ebe - amor;
      const imp = Math.max(re, 0) * (tauxImp / 100);
      return { ca, rn: re - imp };
    });
  }, [params, caBaseJour, fraisFixesEffectif, amor, tauxImp]);

  const biCAnn = biMonthly.reduce((s, m) => s + m.ca, 0);
  const biRNAnn = biMonthly.reduce((s, m) => s + m.rn, 0);
  const biAmorAnn = amor * 12;
  const biMixResult = useMemo(() => {
    const avgSaison = params.seasonalite.reduce((s, v) => s + v, 0) / 12;
    return calculateMixProduitRentabilite(
      mixCategories as MixCategorie[],
      couvertsTotal * scenarioCoeff * avgSaison,
      params.tauxRemplissage,
      params.ticketMoyen,
      JOURS_PAR_MOIS,
      fraisFixesEffectif,
    );
  }, [mixCategories, couvertsTotal, scenarioCoeff, params, fraisFixesEffectif]);

  const biSeuil =
    biCAnn > 0 && biRNAnn !== 0
      ? fraisFixesEffectif / (1 - params.foodCostRatio / 100)
      : 0;

  const biMetrics = computeMetrics(
    "Business Initial",
    biCAnn,
    biRNAnn,
    biAmorAnn,
    biSeuil,
  );

  // ── Business Plan Réel ──
  const reelCA = useMemo(
    () =>
      ventes.reduce((sum, v: VenteRecette) => {
        const r = recetteMap.get(v.recetteId);
        if (!r) return sum;
        return sum + prixHTFromTTC(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      }, 0),
    [ventes, recetteMap],
  );
  const bprCAnn = reelCA > 0 ? reelCA : biCAnn;
  const bprCMPAnn = bprCAnn * (params.foodCostRatio / 100);
  const bprMBAnn = bprCAnn - bprCMPAnn;
  const bprFFAnn = fraisFixesEffectif * 12;
  const bprEBEAnn = bprMBAnn - bprFFAnn;
  const bprREAnn = bprEBEAnn - biAmorAnn;
  const bprImpAnn = Math.max(bprREAnn, 0) * (tauxImp / 100);
  const bprRNAnn = bprREAnn - bprImpAnn;
  const bprSeuil =
    bprMBAnn > 0 && bprCAnn > 0 ? bprFFAnn / (bprMBAnn / bprCAnn) / 12 : 0;
  const bprMetrics = computeMetrics(
    "Business Plan Réel",
    bprCAnn,
    bprRNAnn,
    biAmorAnn,
    bprSeuil,
  );

  // ── Mix Produit ──
  const mixCAnn = biMixResult.caMensuel * 12;
  const mixRNAnn = (() => {
    const mb = biMixResult.margeBruteMensuelle * 12;
    const ff = fraisFixesEffectif * 12;
    const ebe = mb - ff;
    const re = ebe - biAmorAnn;
    return re - Math.max(re, 0) * (tauxImp / 100);
  })();
  const mixMetrics = computeMetrics(
    "Rentabilité Mix",
    mixCAnn,
    mixRNAnn,
    biAmorAnn,
    biMixResult.seuilMensuel,
  );

  const sources = [biMetrics, bprMetrics, mixMetrics];

  // ── Monthly margin-of-safety chart (12m) ──
  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const mIdx = (now.getMonth() + i) % 12;
      const ca =
        caBaseJour * (params.seasonalite[mIdx % 12] ?? 1) * JOURS_PAR_MOIS;
      const biMarg = biSeuil > 0 ? ((ca - biSeuil) / ca) * 100 : 0;
      const bprCA = reelCA / 12;
      const bprMarg = bprSeuil > 0 ? ((bprCA - bprSeuil) / bprCA) * 100 : 0;
      const mixCA = biMixResult.caMensuel * (params.seasonalite[mIdx] ?? 1);
      const mixMarg =
        biMixResult.seuilMensuel > 0
          ? ((mixCA - biMixResult.seuilMensuel) / mixCA) * 100
          : 0;
      return {
        mois: MONTH_SHORT[mIdx],
        "Business Initial": Math.round(biMarg * 10) / 10,
        "BP Réel": Math.round(bprMarg * 10) / 10,
        "Mix Produit": Math.round(mixMarg * 10) / 10,
      };
    });
  }, [params, caBaseJour, biMixResult, biSeuil, bprSeuil, reelCA]);

  if (isLoading) return <KpiSkeleton cols={3} />;

  return (
    <div className="space-y-6" data-ocid="caf.tab.panel">
      <div>
        <h3 className="text-base font-semibold">Capacité d'Autofinancement</h3>
        <p className="text-sm text-muted-foreground">
          Mise en corrélation des 3 projections · CAF = Résultat Net + Dotations
          aux amortissements
        </p>
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-muted/20">
          <CardTitle className="text-sm font-semibold">
            Comparatif des 3 projections
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Indicateur</TableHead>
                {sources.map((s) => (
                  <TableHead key={s.label} className="text-right">
                    {s.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: "CA Annuel", key: "caAnnuel" as const, fmt: fmtEur },
                {
                  label: "Résultat Net",
                  key: "resultatNet" as const,
                  fmt: fmtEur,
                },
                {
                  label: "Marge Nette %",
                  key: "margeNette" as const,
                  fmt: fmtPct,
                },
                {
                  label: "Seuil Rentabilité/mois",
                  key: "seuilMensuel" as const,
                  fmt: fmtEur,
                },
                {
                  label: "Marge de sécurité %",
                  key: "margeSec" as const,
                  fmt: fmtPct,
                },
                {
                  label: "CAF Mensuelle",
                  key: "cafMensuelle" as const,
                  fmt: fmtEur,
                },
                {
                  label: "CAF Annuelle",
                  key: "cafAnnuelle" as const,
                  fmt: fmtEur,
                },
                {
                  label: "CAF 5 ans cumulée",
                  key: "caf5ans" as const,
                  fmt: fmtEur,
                },
              ].map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium text-sm">
                    {row.label}
                  </TableCell>
                  {sources.map((s, si) => {
                    const val = s[row.key] as number;
                    const isRN = row.key === "resultatNet";
                    const isMarge =
                      row.key === "margeNette" || row.key === "margeSec";
                    return (
                      <TableCell
                        key={`${row.key}-${si}`}
                        className={`text-right font-semibold ${
                          isRN || isMarge
                            ? val >= 0
                              ? "text-green-400"
                              : "text-destructive"
                            : ""
                        }`}
                        data-ocid={`caf.${row.key}.${si + 1}`}
                      >
                        {row.fmt(val)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delta analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Écart : Business Initial vs Business Plan Réel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["CA Annuel", "Résultat Net", "CAF Annuelle"].map((label, idx) => {
              const keys = ["caAnnuel", "resultatNet", "cafAnnuelle"] as const;
              const k = keys[idx];
              const bi = biMetrics[k] as number;
              const bpr = bprMetrics[k] as number;
              const diff = bi - bpr;
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span
                    className={`text-xs font-bold ${
                      diff >= 0 ? "text-green-400" : "text-amber-400"
                    }`}
                  >
                    {diff >= 0 ? "+" : ""}
                    {fmtEur(diff)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Écart : Business Initial vs Rentabilité Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["CA Annuel", "Résultat Net", "CAF Annuelle"].map((label, idx) => {
              const keys = ["caAnnuel", "resultatNet", "cafAnnuelle"] as const;
              const k = keys[idx];
              const bi = biMetrics[k] as number;
              const mix = mixMetrics[k] as number;
              const diff = bi - mix;
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span
                    className={`text-xs font-bold ${
                      diff >= 0 ? "text-green-400" : "text-amber-400"
                    }`}
                  >
                    {diff >= 0 ? "+" : ""}
                    {fmtEur(diff)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Monthly margin-of-safety chart */}
      <Card data-ocid="caf.chart.panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Marge de sécurité mensuelle (%) — 12 mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="mois"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Business Initial"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="BP Réel"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Mix Produit"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* CAF summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {sources.map((s) => (
          <Card key={s.label} className="bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  CAF mensuelle
                </span>
                <span
                  className={`text-sm font-bold ${s.cafMensuelle >= 0 ? "text-green-400" : "text-destructive"}`}
                >
                  {fmtEur(s.cafMensuelle)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  CAF annuelle
                </span>
                <span
                  className={`text-sm font-bold ${s.cafAnnuelle >= 0 ? "text-green-400" : "text-destructive"}`}
                >
                  {fmtEur(s.cafAnnuelle)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">CAF 5 ans</span>
                <span
                  className={`font-bold ${s.caf5ans >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {fmtEur(s.caf5ans)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
