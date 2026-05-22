import { useState } from "react";
import { Trash2, BarChart3, AlertTriangle } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
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
import BackupCard from "../components/BackupCard";
import { resetInventory, resetStatistics } from "../lib/api";
import { toast } from "sonner";

export default function Settings() {
  const [confirm, setConfirm] = useState(null); // "inventory" | "statistics" | null
  const [running, setRunning] = useState(false);

  const doReset = async () => {
    if (!confirm) return;
    setRunning(true);
    try {
      if (confirm === "inventory") {
        await resetInventory();
        toast.success("Inventaire réinitialisé. L'application est repartie de zéro.");
      } else {
        await resetStatistics();
        toast.success("Historique des mouvements supprimé. Les produits sont conservés.");
      }
      setConfirm(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de la réinitialisation");
    } finally {
      setRunning(false);
    }
  };

  const messages = {
    inventory: {
      title: "Réinitialiser tout l'inventaire ?",
      desc: (
        <>
          Cette action va <strong>supprimer définitivement</strong> :
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Tous les <strong>produits</strong> de l'inventaire</li>
            <li>Tout l'<strong>historique des mouvements</strong> (entrées, sorties, scans)</li>
            <li>Toutes les <strong>alertes</strong> dérivées (stock épuisé, faible, péremption)</li>
          </ul>
          <p className="mt-3">
            Les <strong>catégories</strong> et <strong>fournisseurs</strong> sont conservés. L'application repart
            comme après une installation fraîche.
          </p>
          <p className="mt-3 text-rose-700 font-semibold">
            Cette action est irréversible. Pensez à télécharger une sauvegarde avant.
          </p>
        </>
      ),
      btn: "Oui, tout réinitialiser",
    },
    statistics: {
      title: "Réinitialiser les statistiques ?",
      desc: (
        <>
          Cette action va <strong>supprimer définitivement</strong> :
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Tout l'<strong>historique des mouvements</strong> (entrées, sorties, scans)</li>
            <li>Les <strong>statistiques de consommation</strong> (top consommation, moyennes)</li>
          </ul>
          <p className="mt-3">
            Les <strong>produits, stocks actuels, fournisseurs et catégories</strong> sont conservés.
          </p>
          <p className="mt-3 text-rose-700 font-semibold">
            Cette action est irréversible. Pensez à télécharger une sauvegarde avant.
          </p>
        </>
      ),
      btn: "Oui, vider l'historique",
    },
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Sauvegarde / Restauration */}
      <BackupCard />

      {/* Zone de danger */}
      <Card className="p-6 bg-white border-2 border-rose-200" data-testid="danger-zone">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-11 h-11 rounded-xl bg-red-800 text-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700">Zone de danger</div>
            <h3 className="font-heading text-lg font-bold text-stone-900 mt-0.5">Réinitialisation de la base</h3>
            <p className="text-sm text-stone-600 mt-1">
              Ces actions sont définitives. Téléchargez d'abord une sauvegarde si vous souhaitez pouvoir revenir en arrière.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reset inventaire */}
          <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-4 h-4 text-rose-700" />
              <div className="font-heading font-bold text-stone-900">Réinitialiser l'inventaire</div>
            </div>
            <p className="text-sm text-stone-600 flex-1">
              Supprime tous les produits, mouvements et alertes. L'application repart comme après une installation fraîche
              (catégories et fournisseurs conservés).
            </p>
            <Button
              variant="outline"
              className="mt-4 border-rose-300 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
              onClick={() => setConfirm("inventory")}
              data-testid="reset-inventory-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Réinitialiser l'inventaire
            </Button>
          </div>

          {/* Reset statistiques */}
          <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-amber-700" />
              <div className="font-heading font-bold text-stone-900">Réinitialiser les statistiques</div>
            </div>
            <p className="text-sm text-stone-600 flex-1">
              Supprime uniquement l'historique des mouvements et les statistiques. Les produits et leur stock actuel sont
              conservés.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => setConfirm("statistics")}
              data-testid="reset-statistics-btn"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Réinitialiser les statistiques
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !running && setConfirm(null)}>
        <AlertDialogContent data-testid="reset-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-heading">
              <AlertTriangle className="w-5 h-5 text-rose-700" />
              {confirm && messages[confirm].title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-stone-700 text-sm">{confirm && messages[confirm].desc}</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running} data-testid="reset-cancel-btn">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={doReset}
              disabled={running}
              className="bg-red-800 hover:bg-red-900 text-red-50"
              data-testid="reset-confirm-btn"
            >
              {running ? "Réinitialisation…" : confirm && messages[confirm].btn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
