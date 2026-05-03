import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ScanLine,
  Package,
  ArrowLeftRight,
  Truck,
  AlertTriangle,
  Tag,
  ShoppingCart,
  Building2,
  QrCode,
} from "lucide-react";
import { Toaster } from "../components/ui/sonner";

const NAV_MAIN = [
  { to: "/", label: "Accueil", icon: LayoutDashboard, end: true },
  { to: "/scanner", label: "Scanner", icon: ScanLine, kbd: "S" },
  { to: "/inventaire", label: "Inventaire", icon: Package, kbd: "I" },
  { to: "/commander", label: "À commander", icon: ShoppingCart, kbd: "C" },
];

const NAV_SECONDARY = [
  { to: "/mouvements", label: "Mouvements", icon: ArrowLeftRight },
  { to: "/etiquettes", label: "Étiquettes", icon: QrCode },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck },
  { to: "/categories", label: "Catégories", icon: Tag },
  { to: "/alertes", label: "Alertes", icon: AlertTriangle },
];

const ALL_NAV = [...NAV_MAIN, ...NAV_SECONDARY];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = ALL_NAV.find((n) => (n.end ? n.to === location.pathname : location.pathname.startsWith(n.to)));

  // Global hotkeys: S, I, C to navigate quickly. Ignored if typing in input/textarea.
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      const typing =
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = (e.key || "").toLowerCase();
      const map = { s: "/scanner", i: "/inventaire", c: "/commander", a: "/" };
      if (map[key]) {
        e.preventDefault();
        navigate(map[key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div className="min-h-screen flex bg-stone-50" data-testid="app-layout">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-stone-200 flex flex-col sticky top-0 h-screen">
        <Link to="/" className="px-5 py-5 border-b border-stone-200 block hover:bg-stone-50 transition-colors" data-testid="brand-home-link" title="Retour à l'accueil">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <div className="font-heading font-extrabold text-lg text-stone-900 leading-none">Opéra santé</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 mt-1">Cabinet dentaire</div>
            </div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Principal</div>
          {NAV_MAIN.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.to === "/" ? "dashboard" : item.to.slice(1)}`}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.kbd && (
                <kbd className="hidden md:inline text-[10px] font-semibold text-stone-400 bg-stone-100 border border-stone-200 rounded px-1.5 py-0.5">{item.kbd}</kbd>
              )}
            </NavLink>
          ))}

          <div className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Gestion</div>
          {NAV_SECONDARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={`nav-${item.to.slice(1)}`}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-stone-200 text-[11px] text-stone-400">
          <div className="font-semibold text-stone-500">Opéra santé</div>
          <div>v1.0 · Application locale</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">Opéra santé</div>
              <h1 className="font-heading text-2xl font-bold text-stone-900 mt-0.5" data-testid="page-title">
                {current?.label ?? "Accueil"}
              </h1>
            </div>
            <div className="text-sm text-stone-500 capitalize">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-x-auto" data-testid="page-main">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
