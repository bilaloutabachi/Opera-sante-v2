import { useEffect, useRef, useState } from "react";
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
import { Textarea } from "./ui/textarea";
import { ScanLine } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const EMPTY = {
  name: "",
  brand: "",
  barcode: "",
  category_id: "",
  supplier_id: "",
  quantity: 0,
  min_threshold: 5,
  unit_price: 0,
  expiry_date: "",
  description: "",
  product_url: "",
};

export default function ProductDialog({ open, onOpenChange, product, categories, suppliers, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [scanMode, setScanMode] = useState(false);
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        brand: product.brand || "",
        barcode: product.barcode || "",
        category_id: product.category_id || "",
        supplier_id: product.supplier_id || "",
        quantity: product.quantity ?? 0,
        min_threshold: product.min_threshold ?? 5,
        unit_price: product.unit_price ?? 0,
        expiry_date: product.expiry_date || "",
        description: product.description || "",
        product_url: product.product_url || "",
      });
    } else {
      setForm(EMPTY);
    }
    setScanMode(false);
  }, [product, open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 0,
      min_threshold: Number(form.min_threshold) || 0,
      unit_price: Number(form.unit_price) || 0,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      expiry_date: form.expiry_date || null,
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="product-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            {product ? "Modifier le produit" : "Nouveau produit"}
          </DialogTitle>
          <DialogDescription>
            {product ? "Mettez à jour les informations du produit." : "Ajoutez un nouveau produit à votre inventaire."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-2">
          <div className="col-span-2">
            <Label htmlFor="name">Nom du produit *</Label>
            <Input
              id="name"
              data-testid="product-name-input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="brand">Marque</Label>
            <Input
              id="brand"
              data-testid="product-brand-input"
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              className="mt-1.5"
              placeholder="3M, Kerr, Ivoclar, Dentsply..."
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="barcode">Code-barres</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="barcode"
                ref={barcodeRef}
                data-testid="product-barcode-input"
                value={form.barcode}
                onChange={(e) => update("barcode", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setScanMode(false);
                    barcodeRef.current?.blur();
                  }
                }}
                onBlur={() => setScanMode(false)}
                className={`font-mono ${scanMode ? "border-emerald-500 ring-4 ring-emerald-500/20 bg-emerald-50" : ""}`}
                placeholder={scanMode ? "Scannez maintenant..." : "3401597... ou scannez"}
              />
              <Button
                type="button"
                variant={scanMode ? "default" : "outline"}
                className={scanMode ? "bg-emerald-700 hover:bg-emerald-800 gap-2" : "gap-2"}
                onClick={() => {
                  setScanMode(true);
                  barcodeRef.current?.focus();
                }}
                data-testid="scan-barcode-btn"
                title="Cliquez puis scannez avec votre scannette"
              >
                <ScanLine className="w-4 h-4" />
                {scanMode ? "Prêt" : "Scanner"}
              </Button>
            </div>
            {scanMode && (
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">Flashez le code-barres avec votre scannette — il s'inscrit automatiquement.</p>
            )}
          </div>

          <div>
            <Label>Catégorie</Label>
            <Select value={form.category_id || "none"} onValueChange={(v) => update("category_id", v === "none" ? "" : v)}>
              <SelectTrigger className="mt-1.5" data-testid="product-category-select"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fournisseur</Label>
            <Select value={form.supplier_id || "none"} onValueChange={(v) => update("supplier_id", v === "none" ? "" : v)}>
              <SelectTrigger className="mt-1.5" data-testid="product-supplier-select"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantité</Label>
            <Input id="quantity" data-testid="product-quantity-input" type="number" min={0} value={form.quantity} onChange={(e) => update("quantity", e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="threshold">Seuil d'alerte</Label>
            <Input id="threshold" data-testid="product-threshold-input" type="number" min={0} value={form.min_threshold} onChange={(e) => update("min_threshold", e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="price">Prix unitaire (€)</Label>
            <Input id="price" type="number" min={0} step="0.01" value={form.unit_price} onChange={(e) => update("unit_price", e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="expiry">Date de péremption</Label>
            <Input id="expiry" type="date" value={form.expiry_date || ""} onChange={(e) => update("expiry_date", e.target.value)} className="mt-1.5" />
          </div>

          <div className="col-span-2">
            <Label htmlFor="url">Lien du produit (site fournisseur)</Label>
            <Input
              id="url"
              type="url"
              value={form.product_url}
              onChange={(e) => update("product_url", e.target.value)}
              className="mt-1.5"
              placeholder="https://www.henry-schein.fr/..."
              data-testid="product-url-input"
            />
            <p className="text-[11px] text-stone-500 mt-1">Collez ici le lien direct du produit sur le site de votre fournisseur. Il apparaîtra dans la page "À commander".</p>
          </div>

          <div className="col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={form.description} onChange={(e) => update("description", e.target.value)} className="mt-1.5" rows={2} />
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="cancel-product-btn">
              Annuler
            </Button>
            <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800" data-testid="save-product-btn">
              {product ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
