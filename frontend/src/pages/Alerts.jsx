import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, XCircle, PackageX } from "lucide-react";
import { Card } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { getAlerts } from "../lib/api";
import { formatDate, daysUntil } from "../lib/format";
import { toast } from "sonner";

export default function Alerts() {
  const [data, setData] = useState({ out_of_stock: [], low_stock: [], expired: [], expiring_soon: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlerts()
      .then((d) => setData({ out_of_stock: [], ...d }))
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    out: (data.out_of_stock || []).length,
    low: data.low_stock.length,
    expired: data.expired.length,
    soon: data.expiring_soon.length,
  }), [data]);

  const Summary = ({ icon: Icon, label, count, tone, testId }) => {
    const tones = {
      warning: "bg-amber-50 border-amber-200 text-amber-800",
      danger: "bg-rose-50 border-rose-200 text-rose-800",
      success: "bg-emerald-50 border-emerald-200 text-emerald-800",
      critical: "bg-red-800 border-2 border-red-900 text-red-50",
    };
    const iconBg = tone === "critical" ? "bg-red-900/60" : "bg-white/60";
    return (
      <Card className={`p-5 border ${tones[tone]}`} data-testid={testId}>
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
    );
  };

  const TableOutOfStock = ({ items }) => (
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

  const TableLowStock = ({ items }) => (
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

  const TableExpiry = ({ items, expired }) => (
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

  if (loading) return <div className="text-stone-500">Chargement...</div>;

  return (
    <div className="space-y-6" data-testid="alerts-page">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Summary icon={PackageX} label="Stock épuisé" count={counts.out} tone="critical" testId="summary-out-of-stock" />
        <Summary icon={AlertTriangle} label="Stock faible" count={counts.low} tone="warning" testId="summary-low-stock" />
        <Summary icon={XCircle} label="Périmés" count={counts.expired} tone="danger" testId="summary-expired" />
        <Summary icon={Clock} label="Expirent bientôt" count={counts.soon} tone="warning" testId="summary-expiring" />
      </div>

      <Card className="bg-white border-stone-200 p-6">
        <Tabs defaultValue={counts.out > 0 ? "out" : "low"} data-testid="alerts-tabs">
          <TabsList className="bg-stone-100">
            <TabsTrigger value="out" data-testid="tab-out-of-stock" className="data-[state=active]:bg-red-800 data-[state=active]:text-red-50">
              Stock épuisé ({counts.out})
            </TabsTrigger>
            <TabsTrigger value="low" data-testid="tab-low-stock">Stock faible ({counts.low})</TabsTrigger>
            <TabsTrigger value="expired" data-testid="tab-expired">Périmés ({counts.expired})</TabsTrigger>
            <TabsTrigger value="soon" data-testid="tab-expiring">Expirent bientôt ({counts.soon})</TabsTrigger>
          </TabsList>
          <TabsContent value="out" className="mt-5"><TableOutOfStock items={data.out_of_stock || []} /></TabsContent>
          <TabsContent value="low" className="mt-5"><TableLowStock items={data.low_stock} /></TabsContent>
          <TabsContent value="expired" className="mt-5"><TableExpiry items={data.expired} expired /></TabsContent>
          <TabsContent value="soon" className="mt-5"><TableExpiry items={data.expiring_soon} /></TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
