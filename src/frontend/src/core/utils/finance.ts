import type { Emprunt, LigneAmortissement } from "../types";

// ── Loan calculations ─────────────────────────────────────────────────────────

/**
 * Monthly payment for a loan (French constant annuity formula)
 */
export function calcMensualite(
  montant: number,
  tauxAnnuel: number,
  dureeMois: number,
): number {
  if (dureeMois <= 0 || montant <= 0) return 0;
  if (tauxAnnuel === 0) return montant / dureeMois;
  const tauxMensuel = tauxAnnuel / 100 / 12;
  return (montant * tauxMensuel) / (1 - (1 + tauxMensuel) ** -dureeMois);
}

/**
 * Total interest paid on a loan
 */
export function totalInterets(emprunt: Emprunt): number {
  const dureeMois = Number(emprunt.dureeMois);
  const mensualite = calcMensualite(
    emprunt.montant,
    emprunt.tauxAnnuel,
    dureeMois,
  );
  return mensualite * dureeMois - emprunt.montant;
}

/**
 * Total cost of a loan (capital + interest)
 */
export function coutTotalEmprunt(emprunt: Emprunt): number {
  return emprunt.montant + totalInterets(emprunt);
}

/**
 * Remaining capital after N months
 */
export function capitalRestantApresNMois(
  emprunt: Emprunt,
  nMois: number,
): number {
  const dureeMois = Number(emprunt.dureeMois);
  if (emprunt.montant <= 0 || dureeMois <= 0) return 0;
  const tauxMensuel = emprunt.tauxAnnuel / 100 / 12;
  const mensualite = calcMensualite(
    emprunt.montant,
    emprunt.tauxAnnuel,
    dureeMois,
  );
  let capital = emprunt.montant;
  for (let i = 0; i < nMois && i < dureeMois; i++) {
    const interets = capital * tauxMensuel;
    capital = Math.max(0, capital - (mensualite - interets));
  }
  return capital;
}

// ── Depreciation calculations ─────────────────────────────────────────────────

/**
 * Annual straight-line depreciation for an asset
 * Note: dureeMois field stores YEARS (standardized naming)
 */
export function annuiteLineaire(asset: LigneAmortissement): number {
  const dureeAns = Number(asset.dureeMois);
  if (dureeAns <= 0) return 0;
  return asset.coutTotal / dureeAns;
}

/**
 * Residual value after N years
 */
export function valeurResiduelle(
  asset: LigneAmortissement,
  annee: number,
): number {
  const dureeAns = Number(asset.dureeMois);
  if (dureeAns <= 0) return asset.coutTotal;
  const dotation = annuiteLineaire(asset);
  const amortissement = dotation * Math.min(annee, dureeAns);
  return Math.max(0, asset.coutTotal - amortissement);
}

/**
 * Annual depreciation for a specific year (0 after depreciation period)
 */
export function dotationAnnuelleParAnnee(
  asset: LigneAmortissement,
  annee: number,
): number {
  const dureeAns = Number(asset.dureeMois);
  if (dureeAns <= 0) return 0;
  return annee <= dureeAns ? asset.coutTotal / dureeAns : 0;
}

/**
 * Total annual depreciation for a portfolio of assets
 */
export function totalDotationsParAnnee(
  assets: LigneAmortissement[],
  annee: number,
): number {
  return assets.reduce(
    (sum, asset) => sum + dotationAnnuelleParAnnee(asset, annee),
    0,
  );
}

/**
 * Monthly depreciation for year 1
 */
export function dotationMensuelle(asset: LigneAmortissement): number {
  return annuiteLineaire(asset) / 12;
}
