import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  caSaison,
  caHebdo as calcCaHebdo,
  seuilRentabilite,
} from "@/core/utils/calculations";
import {
  useFraisFixes,
  useMixProduitParCategorie,
  useParametres,
  useSaveParametres,
} from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import {
  BadgeDollarSign,
  BarChart3,
  Save,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ParamForm {
  ticketStr: string;
  clientsStr: string;
  semainesStr: string;
}

function kpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}

function KpiCard({ label, value, sub, icon, accent }: KpiProps) {
  return (
    <Card
      className={`relative overflow-hidden ${
        accent ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
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
            className={`rounded-lg p-2 ${
              accent ? "bg-primary/15" : "bg-muted"
            }`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Rentabilite() {
  const { data: params, isLoading: loadingParams } = useParametres();
  const { data: fraisFixes = [], isLoading: loadingFrais } = useFraisFixes();
  const { data: mix = [] } = useMixProduitParCategorie();
  const saveMut = useSaveParametres();

  const [form, setForm] = useState<ParamForm>({
    ticketStr: "",
    clientsStr: "",
    semainesStr: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (params) {
      setForm({
        ticketStr:
          params.ticketMoyenHT === 0 ? "" : String(params.ticketMoyenHT),
        clientsStr:
          params.nbClientsParSemaine === 0
            ? ""
            : String(params.nbClientsParSemaine),
        semainesStr:
          params.nbSemainesSaison === 0 ? "" : String(params.nbSemainesSaison),
      });
      setDirty(false);
    }
  }, [params]);

  function set(k: keyof ParamForm) {
    return (ev: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [k]: ev.target.value }));
      setDirty(true);
    };
  }

  async function handleSave() {
    if (!params) return;
    try {
      await saveMut.mutateAsync({
        ...params,
        ticketMoyenHT: Number.parseFloat(form.ticketStr) || 0,
        nbClientsParSemaine: Number.parseInt(form.clientsStr) || 0,
        nbSemainesSaison: Number.parseInt(form.semainesStr) || 0,
      });
      setDirty(false);
      toast.success("Paramètres sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  // ── KPI calculations ─────────────────────────────────────────────────────────
  const ticket = Number.parseFloat(form.ticketStr) || 0;
  const clientsParSemaine = Number.parseInt(form.clientsStr) || 0;
  const nbSemaines = Number.parseInt(form.semainesStr) || 0;

  // Derive a mix-weighted food cost rate (or default 30%)
  const tauxFoodCost =
    mix.length > 0
      ? mix.reduce((sum, [, taux]) => sum + taux, 0) / mix.length / 100
      : 0.3;

  const hebdo = calcCaHebdo(ticket, clientsParSemaine, 1); // 1 opening day as multiplier
  const caPrevi = caSaison(hebdo, nbSemaines);
  const coutMatiere = caPrevi * tauxFoodCost;
  const margeVal = caPrevi - coutMatiere;
  const tauxMarge = caPrevi > 0 ? (margeVal / caPrevi) * 100 : 0;

  const chargesFixesTotales =
    fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0) * 12;
  const seuil = seuilRentabilite(chargesFixesTotales, tauxMarge);

  const isLoading = loadingParams || loadingFrais;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Rentabilité</h2>
          <p className="text-sm text-muted-foreground">
            Simulation du chiffre d'affaires prévisionnel et du seuil de
            rentabilité
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saveMut.isPending}
          data-ocid="rentabilite.save_button"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMut.isPending ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>

      {/* Parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Paramètres de simulation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Ticket moyen HT (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="25"
                  value={form.ticketStr}
                  onChange={set("ticketStr")}
                  data-ocid="rentabilite.ticket_input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Clients par semaine</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="150"
                  value={form.clientsStr}
                  onChange={set("clientsStr")}
                  data-ocid="rentabilite.clients_input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Semaines d'ouverture / saison</Label>
                <Input
                  type="number"
                  min="1"
                  max="52"
                  placeholder="40"
                  value={form.semainesStr}
                  onChange={set("semainesStr")}
                  data-ocid="rentabilite.semaines_input"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      {isLoading ? (
        kpiSkeleton()
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="CA Prévisionnel"
            value={fmtEur(caPrevi)}
            sub={`${nbSemaines} semaines`}
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
            accent
          />
          <KpiCard
            label="Coût Matière"
            value={fmtEur(coutMatiere)}
            sub={fmtPct(tauxFoodCost * 100)}
            icon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />}
          />
          <KpiCard
            label="Marge Brute"
            value={fmtEur(margeVal)}
            sub={fmtPct(tauxMarge)}
            icon={<BadgeDollarSign className="h-5 w-5 text-muted-foreground" />}
          />
          <KpiCard
            label="Seuil de Rentabilité"
            value={fmtEur(seuil)}
            sub={`Charges fixes : ${fmtEur(chargesFixesTotales)}`}
            icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
          />
        </div>
      )}

      {/* Context note */}
      {!isLoading && mix.length === 0 && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-4 py-2">
          💡 Taux food cost par défaut (30 %). Configurez le mix produit dans la
          section Simulateur pour un calcul précis.
        </p>
      )}
    </div>
  );
}
