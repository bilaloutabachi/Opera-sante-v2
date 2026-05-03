# Opéra santé — PRD

## Problem Statement
App de gestion de stock pour cabinet dentaire (100% locale, Electron + PyInstaller + SQLite).
Ajout d'une alerte **"Stock épuisé"** pour les produits dont la quantité = 0, avec couleur
distincte (rouge foncé) pour bien la différencier de "Stock faible" (qty > 0).

## Architecture (inchangée)
- Backend : FastAPI + SQLite (local, fichier unique `opera.db`)
- Frontend : React + CRA + Tailwind
- Desktop : Electron + PyInstaller spawn du backend
- **Interdit de toucher** : `electron/main.js`, `electron/package.json`, PyInstaller, structure dossiers

## Alertes existantes + nouvelle
- Stock faible (qty > 0 ET qty <= seuil) — ambre
- Périmé (date dépassée) — rose
- Périmé bientôt (<= 60 j) — ambre
- **[NOUVEAU] Stock épuisé (qty === 0)** — noir + bordure rouge foncé (#450a0a / red-950)

## Règles métier
- Exclusion mutuelle : un produit à qty=0 apparaît UNIQUEMENT dans `out_of_stock`, jamais dans `low_stock`
- Priorité d'affichage du badge : `out` > `expired` > `low` > `expiring` > `ok`
- Un produit épuisé ET périmé → badge "Stock épuisé" (prioritaire) ET figure aussi dans l'onglet "Périmés"
- `reorder_count` du dashboard inclut désormais `low_stock_count + out_of_stock_count`

## Ce qui a été implémenté (2026-01)
### Backend (`backend/server.py`)
- `/api/alerts` retourne `out_of_stock` + `low_stock` (mutuellement exclusifs)
- `/api/dashboard/stats` retourne `out_of_stock_count`

### Frontend
- `lib/format.js` : `productStatus` ; `out` prioritaire, nouveau `tone: "critical"`, label "Stock épuisé"
- `components/StatusBadge.jsx` : tone `critical` (noir + bordure rouge + uppercase tracking)
- `index.css` : classe `.row-out-of-stock` (bg red-950, texte red-100, border-left red-800)
- `pages/Alerts.jsx` : 4ème carte résumé + 4ème onglet "Stock épuisé" (actif par défaut si count > 0)
- `pages/Dashboard.jsx` : nouvelle StatPill "Stock épuisé" (tone critical), grid 4 colonnes
- `pages/Inventory.jsx` : ligne `row-out-of-stock` + stripe rouge foncé pour produits épuisés ;
  option du filtre `status=out` libellée "Stock épuisé"

## Tests effectués
- Backend curl : création produits (qty=0 / qty=3 / qty=50 / qty=0+périmé), alerts & dashboard OK
- Frontend screenshots : Dashboard (stat card noir), Alerts (onglet + table), Inventory (lignes rouge foncé, badges)
- Lint Python (ruff) + JS (eslint) : 0 issue

## Next Action Items
- Aucun — feature complète selon demande utilisateur

## Backlog (P2)
- [Idée] Sur la page "À commander", regrouper en tête les produits **épuisés** (urgence max) avant les "stock faible"
