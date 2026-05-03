import { useEffect, useMemo, useRef, useState } from "react";
import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import { Search, Printer, Sparkles, Package, Check, Minus, Plus } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { listProducts, generateBarcode } from "../lib/api";
import { toast } from "sonner";

const LABEL_SIZES = {
  small:  { w: 50,  h: 25, label: "Petit (50×25 mm)" },
  medium: { w: 70,  h: 37, label: "Moyen (70×37 mm)" },
  large:  { w: 100, h: 50, label: "Grand (100×50 mm)" },
};

export default function Labels() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({}); // { productId: copies }
  const [format, setFormat] = useState("barcode"); // barcode | qr
  const [size, setSize] = useState("medium");
  const [generating, setGenerating] = useState(null);
  const printAreaRef = useRef(null);

  const reload = () => listProducts().then(setProducts).catch(() => toast.error("Erreur"));
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q) ||
      (p.barcode || "").toLowerCase().includes(q)
    );
  }, [search, products]);

  const toggle = (id) => setSelected((s) => {
    const next = { ...s };
    if (next[id]) delete next[id];
    else next[id] = 1;
    return next;
  });

  const setCopies = (id, n) => setSelected((s) => ({ ...s, [id]: Math.max(1, n) }));

  const handleGenerate = async (product) => {
    setGenerating(product.id);
    try {
      const updated = await generateBarcode(product.id);
      toast.success(`Code-barres ${updated.barcode} généré`);
      setProducts((ps) => ps.map((p) => (p.id === product.id ? updated : p)));
    } catch {
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(null);
    }
  };

  const labelsToPrint = useMemo(() => {
    const out = [];
    Object.entries(selected).forEach(([pid, copies]) => {
      const p = products.find((x) => x.id === pid);
      if (!p || !p.barcode) return;
      for (let i = 0; i < copies; i++) out.push(p);
    });
    return out;
  }, [selected, products]);

  const handlePrint = () => {
    if (labelsToPrint.length === 0) {
      toast.error("Sélectionnez au moins un produit avec un code-barres");
      return;
    }
    window.print();
  };

  const selectedCount = Object.keys(selected).length;
  const totalLabels = labelsToPrint.length;
  const S = LABEL_SIZES[size];

  return (
    <div className="space-y-6" data-testid="labels-page">
      {/* Non-print UI */}
      <div className="no-print space-y-6">
        <Card className="p-5 bg-white border-stone-200">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold text-stone-900">Étiquettes à imprimer</h2>
              <p className="text-stone-500 text-sm mt-1 max-w-2xl">
                Sélectionnez les produits, choisissez le nombre d'étiquettes, puis imprimez. Pour les produits sans code-barres (ex: tube de composite seul), cliquez sur <strong>Générer</strong> pour créer un code-barres interne unique qui sera sauvegardé et scannable.
              </p>
            </div>
            <Button onClick={handlePrint} disabled={totalLabels === 0} size="lg" className="bg-emerald-700 hover:bg-emerald-800 gap-2" data-testid="print-labels-btn">
              <Printer className="w-4 h-4" /> Imprimer ({totalLabels})
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-stone-100">
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="mt-1.5" data-testid="format-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="barcode">Code-barres (CODE128)</SelectItem>
                  <SelectItem value="qr">QR Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Taille de l'étiquette</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger className="mt-1.5" data-testid="size-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LABEL_SIZES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sélection</Label>
              <div className="mt-1.5 h-10 px-3 flex items-center bg-stone-50 border border-stone-200 rounded-md text-sm">
                <span className="font-semibold">{selectedCount}</span>
                <span className="text-stone-500 ml-1">produit{selectedCount > 1 ? "s" : ""} · </span>
                <span className="font-semibold ml-1">{totalLabels}</span>
                <span className="text-stone-500 ml-1">étiquette{totalLabels > 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-stone-200">
          <div className="p-4 border-b border-stone-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Rechercher un produit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="labels-search"
              />
            </div>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-stone-100">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-stone-400 text-sm">Aucun produit</div>
            ) : filtered.map((p) => {
              const sel = selected[p.id] != null;
              const copies = selected[p.id] || 1;
              return (
                <div key={p.id} className={`p-4 flex items-center gap-4 flex-wrap transition-colors ${sel ? "bg-emerald-50/50" : "hover:bg-stone-50"}`} data-testid={`label-row-${p.id}`}>
                  <button
                    type="button"
                    onClick={() => p.barcode && toggle(p.id)}
                    disabled={!p.barcode}
                    className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${sel ? "bg-emerald-600 border-emerald-600" : "bg-white border-stone-300"} ${!p.barcode ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {sel && <Check className="w-4 h-4 text-white" />}
                  </button>

                  <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-stone-500" />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold text-stone-900">{p.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      {p.brand && <span className="font-medium">{p.brand}</span>}
                      {p.barcode ? (
                        <span className="font-mono">{p.barcode}</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Sans code-barres</span>
                      )}
                    </div>
                  </div>

                  {!p.barcode ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerate(p)}
                      disabled={generating === p.id}
                      className="gap-1.5"
                      data-testid={`generate-barcode-btn-${p.id}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {generating === p.id ? "..." : "Générer"}
                    </Button>
                  ) : sel ? (
                    <div className="flex items-center gap-1 bg-white rounded-lg border border-stone-200 px-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCopies(p.id, copies - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={copies}
                        onChange={(e) => setCopies(p.id, Number(e.target.value) || 1)}
                        className="h-8 w-14 text-center font-mono font-bold border-0 p-0"
                        data-testid={`copies-input-${p.id}`}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCopies(p.id, copies + 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 italic">Cliquez pour sélectionner</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Preview */}
        {totalLabels > 0 && (
          <Card className="p-5 bg-white border-stone-200">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500 mb-3">Aperçu</div>
            <LabelGrid labels={labelsToPrint.slice(0, 6)} format={format} size={S} />
            {totalLabels > 6 && (
              <div className="text-xs text-stone-500 mt-3 text-center">+ {totalLabels - 6} autres étiquettes à l'impression</div>
            )}
          </Card>
        )}
      </div>

      {/* Print area (visible only when printing) */}
      <div ref={printAreaRef} className="print-only">
        <LabelGrid labels={labelsToPrint} format={format} size={S} />
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 8mm; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}

function LabelGrid({ labels, format, size }) {
  return (
    <div
      className="flex flex-wrap gap-[3mm]"
      style={{ alignContent: "flex-start" }}
    >
      {labels.map((p, i) => (
        <PrintLabel key={`${p.id}-${i}`} product={p} format={format} size={size} />
      ))}
    </div>
  );
}

function PrintLabel({ product, format, size }) {
  return (
    <div
      className="border border-stone-300 rounded-sm p-[2mm] flex flex-col justify-between overflow-hidden bg-white"
      style={{ width: `${size.w}mm`, height: `${size.h}mm`, boxSizing: "border-box" }}
    >
      <div className="flex-shrink-0">
        <div className="font-bold text-[9pt] leading-tight line-clamp-2">{product.name}</div>
        {product.brand && <div className="text-[7pt] text-stone-600 leading-tight">{product.brand}</div>}
      </div>
      <div className="flex items-center justify-center flex-1 min-h-0">
        {format === "qr" ? (
          <QRCodeSVG
            value={product.barcode}
            size={Math.min(size.h * 2.8, size.w * 2)}
            level="M"
          />
        ) : (
          <Barcode
            value={product.barcode}
            format="CODE128"
            width={Math.max(1, size.w * 0.04)}
            height={Math.max(20, size.h * 1.2)}
            fontSize={Math.max(8, size.w * 0.18)}
            margin={0}
            displayValue={true}
          />
        )}
      </div>
    </div>
  );
}
