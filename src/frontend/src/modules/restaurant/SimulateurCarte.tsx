/**
 * SimulateurCarte.tsx — Laboratoire : Performance × Marges côte à côte
 * Absorbe l'ancien Marges.tsx (Finance) — une seule source de vérité.
 */
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
import { RECIPE_CATEGORIES } from "@/core/constants";
import {
  type CategoryStat,
  useStatsSimulateur,
} from "@/hooks/useStatsSimulateur";
import type { StatRecette } from "@/hooks/useStatsSimulateur";
import { fmtEur, fmtPct } from "@/utils/format";
import {
  BarChart3,
  FlaskConical,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterPerf = "all" | "excellent" | "bon" | "moyen" | "faible";
type FilterMarge = "all" | "faible" | "moyen" | "eleve";
type SortField =
  | "nom"
  | "categorie"
  | "margePercent"
  | "foodCostPercent"
  | "prixVenteTTC"
  | "nbVentes"
  | "caTotal";
type SortDir = "asc" | "desc";

// ─── Performance helpers ───────────────────────────────────────────────────
const PERF_FILTERS: { id: FilterPerf; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "excellent", label: "Excellent" },
  { id: "bon", label: "Bon" },
  { id: "moyen", label: "Moyen" },
  { id: "faible", label: "Faible" },
];

function perfColor(perf: StatRecette["categoriePerf"]) {
  switch (perf) {
    case "excellent":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "bon":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "moyen":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "faible":
      return "bg-red-500/10 text-red-600 border-red-500/20";
  }
}

function perfLabel(perf: StatRecette["categoriePerf"]) {
  switch (perf) {
    case "excellent":
      return "Excellent";
    case "bon":
      return "Bon";
    case "moyen":
      return "Moyen";
    case "faible":
      return "Faible";
  }
}

// ─── Marge helpers ─────────────────────────────────────────────────────────
const MARGE_FILTERS: { id: FilterMarge; label: string; hint: string }[] = [
  { id: "all", label: "Tous", hint: "" },
  { id: "faible", label: "Faible", hint: "< 60 %" },
  { id: "moyen", label: "Moyen", hint: "60–70 %" },
  { id: "eleve", label: "Élevé", hint: "> 70 %" },
];

function getMargeLevel(pct: number): "faible" | "moyen" | "eleve" {
  if (pct < 60) return "faible";
  if (pct < 70) return "moyen";
  return "eleve";
}

function margeLevelColor(lvl: "faible" | "moyen" | "eleve") {
  switch (lvl) {
    case "faible":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "moyen":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "eleve":
      return "bg-green-500/10 text-green-600 border-green-500/20";
  }
}

function margeLevelLabel(lvl: "faible" | "moyen" | "eleve") {
  switch (lvl) {
    case "faible":
      return "Faible";
    case "moyen":
      return "Moyen";
    case "eleve":
      return "Élevé";
  }
}

