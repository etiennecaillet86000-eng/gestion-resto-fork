/**
 * Operations.tsx — Tableau de bord des ventes & opérations
 * Sub-tabs: Jour · Semaine · Mois · Annuel
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjectionStore } from "@/core/store/projectionStore";
import { SearchableSelect } from "@/core/ui/SearchableSelect";
import { useParametres } from "@/hooks/useFinanceQueries";
import {
  useCreateMouvement,
  useCreateVente,
  useDeleteVente,
  useIngredients,
  useMouvementsStock,
  useRecettes,
  useVentesRecettes,
} from "@/hooks/useRestaurantQueries";
import type { Recette, VenteRecette } from "@/hooks/useRestaurantQueries";
import { coutMatiereHT, fmtEur, fmtPct, prixHT } from "@/utils/format";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Euro,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "jour" | "semaine" | "mois" | "annuel";

interface DayStats {
  date: string;
  caHT: number;
  caTTC: number;
  cout: number;
  nbVentes: number;
  nbCouverts: number;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS_FR = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function datesBetween(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function computeDayStats(
  ventes: VenteRecette[],
  recetteMap: Map<string, Recette>,
  ingredientsMap: Map<string, { prixUnitaireHT: number }>,
): Omit<DayStats, "date"> {
  return ventes.reduce(
    (acc, v) => {
      const r = recetteMap.get(v.recetteId);
      if (!r) return acc;
      const ht = prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      const ttc = r.prixVenteTTC * v.quantite;
      const cout = coutMatiereHT(r, new Map(ingredientsMap)) * v.quantite;
      return {
        caHT: acc.caHT + ht,
        caTTC: acc.caTTC + ttc,
        cout: acc.cout + cout,
        nbVentes: acc.nbVentes + 1,
        nbCouverts: acc.nbCouverts + v.quantite,
      };
    },
    { caHT: 0, caTTC: 0, cout: 0, nbVentes: 0, nbCouverts: 0 },
  );
}

function deltaLabel(current: number, previous: number): string {
  if (previous === 0) return "—";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)} %`;
}

function deltaPositive(current: number, previous: number): boolean {
  return current >= previous;
}

function calculerPointMortJour(
  fraisFixesAnnuels: number,
  txFoodCost: number,
  jours: number,
): number {
  const joursRef = jours > 0 ? jours : 300;
  const marge = 1 - txFoodCost;
  if (marge <= 0) return 0;
  return fraisFixesAnnuels / marge / joursRef;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  accent?: boolean;
  delta?: string;
  deltaUp?: boolean;
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  accent,
  delta,
  deltaUp,
}: KpiProps) {
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
            {delta && (
              <p
                className={`text-xs font-medium mt-1 flex items-center gap-0.5 ${deltaUp ? "text-green-400" : "text-red-400"}`}
              >
                {deltaUp ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {delta} vs période préc.
              </p>
            )}
          </div>
          <div className={`rounded-lg p-2 shrink-0 ${iconBg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ServiceCardProps {
  label: string;
  icon: React.ReactNode;
  ventes: VenteRecette[];
  recetteMap: Map<string, Recette>;
  ingredientsMap: Map<string, { prixUnitaireHT: number }>;
}

function ServiceCard({
  label,
  icon,
  ventes,
  recetteMap,
  ingredientsMap,
}: ServiceCardProps) {
  const stats = computeDayStats(ventes, recetteMap, ingredientsMap);
  const marge =
    stats.caHT > 0 ? ((stats.caHT - stats.cout) / stats.caHT) * 100 : 0;
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="font-semibold text-sm">{label}</span>
          <Badge variant="secondary" className="ml-auto">
            {stats.nbCouverts} couvert{stats.nbCouverts > 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">CA HT</p>
            <p className="text-sm font-bold text-primary">
              {fmtEur(stats.caHT)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ticket moy.</p>
            <p className="text-sm font-bold">
              {stats.nbCouverts > 0
                ? fmtEur(stats.caHT / stats.nbCouverts)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Marge</p>
            <p
              className={`text-sm font-bold ${
                marge >= 60
                  ? "text-green-400"
                  : marge >= 40
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {fmtPct(marge)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Add Vente Dialog ───────────────────────────────────────────────────────────

interface AddVenteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedDate: string;
  recettes: Recette[];
  onAdd: (recetteId: string, quantite: number) => Promise<void>;
  isPending: boolean;
}

function AddVenteDialog({
  open,
  onOpenChange,
  selectedDate,
  recettes,
  onAdd,
  isPending,
}: AddVenteDialogProps) {
  const [recetteId, setRecetteId] = useState("");
  const [quantiteStr, setQuantiteStr] = useState("1");

  async function handleSubmit() {
    if (!recetteId) {
      toast.error("Sélectionnez une recette");
      return;
    }
    const qty = Number.parseInt(quantiteStr, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    await onAdd(recetteId, qty);
    setRecetteId("");
    setQuantiteStr("1");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="operations.dialog">
        <DialogHeader>
          <DialogTitle>Enregistrer une vente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label>Recette</Label>
            <SearchableSelect
              options={recettes.map((r) => ({
                value: r.id,
                label: `${r.nom} — ${fmtEur(r.prixVenteTTC)}`,
              }))}
              value={recetteId}
              onChange={setRecetteId}
              placeholder="Sélectionner une recette..."
              searchPlaceholder="Rechercher une recette…"
              data-ocid="operations.add_vente.select"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Quantité (couverts)</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={quantiteStr}
              onChange={(e) => setQuantiteStr(e.target.value)}
              data-ocid="operations.add_vente.qty_input"
            />
          </div>
          <p className="text-xs text-muted-foreground">Date : {selectedDate}</p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-ocid="operations.add_vente.cancel_button"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !recetteId}
            data-ocid="operations.add_vente.submit_button"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />{" "}
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Operations() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("jour");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [addVenteOpen, setAddVenteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: recettes = [], isLoading: loadingR } = useRecettes();
  const { data: ingredients = [], isLoading: loadingI } = useIngredients();
  const { data: allVentes = [], isLoading: loadingV } = useVentesRecettes();
  const { data: parametres } = useParametres();
  const createVente = useCreateVente();
  const createMouvement = useCreateMouvement();
  const deleteVente = useDeleteVente();
  const { data: mouvements = [] } = useMouvementsStock();

  const isLoading = loadingR || loadingI || loadingV;

  const recetteMap = useMemo(
    () => new Map<string, Recette>(recettes.map((r) => [r.id, r])),
    [recettes],
  );

  const ingredientsMap = useMemo(
    () =>
      new Map<string, { prixUnitaireHT: number }>(
        ingredients.map((i) => [i.id, { prixUnitaireHT: i.prixUnitaireHT }]),
      ),
    [ingredients],
  );

  // ── Food cost & point mort ───────────────────────────────────────────────────

  const txFoodCostMoyen = useMemo(() => {
    if (!parametres?.tauxFoodCostParCategorie?.length) return 0.3;
    const sum = parametres.tauxFoodCostParCategorie.reduce(
      (a, [, v]) => a + v,
      0,
    );
    return sum / parametres.tauxFoodCostParCategorie.length / 100;
  }, [parametres]);

  // Use seuil from Rentabilité Mix Produits tab if configured, else conservative default
  const mixProduitSeuilMensuel = useProjectionStore(
    (s) => s.mixProduitSeuilMensuel,
  );
  const fraisFixesAnnuelsEstim =
    mixProduitSeuilMensuel > 0 ? mixProduitSeuilMensuel * 12 : 60_000;

  const pointMortJour = useMemo(
    () => calculerPointMortJour(fraisFixesAnnuelsEstim, txFoodCostMoyen, 300),
    [fraisFixesAnnuelsEstim, txFoodCostMoyen],
  );

  // ── Jour ────────────────────────────────────────────────────────────────────

  const ventesDuJour = useMemo(
    () => allVentes.filter((v) => v.date === selectedDate),
    [allVentes, selectedDate],
  );

  const isToday = selectedDate === todayStr();

  const statsJour = useMemo(
    () => computeDayStats(ventesDuJour, recetteMap, ingredientsMap),
    [ventesDuJour, recetteMap, ingredientsMap],
  );

  const margeJour = statsJour.caHT - statsJour.cout;
  const txMargeJour =
    statsJour.caHT > 0 ? (margeJour / statsJour.caHT) * 100 : 0;
  const ticketMoyenJour =
    statsJour.nbCouverts > 0 ? statsJour.caHT / statsJour.nbCouverts : 0;
  const progressVsPM =
    pointMortJour > 0
      ? Math.min((statsJour.caHT / pointMortJour) * 100, 100)
      : 0;

  const midIdx = Math.ceil(ventesDuJour.length / 2);
  const ventesDejeuner = useMemo(
    () => ventesDuJour.slice(0, midIdx),
    [ventesDuJour, midIdx],
  );
  const ventesDiner = useMemo(
    () => ventesDuJour.slice(midIdx),
    [ventesDuJour, midIdx],
  );

  const parRecetteJour = useMemo(() => {
    const map = new Map<
      string,
      { recette: Recette; quantite: number; caHT: number }
    >();
    for (const v of ventesDuJour) {
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      const ht = prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      const ex = map.get(r.id);
      if (ex) {
        ex.quantite += v.quantite;
        ex.caHT += ht;
      } else map.set(r.id, { recette: r, quantite: v.quantite, caHT: ht });
    }
    return [...map.values()].sort((a, b) => b.caHT - a.caHT);
  }, [ventesDuJour, recetteMap]);

  const parCategorieJour = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of ventesDuJour) {
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      const ht = prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      map.set(r.categorie, (map.get(r.categorie) ?? 0) + ht);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [ventesDuJour, recetteMap]);

  // ── Semaine ─────────────────────────────────────────────────────────────────

  const today = new Date();
  const { start: weekStart, end: weekEnd } = getWeekBounds(today);
  const { start: prevWeekStart, end: prevWeekEnd } = getWeekBounds(
    new Date(weekStart.getTime() - 7 * 86400000),
  );

  const weekDates = useMemo(
    () => datesBetween(weekStart, weekEnd),
    [weekStart, weekEnd],
  );
  const prevWeekDates = useMemo(
    () => datesBetween(prevWeekStart, prevWeekEnd),
    [prevWeekStart, prevWeekEnd],
  );

  const weekStats = useMemo((): DayStats[] => {
    return weekDates.map((date) => {
      const vs = allVentes.filter((v) => v.date === date);
      return { date, ...computeDayStats(vs, recetteMap, ingredientsMap) };
    });
  }, [weekDates, allVentes, recetteMap, ingredientsMap]);

  const weekTotal = useMemo(
    () =>
      weekStats.reduce(
        (acc, d) => ({
          caHT: acc.caHT + d.caHT,
          caTTC: acc.caTTC + d.caTTC,
          cout: acc.cout + d.cout,
          nbVentes: acc.nbVentes + d.nbVentes,
          nbCouverts: acc.nbCouverts + d.nbCouverts,
        }),
        { caHT: 0, caTTC: 0, cout: 0, nbVentes: 0, nbCouverts: 0 },
      ),
    [weekStats],
  );

  const prevWeekTotal = useMemo(() => {
    const vs = allVentes.filter((v) => prevWeekDates.includes(v.date));
    return computeDayStats(vs, recetteMap, ingredientsMap);
  }, [prevWeekDates, allVentes, recetteMap, ingredientsMap]);

  // ── Mois ────────────────────────────────────────────────────────────────────

  const curYear = today.getFullYear();
  const curMonth = today.getMonth(); // 0-based
  const monthStart = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const monthEnd = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const prevMonthIdx = curMonth === 0 ? 11 : curMonth - 1;
  const prevMonthYear = curMonth === 0 ? curYear - 1 : curYear;
  const daysInPrevMonth = new Date(
    prevMonthYear,
    prevMonthIdx + 1,
    0,
  ).getDate();
  const prevMonthStart = `${prevMonthYear}-${String(prevMonthIdx + 1).padStart(2, "0")}-01`;
  const prevMonthEnd = `${prevMonthYear}-${String(prevMonthIdx + 1).padStart(2, "0")}-${String(daysInPrevMonth).padStart(2, "0")}`;

  const monthDates = useMemo(
    () => datesBetween(new Date(monthStart), new Date(monthEnd)),
    [monthStart, monthEnd],
  );

  const monthStats = useMemo((): DayStats[] => {
    return monthDates.map((date) => {
      const vs = allVentes.filter((v) => v.date === date);
      return { date, ...computeDayStats(vs, recetteMap, ingredientsMap) };
    });
  }, [monthDates, allVentes, recetteMap, ingredientsMap]);

  const monthTotal = useMemo(
    () =>
      monthStats.reduce(
        (acc, d) => ({
          caHT: acc.caHT + d.caHT,
          caTTC: acc.caTTC + d.caTTC,
          cout: acc.cout + d.cout,
          nbVentes: acc.nbVentes + d.nbVentes,
          nbCouverts: acc.nbCouverts + d.nbCouverts,
        }),
        { caHT: 0, caTTC: 0, cout: 0, nbVentes: 0, nbCouverts: 0 },
      ),
    [monthStats],
  );

  const prevMonthTotal = useMemo(() => {
    const vs = allVentes.filter(
      (v) => v.date >= prevMonthStart && v.date <= prevMonthEnd,
    );
    return computeDayStats(vs, recetteMap, ingredientsMap);
  }, [prevMonthStart, prevMonthEnd, allVentes, recetteMap, ingredientsMap]);

  const bestDayMonth = useMemo(
    () =>
      monthStats.reduce(
        (best, d) => (d.caHT > best.caHT ? d : best),
        monthStats[0] ?? { date: "—", caHT: 0 },
      ),
    [monthStats],
  );

  // Week groupings in month
  const monthByWeek = useMemo(() => {
    const weeks: { label: string; days: DayStats[] }[] = [];
    let weekIdx = 0;
    let weekDays: DayStats[] = [];
    for (const day of monthStats) {
      const d = new Date(day.date);
      const dow = d.getDay(); // 0=dim, 1=lun
      if (dow === 1 && weekDays.length > 0) {
        weeks.push({ label: `Semaine ${weekIdx + 1}`, days: weekDays });
        weekDays = [];
        weekIdx++;
      }
      weekDays.push(day);
    }
    if (weekDays.length > 0)
      weeks.push({ label: `Semaine ${weekIdx + 1}`, days: weekDays });
    return weeks;
  }, [monthStats]);

  // ── Annuel ──────────────────────────────────────────────────────────────────

  const yearStats = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthNum) => {
      const ms = `${curYear}-${String(monthNum + 1).padStart(2, "0")}-01`;
      const din = new Date(curYear, monthNum + 1, 0).getDate();
      const me = `${curYear}-${String(monthNum + 1).padStart(2, "0")}-${String(din).padStart(2, "0")}`;
      const vs = allVentes.filter((v) => v.date >= ms && v.date <= me);
      const s = computeDayStats(vs, recetteMap, ingredientsMap);
      return { month: MONTHS_FR[monthNum], monthNum, ...s };
    });
  }, [curYear, allVentes, recetteMap, ingredientsMap]);

  const yearTotal = useMemo(
    () =>
      yearStats.reduce(
        (acc, m) => ({
          caHT: acc.caHT + m.caHT,
          caTTC: acc.caTTC + m.caTTC,
          cout: acc.cout + m.cout,
          nbVentes: acc.nbVentes + m.nbVentes,
          nbCouverts: acc.nbCouverts + m.nbCouverts,
        }),
        { caHT: 0, caTTC: 0, cout: 0, nbVentes: 0, nbCouverts: 0 },
      ),
    [yearStats],
  );

  const prevYearTotal = useMemo(() => {
    const vs = allVentes.filter((v) => v.date.startsWith(String(curYear - 1)));
    return computeDayStats(vs, recetteMap, ingredientsMap);
  }, [curYear, allVentes, recetteMap, ingredientsMap]);

  // Cumulative CA progression
  const yearCumulative = useMemo(() => {
    let cum = 0;
    return yearStats.map((m) => {
      cum += m.caHT;
      return { ...m, cumCA: cum };
    });
  }, [yearStats]);

  // Top categories annual
  const yearTopCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of allVentes.filter((v) =>
      v.date.startsWith(String(curYear)),
    )) {
      const r = recetteMap.get(v.recetteId);
      if (!r) continue;
      const ht = prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
      map.set(r.categorie, (map.get(r.categorie) ?? 0) + ht);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [curYear, allVentes, recetteMap]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async function handleAddVente(recetteId: string, quantite: number) {
    try {
      const recette = recetteMap.get(recetteId);
      if (!recette) throw new Error("Recette introuvable");
      const tasks: Promise<unknown>[] = [
        createVente.mutateAsync({ recetteId, date: selectedDate, quantite }),
      ];
      for (const ri of recette.ingredients) {
        tasks.push(
          createMouvement.mutateAsync({
            ingredientId: ri.ingredientId,
            date: selectedDate,
            typeOp: "Sortie",
            quantite: ri.quantite * quantite,
            motif: `Vente — ${recette.nom}`,
          }),
        );
      }
      await Promise.all(tasks);
      toast.success("Vente enregistrée");
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleDeleteVente(id: string) {
    try {
      // Retrouver la vente à supprimer
      const vente = allVentes.find((v) => v.id === id);
      const recette = vente ? recetteMap.get(vente.recetteId) : undefined;

      // Identifier les mouvements de sortie liés à cette vente :
      // motif = "Vente — {recette.nom}", même date, même ingrédient,
      // quantité = ri.quantite × vente.quantite (correspondance exacte)
      let mouvementIds: string[] = [];
      if (vente && recette) {
        const expectedMotif = `Vente — ${recette.nom}`;
        mouvementIds = recette.ingredients.flatMap((ri) => {
          const expectedQty = ri.quantite * vente.quantite;
          // Trouver les mouvements de sortie correspondants (FIFO sur la date)
          const candidates = mouvements.filter(
            (m) =>
              m.typeOp !== "Entrée" &&
              m.ingredientId === ri.ingredientId &&
              m.date === vente.date &&
              m.motif === expectedMotif &&
              Math.abs(m.quantite - expectedQty) < 0.0001,
          );
          // N'en supprimer qu'un seul par ingrédient (une vente = un mouvement par ingrédient)
          return candidates.slice(0, 1).map((m) => m.id);
        });
      }

      await deleteVente.mutateAsync({ venteId: id, mouvementIds });
      setDeleteConfirm(null);
      toast.success(
        mouvementIds.length > 0
          ? `Vente supprimée · ${mouvementIds.length} sortie(s) de stock annulée(s)`
          : "Vente supprimée",
      );
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "jour",
      label: "Jour",
      icon: <CalendarCheck className="h-3.5 w-3.5" />,
    },
    {
      id: "semaine",
      label: "Semaine",
      icon: <CalendarDays className="h-3.5 w-3.5" />,
    },
    {
      id: "mois",
      label: "Mois",
      icon: <CalendarRange className="h-3.5 w-3.5" />,
    },
    {
      id: "annuel",
      label: "Annuel",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-6" data-ocid="operations.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold">Opérations</h2>
            <p className="text-sm text-muted-foreground">
              Tableau de bord des ventes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "jour" && (
            <>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
                data-ocid="operations.date_input"
              />
              {isToday && (
                <Badge
                  variant="outline"
                  className="text-primary border-primary/50"
                >
                  Aujourd'hui
                </Badge>
              )}
            </>
          )}
          <Button
            size="sm"
            onClick={() => setAddVenteOpen(true)}
            data-ocid="operations.add_vente_button"
          >
            <Plus className="h-4 w-4 mr-1" /> Vente
          </Button>
        </div>
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
            data-ocid={`operations.${tab.id}.tab`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─────────── TAB JOUR ─────────── */}
      {activeTab === "jour" && (
        <>
          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="CA HT"
                value={fmtEur(statsJour.caHT)}
                sub={`${statsJour.nbVentes} vente(s)`}
                icon={<Euro className="h-5 w-5 text-primary" />}
                iconBg="bg-primary/15"
                accent
              />
              <KpiCard
                label="CA TTC"
                value={fmtEur(statsJour.caTTC)}
                sub={fmtPct(txMargeJour)}
                icon={<TrendingUp className="h-5 w-5 text-green-400" />}
                iconBg="bg-green-400/10"
              />
              <KpiCard
                label="Ticket Moyen"
                value={fmtEur(ticketMoyenJour)}
                sub={`${statsJour.nbCouverts} couvert(s)`}
                icon={<Users className="h-5 w-5 text-blue-400" />}
                iconBg="bg-blue-400/10"
              />
              <KpiCard
                label="Coût matières"
                value={fmtEur(statsJour.cout)}
                sub={
                  statsJour.caHT > 0
                    ? fmtPct((statsJour.cout / statsJour.caHT) * 100)
                    : "—"
                }
                icon={<ShoppingCart className="h-5 w-5 text-amber-400" />}
                iconBg="bg-amber-400/10"
              />
            </div>
          )}

          {/* Services */}
          {ventesDuJour.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ServiceCard
                label="Déjeuner"
                icon={<CalendarCheck className="h-4 w-4 text-amber-400" />}
                ventes={ventesDejeuner}
                recetteMap={recetteMap}
                ingredientsMap={ingredientsMap}
              />
              <ServiceCard
                label="Dîner"
                icon={<CalendarDays className="h-4 w-4 text-blue-400" />}
                ventes={ventesDiner}
                recetteMap={recetteMap}
                ingredientsMap={ingredientsMap}
              />
            </div>
          )}

          {/* Point mort */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {progressVsPM >= 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  )}
                  <span className="text-sm font-medium">
                    Seuil de rentabilité journalier
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-primary">
                    {fmtEur(statsJour.caHT)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    / {fmtEur(pointMortJour)}
                  </span>
                </div>
              </div>
              <Progress value={progressVsPM} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1.5 text-right">
                {fmtPct(progressVsPM)} atteint
              </p>
            </CardContent>
          </Card>

          {/* Ventes + Top */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      Ventes du {selectedDate}
                    </CardTitle>
                    {ventesDuJour.length > 0 && (
                      <Badge variant="secondary">{ventesDuJour.length}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-4 space-y-2">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : ventesDuJour.length === 0 ? (
                    <div
                      className="flex flex-col items-center justify-center py-10 text-muted-foreground"
                      data-ocid="operations.jour.empty_state"
                    >
                      <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">
                        Aucune vente pour le {selectedDate}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setAddVenteOpen(true)}
                        data-ocid="operations.add_first_vente_button"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Enregistrer une vente
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Recette</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-right">Qté</TableHead>
                          <TableHead className="text-right">CA HT</TableHead>
                          <TableHead className="w-[52px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ventesDuJour.map((v: VenteRecette, i: number) => {
                          const r = recetteMap.get(v.recetteId);
                          if (!r) return null;
                          const ht =
                            prixHT(r.prixVenteTTC, r.tauxTVA) * v.quantite;
                          return (
                            <TableRow
                              key={v.id}
                              data-ocid={`operations.item.${i + 1}`}
                            >
                              <TableCell className="font-medium">
                                {r.nom}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {r.categorie}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {v.quantite}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {fmtEur(ht)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteConfirm(v.id)}
                                  data-ocid={`operations.delete_button.${i + 1}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <tfoot>
                        <TableRow className="bg-muted/40 border-t-2">
                          <TableCell colSpan={2} className="font-bold">
                            Total
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {statsJour.nbCouverts}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {fmtEur(statsJour.caHT)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </tfoot>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Top 3 Recettes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {parRecetteJour.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      —
                    </p>
                  ) : (
                    parRecetteJour.slice(0, 3).map((item, idx) => (
                      <div
                        key={item.recette.id}
                        className="flex items-center justify-between gap-2"
                        data-ocid={`operations.top-recette.item.${idx + 1}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="text-sm truncate">
                            {item.recette.nom}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">
                            {fmtEur(item.caHT)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ×{item.quantite}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Par Catégorie
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {parCategorieJour.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      —
                    </p>
                  ) : (
                    parCategorieJour.map(([cat, ca], idx) => {
                      const pct =
                        statsJour.caHT > 0 ? (ca / statsJour.caHT) * 100 : 0;
                      return (
                        <div
                          key={cat}
                          className="space-y-1"
                          data-ocid={`operations.categorie.item.${idx + 1}`}
                        >
                          <div className="flex justify-between text-sm">
                            <span className="truncate">{cat}</span>
                            <span className="font-semibold shrink-0">
                              {fmtEur(ca)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-right">
                            {fmtPct(pct)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ─────────── TAB SEMAINE ─────────── */}
      {activeTab === "semaine" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="CA HT Semaine"
              value={fmtEur(weekTotal.caHT)}
              sub={`${weekTotal.nbVentes} vente(s)`}
              icon={<Euro className="h-5 w-5 text-primary" />}
              iconBg="bg-primary/15"
              accent
              delta={deltaLabel(weekTotal.caHT, prevWeekTotal.caHT)}
              deltaUp={deltaPositive(weekTotal.caHT, prevWeekTotal.caHT)}
            />
            <KpiCard
              label="CA TTC Semaine"
              value={fmtEur(weekTotal.caTTC)}
              icon={<TrendingUp className="h-5 w-5 text-green-400" />}
              iconBg="bg-green-400/10"
            />
            <KpiCard
              label="Couverts"
              value={String(weekTotal.nbCouverts)}
              icon={<Users className="h-5 w-5 text-blue-400" />}
              iconBg="bg-blue-400/10"
            />
            <KpiCard
              label="Coût matières"
              value={fmtEur(weekTotal.cout)}
              icon={<ShoppingCart className="h-5 w-5 text-amber-400" />}
              iconBg="bg-amber-400/10"
            />
          </div>

          {/* Chart semaine */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                CA HT par jour — Semaine en cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={weekStats.map((d, i) => ({
                    name: DAYS_FR[i] ?? d.date.slice(8),
                    caHT: d.caHT,
                  }))}
                  margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtEur(v)}
                    labelStyle={{ color: "var(--foreground)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="caHT"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                  >
                    {weekStats.map((d, _i) => (
                      <Cell
                        key={d.date}
                        fill={
                          d.caHT === 0
                            ? "var(--muted)"
                            : `hsl(var(--primary) / ${0.5 + 0.5 * (d.caHT / (Math.max(...weekStats.map((x) => x.caHT)) || 1))})`
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tableau semaine */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Détail journalier — {weekStart.toLocaleDateString("fr-FR")} au{" "}
                {weekEnd.toLocaleDateString("fr-FR")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Jour</TableHead>
                    <TableHead className="text-right">CA HT</TableHead>
                    <TableHead className="text-right">CA TTC</TableHead>
                    <TableHead className="text-right">Nb ventes</TableHead>
                    <TableHead className="text-right">Coût mat.</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekStats.map((d, i) => {
                    const marge = d.caHT - d.cout;
                    const txMarge = d.caHT > 0 ? (marge / d.caHT) * 100 : 0;
                    return (
                      <TableRow
                        key={d.date}
                        data-ocid={`operations.semaine.item.${i + 1}`}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => {
                          setSelectedDate(d.date);
                          setActiveTab("jour");
                        }}
                      >
                        <TableCell className="font-medium">
                          {DAYS_FR[i]}{" "}
                          <span className="text-muted-foreground text-xs ml-1">
                            {d.date.slice(8)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {fmtEur(d.caHT)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(d.caTTC)}
                        </TableCell>
                        <TableCell className="text-right">
                          {d.nbVentes}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtEur(d.cout)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            txMarge >= 60
                              ? "text-green-400"
                              : txMarge >= 40
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {d.caHT > 0 ? fmtPct(txMarge) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/40 border-t-2 font-bold">
                    <TableCell>Total semaine</TableCell>
                    <TableCell className="text-right text-primary">
                      {fmtEur(weekTotal.caHT)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(weekTotal.caTTC)}
                    </TableCell>
                    <TableCell className="text-right">
                      {weekTotal.nbVentes}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtEur(weekTotal.cout)}
                    </TableCell>
                    <TableCell className="text-right">
                      {weekTotal.caHT > 0
                        ? fmtPct(
                            ((weekTotal.caHT - weekTotal.cout) /
                              weekTotal.caHT) *
                              100,
                          )
                        : "—"}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </CardContent>
          </Card>

          {/* Comparison semaine */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(
              [
                {
                  label: "CA HT S. courante",
                  value: fmtEur(weekTotal.caHT),
                  highlight: true,
                },
                {
                  label: "CA HT S. précédente",
                  value: fmtEur(prevWeekTotal.caHT),
                  highlight: false,
                },
                {
                  label: "Évolution",
                  value: deltaLabel(weekTotal.caHT, prevWeekTotal.caHT),
                  highlight: false,
                  delta: true,
                  up: deltaPositive(weekTotal.caHT, prevWeekTotal.caHT),
                },
              ] as const
            ).map((item) => (
              <Card
                key={item.label}
                className={
                  item.highlight ? "border-primary/40 bg-primary/5" : ""
                }
              >
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {item.label}
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      "delta" in item && item.delta
                        ? item.up
                          ? "text-green-400"
                          : "text-red-400"
                        : item.highlight
                          ? "text-primary"
                          : ""
                    }`}
                  >
                    {item.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ─────────── TAB MOIS ─────────── */}
      {activeTab === "mois" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="CA HT Mois"
              value={fmtEur(monthTotal.caHT)}
              sub={`${monthTotal.nbVentes} vente(s)`}
              icon={<Euro className="h-5 w-5 text-primary" />}
              iconBg="bg-primary/15"
              accent
              delta={deltaLabel(monthTotal.caHT, prevMonthTotal.caHT)}
              deltaUp={deltaPositive(monthTotal.caHT, prevMonthTotal.caHT)}
            />
            <KpiCard
              label="Meilleure journée"
              value={fmtEur(bestDayMonth?.caHT ?? 0)}
              sub={bestDayMonth?.date}
              icon={<TrendingUp className="h-5 w-5 text-green-400" />}
              iconBg="bg-green-400/10"
            />
            <KpiCard
              label="CA moyen / jour"
              value={fmtEur(
                daysInMonth > 0 ? monthTotal.caHT / daysInMonth : 0,
              )}
              icon={<BarChart3 className="h-5 w-5 text-blue-400" />}
              iconBg="bg-blue-400/10"
            />
            <KpiCard
              label="Couverts du mois"
              value={String(monthTotal.nbCouverts)}
              icon={<Users className="h-5 w-5 text-amber-400" />}
              iconBg="bg-amber-400/10"
            />
          </div>

          {/* Chart mois */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                CA HT par jour — {MONTHS_FR[curMonth]} {curYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={monthStats.map((d) => ({
                    name: d.date.slice(8),
                    caHT: d.caHT,
                  }))}
                  margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtEur(v)}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="caHT"
                    fill="var(--primary)"
                    opacity={0.85}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tableau par semaines */}
          {monthByWeek.map((week, _wIdx) => {
            const wTotal = week.days.reduce(
              (acc, d) => ({
                caHT: acc.caHT + d.caHT,
                caTTC: acc.caTTC + d.caTTC,
                nbVentes: acc.nbVentes + d.nbVentes,
                cout: acc.cout + d.cout,
                nbCouverts: acc.nbCouverts + d.nbCouverts,
              }),
              { caHT: 0, caTTC: 0, nbVentes: 0, cout: 0, nbCouverts: 0 },
            );
            return (
              <Card key={week.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {week.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">CA HT</TableHead>
                        <TableHead className="text-right">CA TTC</TableHead>
                        <TableHead className="text-right">Nb ventes</TableHead>
                        <TableHead className="text-right">Coût mat.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {week.days.map((d, i) => (
                        <TableRow
                          key={d.date}
                          data-ocid={`operations.mois.${week.label}.item.${i + 1}`}
                          className="cursor-pointer hover:bg-muted/30"
                          onClick={() => {
                            setSelectedDate(d.date);
                            setActiveTab("jour");
                          }}
                        >
                          <TableCell className="font-medium">
                            {d.date}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {fmtEur(d.caHT)}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmtEur(d.caTTC)}
                          </TableCell>
                          <TableCell className="text-right">
                            {d.nbVentes}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {fmtEur(d.cout)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <TableRow className="bg-muted/30 border-t font-semibold">
                        <TableCell>Sous-total</TableCell>
                        <TableCell className="text-right text-primary">
                          {fmtEur(wTotal.caHT)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(wTotal.caTTC)}
                        </TableCell>
                        <TableCell className="text-right">
                          {wTotal.nbVentes}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtEur(wTotal.cout)}
                        </TableCell>
                      </TableRow>
                    </tfoot>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}

      {/* ─────────── TAB ANNUEL ─────────── */}
      {activeTab === "annuel" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={`CA HT ${curYear}`}
              value={fmtEur(yearTotal.caHT)}
              sub={`${yearTotal.nbVentes} vente(s)`}
              icon={<Euro className="h-5 w-5 text-primary" />}
              iconBg="bg-primary/15"
              accent
              delta={deltaLabel(yearTotal.caHT, prevYearTotal.caHT)}
              deltaUp={deltaPositive(yearTotal.caHT, prevYearTotal.caHT)}
            />
            <KpiCard
              label="CA TTC Total"
              value={fmtEur(yearTotal.caTTC)}
              icon={<TrendingUp className="h-5 w-5 text-green-400" />}
              iconBg="bg-green-400/10"
            />
            <KpiCard
              label="Couverts"
              value={String(yearTotal.nbCouverts)}
              icon={<Users className="h-5 w-5 text-blue-400" />}
              iconBg="bg-blue-400/10"
            />
            <KpiCard
              label="CA moyen / mois"
              value={fmtEur(yearTotal.caHT / 12)}
              icon={<BarChart3 className="h-5 w-5 text-amber-400" />}
              iconBg="bg-amber-400/10"
            />
          </div>

          {/* Chart annuel */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  CA HT mensuel & progression cumulée — {curYear}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={yearCumulative.map((m) => ({
                    name: m.month,
                    caHT: m.caHT,
                    cumCA: m.cumCA,
                  }))}
                  margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      fmtEur(v),
                      name === "caHT" ? "CA HT mensuel" : "CA cumulé",
                    ]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="caHT"
                    fill="var(--primary)"
                    opacity={0.85}
                    radius={[4, 4, 0, 0]}
                    name="CA HT mensuel"
                  />
                  <Bar
                    dataKey="cumCA"
                    fill="var(--primary)"
                    opacity={0.25}
                    radius={[4, 4, 0, 0]}
                    name="CA cumulé"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tableau mensuel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                Récapitulatif mensuel {curYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Mois</TableHead>
                    <TableHead className="text-right">CA HT</TableHead>
                    <TableHead className="text-right">CA TTC</TableHead>
                    <TableHead className="text-right">Nb ventes</TableHead>
                    <TableHead className="text-right">Coût mat.</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                    <TableHead className="text-right">CA cumulé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearCumulative.map((m, i) => {
                    const marge = m.caHT - m.cout;
                    const txMarge = m.caHT > 0 ? (marge / m.caHT) * 100 : 0;
                    const isFuture = m.monthNum > curMonth;
                    return (
                      <TableRow
                        key={m.month}
                        className={isFuture ? "opacity-40" : ""}
                        data-ocid={`operations.annuel.item.${i + 1}`}
                      >
                        <TableCell className="font-medium">
                          {m.month}
                          {m.monthNum === curMonth && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs text-primary border-primary/50"
                            >
                              En cours
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {fmtEur(m.caHT)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(m.caTTC)}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.nbVentes}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtEur(m.cout)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            txMarge >= 60
                              ? "text-green-400"
                              : txMarge >= 40
                                ? "text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {m.caHT > 0 ? fmtPct(txMarge) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {fmtEur(m.cumCA)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/40 border-t-2 font-bold">
                    <TableCell>Total {curYear}</TableCell>
                    <TableCell className="text-right text-primary">
                      {fmtEur(yearTotal.caHT)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(yearTotal.caTTC)}
                    </TableCell>
                    <TableCell className="text-right">
                      {yearTotal.nbVentes}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtEur(yearTotal.cout)}
                    </TableCell>
                    <TableCell className="text-right">
                      {yearTotal.caHT > 0
                        ? fmtPct(
                            ((yearTotal.caHT - yearTotal.cout) /
                              yearTotal.caHT) *
                              100,
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtEur(yearTotal.caHT)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </CardContent>
          </Card>

          {/* Top catégories annuelles */}
          {yearTopCat.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Top catégories par CA HT — {curYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {yearTopCat.map(([cat, ca], idx) => {
                  const pct =
                    yearTotal.caHT > 0 ? (ca / yearTotal.caHT) * 100 : 0;
                  return (
                    <div
                      key={cat}
                      data-ocid={`operations.annuel.cat.item.${idx + 1}`}
                    >
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate">
                          {idx + 1}. {cat}
                        </span>
                        <span className="shrink-0 font-semibold ml-2">
                          {fmtEur(ca)} · {fmtPct(pct)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add vente dialog */}
      <AddVenteDialog
        open={addVenteOpen}
        onOpenChange={setAddVenteOpen}
        selectedDate={selectedDate}
        recettes={recettes}
        onAdd={handleAddVente}
        isPending={createVente.isPending}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent data-ocid="operations.delete_dialog">
          <DialogHeader>
            <DialogTitle>Supprimer cette vente ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              data-ocid="operations.delete.cancel_button"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteVente(deleteConfirm)}
              disabled={deleteVente.isPending}
              data-ocid="operations.delete.confirm_button"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
