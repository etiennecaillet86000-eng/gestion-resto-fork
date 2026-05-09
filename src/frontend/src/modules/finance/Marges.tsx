/**
 * Marges.tsx — redirige vers SimulateurCarte (Cuisine & Logistique)
 * L'analyse des marges est désormais intégrée dans l'onglet Simulateur Carte.
 */
import SimulateurCarte from "@/modules/restaurant/SimulateurCarte";

export default function Marges() {
  // L'analyse des marges a été fusionnée dans le Simulateur Carte (Cuisine & Logistique).
  // Ce composant re-exporte SimulateurCarte pour assurer la compatibilité des routes existantes.
  return <SimulateurCarte />;
}
