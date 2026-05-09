// ── Projection module types ───────────────────────────────────────────────────

export type ScenarioType = "pessimiste" | "realiste" | "optimiste";
export type HorizonType = 3 | 6 | 12 | 24 | 60;

/**
 * User-configurable parameters for a projection run.
 * seasonalite: array of 12 multiplicative coefficients, one per calendar month
 * (index 0 = January). Default is [1,1,1,…] (flat year).
 */
export interface ProjectionParams {
  /** Number of months to project: 3, 6, 12, 24 or 60 (5 ans) */
  horizon: 3 | 6 | 12 | 24 | 60;
  scenario: ScenarioType;
  /** Average covers served at lunch per day */
  couvertsDejeunner: number;
  /** Average covers served at dinner per day */
  couvertsDiner: number;
  /** Fill-rate percentage, e.g. 80 for 80 % */
  tauxRemplissage: number;
  /** Average ticket price in €HT */
  ticketMoyen: number;
  /**
   * Seasonal coefficients indexed by calendar month (0 = January).
   * Must contain exactly 12 values.
   */
  seasonalite: number[];
  /** Annual inflation rate applied to fixed costs, e.g. 2 for 2 % */
  inflationCharges: number;
  /** Food-cost ratio as a percentage of CA, e.g. 30 for 30 % */
  foodCostRatio: number;
}

/** Computed figures for a single projected month */
export interface ProjectionMonth {
  /** Human-readable French month label, e.g. "Janvier 2026" */
  mois: string;
  /** Calendar month index (0 = January … 11 = December) */
  monthIndex: number;
  /** Projected revenue (CA HT) */
  ca: number;
  /** Cost of goods sold (COGS = CA × foodCostRatio / 100) */
  cogs: number;
  /** Fixed costs for the month (with inflation compounding) */
  fraisFixes: number;
  /** Other charges (expandable — currently 0) */
  autresCharges: number;
  /** Earnings before interest & taxes: CA - COGS - fraisFixes - autresCharges */
  ebit: number;
}

/** Full projection result for one scenario */
export interface ProjectionScenario {
  type: ScenarioType;
  months: ProjectionMonth[];
  totalCA: number;
  totalCOGS: number;
  totalFraisFixes: number;
  totalEBIT: number;
}

/** Multiplicative coefficients applied per scenario type */
export interface ScenarioCoefficients {
  pessimiste: number;
  realiste: number;
  optimiste: number;
}
