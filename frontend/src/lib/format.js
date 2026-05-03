// Shared helpers
export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const formatEuro = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
};

export const daysUntil = (isoDate) => {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
};

export const productStatus = (product) => {
  const qty = product.quantity ?? 0;
  const min = product.min_threshold ?? 0;
  const d = daysUntil(product.expiry_date);
  // "Stock épuisé" est prioritaire sur toutes les autres alertes
  if (qty === 0) return { key: "out", label: "Stock épuisé", tone: "critical" };
  if (d !== null && d < 0) return { key: "expired", label: "Périmé", tone: "danger" };
  if (qty <= min) return { key: "low", label: "Stock faible", tone: "warning" };
  if (d !== null && d <= 60) return { key: "expiring", label: `Expire dans ${d}j`, tone: "warning" };
  return { key: "ok", label: "En stock", tone: "success" };
};
