/**
 * Stock.tsx — Module de gestion des stocks (Logistique)
 * Onglets : Inventaire · Entrées · Sorties · Réconciliation
 * RÈGLE SSOT : zéro calcul hors fonctions pures, zéro setState en rendu.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/core/ui/SearchableSelect";
import {
  useCreateMouvement,
  useDeleteMouvement,
  useIngredients,
  useMouvementsStock,
  useUpdateIngredient,
} from "@/hooks/useRestaurantQueries";
import type { Ingredient, MouvementStock } from "@/hooks/useRestaurantQueries";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  Clock,
  Package,
  PackageX,
  RefreshCw,
  Save,
  Search,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "inventaire" | "entrees" | "sorties" | "reconciliation";
type SortDir = "asc" | "desc" | null;
type InventaireSortKey = "nom" | "unite" | "stock" | "seuil" | "statut";
type ConfigState = Record<string, { stockStr: string; seuilStr: string }>;

// ── Pure helpers ──────────────────────────────────────────────────────────────

function computeStatut(stock: number, seuil: number) {
  if (seuil <= 0)
    return {
      label: "N/D",
      color: "text-muted-foreground",
      variant: "secondary" as const,
    };
  if (stock < seuil)
    return {
      label: "RUPTURE",
      color: "text-destructive",
      variant: "destructive" as const,
      cls: "",
    };
  if (stock < seuil * 2)
    return {
      label: "FAIBLE",
      color: "text-amber-400",
      variant: "outline" as const,
      cls: "text-amber-400 border-amber-500",
    };
  return {
    label: "OK",
    color: "text-green-400",
    variant: "outline" as const,
    cls: "text-green-400 border-green-500",
  };
}

function computeStockActuel(
  ingredients: Ingredient[],
  mouvements: MouvementStock[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const ing of ingredients) map.set(ing.id, ing.stockInitial);
  for (const m of mouvements) {
    const cur = map.get(m.ingredientId) ?? 0;
    map.set(
      m.ingredientId,
      m.typeOp === "Entrée" ? cur + m.quantite : cur - m.quantite,
    );
  }
  return map;
}

function computeMouvStats(mouvements: MouvementStock[]) {
  const entr = new Map<string, number>();
  const sort = new Map<string, number>();
  for (const m of mouvements) {
    if (m.typeOp === "Entrée")
      entr.set(m.ingredientId, (entr.get(m.ingredientId) ?? 0) + m.quantite);
    else sort.set(m.ingredientId, (sort.get(m.ingredientId) ?? 0) + m.quantite);
  }
  return { entr, sort };
}

function nextDir(cur: SortDir): SortDir {
  if (!cur) return "asc";
  if (cur === "asc") return "desc";
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SKELETON_ROWS = [0, 1, 2, 3, 4];
const SKELETON_COLS_8 = [0, 1, 2, 3, 4, 5, 6, 7];
const SKELETON_COLS_6 = [0, 1, 2, 3, 4, 5];

interface SortHeaderProps {
  label: string;
  col: InventaireSortKey;
  sortKey: InventaireSortKey | null;
  sortDir: SortDir;
  onSort: (k: InventaireSortKey) => void;
  className?: string;
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className,
}: SortHeaderProps) {
  const active = sortKey === col;
  return (
    <TableHead
      className={`cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active && sortDir === "asc" && (
          <ChevronUp className="h-3 w-3 text-primary" />
        )}
        {active && sortDir === "desc" && (
          <ChevronDown className="h-3 w-3 text-primary" />
        )}
        {!active && (
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />
        )}
      </div>
    </TableHead>
  );
}

interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon: React.ReactNode;
  iconBg?: string;
}

function KpiCard({ label, value, sub, accent, icon, iconBg }: KpiProps) {
  return (
    <Card className={accent ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}
            >
              {value}
            </p>
            {sub && (
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
          <div
            className={`rounded-lg p-2 shrink-0 ${iconBg ?? "bg-primary/10"}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Stock() {
  const { data: ingredients = [], isLoading: loadingIng } = useIngredients();
  const { data: mouvements = [], isLoading: loadingMvt } = useMouvementsStock();
  const createMvt = useCreateMouvement();
  const deleteMvt = useDeleteMouvement();
  const updateIng = useUpdateIngredient();
  const [lastUpdateTs, setLastUpdateTs] = useState<Date | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [activeTab, setActiveTab] = useState<ActiveTab>("inventaire");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<InventaireSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    ingredientId: "",
    date: today,
    typeOp: "Entrée",
    quantiteStr: "",
    motif: "",
  });

  const [configState, setConfigState] = useState<ConfigState>({});

  useEffect(() => {
    setConfigState((prev) => {
      const next: ConfigState = {};
      for (const ing of ingredients) {
        next[ing.id] = prev[ing.id] ?? {
          stockStr: ing.stockInitial === 0 ? "" : String(ing.stockInitial),
          seuilStr: ing.seuilSecurite === 0 ? "" : String(ing.seuilSecurite),
        };
      }
      return next;
    });
  }, [ingredients]);

  const stockActuel = useMemo(
    () => computeStockActuel(ingredients, mouvements),
    [ingredients, mouvements],
  );

  const mouvStats = useMemo(() => computeMouvStats(mouvements), [mouvements]);

  const alertCount = useMemo(
    () =>
      ingredients.filter((ing) => {
        const s = stockActuel.get(ing.id) ?? ing.stockInitial;
        return ing.seuilSecurite > 0 && s < ing.seuilSecurite;
      }).length,
    [ingredients, stockActuel],
  );

  const totalEntrees = useMemo(
    () => [...mouvStats.entr.values()].reduce((a, b) => a + b, 0),
    [mouvStats],
  );

  const totalSorties = useMemo(
    () => [...mouvStats.sort.values()].reduce((a, b) => a + b, 0),
    [mouvStats],
  );

  const displayedIngredients = useMemo(() => {
    let list = ingredients.filter(
      (i) => !search || i.nom.toLowerCase().includes(search.toLowerCase()),
    );
    if (sortKey && sortDir) {
      list = [...list].sort((a, b) => {
        let av: string | number = 0;
        let bv: string | number = 0;
        if (sortKey === "nom") {
          av = a.nom;
          bv = b.nom;
        } else if (sortKey === "unite") {
          av = a.unite;
          bv = b.unite;
        } else if (sortKey === "stock") {
          av = stockActuel.get(a.id) ?? a.stockInitial;
          bv = stockActuel.get(b.id) ?? b.stockInitial;
        } else if (sortKey === "seuil") {
          av = a.seuilSecurite;
          bv = b.seuilSecurite;
        } else if (sortKey === "statut") {
          av = computeStatut(
            stockActuel.get(a.id) ?? a.stockInitial,
            a.seuilSecurite,
          ).label;
          bv = computeStatut(
            stockActuel.get(b.id) ?? b.stockInitial,
            b.seuilSecurite,
          ).label;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [ingredients, search, sortKey, sortDir, stockActuel]);

  const entrees = useMemo(
    () => [...mouvements].filter((m) => m.typeOp === "Entrée").reverse(),
    [mouvements],
  );
  const sorties = useMemo(
    () => [...mouvements].filter((m) => m.typeOp !== "Entrée").reverse(),
    [mouvements],
  );

  function handleSort(k: InventaireSortKey) {
    if (sortKey === k) {
      const nd = nextDir(sortDir);
      setSortDir(nd);
      if (!nd) setSortKey(null);
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function updateConfig(
    id: string,
    field: "stockStr" | "seuilStr",
    val: string,
  ) {
    setConfigState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: val },
    }));
  }

  async function handleAddMouvement(forceType?: string) {
    if (!form.ingredientId) {
      toast.error("Sélectionnez un ingrédient");
      return;
    }
    const qty = Number.parseFloat(form.quantiteStr);
    if (!form.quantiteStr || Number.isNaN(qty) || qty <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    try {
      await createMvt.mutateAsync({
        ingredientId: form.ingredientId,
        date: form.date,
        typeOp: forceType ?? form.typeOp,
        quantite: qty,
        motif: form.motif,
      });
      setLastUpdateTs(new Date());
      toast.success("Mouvement ajouté");
      setForm((f) => ({ ...f, quantiteStr: "", motif: "" }));
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleDeleteMvt(id: string) {
    try {
      await deleteMvt.mutateAsync(id);
      setDeleteConfirm(null);
      setLastUpdateTs(new Date());
      toast.success("Mouvement supprimé — stock recalculé");
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleSaveConfig(ing: Ingredient) {
    const cfg = configState[ing.id];
    if (!cfg) return;
    try {
      await updateIng.mutateAsync({
        ...ing,
        stockInitial: Number.parseFloat(cfg.stockStr) || 0,
        seuilSecurite: Number.parseFloat(cfg.seuilStr) || 0,
      });
      toast.success(`Configuré : ${ing.nom}`);
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "inventaire",
      label: "Inventaire",
      icon: <ClipboardList className="h-3.5 w-3.5" />,
    },
    {
      id: "entrees",
      label: "Entrées",
      icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
    },
    {
      id: "sorties",
      label: "Sorties",
      icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
    },
    {
      id: "reconciliation",
      label: "Réconciliation",
      icon: <RefreshCw className="h-3.5 w-3.5" />,
    },
  ];

  // ── Shared mouvement table ───────────────────────────────────────────────
  function MouvementTable({
    rows,
    loading,
    emptyLabel,
  }: { rows: MouvementStock[]; loading: boolean; emptyLabel: string }) {
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>Ingrédient</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              SKELETON_ROWS.map((r) => (
                <TableRow key={r}>
                  {SKELETON_COLS_6.map((c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-10"
                  data-ocid="stock.empty_state"
                >
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m, idx) => {
                const ing = ingredients.find((i) => i.id === m.ingredientId);
                const isEntry = m.typeOp === "Entrée";
                return (
                  <TableRow key={m.id} data-ocid={`stock.row.${idx + 1}`}>
                    <TableCell className="text-sm">{m.date}</TableCell>
                    <TableCell className="font-medium">
                      {ing?.nom ?? m.ingredientId}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isEntry
                            ? "text-green-400 border-green-600"
                            : "text-red-400 border-red-600"
                        }
                      >
                        {isEntry ? (
                          <ArrowUpCircle className="h-3 w-3 mr-1 inline" />
                        ) : (
                          <ArrowDownCircle className="h-3 w-3 mr-1 inline" />
                        )}
                        {m.typeOp}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.quantite.toLocaleString("fr-FR", {
                        maximumFractionDigits: 3,
                      })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {m.motif || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirm(m.id)}
                        data-ocid={`stock.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="stock.page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display">Gestion de Stock</h2>
            <p className="text-sm text-muted-foreground">
              Stock actuel = Stock initial + Entrées − Sorties
            </p>
          </div>
          {alertCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <PackageX className="h-3 w-3" />
              {alertCount} alerte{alertCount > 1 ? "s" : ""}
            </Badge>
          )}
          {lastUpdateTs && (
            <Badge
              variant="outline"
              className="gap-1 text-muted-foreground border-border"
              title={lastUpdateTs.toLocaleString("fr-FR")}
            >
              <Clock className="h-3 w-3" />
              Mis à jour à{" "}
              {lastUpdateTs.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Badge>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ingrédients"
          value={ingredients.length}
          sub={`${ingredients.filter((i) => i.seuilSecurite > 0).length} avec seuil`}
          icon={<Package className="h-4 w-4 text-primary" />}
          accent
        />
        <KpiCard
          label="Entrées totales"
          value={totalEntrees.toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
          })}
          sub={`${entrees.length} opération(s)`}
          icon={<ArrowUpCircle className="h-4 w-4 text-green-400" />}
          iconBg="bg-green-400/10"
        />
        <KpiCard
          label="Sorties totales"
          value={totalSorties.toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
          })}
          sub={`${sorties.length} opération(s)`}
          icon={<ArrowDownCircle className="h-4 w-4 text-red-400" />}
          iconBg="bg-red-400/10"
        />
        <KpiCard
          label="Alertes stock"
          value={alertCount}
          sub={alertCount === 0 ? "Tout est OK" : "Sous le seuil"}
          icon={
            <PackageX
              className={`h-4 w-4 ${alertCount > 0 ? "text-destructive" : "text-green-400"}`}
            />
          }
          iconBg={alertCount > 0 ? "bg-destructive/10" : "bg-green-400/10"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-ocid={`stock.${tab.id}.tab`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Inventaire */}
      {activeTab === "inventaire" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un ingrédient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-ocid="stock.search_input"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {displayedIngredients.length} / {ingredients.length} ingrédient
              {ingredients.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <SortHeader
                    label="Ingrédient"
                    col="nom"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Unité"
                    col="unite"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="text-right">Stock initial</TableHead>
                  <TableHead className="text-right">
                    <span className="text-green-400 flex items-center justify-end gap-1">
                      <ArrowUpCircle className="h-3 w-3" /> Entrées
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="text-red-400 flex items-center justify-end gap-1">
                      <ArrowDownCircle className="h-3 w-3" /> Sorties
                    </span>
                  </TableHead>
                  <SortHeader
                    label="Stock actuel"
                    col="stock"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Seuil alerte"
                    col="seuil"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Statut"
                    col="statut"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="text-center"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingIng ? (
                  SKELETON_ROWS.map((r) => (
                    <TableRow key={r}>
                      {SKELETON_COLS_8.map((c) => (
                        <TableCell key={c}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : displayedIngredients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-12"
                      data-ocid="stock.empty_state"
                    >
                      Aucun ingrédient trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedIngredients.map((ing, idx) => {
                    const stock = stockActuel.get(ing.id) ?? ing.stockInitial;
                    const totalE = mouvStats.entr.get(ing.id) ?? 0;
                    const totalS = mouvStats.sort.get(ing.id) ?? 0;
                    const statut = computeStatut(stock, ing.seuilSecurite);
                    const alerte =
                      ing.seuilSecurite > 0 && stock < ing.seuilSecurite;
                    return (
                      <TableRow
                        key={ing.id}
                        data-ocid={`stock.item.${idx + 1}`}
                        className={
                          alerte
                            ? "bg-destructive/5 hover:bg-destructive/10"
                            : ""
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {alerte && (
                              <PackageX className="h-3.5 w-3.5 text-destructive shrink-0" />
                            )}
                            {ing.nom}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {ing.unite}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {ing.stockInitial}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-green-400">
                          {totalE > 0 ? `+${totalE}` : "0"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono text-red-400">
                          {totalS > 0 ? `-${totalS}` : "0"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold font-mono ${
                            alerte ? "text-destructive" : ""
                          }`}
                        >
                          {stock.toLocaleString("fr-FR", {
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {ing.seuilSecurite > 0 ? (
                            ing.seuilSecurite
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={statut.variant}
                            className={`text-xs ${"cls" in statut ? statut.cls : ""}`}
                          >
                            {statut.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* ── TAB: Entrées */}
      {activeTab === "entrees" && (
        <>
          <Card data-ocid="stock.entree.panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-green-400" />
                Enregistrer une entrée de stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div className="grid gap-1.5">
                  <Label>Ingrédient</Label>
                  <SearchableSelect
                    options={ingredients.map((i) => ({
                      value: i.id,
                      label: i.nom,
                    }))}
                    value={form.ingredientId}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, ingredientId: v }))
                    }
                    placeholder="Sélectionner..."
                    searchPlaceholder="Rechercher un ingrédient…"
                    data-ocid="stock.entree.select"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    data-ocid="stock.entree.date_input"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.quantiteStr}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantiteStr: e.target.value }))
                    }
                    placeholder="0"
                    data-ocid="stock.entree.qty_input"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Motif</Label>
                  <Input
                    value={form.motif}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, motif: e.target.value }))
                    }
                    placeholder="Optionnel"
                  />
                </div>
                <div />
                <Button
                  onClick={() => handleAddMouvement("Entrée")}
                  disabled={
                    createMvt.isPending ||
                    !form.ingredientId ||
                    !form.quantiteStr
                  }
                  data-ocid="stock.entree.submit_button"
                  className="w-full"
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" /> Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-base font-semibold flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-green-400" />
            Historique — Entrées
            <Badge variant="secondary">{entrees.length}</Badge>
          </h3>
          <MouvementTable
            rows={entrees}
            loading={loadingMvt}
            emptyLabel="Aucune entrée enregistrée"
          />
        </>
      )}

      {/* ── TAB: Sorties */}
      {activeTab === "sorties" && (
        <>
          <Card data-ocid="stock.sortie.panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-red-400" />
                Enregistrer une sortie de stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div className="grid gap-1.5">
                  <Label>Ingrédient</Label>
                  <SearchableSelect
                    options={ingredients.map((i) => ({
                      value: i.id,
                      label: i.nom,
                    }))}
                    value={form.ingredientId}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, ingredientId: v }))
                    }
                    placeholder="Sélectionner..."
                    searchPlaceholder="Rechercher un ingrédient…"
                    data-ocid="stock.sortie.select"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    data-ocid="stock.sortie.date_input"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.quantiteStr}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantiteStr: e.target.value }))
                    }
                    placeholder="0"
                    data-ocid="stock.sortie.qty_input"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Motif</Label>
                  <Input
                    value={form.motif}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, motif: e.target.value }))
                    }
                    placeholder="Optionnel"
                  />
                </div>
                <div />
                <Button
                  variant="destructive"
                  onClick={() => handleAddMouvement("Sortie")}
                  disabled={
                    createMvt.isPending ||
                    !form.ingredientId ||
                    !form.quantiteStr
                  }
                  data-ocid="stock.sortie.submit_button"
                  className="w-full"
                >
                  <ArrowDownCircle className="mr-2 h-4 w-4" /> Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-base font-semibold flex items-center gap-2">
            <ArrowDownCircle className="h-4 w-4 text-red-400" />
            Historique — Sorties
            <Badge variant="secondary">{sorties.length}</Badge>
          </h3>
          <MouvementTable
            rows={sorties}
            loading={loadingMvt}
            emptyLabel="Aucune sortie enregistrée"
          />
        </>
      )}

      {/* ── TAB: Réconciliation */}
      {activeTab === "reconciliation" && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">
              Réconciliation — Seuils &amp; Stocks initiaux
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Ajustez le stock initial de référence et le seuil d&apos;alerte par
            ingrédient.
          </p>

          {ingredients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">
                  Aucun ingrédient. Ajoutez des ingrédients d&apos;abord.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Ingrédient</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead>Stock calculé</TableHead>
                      <TableHead className="min-w-[150px]">
                        Stock initial
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        Seuil d&apos;alerte
                      </TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ing) => {
                      const cfg = configState[ing.id] ?? {
                        stockStr: "",
                        seuilStr: "",
                      };
                      const stockCalc =
                        stockActuel.get(ing.id) ?? ing.stockInitial;
                      const statut = computeStatut(
                        stockCalc,
                        ing.seuilSecurite,
                      );
                      return (
                        <TableRow key={ing.id}>
                          <TableCell className="font-medium">
                            {ing.nom}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {ing.unite}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`font-mono text-sm font-semibold ${statut.color}`}
                            >
                              {stockCalc.toLocaleString("fr-FR", {
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={cfg.stockStr}
                              onChange={(e) =>
                                updateConfig(ing.id, "stockStr", e.target.value)
                              }
                              placeholder="0"
                              className="w-28 h-8"
                              data-ocid="stock.reconciliation.stock_input"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={cfg.seuilStr}
                              onChange={(e) =>
                                updateConfig(ing.id, "seuilStr", e.target.value)
                              }
                              placeholder="0"
                              className="w-28 h-8"
                              data-ocid="stock.reconciliation.seuil_input"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 hover:border-primary hover:text-primary"
                              onClick={() => handleSaveConfig(ing)}
                              disabled={updateIng.isPending}
                              data-ocid="stock.reconciliation.save_button"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent data-ocid="stock.dialog">
          <DialogHeader>
            <DialogTitle>Supprimer ce mouvement ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible et modifiera le stock calculé.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              data-ocid="stock.cancel_button"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteMvt(deleteConfirm)}
              disabled={deleteMvt.isPending}
              data-ocid="stock.confirm_button"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
