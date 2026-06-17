import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Edit, Trash2, ArrowDownToLine, ArrowUpFromLine, Download, Upload, ShoppingCart, Sparkles } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  listProducts,
  listCategories,
  listSuppliers,
  createProduct,
  updateProduct,
  deleteProduct,
  createMovement,
  generateBarcode,
} from "../lib/api";
import { formatDate, formatEuro, productStatus } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import ProductDialog from "../components/ProductDialog";
import ImportCSVDialog from "../components/ImportCSVDialog";
import { toast } from "sonner";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [movementTarget, setMovementTarget] = useState(null);
  const [movementType, setMovementType] = useState("in");
  const [movementQty, setMovementQty] = useState(1);
  const [movementReason, setMovementReason] = useState("");
  const [movementExpiry, setMovementExpiry] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [p, c, s] = await Promise.all([listProducts({ with_usage: true }), listCategories(), listSuppliers()]);
      setProducts(p); setCategories(c); setSuppliers(s);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const supMap = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.barcode || "").includes(search)) return false;
      if (catFilter !== "all" && p.category_id !== catFilter) return false;
      if (statusFilter !== "all" && productStatus(p).key !== statusFilter) return false;
      return true;
    });
  }, [products, search, catFilter, statusFilter]);

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produit mis à jour");
      } else {
        await createProduct(payload);
        toast.success("Produit créé");
      }
      setDialogOpen(false);
      setEditing(null);
      reload();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      toast.success("Produit supprimé");
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleMovement = async () => {
    if (!movementTarget) return;
    try {
      await createMovement({
        product_id: movementTarget.id,
        type: movementType,
        quantity: Number(movementQty) || 1,
        reason: movementReason || (movementType === "in" ? "Ajustement entrée" : "Ajustement sortie"),
        expiry_date: movementType === "in" && movementExpiry ? movementExpiry : null,
      });
      toast.success("Mouvement enregistré");
      setMovementTarget(null);
      setMovementQty(1);
      setMovementReason("");
      setMovementExpiry("");
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur");
    }
  };

  const handleGenerateBarcode = async (product) => {
    try {
      const updated = await generateBarcode(product.id);
      toast.success(`Code-barres ${updated.barcode} généré`);
      setProducts((ps) => ps.map((p) => (p.id === product.id ? { ...p, barcode: updated.barcode } : p)));
    } catch {
      toast.error("Erreur lors de la génération");
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.info("Aucun produit à exporter");
      return;
    }
    const rows = [
      ["Nom", "Marque", "Code-barres", "Catégorie", "Fournisseur", "Quantité", "Seuil", "Prix unitaire", "Péremption"],
      ...filtered.map((p) => [
        p.name,
        p.brand || "",
        p.barcode || "",
        catMap[p.category_id]?.name || "",
        supMap[p.supplier_id]?.name || "",
        p.quantity,
        p.min_threshold,
        p.unit_price,
        p.expiry_date || "",
      ]),
    ];
    // Semicolon separator = friendlier for French Excel; UTF-8 BOM so accents display correctly
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const filename = `inventaire_${new Date().toISOString().slice(0, 10)}.csv`;

    // Method 1: modern browsers — Blob + createObjectURL + download attr
    try {
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, filename);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        // Dispatch a real MouseEvent (more reliable in iframes than .click())
        a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
      toast.success(`${filtered.length} produit${filtered.length > 1 ? "s" : ""} exporté${filtered.length > 1 ? "s" : ""}`);
    } catch (err) {
      // Fallback: open in a new tab as data URI so user can copy/save
      const dataUri = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
      const win = window.open(dataUri, "_blank");
      if (win) {
        toast.success("Export ouvert dans un nouvel onglet — enregistrez-le avec Ctrl+S");
      } else {
        toast.error("Téléchargement bloqué. Autorisez les pop-ups puis réessayez.");
      }
    }
  };

  return (
    <div className="space-y-6" data-testid="inventory-page">
      {/* Toolbar */}
      <Card className="p-5 bg-white border-stone-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Rechercher par nom ou code-barres..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11"
              data-testid="inventory-search"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[200px] h-11" data-testid="category-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-11" data-testid="status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ok">En stock</SelectItem>
              <SelectItem value="out">Stock épuisé</SelectItem>
              <SelectItem value="low">Stock faible</SelectItem>
              <SelectItem value="expiring">Expire bientôt</SelectItem>
              <SelectItem value="expired">Périmé</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="h-11" data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="h-11" data-testid="import-csv-btn">
            <Upload className="w-4 h-4 mr-2" /> Importer CSV
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="h-11 bg-emerald-700 hover:bg-emerald-800" data-testid="add-product-btn">
            <Plus className="w-4 h-4 mr-2" /> Nouveau produit
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-stone-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-stone-50">
            <TableRow>
              <TableHead className="font-semibold text-stone-700 w-1">&nbsp;</TableHead>
              <TableHead className="font-semibold text-stone-700">Produit</TableHead>
              <TableHead className="font-semibold text-stone-700">Marque</TableHead>
              <TableHead className="font-semibold text-stone-700">Catégorie</TableHead>
              <TableHead className="font-semibold text-stone-700">Stock</TableHead>
              <TableHead className="font-semibold text-stone-700">Prix unitaire</TableHead>
              <TableHead className="font-semibold text-stone-700">Conso. / mois</TableHead>
              <TableHead className="font-semibold text-stone-700">Péremption</TableHead>
              <TableHead className="font-semibold text-stone-700">Code-barres</TableHead>
              <TableHead className="font-semibold text-stone-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-12 text-stone-400">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-12 text-stone-400">Aucun produit</TableCell></TableRow>
            ) : filtered.map((p) => {
              const status = productStatus(p);
              const rowClass = status.key === "out"
                ? "row-out-of-stock"
                : status.key === "expired"
                  ? "row-expired"
                  : status.key === "low"
                    ? "row-low-stock"
                    : "";
              const stripe = status.tone === "critical"
                ? "bg-red-900"
                : status.tone === "danger"
                  ? "bg-rose-500"
                  : status.tone === "warning"
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <TableRow key={p.id} className={rowClass} data-testid={`product-row-${p.id}`}>
                  <TableCell className="p-0 w-1"><div className={`w-1 h-16 ${stripe}`} /></TableCell>
                  <TableCell>
                    <div className="font-semibold text-stone-900">{p.name}</div>
                    <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                      <StatusBadge product={p} />
                    </div>
                  </TableCell>
                  <TableCell className="text-stone-700 text-sm">
                    {p.brand ? <span className="font-medium">{p.brand}</span> : <span className="text-stone-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {catMap[p.category_id] ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full border" style={{ backgroundColor: catMap[p.category_id].color + "15", color: catMap[p.category_id].color, borderColor: catMap[p.category_id].color + "40" }}>
                        {catMap[p.category_id].name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-heading font-bold text-xl text-stone-900 leading-none">{p.quantity}</div>
                    <div className="text-[11px] text-stone-500 mt-1">min {p.min_threshold}</div>
                  </TableCell>
                  <TableCell data-testid={`product-price-${p.id}`}>
                    {p.unit_price && p.unit_price > 0 ? (
                      <span className="font-mono font-semibold text-stone-900">{formatEuro(p.unit_price)}</span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-stone-700">
                    {p.avg_monthly_usage ? <span className="font-mono font-semibold">{p.avg_monthly_usage}</span> : <span className="text-stone-300">—</span>}
                  </TableCell>
                  <TableCell className="text-stone-700 text-sm">{formatDate(p.expiry_date)}</TableCell>
                  <TableCell className="font-mono text-sm text-stone-600">
                    {p.barcode ? (
                      p.barcode
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateBarcode(p)}
                        className="h-7 gap-1.5 text-xs"
                        data-testid={`generate-barcode-inline-${p.id}`}
                      >
                        <Sparkles className="w-3 h-3" /> Générer
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.product_url ? (
                        <a href={p.product_url} target="_blank" rel="noopener noreferrer" title="Commander sur le site fournisseur" data-testid={`cart-link-${p.id}`}>
                          <Button size="icon" variant="ghost">
                            <ShoppingCart className="w-4 h-4 text-emerald-700" />
                          </Button>
                        </a>
                      ) : (
                        <Button size="icon" variant="ghost" disabled className="opacity-30" title="Aucun lien fournisseur renseigné">
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { setMovementTarget(p); setMovementType("in"); }} title="Entrée" data-testid={`in-btn-${p.id}`}>
                        <ArrowDownToLine className="w-4 h-4 text-emerald-700" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setMovementTarget(p); setMovementType("out"); }} title="Sortie" data-testid={`out-btn-${p.id}`}>
                        <ArrowUpFromLine className="w-4 h-4 text-rose-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }} title="Modifier" data-testid={`edit-btn-${p.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(p)} title="Supprimer" data-testid={`delete-btn-${p.id}`}>
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="text-sm text-stone-500">{filtered.length} produit(s) affiché(s)</div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        product={editing}
        categories={categories}
        suppliers={suppliers}
        onSubmit={handleSubmit}
      />

      <ImportCSVDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={reload}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} sera supprimé définitivement. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700" data-testid="confirm-delete-btn">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!movementTarget} onOpenChange={(o) => !o && setMovementTarget(null)}>
        <DialogContent
          data-testid="movement-dialog"
          className="w-[calc(100vw-2rem)] sm:!w-[600px] sm:!max-w-[600px] sm:min-w-[480px]"
        >
          <DialogHeader>
            <DialogTitle className="font-heading">
              {movementType === "in" ? "Entrée de stock" : "Sortie de stock"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 w-full overflow-hidden">
            <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 w-full max-w-full overflow-hidden">
              <div className="font-semibold text-stone-900 leading-snug line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word]" title={movementTarget?.name}>
                {movementTarget?.name}
              </div>
              <div className="text-sm text-stone-500 mt-1">
                Stock actuel : <span className="font-mono font-bold">{movementTarget?.quantity}</span>
              </div>
            </div>
            <div>
              <Label>Quantité</Label>
              <Input type="number" min={1} value={movementQty} onChange={(e) => setMovementQty(e.target.value)} className="mt-1.5" data-testid="movement-qty" />
            </div>
            <div>
              <Label>Motif</Label>
              <Input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder={movementType === "in" ? "Réception, ajustement..." : "Utilisation, perte, péremption..."} className="mt-1.5" data-testid="movement-reason" />
            </div>
            {movementType === "in" && (
              <div>
                <Label>Date de péremption du lot (optionnel)</Label>
                <Input
                  type="date"
                  value={movementExpiry}
                  onChange={(e) => setMovementExpiry(e.target.value)}
                  className="mt-1.5"
                  data-testid="movement-expiry"
                />
                <p className="text-xs text-stone-500 mt-1">
                  Mettra à jour la péremption du produit uniquement si plus proche (FEFO).
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementTarget(null)}>Annuler</Button>
            <Button onClick={handleMovement} className={movementType === "in" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-rose-600 hover:bg-rose-700"} data-testid="confirm-movement-btn">
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
