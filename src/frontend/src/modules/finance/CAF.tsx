import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Recette } from "@/hooks/useQueries";
import { fmtEur, fmtPct, prixHT } from "@/utils/format";
import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOIS_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function margeSafetyColor(pct: number): string {
  if (pct >= 20) return "text-green-400";
  if (pct >= 10) return "text-yellow-400";
  return "text-destructive";
}

function margeSafetyBg(pct: number): string {
  if (pct >= 20) return "bg-green-500/10 border border-green-500/20";
  if (pct >= 10) return "bg-yellow-500/10 border border-yellow-500/20";
  return "bg-destructive/10 border border-destructive/20";
}

function margeSafetyDot(pct: number): string {
  if (pct >= 20) return "bg-green-400";
  if (pct >= 10) return "bg-yellow-400";
  return "bg-destructive";
}

function cafColor(caf: number): string {
  return caf >= 0 ? "text-green-400" : "text-destructive";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CAFTab() {
  const { data: ventes = [], isLoading: lv } = useVentesRecettes();
  const { data: recettes = [], isLoading: lr } = useRecettes();
  const { data: fraisFixes = [], isLoading: lff } = useFraisFixes();
  const { data: salaries = [], isLoading: ls } = useSalaries();
  const { data: amortissements = [], isLoading: la } = useAmortissements();
  const { data: emprunts = [], isLoading: le } = useEmprunts();
  const { data: associes = [] } = useAssociesGerants();

  const isLoading = lv || lr || lff || ls || la || le;

  const recetteMap = useMemo(
    () => new Map<string, Recette>(recettes.map((r) => [r.id, r])),
    [recettes],
  );

  // ── Annual base values ────────────────────────────────────────────────────

  const totalFFMensuel = fraisFixes.reduce(
    (s, l) => s + l.montantMensuelAvecRemu,
    0,
  );
  const totalSalairesAnnuel = salaries.reduce(
    (s, sal) => s + sal.salaireAnnuelBrut,
    0,
  );
  const totalRemuAnnuel = associes.reduce(
    (s, a) => s + a.remunerationAnnuelle,
    0,
  );
  const dotationAnnuelle = totalDotationsParAnnee(amortissements, 1);
  const dotationMensuelle = dotationAnnuelle / 12;

  const interetsMensuel = emprunts.reduce((s, e) => {
    const tauxM = e.tauxAnnuel / 100 / 12;
    return s + e.montant * tauxM;
  }, 0);
  const chargesFinancieresAnnuelles = interetsMensuel * 12;

  // Seuil mensuel = (frais fixes + salaires + remu + intérêts) / 12 + dotation mensuelle
  const seuilMensuel =
    (totalFFMensuel * 12 +
      totalSalairesAnnuel +
      totalRemuAnnuel +
      chargesFinancieresAnnuelles) /
      12 +
    dotationMensuelle;

  // ── CA mensuel réel (from ventes grouped by month) ────────────────────────

  const caMensuelReel = useMemo(() => {
    const map = new Map<number, number>(); // month index 0-11
    const year = new Date().getFullYear();
    for (const v of ventes) {
      const d = new Date(v.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      const ht = prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      map.set(d.getMonth(), (map.get(d.getMonth()) ?? 0) + ht);
    }
    return map;
  }, [ventes, recetteMap]);

  const coutMatieresMensuel = useMemo(() => {
    const map = new Map<number, number>();
    const year = new Date().getFullYear();
    for (const v of ventes) {
      const d = new Date(v.date);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      map.set(
        d.getMonth(),
        (map.get(d.getMonth()) ?? 0) + r.consommablesHT * v.quantite,
      );
    }
    return map;
  }, [ventes, recetteMap]);

  // ── Monthly CAF rows ──────────────────────────────────────────────────────

  interface MoisCAF {
    mois: string;
    ca: number;
    resultat: number;
    caf: number;
    margeSafety: number;
  }

  const moisRows: MoisCAF[] = useMemo(() => {
    return MOIS_FR.map((label, idx) => {
      const ca = caMensuelReel.get(idx) ?? 0;
      const coutsM = coutMatieresMensuel.get(idx) ?? 0;
      const chargesM =
        totalFFMensuel +
        totalSalairesAnnuel / 12 +
        totalRemuAnnuel / 12 +
        interetsMensuel +
        dotationMensuelle;
      const resultat = ca - coutsM - chargesM;
      const caf = resultat + dotationMensuelle;
      const margeSafety = ca > 0 ? ((ca - seuilMensuel) / ca) * 100 : 0;
      return { mois: label, ca, resultat, caf, margeSafety };
    });
  }, [
    caMensuelReel,
    coutMatieresMensuel,
    totalFFMensuel,
    totalSalairesAnnuel,
    totalRemuAnnuel,
    interetsMensuel,
    dotationMensuelle,
    seuilMensuel,
  ]);

  // ── Annual aggregates ─────────────────────────────────────────────────────

  const totalCAReel = [...caMensuelReel.values()].reduce((s, v) => s + v, 0);
  const chargesAnnuelles =
    totalFFMensuel * 12 +
    totalSalairesAnnuel +
    totalRemuAnnuel +
    chargesFinancieresAnnuelles +
    dotationAnnuelle;
  const coutMatiereAnnuel = [...coutMatieresMensuel.values()].reduce(
    (s, v) => s + v,
    0,
  );
  const resultatAnnuel = totalCAReel - coutMatiereAnnuel - chargesAnnuelles;
  const cafAnnuelle = resultatAnnuel + dotationAnnuelle;
  const cafMoyenneMensuelle = moisRows.reduce((s, r) => s + r.caf, 0) / 12;
  const margeSafetyAnnuelle =
    totalCAReel > 0
      ? ((totalCAReel - seuilMensuel * 12) / totalCAReel) * 100
      : 0;
  const capaciteRemboursement =
    chargesFinancieresAnnuelles > 0
      ? cafAnnuelle / chargesFinancieresAnnuelles
      : null;

  const anneeLabel = String(new Date().getFullYear());

  const chartData = moisRows.map((r) => ({
    mois: r.mois,
    caf: Math.round(r.caf),
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Two sections side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── SECTION A : CAF Annuelle ──────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            CAF Annuelle
          </h3>

          <Card
            className={`${margeSafetyBg(margeSafetyAnnuelle)} overflow-hidden`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Exercice {anneeLabel}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    cafAnnuelle >= 0
                      ? "bg-green-500/20 text-green-400"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {cafAnnuelle >= 0 ? "✓ Positive" : "✗ Négative"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CAF */}
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">Résultat Net</p>
                  <p
                    className={`font-bold text-lg ${cafColor(resultatAnnuel)}`}
                  >
                    {fmtEur(resultatAnnuel)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    + Dotations Amort.
                  </p>
                  <p className="font-bold text-lg text-muted-foreground">
                    {fmtEur(dotationAnnuelle)}
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-lg p-3 text-center border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">
                  CAF Annuelle
                </p>
                <p className={`text-2xl font-bold ${cafColor(cafAnnuelle)}`}>
                  {fmtEur(cafAnnuelle)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  = Résultat Net + Amortissements
                </p>
              </div>

              {/* Marge de sécurité */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Marge de Sécurité
                  </p>
                  <p
                    className={`text-xl font-bold ${margeSafetyColor(margeSafetyAnnuelle)}`}
                  >
                    {fmtPct(margeSafetyAnnuelle)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (CA réel – Seuil) / CA
                  </p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Cap. de Remboursement
                  </p>
                  {capaciteRemboursement !== null ? (
                    <p
                      className={`text-xl font-bold ${capaciteRemboursement >= 1 ? "text-green-400" : "text-destructive"}`}
                    >
                      {capaciteRemboursement.toFixed(1)}x
                    </p>
                  ) : (
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    CAF / Charges fin.
                  </p>
                </div>
              </div>

              {/* Charges summary */}
              <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                <div className="flex justify-between">
                  <span>CA Réel</span>
                  <span className="font-medium text-foreground">
                    {fmtEur(totalCAReel)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Seuil de Rentabilité (annuel)</span>
                  <span className="font-medium text-foreground">
                    {fmtEur(seuilMensuel * 12)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Dotations Amortissements</span>
                  <span className="font-medium text-foreground">
                    {fmtEur(dotationAnnuelle)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Charges Financières</span>
                  <span className="font-medium text-foreground">
                    {fmtEur(chargesFinancieresAnnuelles)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── SECTION B : CAF Mensuelle ─────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />
            CAF Mensuelle — 12 mois glissants
          </h3>

          {/* Summary average */}
          <div className="flex gap-3">
            <Card className="flex-1">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  CAF Moy. Mensuelle
                </p>
                <p
                  className={`text-lg font-bold ${cafColor(cafMoyenneMensuelle)}`}
                >
                  {fmtEur(cafMoyenneMensuelle)}
                </p>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  CAF Annuelle projetée
                </p>
                <p
                  className={`text-lg font-bold ${cafColor(cafMoyenneMensuelle * 12)}`}
                >
                  {fmtEur(cafMoyenneMensuelle * 12)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trend chart */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Tendance CAF mensuelle
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart
                  data={chartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <XAxis
                    dataKey="mois"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [fmtEur(value), "CAF"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "11px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="caf"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly grid */}
          <div
            className="grid grid-cols-3 sm:grid-cols-4 gap-2"
            data-ocid="caf.mois.list"
          >
            {moisRows.map((row, idx) => (
              <Card
                key={row.mois}
                className="p-2 text-center"
                data-ocid={`caf.mois.item.${idx + 1}`}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {row.mois}
                </p>
                <p className={`text-sm font-bold mt-0.5 ${cafColor(row.caf)}`}>
                  {fmtEur(row.caf)}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${margeSafetyDot(row.margeSafety)}`}
                  />
                  <span
                    className={`text-xs ${margeSafetyColor(row.margeSafety)}`}
                  >
                    {row.margeSafety.toFixed(1)}%
                  </span>
                </div>
              </Card>
            ))}
          </div>

          {/* Detailed monthly table */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                Détail mensuel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Mois</th>
                      <th className="text-right px-3 py-2 font-medium">CA</th>
                      <th className="text-right px-3 py-2 font-medium">
                        Résultat
                      </th>
                      <th className="text-right px-3 py-2 font-medium">CAF</th>
                      <th className="text-right px-3 py-2 font-medium">
                        Marge Sécu.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {moisRows.map((row, idx) => (
                      <tr
                        key={row.mois}
                        className={
                          idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                        }
                        data-ocid={`caf.table.row.${idx + 1}`}
                      >
                        <td className="px-3 py-2 font-medium">{row.mois}</td>
                        <td className="px-3 py-2 text-right">
                          {row.ca > 0 ? fmtEur(row.ca) : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right ${cafColor(row.resultat)}`}
                        >
                          {fmtEur(row.resultat)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-semibold ${cafColor(row.caf)}`}
                        >
                          {fmtEur(row.caf)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-flex items-center gap-1 ${margeSafetyColor(row.margeSafety)}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${margeSafetyDot(row.margeSafety)}`}
                            />
                            {fmtPct(row.margeSafety)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {ventes.length === 0 && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-4 py-3">
          💡 Enregistrez des ventes pour calculer la CAF et la marge de sécurité
          mensuelles.
        </p>
      )}
    </div>
  );
}
