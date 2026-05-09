import type {
  ProjectionMonth,
  ProjectionParams,
  ProjectionScenario,
  ScenarioType,
} from "../types/projection";

// ── Scenario coefficients ─────────────────────────────────────────────────────

/**
 * Returns the revenue multiplier for a given scenario.
 * pessimiste: -15 %, realiste: ×1, optimiste: +15 %
 */
export function getScenarioCoefficient(scenario: ScenarioType): number {
  switch (scenario) {
    case "pessimiste":
      return 0.85;
    case "optimiste":
      return 1.15;
    default:
      return 1.0;
  }
}

// ── Month helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const;

/**
 * Returns the French month name for a calendar month index.
 * @param monthIndex 0-based index (0 = January, 11 = December)
 */
export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[((monthIndex % 12) + 12) % 12];
}

/** Returns the number of days in a given calendar month / year */
function daysInMonth(calendarMonth: number, year: number): number {
  // Date(year, month+1, 0) gives the last day of `month`
  return new Date(year, calendarMonth + 1, 0).getDate();
}

// ── CA calculation ────────────────────────────────────────────────────────────

/**
 * Calculates monthly revenue (CA HT) for a single month.
 *
 * Formula:
 *   CA = (couvertsDejeunner + couvertsDiner)
 *        × (tauxRemplissage / 100)
 *        × ticketMoyen
 *        × seasonaliteCoeff
 *        × scenarioCoeff
 *        × jours
 */
export function calculateMonthCA(params: {
  couvertsTotal: number;
  tauxRemplissage: number;
  ticketMoyen: number;
  seasonaliteCoeff: number;
  jours: number;
  scenarioCoeff: number;
}): number {
  const {
    couvertsTotal,
    tauxRemplissage,
    ticketMoyen,
    seasonaliteCoeff,
    jours,
    scenarioCoeff,
  } = params;
  return (
    couvertsTotal *
    (tauxRemplissage / 100) *
    ticketMoyen *
    seasonaliteCoeff *
    scenarioCoeff *
    jours
  );
}

// ── Single-month projection ───────────────────────────────────────────────────

/**
 * Computes all KPIs for a single projected month.
 *
 * @param params           Projection parameters
 * @param monthIndex       Offset from the start of the projection (0-based)
 * @param fraisFixesMensuel Base monthly fixed costs (€)
 * @param startMonthIndex  Calendar month index of the first projection month (0-based)
 */
export function calculateProjectionMonth(
  params: ProjectionParams,
  monthIndex: number,
  fraisFixesMensuel: number,
  startMonthIndex: number,
): ProjectionMonth {
  const calendarMonth = (startMonthIndex + monthIndex) % 12;
  const year =
    new Date().getFullYear() + Math.floor((startMonthIndex + monthIndex) / 12);

  const seasonaliteCoeff =
    params.seasonalite.length === 12 ? params.seasonalite[calendarMonth] : 1;

  const scenarioCoeff = getScenarioCoefficient(params.scenario);
  const jours = daysInMonth(calendarMonth, year);
  const couvertsTotal = params.couvertsDejeunner + params.couvertsDiner;

  const ca = calculateMonthCA({
    couvertsTotal,
    tauxRemplissage: params.tauxRemplissage,
    ticketMoyen: params.ticketMoyen,
    seasonaliteCoeff,
    jours,
    scenarioCoeff,
  });

  const cogs = ca * (params.foodCostRatio / 100);

  // Fixed costs grow with compound monthly inflation
  const monthlyInflationRate = params.inflationCharges / 100 / 12;
  const fraisFixes =
    fraisFixesMensuel * (1 + monthlyInflationRate) ** monthIndex;

  const autresCharges = 0;
  const ebit = ca - cogs - fraisFixes - autresCharges;

  return {
    mois: `${getMonthName(calendarMonth)} ${year}`,
    monthIndex: calendarMonth,
    ca,
    cogs,
    fraisFixes,
    autresCharges,
    ebit,
  };
}

// ── Full projection ───────────────────────────────────────────────────────────

/**
 * Runs a full projection for the given scenario and horizon.
 *
 * @param params            Projection parameters (scenario & horizon included)
 * @param fraisFixesMensuel Base monthly fixed costs (€)
 * @param startMonth        Calendar month index to start from (defaults to current month)
 */
