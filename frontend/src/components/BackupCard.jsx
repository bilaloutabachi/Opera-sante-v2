import { useRef, useState } from "react";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "./ui/alert-dialog";
import { API, restoreBackup } from "../lib/api";
import { toast } from "sonner";

export default function BackupCard() {
  const fileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/backup`);
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const filename = `opera-sante-backup-${new Date().toISOString().slice(0, 10)}.db`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      toast.success("Sauvegarde téléchargée");
    } catch (e) {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setLoading(false);
    }
  };

  const handleFilePick = (f) => {
    if (!f) return;
    if (!/\.db$/i.test(f.name)) {
      toast.error("Veuillez choisir un fichier .db");
      return;
    }
    setPendingFile(f);
  };

  const handleRestore = async () => {
    if (!pendingFile) return;
    setLoading(true);
    try {
      await restoreBackup(pendingFile);
      toast.success("Base restaurée. Redémarrez l'application pour finaliser.");
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la restauration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="p-6 bg-white border-stone-200" data-testid="backup-card">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Base de données</div>
            <h3 className="font-heading text-lg font-bold text-stone-900 mt-0.5">Sauvegarde & Restauration</h3>
            <p className="text-sm text-stone-600 mt-1">
              Télécharge un fichier <code className="bg-stone-100 px-1 rounded">.db</code> avec tout votre stock.
              À faire avant chaque mise à jour ou tous les quelques jours sur clé USB.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                onClick={handleDownload}
                disabled={loading}
                className="bg-emerald-700 hover:bg-emerald-800"
                data-testid="backup-download-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger la base
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".db"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
                data-testid="backup-file-input"
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                data-testid="backup-restore-btn"
              >
                <Upload className="w-4 h-4 mr-2" />
                Restaurer une sauvegarde
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog open={!!pendingFile} onOpenChange={(o) => !o && setPendingFile(null)}>
        <AlertDialogContent data-testid="restore-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Restaurer cette sauvegarde ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Fichier : <strong>{pendingFile?.name}</strong> ({pendingFile ? (pendingFile.size / 1024).toFixed(1) : 0} Ko).
              <br /><br />
              Vos données actuelles seront <strong>REMPLACÉES</strong> par celles de la sauvegarde.
              Cette action est irréversible — téléchargez d'abord votre base actuelle si vous voulez la conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="restore-cancel-btn">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="restore-confirm-btn"
            >
              Oui, restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
