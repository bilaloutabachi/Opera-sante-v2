import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getDashboardStats, getReorderSuggestions } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { toast } from "sonner";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [suggest, setSuggest] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([getDashboardStats(), getReorderSuggestions(14)])
      .then(([s, r]) => { setStats(s); setSuggest(r); })
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading || !stats) return <div className="text-stone-500">Chargement…</div>;

  const isEmpty = stats.total_products === 0;
  const urgentCount = suggest?.total_items || 0;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {isEmpty && (
        <Card className="p-8 border-dashed border-2 border-emerald-300 bg-emerald-50/40">
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-[260px]">
              <h3 className="font-heading text-xl font-bold text-stone-900">Bienvenue dans Opéra santé</h3>
              <p className="text-stone-600 mt-1">Commencez en ajoutant vos fournisseurs puis vos produits.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/fournisseurs"><Button variant="outline">Ajouter un fournisseur</Button></Link>
              <Link to="/inventaire"><Button className="bg-emerald-700 hover:bg-emerald-800">Ajouter un produit</Button></Link>
            </div>
          </div>
        </Card>
      )}

      {/* À commander — bloc principal */}
      <Card className={`p-7 overflow-hidden relative border ${urgentCount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`} data-testid="reorder-hero">
        <div className="flex items-start justify-between flex-wrap gap-5">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${urgentCount > 0 ? "bg-amber-600 text-white" : "bg-emerald-700 text-white"}`}>
              {urgentCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div>
              <div className={`text-[11px] font-bold uppercase tracking-[0.2em] ${urgentCount > 0 ? "text-amber-800" : "text-emerald-800"} flex items-center gap-2`}>
                <ShoppingCart className="w-3.5 h-3.5" /> À commander
              </div>
              <h2 className="font-heading text-3xl md:text-4xl font-extrabold text-stone-900 mt-2 leading-tight">
                {urgentCount === 0 ? "Tout va bien" : `${urgentCount} produit${urgentCount > 1 ? "s" : ""} à commander`}
              </h2>
              <p className="text-stone-600 mt-1 text-sm max-w-xl">
                {urgentCount === 0
                  ? "Aucune commande à passer aujourd'hui. Votre stock est bon."
                  : `Répartis sur ${suggest.groups.length} fournisseur${suggest.groups.length > 1 ? "s" : ""}. Générez les commandes en 1 clic.`}
              </p>
            </div>
          </div>
          {urgentCount > 0 && (
            <Link to="/commander">
              <Button size="lg" className="font-bold bg-amber-600 hover:bg-amber-700 text-white" data-testid="go-to-reorder-btn">
                Voir les suggestions <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Compact stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill label="Produits" value={stats.total_products} to="/inventaire" testId="stat-products" />
        <StatPill label="Stock épuisé" value={stats.out_of_stock_count || 0} tone={stats.out_of_stock_count > 0 ? "critical" : "default"} to="/alertes" testId="stat-out-of-stock" />
        <StatPill label="Stock faible" value={stats.low_stock_count} tone={stats.low_stock_count > 0 ? "warning" : "default"} to="/alertes" testId="stat-low-stock" />
        <StatPill label="Périmés / bientôt" value={stats.expired_count + stats.expiring_soon_count} tone={stats.expired_count > 0 ? "danger" : stats.expiring_soon_count > 0 ? "warning" : "default"} to="/alertes" testId="stat-expiry" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top consumers */}
        <Card className="p-6 bg-white border-stone-200" data-testid="top-consumed">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Les plus utilisés · 30 j</div>
              <h3 className="font-heading text-lg font-bold text-stone-900 mt-1 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" /> Top consommation
              </h3>
            </div>
          </div>
          {stats.top_consumed.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">Pas encore d'historique</div>
          ) : (
            <div className="space-y-2.5">
              {stats.top_consumed.map((t, i) => {
                const max = stats.top_consumed[0]?.total || 1;
                const pct = Math.max(8, Math.round((t.total / max) * 100));
                return (
                  <div key={t.product_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-400 text-xs w-4">#{i + 1}</span>
                        <span className="font-medium text-stone-800">{t.name}</span>
                      </div>
                      <span className="font-heading font-bold text-stone-900">{t.total}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="p-6 bg-white border-stone-200" data-testid="recent-movements">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Activité récente</div>
              <h3 className="font-heading text-lg font-bold text-stone-900 mt-1">Derniers mouvements</h3>
            </div>
            <Link to="/mouvements" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Voir tout →</Link>
          </div>
          {stats.recent_movements.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">Aucun mouvement</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {stats.recent_movements.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${m.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {m.type === "in" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-stone-900 text-sm truncate">{m.product_name}</div>
                      <div className="text-xs text-stone-500 truncate">{formatDateTime(m.created_at)}</div>
                    </div>
                  </div>
                  <div className={`font-heading font-bold text-sm shrink-0 ml-2 ${m.type === "in" ? "text-emerald-700" : "text-rose-700"}`}>
                    {m.type === "in" ? "+" : "−"}{m.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = "default", to, testId }) {
  const tones = {
    default: "bg-white border-stone-200",
    warning: "bg-amber-50 border-amber-200",
    danger: "bg-rose-50 border-rose-200",
    success: "bg-emerald-50 border-emerald-200",
    critical: "bg-red-800 border-2 border-red-900",
  };
  const valueTone = {
    default: "text-stone-900",
    warning: "text-amber-800",
    danger: "text-rose-700",
    success: "text-emerald-700",
    critical: "text-red-50",
  };
  const labelTone = tone === "critical" ? "text-red-100" : "text-stone-500";
  const content = (
    <Card className={`px-5 py-4 border transition-all hover:-translate-y-0.5 hover:shadow-sm ${tones[tone]}`} data-testid={testId}>
      <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${labelTone}`}>{label}</div>
      <div className={`font-heading text-2xl font-extrabold mt-1 ${valueTone[tone]}`}>{value}</div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}