export function calculateProjection(
  params: ProjectionParams,
  fraisFixesMensuel: number,
  startMonth?: number,
): ProjectionScenario {
  const startMonthIndex = startMonth ?? new Date().getMonth();

  const months: ProjectionMonth[] = Array.from(
    { length: params.horizon },
    (_, i) =>
      calculateProjectionMonth(params, i, fraisFixesMensuel, startMonthIndex),
  );

  const totalCA = months.reduce((s, m) => s + m.ca, 0);
  const totalCOGS = months.reduce((s, m) => s + m.cogs, 0);
  const totalFraisFixes = months.reduce((s, m) => s + m.fraisFixes, 0);
  const totalEBIT = months.reduce((s, m) => s + m.ebit, 0);

  return {
    type: params.scenario,
    months,
    totalCA,
    totalCOGS,
    totalFraisFixes,
    totalEBIT,
  };
}

// ── All-scenarios helper ──────────────────────────────────────────────────────

/**
 * Computes pessimiste / realiste / optimiste projections in one call.
 * Uses baseParams.scenario as a template and overrides the scenario field.
 */
export function calculateAllScenarios(
  baseParams: ProjectionParams,
  fraisFixesMensuel: number,
): Record<ScenarioType, ProjectionScenario> {
  const scenarios: ScenarioType[] = ["pessimiste", "realiste", "optimiste"];
  const startMonth = new Date().getMonth();

  return Object.fromEntries(
    scenarios.map((scenario) => [
      scenario,
      calculateProjection(
        { ...baseParams, scenario },
        fraisFixesMensuel,
        startMonth,
      ),
    ]),
  ) as Record<ScenarioType, ProjectionScenario>;
}

// ── Mix produit rentabilité ───────────────────────────────────────────────────

export interface MixCategorie {
  /** Category name */
  label: string;
  /** Portion of total CA (0-100) */
  pctCA: number;
  /** Average gross margin of the category (0-100) */
  margeBruteAvg: number;
}

export interface MixProduitResult {
  /** Weighted gross margin (%) */
  margeMoyennePonderee: number;
  /** Projected monthly CA */
  caMensuel: number;
  /** Monthly material cost */
  coutMatiereMensuel: number;
  /** Monthly gross margin value */
  margeBruteMensuelle: number;
  /** Monthly EBIT */
  ebitMensuel: number;
  /** Break-even CA (monthly) */
  seuilMensuel: number;
  /** Daily covers needed to break even */
  couvertsPointMort: number;
}

/**
 * Calculates profitability from a product mix.
 * @param categories        Array of mix categories with pctCA and margeBruteAvg
 * @param couvertsJour      Total covers per day (déjeuner + dîner)
 * @param tauxRemplissage   Fill rate (0-100)
 * @param ticketMoyen       Average ticket price (€)
 * @param joursParMois      Working days per month
 * @param fraisFixesMensuel Monthly fixed costs
 */
export function calculateMixProduitRentabilite(
  categories: MixCategorie[],
  couvertsJour: number,
  tauxRemplissage: number,
  ticketMoyen: number,
  joursParMois: number,
  fraisFixesMensuel: number,
): MixProduitResult {
  const totalPct = categories.reduce((s, c) => s + c.pctCA, 0);
  const norm = totalPct > 0 ? totalPct : 100;

  // Weighted average margin
  const margeMoyennePonderee = categories.reduce(
    (s, c) => s + (c.pctCA / norm) * c.margeBruteAvg,
    0,
  );

  const caMensuel =
    couvertsJour * (tauxRemplissage / 100) * ticketMoyen * joursParMois;

  const coutMatiereMensuel = caMensuel * (1 - margeMoyennePonderee / 100);
  const margeBruteMensuelle = caMensuel - coutMatiereMensuel;
  const ebitMensuel = margeBruteMensuelle - fraisFixesMensuel;

  const seuilMensuel =
    margeMoyennePonderee > 0
      ? fraisFixesMensuel / (margeMoyennePonderee / 100)
      : 0;

  const couvertsPointMort =
    ticketMoyen > 0 && tauxRemplissage > 0 && joursParMois > 0
      ? seuilMensuel / (ticketMoyen * (tauxRemplissage / 100) * joursParMois)
      : 0;

  return {
    margeMoyennePonderee,
    caMensuel,
    coutMatiereMensuel,
    margeBruteMensuelle,
    ebitMensuel,
    seuilMensuel,
    couvertsPointMort,
  };
}
