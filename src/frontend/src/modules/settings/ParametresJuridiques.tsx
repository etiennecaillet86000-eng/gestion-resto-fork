import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useParametresJuridiques,
  useSaveParametresJuridiques,
} from "@/hooks/useQueries";
import type { ParametresJuridiques } from "@/hooks/useQueries";
import { Building2, Info, Save, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ── Static option lists ──────────────────────────────────────────────────────

const FORMES = [
  { value: "EI", label: "EI — Entreprise Individuelle" },
  {
    value: "EIRL",
    label: "EIRL — Entreprise Individuelle à Responsabilité Limitée",
  },
  {
    value: "EURL",
    label: "EURL — Entreprise Unipersonnelle à Responsabilité Limitée",
  },
  { value: "SARL", label: "SARL — Société à Responsabilité Limitée" },
  { value: "SAS", label: "SAS — Société par Actions Simplifiée" },
  {
    value: "SASU",
    label: "SASU — Société par Actions Simplifiée Unipersonnelle",
  },
  { value: "SA", label: "SA — Société Anonyme" },
];

const REGIMES_FISCAUX = [
  { value: "IR", label: "IR — Impôt sur le Revenu" },
  { value: "IS", label: "IS — Impôt sur les Sociétés" },
];

const REGIMES_SOCIAUX = [
  { value: "TNS", label: "TNS — Travailleur Non Salarié" },
  { value: "assimile", label: "Assimilé salarié" },
];

// ── Local-only fields (not in backend contract) ───────────────────────────────

interface InfosEtablissement {
  nomEtablissement: string;
  siret: string;
  adresse: string;
  capitalSocial: string;
}

const LS_KEY = "gestion_resto_infos_etablissement";

function loadInfosEtablissement(): InfosEtablissement {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as InfosEtablissement;
  } catch {
    // ignore
  }
  return { nomEtablissement: "", siret: "", adresse: "", capitalSocial: "" };
}

