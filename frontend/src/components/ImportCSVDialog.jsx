import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { importProductsCSV } from "../lib/api";
import { toast } from "sonner";

const SAMPLE_CSV = `nom;marque;code-barres;catégorie;fournisseur;stock;seuil;prix;péremption;lien
Gants latex T8;Hartmann;3401234567890;Hygiène;Henry Schein;120;30;6.50;2027-06-30;https://www.henryschein.fr/produit
Composite A2;3M ESPE;;Composites / Soins;Pierre Rolland;5;3;45.00;2026-12-31;
Aiguille 30G;Septodont;3401111222333;Anesthésie;Septodont;200;50;0.80;2027-01-15;`;

export default function ImportCSVDialog({ open, onOpenChange, onImported }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setResult(null);
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handlePick = (f) => {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) {
      toast.error("Veuillez choisir un fichier .csv");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handlePick(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importProductsCSV(file);
      setResult(res);
      const msg = `${res.created} créé(s), ${res.updated} mis à jour${res.errors.length ? `, ${res.errors.length} erreur(s)` : ""}`;
      if (res.errors.length === 0) toast.success(msg);
      else toast.warning(msg);
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'import");
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-opera-sante.csv";
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="import-csv-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl">Importer des produits depuis un CSV</DialogTitle>
          <DialogDescription>
            Chargez vos références en masse. Les catégories et fournisseurs manquants seront créés automatiquement.
            Si un code-barres existe déjà, le produit est <strong>mis à jour</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Format help */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-stone-800">Colonnes acceptées (séparateur <code>;</code> ou <code>,</code>)</p>
            <Button variant="outline" size="sm" onClick={downloadSample} data-testid="download-sample-csv">
              <Download className="w-4 h-4 mr-2" /> Modèle CSV
            </Button>
          </div>
          <p className="text-stone-600 leading-relaxed">
            <code>nom</code>, <code>marque</code>, <code>code-barres</code>, <code>catégorie</code>,{" "}
            <code>fournisseur</code>, <code>stock</code>, <code>seuil</code>, <code>prix</code>,{" "}
            <code>péremption</code> (AAAA-MM-JJ ou JJ/MM/AAAA), <code>lien</code>.
            Seul <strong>nom</strong> est obligatoire.
          </p>
        </div>

        {/* Drop zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`mt-2 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-emerald-600 bg-emerald-50" : "border-stone-300 hover:border-emerald-500 hover:bg-stone-50"
            }`}
            data-testid="csv-dropzone"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0])}
              data-testid="csv-file-input"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-emerald-700" />
                <div className="text-left">
                  <p className="font-medium text-stone-900">{file.name}</p>
                  <p className="text-xs text-stone-500">{(file.size / 1024).toFixed(1)} Ko — cliquez pour changer</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                <p className="font-medium text-stone-700">Glissez votre fichier CSV ici</p>
                <p className="text-sm text-stone-500">ou cliquez pour parcourir</p>
              </>
            )}
          </div>
        )}

        {/* Result panel */}
        {result && (
          <div className="space-y-3" data-testid="import-result">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-800">{result.created}</p>
                <p className="text-xs text-emerald-700">Créés</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
                <FileSpreadsheet className="w-6 h-6 text-blue-700 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-800">{result.updated}</p>
                <p className="text-xs text-blue-700">Mis à jour</p>
              </div>
              <div className={`rounded-lg p-4 text-center border ${
                result.errors.length ? "bg-rose-50 border-rose-200" : "bg-stone-50 border-stone-200"
              }`}>
                <AlertCircle className={`w-6 h-6 mx-auto mb-1 ${result.errors.length ? "text-rose-700" : "text-stone-400"}`} />
                <p className={`text-2xl font-bold ${result.errors.length ? "text-rose-800" : "text-stone-500"}`}>
                  {result.errors.length}
                </p>
                <p className={`text-xs ${result.errors.length ? "text-rose-700" : "text-stone-500"}`}>Erreurs</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 max-h-40 overflow-auto">
                <p className="text-sm font-medium text-rose-900 mb-1">Lignes ignorées :</p>
                <ul className="text-xs text-rose-800 space-y-0.5">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>Ligne {e.line} : {e.error}</li>
                  ))}
                  {result.errors.length > 20 && <li>... et {result.errors.length - 20} autres</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {result ? (
            <>
              <Button variant="outline" onClick={reset} data-testid="import-csv-again">
                Importer un autre fichier
              </Button>
              <Button onClick={() => handleClose(false)} className="bg-emerald-700 hover:bg-emerald-800" data-testid="import-csv-close">
                Fermer
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                <X className="w-4 h-4 mr-1" /> Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!file || loading}
                className="bg-emerald-700 hover:bg-emerald-800"
                data-testid="import-csv-submit"
              >
                <Upload className="w-4 h-4 mr-2" />
                {loading ? "Import en cours..." : "Importer"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
