import { useEffect, useRef, useState } from "react";
import { ScanLine, ArrowDownToLine, ArrowUpFromLine, Package, Check, X, Keyboard, Calendar } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { scanAction, getProductByBarcode } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import ManualMovementDialog from "../components/ManualMovementDialog";
import { toast } from "sonner";

const MODE_KEY = "mspf-scan-mode";
const QTY_PRESETS = [1, 2, 5, 10];

export default function Scanner() {
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || "out");
  const [quantity, setQuantity] = useState(1);
  const [barcode, setBarcode] = useState("");
  const [expiryDate, setExpiryDate] = useState(""); // péremption du lot pour entrées scannées
  const [history, setHistory] = useState([]);
  const [lastProduct, setLastProduct] = useState(null);
  const [flash, setFlash] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  // Persistent auto-focus
  useEffect(() => {
    inputRef.current?.focus();
    const t = setInterval(() => {
      const active = document.activeElement;
      if (inputRef.current && active && active.tagName !== "INPUT" && active.tagName !== "TEXTAREA") {
        inputRef.current.focus();
      }
    }, 600);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    try {
      const result = await scanAction({
        barcode: code,
        type: mode,
        quantity: Number(quantity) || 1,
        expiry_date: mode === "in" && expiryDate ? expiryDate : null,
      });
      setLastProduct(result.product);
      setHistory((h) => [{ ok: true, ...result, at: new Date().toISOString() }, ...h].slice(0, 30));
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
      toast.success(`${mode === "in" ? "Entrée" : "Sortie"} : ${result.product.name} (${result.product.quantity} restants)`);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Erreur de scan";
      let prod = null;
      try { prod = await getProductByBarcode(code); } catch { /* ignore */ }
      setHistory((h) => [{ ok: false, error: msg, barcode: code, product: prod, at: new Date().toISOString() }, ...h].slice(0, 30));
      toast.error(msg);
    } finally {
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const isIn = mode === "in";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" data-testid="scanner-page">
      {/* Scanner input area */}
      <Card className="lg:col-span-2 p-8 bg-white border-stone-200">
        {/* Big mode switch */}
        <div className="grid grid-cols-2 gap-3 mb-7" data-testid="scan-mode-toggle">
          <button
            type="button"
            onClick={() => setMode("out")}
            data-testid="mode-out"
            className={`py-5 px-6 rounded-2xl border-2 font-heading font-bold text-lg flex items-center justify-center gap-3 transition-all ${!isIn ? "bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20 scale-[1.02]" : "bg-white border-stone-200 text-stone-600 hover:border-rose-300"}`}
          >
            <ArrowUpFromLine className="w-5 h-5" /> Sortie de stock
          </button>
          <button
            type="button"
            onClick={() => setMode("in")}
            data-testid="mode-in"
            className={`py-5 px-6 rounded-2xl border-2 font-heading font-bold text-lg flex items-center justify-center gap-3 transition-all ${isIn ? "bg-emerald-700 border-emerald-700 text-white shadow-lg shadow-emerald-700/20 scale-[1.02]" : "bg-white border-stone-200 text-stone-600 hover:border-emerald-300"}`}
          >
            <ArrowDownToLine className="w-5 h-5" /> Entrée de stock
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-stone-500 mb-2">Code-barres</label>
            <Input
              ref={inputRef}
              id="scan-input"
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Flashez ou tapez..."
              data-testid="scan-input"
              className={`h-24 text-4xl text-center font-mono tracking-wider rounded-2xl border-2 border-stone-300 focus-visible:ring-4 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] ${flash ? "scan-flash" : ""}`}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-stone-500 mb-2">Quantité</label>
            <div className="flex gap-2 flex-wrap items-center">
              {QTY_PRESETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  data-testid={`qty-preset-${q}`}
                  className={`h-12 px-5 rounded-xl border-2 font-heading font-bold text-lg transition-all ${Number(quantity) === q ? "bg-stone-900 border-stone-900 text-white" : "bg-white border-stone-200 text-stone-700 hover:border-stone-400"}`}
                >
                  {q}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="scan-quantity-input"
                className="h-12 w-24 text-lg font-mono text-center"
              />
              <Button
                type="submit"
                size="lg"
                className={`h-12 px-7 ml-auto font-semibold ${isIn ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700"}`}
                data-testid="scan-submit-btn"
              >
                Valider
              </Button>
            </div>
          </div>

          {isIn && (
            <div data-testid="scan-expiry-block">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-stone-500 mb-2">
                Date de péremption du lot (optionnel)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    data-testid="scan-expiry-input"
                    className="h-12 pl-10 w-56 font-mono text-stone-700"
                  />
                </div>
                {expiryDate && (
                  <button
                    type="button"
                    onClick={() => setExpiryDate("")}
                    className="h-12 px-3 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 text-sm font-medium"
                    data-testid="scan-expiry-clear"
                  >
                    Effacer
                  </button>
                )}
                <p className="text-xs text-stone-500 ml-1">
                  Conservée entre les scans · Met à jour la péremption du produit uniquement si plus proche (FEFO).
                </p>
              </div>
            </div>
          )}
        </form>

        {lastProduct && (
          <Card className={`mt-6 p-5 border ${isIn ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`} data-testid="last-scanned">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${isIn ? "bg-emerald-700" : "bg-rose-600"} text-white flex items-center justify-center`}>
                <Package className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Dernier scan</div>
                <div className="font-heading font-bold text-lg text-stone-900 truncate">{lastProduct.name}</div>
                <div className="text-sm text-stone-600">
                  Stock actuel : <span className="font-mono font-bold">{lastProduct.quantity}</span>
                  {lastProduct.quantity <= lastProduct.min_threshold && <span className="ml-2 text-amber-700 font-semibold">· à commander</span>}
                </div>
              </div>
              <StatusBadge product={lastProduct} />
            </div>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-stone-400">
            Astuce : <kbd className="font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">I</kbd> inventaire · <kbd className="font-mono bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">C</kbd> commander
          </div>
          <Button type="button" variant="outline" onClick={() => setManualOpen(true)} className="gap-2" data-testid="open-manual-btn">
            <Keyboard className="w-4 h-4" /> Saisie manuelle (sans scan)
          </Button>
        </div>
      </Card>

      {/* History */}
      <Card className="p-6 bg-white border-stone-200" data-testid="scan-history">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Historique</div>
            <h3 className="font-heading text-lg font-bold text-stone-900 mt-1">Scans récents</h3>
          </div>
          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-xs text-stone-500 hover:text-stone-700" data-testid="clear-history-btn">Effacer</button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            <ScanLine className="w-10 h-10 mx-auto mb-2 text-stone-300" />
            Aucun scan pour l'instant
          </div>
        ) : (
          <div className="space-y-2 max-h-[620px] overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className={`p-3 rounded-lg border ${h.ok ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50 border-rose-200"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center ${h.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                    {h.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {h.ok ? (
                      <>
                        <div className="font-semibold text-stone-900 truncate">{h.product.name}</div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          <span className={h.movement.type === "in" ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>
                            {h.movement.type === "in" ? "+" : "−"}{h.movement.quantity}
                          </span>
                          {" · "}Stock : {h.product.quantity} · {formatDateTime(h.at)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold text-rose-900">{h.product?.name || "Produit inconnu"}</div>
                        <div className="text-xs text-rose-700 mt-0.5 font-mono">{h.barcode}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{h.error}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ManualMovementDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        defaultType={mode}
        onSuccess={() => { /* keep history local — nothing to refresh globally */ }}
      />
    </div>
  );
}
