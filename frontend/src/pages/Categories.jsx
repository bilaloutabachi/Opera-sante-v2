import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Sparkles } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
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
import { listCategories, createCategory, updateCategory, deleteCategory, seedDentalCategories } from "../lib/api";
import { toast } from "sonner";

const COLORS = ["#059669", "#0891b2", "#7c3aed", "#d97706", "#be123c", "#0284c7", "#16a34a", "#db2777"];

export default function Categories() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", color: COLORS[0] });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => listCategories().then(setItems).catch(() => toast.error("Erreur"));
  useEffect(() => { reload(); }, []);

  const startEdit = (c) => { setEditing(c); setForm({ name: c.name, color: c.color || COLORS[0] }); setOpen(true); };
  const startCreate = () => { setEditing(null); setForm({ name: "", color: COLORS[0] }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await updateCategory(editing.id, form); toast.success("Mis à jour"); }
      else { await createCategory(form); toast.success("Créé"); }
      setOpen(false); reload();
    } catch { toast.error("Erreur"); }
  };

  const confirmDelete = async () => {
    try { await deleteCategory(deleteTarget.id); toast.success("Supprimé"); setDeleteTarget(null); reload(); }
    catch { toast.error("Erreur"); }
  };

  const handleSeedDental = async () => {
    try {
      const res = await seedDentalCategories();
      if (res.count === 0) toast.info("Toutes les catégories dentaires sont déjà présentes");
      else toast.success(`${res.count} catégorie${res.count > 1 ? "s" : ""} ajoutée${res.count > 1 ? "s" : ""}`);
      reload();
    } catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-6" data-testid="categories-page">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-stone-500">Organisez vos produits par catégorie dentaire</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDental} data-testid="seed-dental-btn">
            <Sparkles className="w-4 h-4 mr-2" /> Ajouter les catégories dentaires
          </Button>
          <Button onClick={startCreate} className="bg-emerald-700 hover:bg-emerald-800" data-testid="add-category-btn">
            <Plus className="w-4 h-4 mr-2" /> Nouvelle catégorie
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center bg-white border-dashed border-2 border-stone-200">
          <div className="text-stone-400">Aucune catégorie</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((c) => (
            <Card key={c.id} className="p-5 bg-white border-stone-200 flex items-center justify-between" data-testid={`category-card-${c.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: c.color }} />
                <div className="font-heading font-semibold text-stone-900">{c.name}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Edit className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-rose-600" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="category-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4 pt-2">
            <div><Label>Nom *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="category-name-input" /></div>
            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`w-9 h-9 rounded-lg transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-stone-900 scale-110" : ""}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800" data-testid="save-category-btn">{editing ? "Enregistrer" : "Créer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} sera supprimée. Les produits associés resteront sans catégorie.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
