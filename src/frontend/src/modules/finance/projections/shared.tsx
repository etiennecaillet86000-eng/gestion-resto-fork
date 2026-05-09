/**
 * projections/shared.tsx — shared sub-components & helpers
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtEur, fmtPct } from "@/utils/format";
import { TrendingDown, TrendingUp } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

export const MONTH_SHORT = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

export const MONTH_FULL = [
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
];

// RECIPE_CATEGORIES is re-exported from @/core/constants — import from there
export { RECIPE_CATEGORIES } from "@/core/constants";

export type PnLHorizon = "mensuel" | "annuel" | "5ans";

// ── Helpers ────────────────────────────────────────────────────────────────────

export function prixHTFromTTC(prixTTC: number, tauxTVA: number): number {
  return prixTTC / (1 + tauxTVA / 100);
}

export function deltaInfo(
  reel: number,
  previsionnel: number,
): { label: string; isPositive: boolean } {
  if (previsionnel === 0) return { label: "—", isPositive: true };
  const pct = ((reel - previsionnel) / Math.abs(previsionnel)) * 100;
  return {
    label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)} %`,
    isPositive: pct >= 0,
  };
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  positive?: boolean;
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  positive,
}: KpiCardProps) {
  return (
    <Card
      className={`relative overflow-hidden ${
        accent
          ? "border-primary/40 bg-primary/5"
          : positive === false
            ? "border-destructive/30 bg-destructive/5"
            : ""
      }`}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
              {label}
            </p>
            <p
              className={`text-2xl font-bold mt-1 ${
                accent
                  ? "text-primary"
                  : positive === false
                    ? "text-destructive"
                    : ""
              }`}
            >
              {value}
            </p>
            {sub && (
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
          <div
            className={`rounded-lg p-2 ${
              accent
                ? "bg-primary/15"
                : positive === false
                  ? "bg-destructive/15"
                  : "bg-muted"
            }`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function KpiSkeleton({ cols = 4 }: { cols?: number }) {
  const KEYS = ["sk-a", "sk-b", "sk-c", "sk-d"];
  return (
    <div className={`grid grid-cols-2 gap-4 sm:grid-cols-${cols}`}>
      {KEYS.slice(0, cols).map((k) => (
        <Skeleton key={k} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg text-sm">
      <p className="font-medium mb-1 text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtEur(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── P&L Table row structures ───────────────────────────────────────────────────

export interface PnLRow {
  label: string;
  valeur: number;
  pctCA?: number;
  isBold?: boolean;
  isTotal?: boolean;
  isSubtotal?: boolean;
  isIndented?: boolean;
  isPositive?: boolean;
  isNegative?: boolean;
  isSeparator?: boolean;
}

function rowColor(row: PnLRow, _ca: number) {
  if (row.isTotal) {
    if (row.valeur >= 0) return "text-green-400";
    return "text-destructive";
  }
  return "";
}

export function PnLTable({ rows, ca }: { rows: PnLRow[]; ca: number }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="min-w-[260px]">Compte de résultat</TableHead>
            <TableHead className="text-right min-w-[130px]">Montant</TableHead>
            <TableHead className="text-right min-w-[80px]">% CA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            if (row.isSeparator) {
              return (
                <TableRow key={`sep-${row.label}-${i}`} className="bg-muted/10">
                  <TableCell colSpan={3} className="py-1" />
                </TableRow>
              );
            }
            const color = rowColor(row, ca);
            return (
              <TableRow
                key={`${row.label}-${i}`}
                className={
                  row.isTotal
                    ? "bg-muted/30 border-t-2"
                    : row.isSubtotal
                      ? "bg-muted/10"
                      : ""
                }
              >
                <TableCell
                  className={`${row.isBold || row.isTotal ? "font-bold" : ""} ${
                    row.isIndented ? "pl-8 text-xs text-muted-foreground" : ""
                  }`}
                >
                  {row.label}
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    row.isBold || row.isTotal ? "font-bold" : ""
                  } ${color || (row.isPositive ? "text-green-400" : row.isNegative ? "text-destructive" : "")}`}
                >
                  {fmtEur(row.valeur)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {ca > 0 && row.pctCA !== undefined
                    ? fmtPct(row.pctCA)
                    : ca > 0
                      ? fmtPct((row.valeur / ca) * 100)
                      : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Delta badge ────────────────────────────────────────────────────────────────

export function DeltaBadge({
  reel,
  previsionnel,
}: { reel: number; previsionnel: number }) {
  const delta = deltaInfo(reel, previsionnel);
  return (
    <Badge
      variant="outline"
      className={`text-xs font-semibold border-0 ${
        delta.isPositive
          ? "bg-green-500/15 text-green-400"
          : "bg-destructive/15 text-destructive"
      }`}
    >
      {delta.isPositive ? (
        <TrendingUp className="h-3 w-3 mr-1 inline" />
      ) : (
        <TrendingDown className="h-3 w-3 mr-1 inline" />
      )}
      {delta.label}
    </Badge>
  );
}
