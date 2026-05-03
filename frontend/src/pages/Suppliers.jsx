import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Mail, Phone, User } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../lib/api";
import { toast } from "sonner";

const EMPTY = { name: "", contact_name: "", email: "", phone: "", address: "", notes: "" };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => listSuppliers().then(setItems).catch(() => toast.error("Erreur"));

  useEffect(() => { reload(); }, []);

  const startEdit = (s) => { setEditing(s); setForm({ ...EMPTY, ...s }); setOpen(true); };
  const startCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await updateSupplier(editing.id, form); toast.success("Mis à jour"); }
      else { await createSupplier(form); toast.success("Créé"); }
      setOpen(false); reload();
    } catch { toast.error("Erreur"); }
  };

  const confirmDelete = async () => {
    try { await deleteSupplier(deleteTarget.id); toast.success("Supprimé"); setDeleteTarget(null); reload(); }
    catch { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-6" data-testid="suppliers-page">
      <div className="flex justify-between items-center">
        <p className="text-stone-500">Gérez vos fournisseurs et leurs coordonnées</p>
        <Button onClick={startCreate} className="bg-emerald-700 hover:bg-emerald-800" data-testid="add-supplier-btn">
          <Plus className="w-4 h-4 mr-2" /> Nouveau fournisseur
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center bg-white border-dashed border-2 border-stone-200">
          <div className="text-stone-400">Aucun fournisseur. Commencez par en ajouter un.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((s) => (
            <Card key={s.id} className="p-5 bg-white border-stone-200 hover:-translate-y-0.5 hover:shadow-md transition-all" data-testid={`supplier-card-${s.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-heading font-bold text-lg text-stone-900">{s.name}</h3>
                  {s.contact_name && (
                    <div className="text-sm text-stone-600 flex items-center gap-1.5 mt-1">
                      <User className="w-3.5 h-3.5" /> {s.contact_name}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(s)} data-testid={`edit-supplier-${s.id}`}><Edit className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(s)} data-testid={`delete-supplier-${s.id}`}><Trash2 className="w-4 h-4 text-rose-600" /></Button>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-stone-600">
                {s.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-stone-400" /> {s.email}</div>}
                {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-stone-400" /> {s.phone}</div>}
                {s.address && <div className="text-stone-500 mt-1">{s.address}</div>}
              </div>
              {s.notes && <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 italic">{s.notes}</div>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="supplier-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3 pt-2">
            <div><Label>Nom *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="supplier-name-input" /></div>
            <div><Label>Contact</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="mt-1.5" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" /></div>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800" data-testid="save-supplier-btn">{editing ? "Enregistrer" : "Créer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} sera supprimé définitivement.</AlertDialogDescription>
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
