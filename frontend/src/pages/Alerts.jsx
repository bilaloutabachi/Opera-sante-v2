import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, XCircle, PackageX } from "lucide-react";
import { Card } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { getAlerts } from "../lib/api";
import { formatDate, daysUntil } from "../lib/format";
import { toast } from "sonner";

const TONES = {
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  danger: "bg-rose-50 border-rose-200 text-rose-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  critical: "bg-red-800 border-2 border-red-900 text-red-50",
};

function AlertCard({ icon: Icon, label, count, tone, value, active, onClick, testId }) {
  const iconBg = tone === "critical" ? "bg-red-900/60" : "bg-white/60";
  const isActive = active === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      data-testid={testId}
      className={`text-left transition-all ${isActive ? "ring-4 ring-emerald-500/30 -translate-y-0.5 shadow-md" : "hover:-translate-y-0.5 hover:shadow-sm opacity-90"}`}
    >
      <Card className={`p-5 border ${TONES[tone]}`}>
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]">{label}</div>
            <div className="font-heading text-3xl font-extrabold mt-1">{count}</div>
          </div>
        </div>
      </Card>
    </button>
  );
}

function TableOutOfStock({ items }) {
  return (
    <Table>
      <TableHeader className="bg-stone-50">
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead>Stock actuel</TableHead>
          <TableHead>Seuil</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow><TableCell colSpan={3} className="text-center py-10 text-stone-400">Aucun produit épuisé</TableCell></TableRow>
        ) : items.map((p) => (
          <TableRow key={p.id} className="row-out-of-stock" data-testid={`out-of-stock-row-${p.id}`}>
            <TableCell className="font-semibold">{p.name}</TableCell>
            <TableCell><span className="font-heading font-extrabold text-lg">{p.quantity}</span></TableCell>
            <TableCell>{p.min_threshold}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableLowStock({ items }) {
  return (
    <Table>
      <TableHeader className="bg-stone-50">
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead>Stock actuel</TableHead>
          <TableHead>Seuil</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow><TableCell colSpan={3} className="text-center py-10 text-stone-400">Aucune alerte</TableCell></TableRow>
        ) : items.map((p) => (
          <TableRow key={p.id} className="row-low-stock">
            <TableCell className="font-semibold">{p.name}</TableCell>
            <TableCell><span className="font-heading font-bold text-lg text-amber-700">{p.quantity}</span></TableCell>
            <TableCell className="text-stone-600">{p.min_threshold}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableExpiry({ items, expired }) {
  return (
    <Table>
      <TableHeader className="bg-stone-50">
        <TableRow>
          <TableHead>Produit</TableHead>
          <TableHead>Date de péremption</TableHead>
          <TableHead>Dans</TableHead>
          <TableHead>Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow><TableCell colSpan={4} className="text-center py-10 text-stone-400">Aucune alerte</TableCell></TableRow>
        ) : items.map((p) => {
          const d = daysUntil(p.expiry_date);
          return (
            <TableRow key={p.id} className={expired ? "row-expired" : "row-low-stock"}>
              <TableCell className="font-semibold">{p.name}</TableCell>
              <TableCell>{formatDate(p.expiry_date)}</TableCell>
              <TableCell className={expired ? "text-rose-700 font-bold" : "text-amber-700 font-bold"}>
                {expired ? `il y a ${Math.abs(d)} j` : `${d} j`}
              </TableCell>
              <TableCell className="font-mono">{p.quantity}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function pickInitialFilter(d) {
  if ((d.out_of_stock || []).length > 0) return "out";
  if ((d.low_stock || []).length > 0) return "low";
  if ((d.expired || []).length > 0) return "expired";
  return "soon";
}

export default function Alerts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("out");

  useEffect(() => {
    getAlerts()
      .then((d) => {
        const safe = { out_of_stock: [], low_stock: [], expired: [], expiring_soon: [], ...d };
        setData(safe);
        setActive(pickInitialFilter(safe));
      })
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    out: (data?.out_of_stock || []).length,
    low: (data?.low_stock || []).length,
    expired: (data?.expired || []).length,
    soon: (data?.expiring_soon || []).length,
  }), [data]);

  if (loading || !data) return <div className="text-stone-500">Chargement...</div>;

  const renderActiveTable = () => {
    if (active === "out") return <TableOutOfStock items={data.out_of_stock} />;
    if (active === "low") return <TableLowStock items={data.low_stock} />;
    if (active === "expired") return <TableExpiry items={data.expired} expired />;
    return <TableExpiry items={data.expiring_soon} />;
  };

  return (
    <div className="space-y-6" data-testid="alerts-page">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AlertCard icon={PackageX}      label="Stock épuisé"    count={counts.out}     tone="critical" value="out"     active={active} onClick={setActive} testId="card-out-of-stock" />
        <AlertCard icon={AlertTriangle} label="Stock faible"    count={counts.low}     tone="warning"  value="low"     active={active} onClick={setActive} testId="card-low-stock" />
        <AlertCard icon={Clock}         label="Périmé bientôt"  count={counts.soon}    tone="warning"  value="soon"    active={active} onClick={setActive} testId="card-expiring" />
        <AlertCard icon={XCircle}       label="Expiré"          count={counts.expired} tone="danger"   value="expired" active={active} onClick={setActive} testId="card-expired" />
      </div>

      <Card className="bg-white border-stone-200 p-6" data-testid="alerts-active-list">
        {renderActiveTable()}
      </Card>
    </div>
  );
}
