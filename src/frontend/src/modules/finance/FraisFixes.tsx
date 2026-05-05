import { Button } from "@/components/ui/button";
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
import {
  type LigneFraisFixes,
  useFraisFixes,
  useSaveFraisFixes,
} from "@/hooks/useQueries";
import { fmtEur } from "@/utils/format";
import { Save, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

export default function FraisFixes() {
  const { data: lignes = [], isLoading } = useFraisFixes();
  const saveMut = useSaveFraisFixes();

  // Local editable copy
  const [rows, setRows] = useState<LigneFraisFixes[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (lignes.length > 0) {
      setRows(lignes);
      setDirty(false);
    }
  }, [lignes]);

  function updateRow(
    idx: number,
    field: "montantMensuelHorsRemu" | "montantMensuelAvecRemu",
    raw: string,
  ) {
    const val = Number.parseFloat(raw) || 0;
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    );
    setDirty(true);
  }

  async function handleSave() {
    try {
      await saveMut.mutateAsync(rows);
      setDirty(false);
      toast.success("Frais fixes sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur : ${msg}`);
    }
  }

  const totalMensuelSansRemu = rows.reduce(
    (s, r) => s + r.montantMensuelHorsRemu,
    0,
  );
  const totalAnnuelSansRemu = totalMensuelSansRemu * 12;
  const totalMensuelAvecRemu = rows.reduce(
    (s, r) => s + r.montantMensuelAvecRemu,
    0,
  );
  const totalAnnuelAvecRemu = totalMensuelAvecRemu * 12;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Frais Fixes</h2>
          <p className="text-sm text-muted-foreground">
            Charges structurelles mensuelles et annuelles
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saveMut.isPending}
          data-ocid="frais-fixes.save_button"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMut.isPending ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {SKELETON_ROWS.map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-10 text-center text-muted-foreground"
          data-ocid="frais-fixes.empty_state"
        >
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucune catégorie de frais fixes configurée.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Détail des charges par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="min-w-[220px]">Catégorie</TableHead>
                    <TableHead className="text-right min-w-[180px]">
                      Mensuel (sans rémunération)
                    </TableHead>
                    <TableHead className="text-right min-w-[160px]">
                      Annuel (sans rémunération)
                    </TableHead>
                    <TableHead className="text-right min-w-[180px]">
                      Mensuel (avec rémunération)
                    </TableHead>
                    <TableHead className="text-right min-w-[160px]">
                      Annuel (avec rémunération)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={row.nom}
                      data-ocid={`frais-fixes.item.${idx + 1}`}
                    >
                      <TableCell className="font-medium">{row.nom}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 ml-auto text-right h-8 text-sm"
                          value={
                            row.montantMensuelHorsRemu === 0
                              ? ""
                              : row.montantMensuelHorsRemu
                          }
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "montantMensuelHorsRemu",
                              e.target.value,
                            )
                          }
                          data-ocid={`frais-fixes.input.${idx + 1}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmtEur(row.montantMensuelHorsRemu * 12)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 ml-auto text-right h-8 text-sm"
                          value={
                            row.montantMensuelAvecRemu === 0
                              ? ""
                              : row.montantMensuelAvecRemu
                          }
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "montantMensuelAvecRemu",
                              e.target.value,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmtEur(row.montantMensuelAvecRemu * 12)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/40 font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtEur(totalMensuelSansRemu)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtEur(totalAnnuelSansRemu)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtEur(totalMensuelAvecRemu)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {fmtEur(totalAnnuelAvecRemu)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
