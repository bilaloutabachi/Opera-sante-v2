import { useEffect, useState } from "react";
import { Truck, Package, ExternalLink, CheckCircle2, Globe, Printer } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { getReorderSuggestions } from "../lib/api";
import { formatEuro } from "../lib/format";
import { toast } from "sonner";

export default function Reorder() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getReorderSuggestions()
      .then(setData)
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalFor = (g) => g.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  if (loading || !data) return <div className="text-stone-500">Chargement…</div>;

  const empty = data.total_items === 0;

  return (
    <div className="space-y-6" data-testid="reorder-page">
      {empty ? (
        <Card className="p-12 bg-emerald-50 border-emerald-200 text-center" data-testid="reorder-empty">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
          <h2 className="font-heading text-2xl font-bold text-stone-900 mt-4">Tout est à jour</h2>
          <p className="text-stone-600 mt-2 max-w-md mx-auto">Aucun produit n'est en dessous du seuil minimal.</p>
        </Card>
      ) : (
        <>
          {/* Intro */}
          <Card className="p-5 bg-white border-stone-200">
            <div className="flex items-start gap-4 flex-wrap justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Liste de courses</div>
                <h2 className="font-heading text-xl font-bold text-stone-900 mt-1">
                  {data.total_items} produit{data.total_items > 1 ? "s" : ""} à commander · {data.groups.length} fournisseur{data.groups.length > 1 ? "s" : ""}
                </h2>
                <p className="text-stone-500 text-sm mt-1 max-w-2xl">
                  Produits sous le seuil minimal. Quantités calculées pour couvrir <strong>1 mois de consommation</strong>. Cliquez sur le lien à droite de chaque produit pour l'ajouter au panier sur le site du fournisseur.
                </p>
              </div>
              <Button variant="outline" onClick={() => window.print()} className="gap-2" data-testid="print-list-btn">
                <Printer className="w-4 h-4" /> Imprimer la liste
              </Button>
            </div>
          </Card>

          {/* Supplier groups */}
          <div className="space-y-4">
            {data.groups.map((g) => {
              const groupTotal = totalFor(g);
              return (
                <Card key={g.supplier_id} className="bg-white border-stone-200" data-testid={`supplier-group-${g.supplier_id}`}>
                  {/* Header */}
                  <div className="flex items-center justify-between p-5 border-b border-stone-100 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div>
                        <div className="font-heading font-bold text-lg text-stone-900">{g.supplier_name}</div>
                        <div className="text-xs text-stone-500">{g.items.length} produit{g.items.length > 1 ? "s" : ""} à commander</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-stone-500 uppercase font-semibold tracking-wider">Total estimé</div>
                      <div className="font-heading text-xl font-extrabold text-stone-900">{formatEuro(groupTotal)}</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-stone-100">
                    {g.items.map((item) => (
                      <div key={item.product_id} className="p-4 flex items-center gap-4 flex-wrap" data-testid={`reorder-item-${item.product_id}`}>
                        <div className="flex-1 min-w-[240px]">
                          <div className="font-semibold text-stone-900">{item.product_name}</div>
                          <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="text-amber-700 font-semibold">Stock : {item.current_quantity} / seuil {item.min_threshold}</span>
                            {item.monthly_usage > 0 && (
                              <>
                                <span>·</span>
                                <span>Conso : {item.monthly_usage}/mois</span>
                              </>
                            )}
                            {item.barcode && (
                              <>
                                <span>·</span>
                                <span className="font-mono">{item.barcode}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-5 flex-wrap">
                          <div className="text-center">
                            <div className="text-[10px] text-stone-500 uppercase font-semibold tracking-wider">À commander</div>
                            <div className="font-heading font-extrabold text-2xl text-emerald-700 leading-none mt-0.5">{item.quantity}</div>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <div className="text-[10px] text-stone-500 uppercase font-semibold tracking-wider">Sous-total</div>
                            <div className="font-heading font-bold text-stone-900">{formatEuro(item.quantity * item.unit_price)}</div>
                            <div className="text-[10px] text-stone-400">× {formatEuro(item.unit_price)}</div>
                          </div>

                          {item.product_url ? (
                            <a
                              href={item.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`reorder-link-${item.product_id}`}
                            >
                              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 gap-2">
                                <ExternalLink className="w-3.5 h-3.5" /> Commander
                              </Button>
                            </a>
                          ) : (
                            <Button size="sm" variant="outline" disabled className="gap-2 opacity-50" title="Ajoutez le lien du produit dans sa fiche">
                              <Globe className="w-3.5 h-3.5" /> Lien manquant
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}

            {/* Unassigned */}
            {data.unassigned.length > 0 && (
              <Card className="p-5 bg-amber-50 border-amber-200" data-testid="reorder-unassigned">
                <h3 className="font-heading font-bold text-amber-900">Produits sans fournisseur ({data.unassigned.length})</h3>
                <p className="text-sm text-amber-800 mt-0.5">Assignez un fournisseur à ces produits pour les regrouper correctement :</p>
                <ul className="mt-3 space-y-1.5">
                  {data.unassigned.map((i) => (
                    <li key={i.product_id} className="text-sm text-stone-700 flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-medium">{i.product_name}</span>
                      <span className="text-stone-500">— stock {i.current_quantity}, à commander {i.quantity}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