// ─── Shared FilterBar ─────────────────────────────────────────────────────
function FilterBar<T extends string>({
  filters,
  active,
  onChange,
  prefix,
}: {
  filters: { id: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
  prefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            active === f.id
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
          data-ocid={`${prefix}.${f.id}.toggle`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── SortIcon ─────────────────────────────────────────────────────────────
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="opacity-30 ml-1">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────
function PanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Performance Panel ────────────────────────────────────────────────────
function PanelPerformance({ stats }: { stats: StatRecette[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPerf>("all");
  const [sortField, setSortField] = useState<SortField>("margePercent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const rows = useMemo(() => {
    let list = [...stats];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.recette.nom.toLowerCase().includes(q) ||
          s.recette.categorie.toLowerCase().includes(q),
      );
    }
    if (filter !== "all") list = list.filter((s) => s.categoriePerf === filter);
    list.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortField) {
        case "nom":
          va = a.recette.nom;
          vb = b.recette.nom;
          break;
        case "categorie":
          va = a.recette.categorie;
          vb = b.recette.categorie;
          break;
        case "margePercent":
          va = a.margePercent;
          vb = b.margePercent;
          break;
        case "foodCostPercent":
          va = a.foodCostPercent;
          vb = b.foodCostPercent;
          break;
        case "prixVenteTTC":
          va = a.recette.prixVenteTTC;
          vb = b.recette.prixVenteTTC;
          break;
        case "nbVentes":
          va = a.nbVentes;
          vb = b.nbVentes;
          break;
        case "caTotal":
          va = a.caTotal;
          vb = b.caTotal;
          break;
        default:
          va = a.margePercent;
          vb = b.margePercent;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [stats, search, filter, sortField, sortDir]);

  const margeMoy =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.margePercent, 0) / rows.length
      : 0;
  const best =
    rows.length > 0
      ? rows.reduce((a, b) => (b.margePercent > a.margePercent ? b : a))
      : null;
  const worst =
    rows.length > 0
      ? rows.reduce((a, b) => (b.margePercent < a.margePercent ? b : a))
      : null;

  const TH = ({
    field,
    label,
    right,
  }: { field: SortField; label: string; right?: boolean }) => (
    <TableHead
      className={`cursor-pointer hover:bg-muted/60 whitespace-nowrap ${right ? "text-right" : ""}`}
      onClick={() => toggleSort(field)}
    >
      {label}
      <SortIcon active={sortField === field} dir={sortDir} />
    </TableHead>
  );

  return (
    <Card className="flex flex-col" data-ocid="simulateur.perf.panel">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">
            Simulateur Carte
          </CardTitle>
          <Badge variant="secondary" className="text-xs ml-auto">
            {rows.length}/{stats.length}
          </Badge>
        </div>
        <div className="relative mb-2">
          <Input
            placeholder="Rechercher un plat…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-3"
            data-ocid="simulateur.perf.search_input"
          />
        </div>
        <FilterBar
          filters={PERF_FILTERS}
          active={filter}
          onChange={setFilter}
          prefix="simulateur.perf"
        />
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TH field="nom" label="Plat" />
              <TH field="prixVenteTTC" label="Prix TTC" right />
              <TH field="foodCostPercent" label="FC %" right />
              <TH field="margePercent" label="Marge %" right />
              <TH field="nbVentes" label="Ventes" right />
              <TH field="caTotal" label="CA" right />
              <TableHead className="text-center">Perf.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-10"
                  data-ocid="simulateur.perf.empty_state"
                >
                  <FlaskConical className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Aucun résultat</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s, idx) => (
                <TableRow
                  key={s.recette.id}
                  data-ocid={`simulateur.perf.item.${idx + 1}`}
                >
                  <TableCell className="font-medium text-sm min-w-0">
                    <div
                      className="truncate max-w-[120px]"
                      title={s.recette.nom}
                    >
                      {s.recette.nom}
                    </div>
                    <Badge variant="secondary" className="text-xs mt-0.5">
                      {s.recette.categorie}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {fmtEur(s.recette.prixVenteTTC)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {fmtPct(s.foodCostPercent)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-xs font-semibold ${
                        s.margePercent >= 65
                          ? "text-green-600"
                          : s.margePercent >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {fmtPct(s.margePercent)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {s.nbVentes > 0 ? (
                      <span className="flex items-center justify-end gap-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        {s.nbVentes}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {s.caTotal > 0 ? (
                      fmtEur(s.caTotal)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs ${perfColor(s.categoriePerf)}`}
                    >
                      {perfLabel(s.categoriePerf)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Summary bar */}
      <div className="border-t bg-muted/20 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Marge moy.{" "}
          <strong className="text-foreground">{fmtPct(margeMoy)}</strong>
        </span>
        {best && (
          <span>
            Meilleur{" "}
            <strong className="text-green-600 truncate">
              {best.recette.nom}
            </strong>
          </span>
        )}
        {worst && (
          <span>
            À optimiser{" "}
            <strong className="text-red-600 truncate">
              {worst.recette.nom}
            </strong>
          </span>
        )}
      </div>
    </Card>
  );
}

// ─── Marges Panel ─────────────────────────────────────────────────────────
function PanelMarges({ stats }: { stats: StatRecette[] }) {
  const [filter, setFilter] = useState<FilterMarge>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let list = [...stats];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.recette.nom.toLowerCase().includes(q));
    }
    if (filter !== "all") {
      list = list.filter((s) => getMargeLevel(s.margePercent) === filter);
    }
    return list.sort((a, b) => a.margePercent - b.margePercent);
  }, [stats, filter, search]);

  const countFaible = stats.filter(
    (s) => getMargeLevel(s.margePercent) === "faible",
  ).length;
  const countMoyen = stats.filter(
    (s) => getMargeLevel(s.margePercent) === "moyen",
  ).length;
  const countEleve = stats.filter(
    (s) => getMargeLevel(s.margePercent) === "eleve",
  ).length;

  return (
    <Card className="flex flex-col" data-ocid="simulateur.marges.panel">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-accent/60">
            <TrendingDown className="h-4 w-4 text-foreground" />
          </div>
          <CardTitle className="text-sm font-semibold">
            Analyse des Marges
          </CardTitle>
          <Badge variant="secondary" className="text-xs ml-auto">
            {rows.length}/{stats.length}
          </Badge>
        </div>
        <div className="relative mb-2">
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-3"
            data-ocid="simulateur.marges.search_input"
          />
        </div>
        <FilterBar
          filters={MARGE_FILTERS}
          active={filter}
          onChange={setFilter}
          prefix="simulateur.marges"
        />
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Plat</TableHead>
              <TableHead className="text-right">Marge Brute %</TableHead>
              <TableHead className="text-right">Food Cost %</TableHead>
              <TableHead className="text-right">Marge €</TableHead>
              <TableHead className="text-center">Niveau</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-10"
                  data-ocid="simulateur.marges.empty_state"
                >
                  <p className="text-xs">Aucun résultat</p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s, idx) => {
                const lvl = getMargeLevel(s.margePercent);
                const margeEur = s.prixHTCalc - s.coutHT;
                return (
                  <TableRow
                    key={s.recette.id}
                    data-ocid={`simulateur.marges.item.${idx + 1}`}
                  >
                    <TableCell className="font-medium text-sm min-w-0">
                      <div
                        className="truncate max-w-[140px]"
                        title={s.recette.nom}
                      >
                        {s.recette.nom}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-xs font-semibold ${
                          lvl === "eleve"
                            ? "text-green-600"
                            : lvl === "moyen"
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {fmtPct(s.margePercent)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {fmtPct(s.foodCostPercent)}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs font-semibold ${
                        margeEur >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {fmtEur(margeEur)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${margeLevelColor(lvl)}`}
                      >
                        {margeLevelLabel(lvl)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Répartition summary */}
      <div className="border-t bg-muted/20 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="text-red-600 font-medium">Faible: {countFaible}</span>
        <span className="text-amber-600 font-medium">Moyen: {countMoyen}</span>
        <span className="text-green-600 font-medium">Élevé: {countEleve}</span>
        <span className="text-muted-foreground ml-auto">
          seuils: &lt;60% / 60–70% / &gt;70%
        </span>
      </div>
    </Card>
  );
}

// ─── Category Analysis Panel ──────────────────────────────────────────────
function margeColor(avgMarge: number): string {
  if (avgMarge > 60) return "text-green-600";
  if (avgMarge >= 40) return "text-amber-600";
  return "text-red-600";
}

function margeBadgeClass(avgMarge: number): string {
  if (avgMarge > 60)
    return "bg-green-500/10 text-green-600 border-green-500/20";
  if (avgMarge >= 40)
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  return "bg-red-500/10 text-red-600 border-red-500/20";
}

function PanelCategories({ categoryStats }: { categoryStats: CategoryStat[] }) {
  const total = categoryStats.reduce((s, c) => s + c.count, 0);

  return (
    <Card data-ocid="simulateur.categories.panel">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-secondary/60">
            <BarChart3 className="h-4 w-4 text-foreground" />
          </div>
          <CardTitle className="text-sm font-semibold">
            Analyse par catégories
          </CardTitle>
          <Badge variant="secondary" className="text-xs ml-auto">
            {total} recette{total !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Nb recettes</TableHead>
              <TableHead className="text-right">Food Cost moy. %</TableHead>
              <TableHead className="text-right">Marge moy. %</TableHead>
              <TableHead className="text-center">Niveau</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryStats.map((cs, idx) => (
              <TableRow
                key={cs.category}
                data-ocid={`simulateur.categories.item.${idx + 1}`}
              >
                <TableCell className="font-medium text-sm">
                  {cs.category}
                </TableCell>
                <TableCell className="text-right text-xs">
                  {cs.count > 0 ? (
                    <span className="font-semibold">{cs.count}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {cs.count > 0 ? fmtPct(cs.avgFoodCost) : <span>—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {cs.count > 0 ? (
                    <span
                      className={`text-xs font-semibold ${margeColor(cs.avgMarge)}`}
                    >
                      {fmtPct(cs.avgMarge)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {cs.count > 0 ? (
                    <Badge
                      variant="outline"
                      className={`text-xs ${margeBadgeClass(cs.avgMarge)}`}
                    >
                      {cs.avgMarge > 60
                        ? "Élevé"
                        : cs.avgMarge >= 40
                          ? "Moyen"
                          : "Faible"}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      0 recette
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <div className="border-t bg-muted/20 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="text-red-600 font-medium">Rouge &lt;40 %</span>
        <span className="text-amber-600 font-medium">Jaune 40–60 %</span>
        <span className="text-green-600 font-medium">Vert &gt;60 %</span>
        <span className="ml-auto">{RECIPE_CATEGORIES.length} catégories</span>
      </div>
    </Card>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────
export default function SimulateurCarte() {
  const {
    stats,
    totalRecettes,
    margeMoyenne,
    meilleurePlat,
    platAOptimiser,
    categoryStats,
    isLoading,
  } = useStatsSimulateur();

  if (isLoading) {
    return (
      <div className="space-y-4" data-ocid="simulateur.page">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div className="h-5 w-44 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
      </div>
    );
  }

  if (totalRecettes === 0) {
    return (
      <div className="space-y-4" data-ocid="simulateur.page">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Simulateur Carte</h2>
            <p className="text-sm text-muted-foreground">
              Analyse de rentabilité par plat
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-16">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-ocid="simulateur.empty_state"
            >
              <FlaskConical className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">Aucune recette disponible</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajoutez des recettes dans l&apos;onglet Recettes pour commencer
                l&apos;analyse
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-ocid="simulateur.page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Laboratoire Carte</h2>
            <p className="text-sm text-muted-foreground">
              Performance & marges — {totalRecettes} plat
              {totalRecettes > 1 ? "s" : ""} analysé
              {totalRecettes > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {/* KPI pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 text-xs">
            <span className="text-muted-foreground">Marge moy.</span>
            <strong
              className={
                margeMoyenne >= 60
                  ? "text-green-600"
                  : margeMoyenne >= 40
                    ? "text-amber-600"
                    : "text-red-600"
              }
            >
              {fmtPct(margeMoyenne)}
            </strong>
          </div>
          {meilleurePlat && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-xs text-green-700">
              <Star className="h-3 w-3" />
              <span className="truncate max-w-[100px]">
                {meilleurePlat.recette.nom}
              </span>
              <strong>{fmtPct(meilleurePlat.margePercent)}</strong>
            </div>
          )}
          {platAOptimiser && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-xs text-red-700">
              <TrendingDown className="h-3 w-3" />
              <span className="truncate max-w-[100px]">
                {platAOptimiser.recette.nom}
              </span>
              <strong>{fmtPct(platAOptimiser.margePercent)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <PanelPerformance stats={stats} />
        <PanelMarges stats={stats} />
      </div>

      {/* Category analysis — full width */}
      <PanelCategories categoryStats={categoryStats} />
    </div>
  );
}
