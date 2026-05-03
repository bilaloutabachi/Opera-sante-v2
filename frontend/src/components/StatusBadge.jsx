import { Badge } from "./ui/badge";
import { productStatus } from "../lib/format";

const TONES = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  warning: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50",
  danger: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50",
  critical: "bg-stone-900 text-rose-100 border-2 border-rose-700 hover:bg-stone-900 font-bold uppercase tracking-wider",
  neutral: "bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-100",
};

export function StatusBadge({ product }) {
  const { label, tone } = productStatus(product);
  return (
    <Badge variant="outline" className={`font-medium ${TONES[tone] || TONES.neutral}`} data-testid="status-badge">
      {label}
    </Badge>
  );
}

export function ToneBadge({ tone = "neutral", children, ...props }) {
  return (
    <Badge variant="outline" className={`font-medium ${TONES[tone]}`} {...props}>
      {children}
    </Badge>
  );
}
