import { useEffect, useMemo, useState } from "react";
import { Search, Package, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { listProducts, createMovement } from "../lib/api";
import { toast } from "sonner";

export default function ManualMovementDialog({ open, onOpenChange, defaultType = "out", onSuccess }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [type, setType] = useState(defaultType);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      listProducts().then(setProducts).catch(() => toast.error("Erreur de chargement"));
      setSearch(""); setSelected(null); setQuantity(1); setReason(""); setExpiryDate(""); setType(defaultType);
    }
  }, [open, defaultType]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q)
    ).slice(0, 50);
  }, [search, products]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) { toast.error("Choisissez un produit"); return; }
    setSubmitting(true);
    try {
      await createMovement({
        product_id: selected.id,
        type,
        quantity: Number(quantity) || 1,
        reason: reason || (type === "in" ? "Entrée manuelle" : "Sortie manuelle"),
        expiry_date: type === "in" && expiryDate ? expiryDate : null,
      });
      toast.success(`${type === "in" ? "Entrée" : "Sortie"} enregistrée : ${selected.name}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:w-[640px] max-w-[640px] max-h-[90vh] overflow-y-auto"
        data-testid="manual-movement-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Mouvement manuel</DialogTitle>
          <DialogDescription>Sans scan : cherchez le produit et enregistrez une entrée ou une sortie.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2">
          {/* Mode */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType("out")}
              className={`py-3 px-4 rounded-xl border-2 font-heading font-bold flex items-center justify-center gap-2 transition-all ${type === "out" ? "bg-rose-600 border-rose-600 text-white" : "bg-white border-stone-200 text-stone-600 hover:border-rose-300"}`}
              data-testid="manual-mode-out"
            >
              <ArrowUpFromLine className="w-4 h-4" /> Sortie
            </button>
            <button
              type="button"
              onClick={() => setType("in")}
              className={`py-3 px-4 rounded-xl border-2 font-heading font-bold flex items-center justify-center gap-2 transition-all ${type === "in" ? "bg-emerald-700 border-emerald-700 text-white" : "bg-white border-stone-200 text-stone-600 hover:border-emerald-300"}`}
              data-testid="manual-mode-in"
            >
              <ArrowDownToLine className="w-4 h-4" /> Entrée
            </button>
          </div>

          {/* Product picker */}
          {!selected ? (
            <>
              <div>
                <Label>Rechercher un produit</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nom ou code-barres..."
                    className="pl-10"
                    data-testid="manual-search-input"
                  />
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                {filtered.length === 0 ? (
                  <div className="text-center py-8 text-stone-400 text-sm">Aucun produit trouvé</div>
                ) : filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-stone-50 transition-colors"
                    data-testid={`manual-product-${p.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-900 truncate">{p.name}</div>
                      <div className="text-xs text-stone-500 font-mono">{p.barcode || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-heading font-bold text-stone-900">{p.quantity}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div
                    className="font-semibold text-stone-900 break-words line-clamp-2 leading-snug"
                    title={selected.name}
                  >
                    {selected.name}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Stock : <span className="font-mono font-bold">{selected.quantity}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(null)}
                  data-testid="manual-change-product-btn"
                  className="shrink-0"
                >
                  Changer
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantité</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    autoFocus
                    className="mt-1.5 h-12 text-lg font-mono text-center"
                    data-testid="manual-qty-input"
                  />
                </div>
                <div>
                  <Label>Motif (optionnel)</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={type === "in" ? "Réception, ajustement..." : "Utilisation, perte, péremption..."}
                    className="mt-1.5 h-12"
                    data-testid="manual-reason-input"
                  />
                </div>
              </div>

              {type === "in" && (
                <div>
                  <Label>Date de péremption du lot (optionnel)</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1.5 h-12"
                    data-testid="manual-expiry-input"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Si renseignée et plus proche que l&apos;actuelle, elle remplacera la date de péremption du produit (FEFO).
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button
              type="submit"
              disabled={!selected || submitting}
              className={type === "in" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700"}
              data-testid="manual-submit-btn"
            >
              {submitting ? "Enregistrement…" : "Valider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
