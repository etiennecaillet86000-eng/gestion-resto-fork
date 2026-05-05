import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coutMatiereHT, margeBrute, prixHT } from "@/core/utils/calculations";
import { useIngredients, useRecettes } from "@/hooks/useQueries";
import type { Ingredient } from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import { ChefHat } from "lucide-react";
import { useMemo, useState } from "react";

const SKELETON_ROWS = [0, 1, 2, 3];

type MargeLevel = "low" | "medium" | "high";

function getMargeLevel(pct: number): MargeLevel {
  if (pct < 60) return "low";
  if (pct < 70) return "medium";
  return "high";
}

function MargeBadge({ pct }: { pct: number }) {
  const level = getMargeLevel(pct);
  const classes =
    level === "high"
      ? "bg-green-100 text-green-800 border-green-200"
      : level === "medium"
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-red-100 text-red-800 border-red-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        classes
      }`}
    >
      {fmtPct(pct)}
    </span>
  );
}

export default function Marges() {
  const { data: recettes = [], isLoading: loadingR } = useRecettes();
  const { data: ingredients = [], isLoading: loadingI } = useIngredients();
  const [search, setSearch] = useState("");

  const ingMap = useMemo(
    () => new Map<string, Ingredient>(ingredients.map((ing) => [ing.id, ing])),
    [ingredients],
  );

  const rows = useMemo(() => {
    return recettes
      .filter(
        (r) =>
          r.nom.toLowerCase().includes(search.toLowerCase()) ||
          r.categorie.toLowerCase().includes(search.toLowerCase()),
      )
      .map((r) => {
        const cout = coutMatiereHT(r, ingMap);
        const ph = prixHT(r.prixVenteTTC, r.tauxTVA);
        const marge = margeBrute(ph, cout);
        const margeEur = ph - cout;
        return { recette: r, cout, ph, marge, margeEur };
      })
      .sort((a, b) => a.marge - b.marge);
  }, [recettes, ingMap, search]);

  const avgMarge =
    rows.length > 0 ? rows.reduce((s, r) => s + r.marge, 0) / rows.length : 0;

  const countLow = rows.filter((r) => getMargeLevel(r.marge) === "low").length;
  const countMed = rows.filter(
    (r) => getMargeLevel(r.marge) === "medium",
  ).length;
  const countHigh = rows.filter(
    (r) => getMargeLevel(r.marge) === "high",
  ).length;

  const isLoading = loadingR || loadingI;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Marges par Recette</h2>
          <p className="text-sm text-muted-foreground">
            Analyse de la rentabilité par plat — coût matière vs prix de vente
          </p>
        </div>
        {!isLoading && rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-red-700 border-red-200 bg-red-50"
            >
              {countLow} &lt; 60 %
            </Badge>
            <Badge
              variant="outline"
              className="text-yellow-700 border-yellow-200 bg-yellow-50"
            >
              {countMed} 60–70 %
            </Badge>
            <Badge
              variant="outline"
              className="text-green-700 border-green-200 bg-green-50"
            >
              {countHigh} &gt; 70 %
            </Badge>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : recettes.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
          data-ocid="marges.empty_state"
        >
          <ChefHat className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucune recette enregistrée. Commencez par créer des recettes.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between gap-4 flex-wrap">
              <span>
                {rows.length} recette{rows.length > 1 ? "s" : ""} — marge
                moyenne :{" "}
                <span className="text-primary">{fmtPct(avgMarge)}</span>
              </span>
              <Input
                placeholder="Rechercher une recette…"
                className="h-8 w-52 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-ocid="marges.search_input"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[180px]">Recette</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Prix Vente HT</TableHead>
                    <TableHead className="text-right">Coût Matière</TableHead>
                    <TableHead className="text-right">Marge %</TableHead>
                    <TableHead className="text-right">Marge €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        Aucune recette ne correspond à la recherche.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(({ recette, cout, ph, marge, margeEur }, idx) => (
                      <TableRow
                        key={recette.id}
                        data-ocid={`marges.item.${idx + 1}`}
                      >
                        <TableCell className="font-medium">
                          {recette.nom}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {recette.categorie}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(ph)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(cout)}
                        </TableCell>
                        <TableCell className="text-right">
                          <MargeBadge pct={marge} />
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            margeEur > 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {fmtEur(margeEur)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {!isLoading && recettes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          🔴 Marge &lt; 60 % — à optimiser · 🟡 60–70 % — acceptable · 🟢 &gt;
          70 % — idéal
        </p>
      )}
    </div>
  );
}
