/**
 * TabParametrage.tsx — Central config tab (single source of truth)
 * Sections: Sésonnalitm | Config simulation | Mix produit | Fiscal (auto-charges)
 * Section D (saisie manuelle des charges) supprimée —
 * les charges sont calculées automatiquement depuis Frais Fixes / Emprunts /
 * Amortissements / Salariés / Associés.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { BusinessPlanParams } from "@/core/store/projectionStore";
import { useProjectionStore } from "@/core/store/projectionStore";
import type { ScenarioType } from "@/core/types/projection";
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
  AlertTriangle,
  CalendarDays,
  Info,
  RefreshCw,
  Settings,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { MONTH_SHORT } from "./shared";

const SCENARIO_OPTIONS: { value: ScenarioType; label: string; desc: string }[] =
  [
    { value: "pessimiste", label: "🔴 Pessimiste", desc: "-15%" },
    { value: "realiste", label: "🟡 Réaliste", desc: "×1.0" },
    { value: "optimiste", label: "🟢 Optimiste", desc: "+15%" },
  ];

export default function TabParametrage() {
  const {
    params,
    scenario,
    mixCategories,
    businessPlanParams,
    updateParams,
    updateSeasonalite,
    setScenario,
    resetParams,
    updateMixCategories,
    updateBusinessPlanParams,
  } = useProjectionStore();

  // ── Live charges from backend ──
  const { data: salaries = [] } = useSalaries();
  const { data: associes = [] } = useAssociesGerants();
  const { data: fraisFixes = [] } = useFraisFixes();
  const { data: amortissements = [] } = useAmortissements();
  const { data: emprunts = [] } = useEmprunts();

  // Salary cost: annual ÷ 12 + employer charges (~42%)
  const salairesMensuel = useMemo(() => {
    const sal = salaries.reduce(
      (s, e) => s + (e.salaireAnnuelBrut * 1.42) / 12,
      0,
    );
    const assoc = associes.reduce((s, a) => s + a.remunerationAnnuelle / 12, 0);
    return sal + assoc;
  }, [salaries, associes]);

  // Amortissements: annual dotation = coutTotal / dureeAns, monthly = annual / 12
  const amortissementMensuel = useMemo(
    () =>
      amortissements.reduce(
        (s, a) =>
          s +
          (Number(a.dureeMois) > 0
            ? a.coutTotal / Number(a.dureeMois) / 12
            : 0),
        0,
      ),
    [amortissements],
  );

  // Emprunts: simple monthly instalment (capital ÷ duration)
  const empruntsMensuel = useMemo(
    () =>
      emprunts.reduce(
        (s, e) =>
          s + (Number(e.dureeMois) > 0 ? e.montant / Number(e.dureeMois) : 0),
        0,
      ),
    [emprunts],
  );

  // Frais fixes: sum of monthly amounts
  const fraisFixesMensuel = useMemo(
    () => fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0),
    [fraisFixes],
  );

  // Total charges mensuel
  const totalChargesMensuel =
    salairesMensuel +
    amortissementMensuel +
    empruntsMensuel +
    fraisFixesMensuel;

  // ── Section A helpers ──
  const avgCoeff = (params.seasonalite.reduce((s, v) => s + v, 0) / 12).toFixed(
    2,
  );
  const minCoeff = Math.min(...params.seasonalite);
  const maxCoeff = Math.max(...params.seasonalite);
  const amplitude = ((maxCoeff / minCoeff - 1) * 100).toFixed(1);

  function resetSeasonalite() {
    for (let i = 0; i < 12; i++) updateSeasonalite(i, 1.0);
  }

  // ── Section C helpers ──
  const totalPct = mixCategories.reduce((s, c) => s + c.pctCA, 0);
  const isPctValid = Math.abs(totalPct - 100) < 1;

  function updateMixPctCA(label: string, val: number) {
    updateMixCategories(
      mixCategories.map((c) => (c.label === label ? { ...c, pctCA: val } : c)),
    );
  }

  function updateMixMarge(label: string, val: number) {
    updateMixCategories(
      mixCategories.map((c) =>
        c.label === label ? { ...c, margeBruteAvg: val } : c,
      ),
    );
  }

  function equilibrerMix() {
    const even = 100 / mixCategories.length;
    updateMixCategories(mixCategories.map((c) => ({ ...c, pctCA: even })));
  }

  function updateBP(partial: Partial<BusinessPlanParams>) {
    updateBusinessPlanParams(partial);
  }

  return (
    <div className="space-y-8" data-ocid="parametrage.tab.panel">
      <div>
        <h3 className="text-base font-semibold">Paramétrage central</h3>
        <p className="text-sm text-muted-foreground">
          Tous les paramètres utilisés par les autres sous-onglets. Modifiez ici
          et toutes les projections se mettront à jour automatiquement.
        </p>
      </div>

      {/* ── SECTION A: Sésonnalitm ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm uppercase tracking-wide">
            A — Saisonnalitm mensuelle
          </h4>
        </div>

        <Card data-ocid="parametrage.saisonnalite.panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Coefficients d&apos;affluence (Jan → Déc)
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Moy. : <strong>{avgCoeff}</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetSeasonalite}
                  data-ocid="parametrage.saisonnalite.reset_button"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Réinitialiser
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">
              {MONTH_SHORT.map((m, idx) => {
                const coeff = params.seasonalite[idx] ?? 1;
                const isHigh = coeff >= 1.2;
                const isLow = coeff < 0.8;
                const isMid = !isHigh && !isLow;
                return (
                  <div key={m} className="grid gap-1 text-center">
                    <Label className="text-xs text-muted-foreground text-center">
                      {m}
                    </Label>
                    <Input
                      type="number"
                      min="0.1"
                      max="2.0"
                      step="0.05"
                      className={`text-center px-1 text-xs h-9 ${
                        isHigh
                          ? "border-green-500/60 bg-green-500/8 text-green-400"
                          : isLow
                            ? "border-red-500/60 bg-red-500/8 text-red-400"
                            : isMid && coeff !== 1.0
                              ? "border-amber-500/40 bg-amber-500/5 text-amber-400"
                              : ""
                      }`}
                      value={coeff}
                      onChange={(e) =>
                        updateSeasonalite(idx, Number(e.target.value) || 0)
                      }
                      data-ocid={`parametrage.saisonnalite.coeff.${idx + 1}`}
                    />
                    <div
                      className={`text-[10px] font-medium ${
                        isHigh
                          ? "text-green-400"
                          : isLow
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {coeff > 1
                        ? `+${((coeff - 1) * 100).toFixed(0)}%`
                        : coeff < 1
                          ? `${((coeff - 1) * 100).toFixed(0)}%`
                          : "0%"}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-3 pt-2 border-t">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Min</p>
                <p className="font-bold text-destructive">
                  {minCoeff.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Max</p>
                <p className="font-bold text-green-400">
                  {maxCoeff.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Amplitude</p>
                <p className="font-bold">{amplitude}%</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">Moyenne</p>
                <p className="font-bold text-primary">{avgCoeff}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── SECTION B: Config simulation ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm uppercase tracking-wide">
            B — Configuration simulation (Business Initial)
          </h4>
        </div>

        <Card data-ocid="parametrage.simulation.panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Paramètres de projection
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={resetParams}
                data-ocid="parametrage.simulation.reset_button"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Réinitialiser
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Scénario */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Scénario
              </Label>
              <div className="flex flex-wrap gap-2">
                {SCENARIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScenario(opt.value)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      scenario === opt.value
                        ? "bg-primary/20 border-primary/60 text-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                    }`}
                    data-ocid={`parametrage.scenario.${opt.value}`}
                  >
                    {opt.label}
                    <span className="text-xs opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid params */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Couverts déjeuner / jour</Label>
                <Input
                  type="number"
                  min="0"
                  value={params.couvertsDejeunner}
                  onChange={(e) =>
                    updateParams({
                      couvertsDejeunner: Number(e.target.value) || 0,
                    })
                  }
                  data-ocid="parametrage.simulation.couverts_dej_input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Couverts dîner / jour</Label>
                <Input
                  type="number"
                  min="0"
                  value={params.couvertsDiner}
                  onChange={(e) =>
                    updateParams({ couvertsDiner: Number(e.target.value) || 0 })
                  }
                  data-ocid="parametrage.simulation.couverts_diner_input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Ticket moyen HT (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={params.ticketMoyen}
                  onChange={(e) =>
                    updateParams({ ticketMoyen: Number(e.target.value) || 0 })
                  }
                  data-ocid="parametrage.simulation.ticket_input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Taux de remplissage :{" "}
                  <strong>{params.tauxRemplissage}%</strong>
                </Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={params.tauxRemplissage}
                  onChange={(e) =>
                    updateParams({ tauxRemplissage: Number(e.target.value) })
                  }
                  className="accent-primary h-2"
                  data-ocid="parametrage.simulation.taux_remplissage_slider"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Food cost : <strong>{fmtPct(params.foodCostRatio)}</strong>
                </Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={params.foodCostRatio}
                  onChange={(e) =>
                    updateParams({ foodCostRatio: Number(e.target.value) })
                  }
                  className="accent-primary h-2"
                  data-ocid="parametrage.simulation.food_cost_slider"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Inflation charges :{" "}
                  <strong>{params.inflationCharges}%/an</strong>
                </Label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.1"
                  value={params.inflationCharges}
                  onChange={(e) =>
                    updateParams({ inflationCharges: Number(e.target.value) })
                  }
                  className="accent-primary h-2"
                  data-ocid="parametrage.simulation.inflation_slider"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── SECTION C: Mix produit ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm uppercase tracking-wide">
            C — Paramétrage Mix Produit (Rentabilité)
          </h4>
        </div>

        <Card data-ocid="parametrage.mix.panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold">
                Composition CA par catégorie
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    isPctValid
                      ? "border-green-500/40 text-green-400 bg-green-500/5"
                      : "border-destructive/40 text-destructive bg-destructive/5"
                  }`}
                >
                  Total : {totalPct.toFixed(0)}%{isPctValid ? " ✓" : " ⚠"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={equilibrerMix}
                  data-ocid="parametrage.mix.equilibrer_button"
                >
                  Équilibrer automatiquement
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isPctValid && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertDescription className="text-xs flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  La somme des pourcentages doit être égale à 100%. Actuellement
                  : {totalPct.toFixed(1)}%
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-3">
              {(mixCategories as MixCategorie[]).map((cat, idx) => (
                <div
                  key={cat.label}
                  className="space-y-1.5"
                  data-ocid={`parametrage.mix.category.${idx + 1}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate max-w-[200px]">
                      {cat.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Marge brute :{" "}
                      <strong className="text-green-400">
                        {cat.margeBruteAvg.toFixed(0)}%
                      </strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_56px_auto] items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={cat.pctCA}
                      onChange={(e) =>
                        updateMixPctCA(cat.label, Number(e.target.value))
                      }
                      className="accent-primary h-1.5"
                      data-ocid={`parametrage.mix.pct_slider.${idx + 1}`}
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={cat.pctCA.toFixed(0)}
                      onChange={(e) =>
                        updateMixPctCA(cat.label, Number(e.target.value))
                      }
                      className="w-14 text-xs h-7 text-center px-1"
                      data-ocid={`parametrage.mix.pct_input.${idx + 1}`}
                    />
                    <span className="text-xs text-muted-foreground">%CA</span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">
                      Marge brute
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={cat.margeBruteAvg}
                      onChange={(e) =>
                        updateMixMarge(cat.label, Number(e.target.value))
                      }
                      className="accent-green-500 h-1"
                      data-ocid={`parametrage.mix.marge_slider.${idx + 1}`}
                    />
                    <span className="text-xs font-medium w-8 text-right">
                      {cat.margeBruteAvg.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── SECTION D: Charges auto-agrégées + Fiscal ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm uppercase tracking-wide">
            D — Charges agrégées & Fiscalité
          </h4>
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <AlertDescription className="text-xs">
            <strong>Calcul automatique</strong> — Les charges sont agrégées
            depuis les onglets <em>Salariés</em>, <em>Associés</em>,{" "}
            <em>Frais Fixes</em>, <em>Emprunts</em> et <em>Amortissements</em>.
            Mettez à jour ces onglets pour recalculer.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Salaires &amp; Associés
            </p>
            <p className="text-sm font-bold">{fmtEur(salairesMensuel)}/mois</p>
            <p className="text-[10px] text-muted-foreground">
              {salaries.length} salarié{salaries.length > 1 ? "s" : ""} +{" "}
              {associes.length} associé{associes.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Frais Fixes</p>
            <p className="text-sm font-bold">
              {fmtEur(fraisFixesMensuel)}/mois
            </p>
            <p className="text-[10px] text-muted-foreground">
              {fraisFixes.length} ligne{fraisFixes.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Emprunts</p>
            <p className="text-sm font-bold">{fmtEur(empruntsMensuel)}/mois</p>
            <p className="text-[10px] text-muted-foreground">
              {emprunts.length} emprunt{emprunts.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Amortissements</p>
            <p className="text-sm font-bold">
              {fmtEur(amortissementMensuel)}/mois
            </p>
            <p className="text-[10px] text-muted-foreground">
              {amortissements.length} bien
              {amortissements.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold">
            Total charges mensuelles
          </span>
          <span className="text-lg font-bold text-primary">
            {fmtEur(totalChargesMensuel)}
          </span>
        </div>

        {/* Fiscal + 5-year growth coefficient */}
        <Card data-ocid="parametrage.fiscal.panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Paramètres fiscaux &amp; projection 5 ans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Taux d&apos;imposition :{" "}
                  <strong>{businessPlanParams.tauxImposition}%</strong>
                </Label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={businessPlanParams.tauxImposition}
                  onChange={(e) =>
                    updateBP({ tauxImposition: Number(e.target.value) })
                  }
                  className="accent-primary h-2 mt-2"
                  data-ocid="parametrage.fiscal.taux_imposition_slider"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Coefficient croissance 5 ans :{" "}
                  <strong>
                    {businessPlanParams.growthCoefficient5ans === 1.0
                      ? "Linéaire (×1.0)"
                      : `×${businessPlanParams.growthCoefficient5ans.toFixed(2)}/an`}
                  </strong>
                </Label>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.01"
                  value={businessPlanParams.growthCoefficient5ans}
                  onChange={(e) =>
                    updateBP({
                      growthCoefficient5ans: Number(e.target.value),
                    })
                  }
                  className="accent-primary h-2 mt-2"
                  data-ocid="parametrage.fiscal.growth_coefficient_slider"
                />
                <p className="text-[10px] text-muted-foreground">
                  1.0 = projection linéaire, 1.05 = +5% par an
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
