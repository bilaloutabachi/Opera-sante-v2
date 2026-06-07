import { useEffect, useState } from "react";
import { Truck, Package, ExternalLink, CheckCircle2, Globe, Printer, Search } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getReorderSuggestions } from "../lib/api";
import { formatEuro } from "../lib/format";
import { toast } from "sonner";

function applySearchFilter(data, search) {
  if (!data) return null;
  const q = search.trim().toLowerCase();
  if (!q) return data;
  const matches = (it) => (it.product_name || "").toLowerCase().includes(q);
  const groups = data.groups
    .map((g) => ({ ...g, items: g.items.filter(matches) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      ...g,
      total: g.items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    }));
  const unassigned = data.unassigned.filter(matches);
  return {
    ...data,
    groups,
    unassigned,
    total_items: groups.reduce((s, g) => s + g.items.length, 0) + unassigned.length,
  };
}

function buildPrintRows(filtered) {
  if (!filtered) return [];
  const rows = [];
  for (const g of filtered.groups) {
    for (const it of g.items) {
      rows.push({ ...it, supplier_name: g.supplier_name });
    }
  }
  for (const it of filtered.unassigned) {
    rows.push({ ...it, supplier_name: "—" });
  }
  return rows;
}

export default function Reorder() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    getReorderSuggestions()
      .then((d) => { if (alive) setData(d); })
      .catch(() => toast.error("Erreur de chargement"));
    return () => { alive = false; };
  }, []);

  const loading = data === null;

  const filtered = applySearchFilter(data, search);

  if (loading || !filtered) return <div className="text-stone-500">Chargement…</div>;

  const printRows = buildPrintRows(filtered);
  const totalFor = (g) => g.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const grandTotal = printRows.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  const empty = filtered.total_items === 0;
  const noResults = empty && search.trim().length > 0;

  return (
    <div className="space-y-6" data-testid="reorder-page">
      {/* Toolbar avec barre de recherche (cachée à l'impression) */}
      <Card className="p-5 bg-white border-stone-200 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11"
              data-testid="reorder-search"
            />
          </div>
          {search && (
            <Button variant="ghost" onClick={() => setSearch("")} data-testid="reorder-search-clear">
              Effacer
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
            data-testid="print-list-btn"
            disabled={empty}
          >
            <Printer className="w-4 h-4" /> Imprimer la liste
          </Button>
        </div>
      </Card>

      {/* Empty state */}
      {empty && !noResults && (
        <Card className="p-12 bg-emerald-50 border-emerald-200 text-center no-print" data-testid="reorder-empty">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
          <h2 className="font-heading text-2xl font-bold text-stone-900 mt-4">Tout est à jour</h2>
          <p className="text-stone-600 mt-2 max-w-md mx-auto">Aucun produit n&apos;est en dessous du seuil minimal.</p>
        </Card>
      )}
      {noResults && (
        <Card className="p-8 bg-white border-stone-200 text-center no-print" data-testid="reorder-no-results">
          <Search className="w-10 h-10 mx-auto text-stone-300" />
          <p className="font-heading text-lg font-bold text-stone-700 mt-3">Aucun produit ne correspond</p>
          <p className="text-sm text-stone-500 mt-1">Essayez avec d&apos;autres mots-clés.</p>
        </Card>
      )}

      {!empty && (
        <>
          {/* Intro (écran uniquement) */}
          <Card className="p-5 bg-white border-stone-200 no-print">
            <div className="flex items-start gap-4 flex-wrap justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Liste de courses</div>
                <h2 className="font-heading text-xl font-bold text-stone-900 mt-1">
                  {filtered.total_items} produit{filtered.total_items > 1 ? "s" : ""} à commander · {filtered.groups.length} fournisseur{filtered.groups.length > 1 ? "s" : ""}
                </h2>
                <p className="text-stone-500 text-sm mt-1 max-w-2xl">
                  Produits sous le seuil minimal. Cliquez sur le lien à droite de chaque produit pour l&apos;ajouter au panier sur le site du fournisseur.
                </p>
              </div>
            </div>
          </Card>

          {/* Vue écran : groupes par fournisseur (cachée à l'impression) */}
          <div className="space-y-4 no-print">
            {filtered.groups.map((g) => {
              const groupTotal = totalFor(g);
              return (
                <Card key={g.supplier_id} className="bg-white border-stone-200" data-testid={`supplier-group-${g.supplier_id}`}>
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
                            <div className="font-heading font-bold text-stone-900">
                              {item.unit_price > 0 ? formatEuro(item.quantity * item.unit_price) : <span className="text-stone-300">—</span>}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {item.unit_price > 0 ? `× ${formatEuro(item.unit_price)}` : "prix non renseigné"}
                            </div>
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

            {filtered.unassigned.length > 0 && (
              <Card className="p-5 bg-amber-50 border-amber-200" data-testid="reorder-unassigned">
                <h3 className="font-heading font-bold text-amber-900">Produits sans fournisseur ({filtered.unassigned.length})</h3>
                <p className="text-sm text-amber-800 mt-0.5">Assignez un fournisseur à ces produits pour les regrouper correctement :</p>
                <ul className="mt-3 space-y-1.5">
                  {filtered.unassigned.map((i) => (
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

          {/* Vue impression : tableau compact style Excel (visible uniquement au print) */}
          <div className="print-only" data-testid="print-table-wrapper">
            <h1 className="print-title">Liste à commander — {new Date().toLocaleDateString("fr-FR")}</h1>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Fournisseur</th>
                  <th className="num">Stock actuel</th>
                  <th className="num">Seuil</th>
                  <th className="num">Qté à commander</th>
                  <th className="num">Prix unitaire</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r) => (
                  <tr key={r.product_id}>
                    <td>{r.product_name}</td>
                    <td>{r.supplier_name}</td>
                    <td className="num">{r.current_quantity}</td>
                    <td className="num">{r.min_threshold}</td>
                    <td className="num bold">{r.quantity}</td>
                    <td className="num">{r.unit_price > 0 ? formatEuro(r.unit_price) : "—"}</td>
                    <td className="num bold">{r.unit_price > 0 ? formatEuro(r.quantity * r.unit_price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="num bold">Total estimé</td>
                  <td className="num bold">{formatEuro(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
