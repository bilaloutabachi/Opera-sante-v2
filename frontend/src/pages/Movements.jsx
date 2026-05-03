import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";
import { Card } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import ManualMovementDialog from "../components/ManualMovementDialog";
import { listMovements } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { toast } from "sonner";

export default function Movements() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultType, setDefaultType] = useState("out");

  const load = () => {
    setLoading(true);
    listMovements({ limit: 500 })
      .then(setItems)
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((m) =>
    !search ||
    m.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.reason || "").toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (type) => {
    setDefaultType(type);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="movements-page">
      {/* Toolbar */}
      <Card className="p-5 bg-white border-stone-200">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Rechercher un produit ou un motif..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 flex-1 min-w-[220px]"
            data-testid="movements-search"
          />
          <Button
            onClick={() => openDialog("out")}
            className="h-11 bg-rose-600 hover:bg-rose-700 gap-2"
            data-testid="add-out-btn"
          >
            <ArrowUpFromLine className="w-4 h-4" /> Sortie
          </Button>
          <Button
            onClick={() => openDialog("in")}
            className="h-11 bg-emerald-700 hover:bg-emerald-800 gap-2"
            data-testid="add-in-btn"
          >
            <ArrowDownToLine className="w-4 h-4" /> Entrée
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-stone-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-stone-50">
            <TableRow>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Produit</TableHead>
              <TableHead className="font-semibold">Quantité</TableHead>
              <TableHead className="font-semibold">Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-stone-400">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-stone-400">
                  <div>Aucun mouvement</div>
                  <div className="text-xs text-stone-500 mt-1">Utilisez les boutons ci-dessus pour enregistrer une entrée ou une sortie.</div>
                </TableCell>
              </TableRow>
            ) : filtered.map((m) => (
              <TableRow key={m.id} data-testid={`movement-row-${m.id}`}>
                <TableCell className="text-stone-600 text-sm">{formatDateTime(m.created_at)}</TableCell>
                <TableCell>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${m.type === "in" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {m.type === "in" ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                    {m.type === "in" ? "Entrée" : "Sortie"}
                  </div>
                </TableCell>
                <TableCell className="font-medium text-stone-900">{m.product_name}</TableCell>
                <TableCell className={`font-mono font-bold ${m.type === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                  {m.type === "in" ? "+" : "−"}{m.quantity}
                </TableCell>
                <TableCell className="text-stone-600">{m.reason || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ManualMovementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={defaultType}
        onSuccess={load}
      />
    </div>
  );
}