function saveInfosEtablissement(v: InfosEtablissement) {
  localStorage.setItem(LS_KEY, JSON.stringify(v));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function suggestRegimeSocial(forme: string): string {
  if (["SAS", "SASU", "SA"].includes(forme)) return "assimile";
  return "TNS";
}

function suggestRegimeFiscal(forme: string): string {
  if (["SAS", "SASU", "SA", "SARL"].includes(forme)) return "IS";
  return "IR";
}

const DEFAULT_JURIDIQUE: ParametresJuridiques = {
  formeJuridique: "EI",
  regimeFiscal: "IR",
  regimeSocial: "TNS",
};

// ── FormField helper ──────────────────────────────────────────────────────────

function FormField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {hint && (
          <span className="ml-2 text-xs text-muted-foreground">{hint}</span>
        )}
      </Label>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ParametresJuridiquesPage() {
  const { data, isLoading } = useParametresJuridiques();
  const saveMut = useSaveParametresJuridiques();

  const [form, setForm] = useState<ParametresJuridiques>(DEFAULT_JURIDIQUE);
  const [infos, setInfos] = useState<InfosEtablissement>(
    loadInfosEtablissement,
  );

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function handleFormeChange(forme: string) {
    setForm((f) => ({
      ...f,
      formeJuridique: forme,
      regimeSocial: suggestRegimeSocial(forme),
      regimeFiscal: suggestRegimeFiscal(forme),
    }));
  }

  function setInfoField<K extends keyof InfosEtablissement>(
    key: K,
    value: InfosEtablissement[K],
  ) {
    setInfos((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    try {
      await saveMut.mutateAsync(form);
      saveInfosEtablissement(infos);
      toast.success("Paramètres juridiques sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  const isBusy = saveMut.isPending || isLoading;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            Paramètres Juridiques
          </h2>
          <p className="text-sm text-muted-foreground">
            Structure légale, régimes fiscal et social du dirigeant.
          </p>
        </div>
      </div>

      {/* ── Section 1 : Informations de l'établissement ──────────────────── */}
      <Card data-ocid="juridiques.etablissement_card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              Informations de l&apos;établissement
            </CardTitle>
          </div>
          <CardDescription>
            Coordonnées légales et administratives de votre établissement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="nom-etablissement" label="Nom de l'établissement">
              <Input
                id="nom-etablissement"
                value={infos.nomEtablissement}
                onChange={(e) =>
                  setInfoField("nomEtablissement", e.target.value)
                }
                placeholder="Ex : Le Bistrot du Coin"
                data-ocid="juridiques.nom_input"
              />
            </FormField>

            <FormField id="siret" label="Numéro SIRET" hint="(14 chiffres)">
              <Input
                id="siret"
                value={infos.siret}
                onChange={(e) => setInfoField("siret", e.target.value)}
                placeholder="000 000 000 00000"
                maxLength={17}
                data-ocid="juridiques.siret_input"
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField id="adresse" label="Adresse complète">
                <Input
                  id="adresse"
                  value={infos.adresse}
                  onChange={(e) => setInfoField("adresse", e.target.value)}
                  placeholder="12 rue de la Paix, 75001 Paris"
                  data-ocid="juridiques.adresse_input"
                />
              </FormField>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2 : Structure juridique ──────────────────────────────── */}
      <Card data-ocid="juridiques.structure_card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Structure juridique</CardTitle>
          </div>
          <CardDescription>
            La forme juridique détermine automatiquement les régimes suggérés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField id="forme-juridique" label="Forme juridique">
                <Select
                  value={form.formeJuridique}
                  onValueChange={handleFormeChange}
                  disabled={isBusy}
                >
                  <SelectTrigger
                    id="forme-juridique"
                    data-ocid="juridiques.forme_select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField id="regime-fiscal" label="Régime fiscal">
              <Select
                value={form.regimeFiscal}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, regimeFiscal: v }))
                }
                disabled={isBusy}
              >
                <SelectTrigger
                  id="regime-fiscal"
                  data-ocid="juridiques.fiscal_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIMES_FISCAUX.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              id="regime-social"
              label="Régime social du dirigeant"
              hint="(suggéré, modifiable)"
            >
              <Select
                value={form.regimeSocial}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, regimeSocial: v }))
                }
                disabled={isBusy}
              >
                <SelectTrigger
                  id="regime-social"
                  data-ocid="juridiques.social_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIMES_SOCIAUX.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="capital-social" label="Capital social" hint="(€)">
              <Input
                id="capital-social"
                type="number"
                min="0"
                step="100"
                value={infos.capitalSocial}
                onChange={(e) => setInfoField("capitalSocial", e.target.value)}
                placeholder="1 000"
                data-ocid="juridiques.capital_input"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isBusy}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-6"
          data-ocid="juridiques.save_button"
        >
          <Save className="h-4 w-4" />
          {saveMut.isPending ? "Sauvegarde..." : "Sauvegarder les paramètres"}
        </Button>
      </div>

      {/* ── Info box : charges sociales ───────────────────────────────────── */}
      <Card className="border-blue-500/20 bg-blue-950/20">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-300">
                Impact sur les calculs de charges sociales
              </p>
              <div className="space-y-1 text-blue-400/90">
                <p>
                  <strong className="text-blue-300">
                    TNS (Travailleur Non Salarié)
                  </strong>{" "}
                  — EI, EIRL, EURL, Gérant majoritaire SARL : cotisations ≈ 45 %
                  de la rémunération nette. Coût total = net × 1,45.
                </p>
                <p>
                  <strong className="text-blue-300">Assimilé salarié</strong> —
                  Président SAS/SASU, DG SA, Gérant minoritaire SARL : charges
                  patronales ≈ 42 % + charges salariales ≈ 22 % sur le brut. Net
                  = brut × 78 %. Coût employeur = brut × 142 %.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Info box : IR vs IS ───────────────────────────────────────────── */}
      <Card className="border-amber-500/20 bg-amber-950/20">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-300">
                Régime fiscal — IR vs IS
              </p>
              <p className="text-amber-400/90">
                <strong className="text-amber-300">IR</strong> : les bénéfices
                sont imposés directement entre les mains de l&apos;exploitant
                (tranches marginales 0–45 %). Adapté aux petites structures ou
                au démarrage.
              </p>
              <p className="text-amber-400/90">
                <strong className="text-amber-300">IS</strong> :
                l&apos;entreprise est imposée à taux fixe (15 % jusqu&apos;à 42
                500 € de bénéfice, puis 25 %). La rémunération du dirigeant est
                déductible du résultat imposable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
