/**
 * Projections.tsx — Finance > Projections Financières
 *
 * 5 sub-tabs:
 *   1. Paramétrage         — CENTRAL CONFIG (single source of truth for all params)
 *   2. Business Plan Réel  — Real sales projection
 *   3. Business Initial    — Fully automated simulation
 *   4. Rentabilité Mix Produit — Category mix P&L
 *   5. Capacité d'Autofinancement — CAF & correlation
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabBusinessInitial from "./projections/TabBusinessInitial";
import TabBusinessPlanReel from "./projections/TabBusinessPlanReel";
import TabCAF from "./projections/TabCAF";
import TabParametrage from "./projections/TabParametrage";
import TabRentabiliteMixProduit from "./projections/TabRentabiliteMixProduit";

export default function Projections() {
  return (
    <div className="space-y-6" data-ocid="projections.page">
      <div>
        <h2 className="text-lg font-semibold">
          Finance — Projections Financières
        </h2>
        <p className="text-sm text-muted-foreground">
          Paramétrez une fois, consultez partout — toutes les projections
          utilisent le même paramétrage central.
        </p>
      </div>

      <Tabs
        defaultValue="parametrage"
        className="space-y-6"
        data-ocid="projections.tabs"
      >
        <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/40 p-1">
          <TabsTrigger
            value="parametrage"
            className="flex-1 min-w-[120px]"
            data-ocid="projections.tab.parametrage"
          >
            ⚙ Paramétrage
          </TabsTrigger>
          <TabsTrigger
            value="bp-reel"
            className="flex-1 min-w-[140px]"
            data-ocid="projections.tab.bp-reel"
          >
            Business Plan Réel
          </TabsTrigger>
          <TabsTrigger
            value="bp-initial"
            className="flex-1 min-w-[140px]"
            data-ocid="projections.tab.bp-initial"
          >
            Business Initial
          </TabsTrigger>
          <TabsTrigger
            value="rentabilite-mix"
            className="flex-1 min-w-[160px]"
            data-ocid="projections.tab.rentabilite-mix"
          >
            Rentabilité Mix Produit
          </TabsTrigger>
          <TabsTrigger
            value="caf"
            className="flex-1 min-w-[180px]"
            data-ocid="projections.tab.caf"
          >
            Capacité d'Autofinancement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parametrage">
          <TabParametrage />
        </TabsContent>

        <TabsContent value="bp-reel">
          <TabBusinessPlanReel />
        </TabsContent>

        <TabsContent value="bp-initial">
          <TabBusinessInitial />
        </TabsContent>

        <TabsContent value="rentabilite-mix">
          <TabRentabiliteMixProduit />
        </TabsContent>

        <TabsContent value="caf">
          <TabCAF />
        </TabsContent>
      </Tabs>
    </div>
  );
}
