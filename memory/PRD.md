# Opéra santé — PRD

## Architecture (inchangée, intangible)
- Backend : FastAPI + SQLite (fichier `~/.opera-sante/opera.db` ou `%APPDATA%/opera-sante/opera.db`)
- Frontend : React + CRA + Tailwind (HashRouter)
- Desktop : Electron + PyInstaller spawn du backend
- **NE PAS toucher** : `electron/main.js`, `electron/package.json`, PyInstaller spec, structure dossiers

## Features livrées
### v1 — Alerte "Stock épuisé"
- Backend `/api/alerts` + `/api/dashboard/stats` : `out_of_stock` + `out_of_stock_count`, exclusion mutuelle avec `low_stock`
- Badge "STOCK ÉPUISÉ" rouge foncé `bg-red-800` + ligne `row-out-of-stock`
- Affiché sur Dashboard, Alertes, Inventaire
- Priorité d'affichage : `out` > `expired` > `low` > `expiring`

### v2 — Suggestion de réapprovisionnement
- Formule simplifiée `suggested = max(1, (min_threshold * 2) - quantity)`
- Lit dynamiquement le seuil de chaque produit
- Localisation : `backend/server.py` ligne 899

### v3 — Date de péremption sur entrée de stock (FEFO)
**Backend** :
- `Movement` + `MovementCreate` : champ optionnel `expiry_date`
- Colonne `movements.expiry_date` (auto-migration + SCHEMA pour nouvelles bases)
- `POST /api/movements` : si type="in" et `expiry_date` fourni, met à jour la péremption du produit
  **uniquement si plus proche que l'actuelle** (logique FEFO – First Expired First Out)
- Le lot expiry est enregistré dans l'historique (pas écrasé)

**Frontend** :
- `ManualMovementDialog.jsx` + dialogue Mouvement dans `Inventory.jsx` : input `type="date"` optionnel
  affiché uniquement pour les entrées (`type="in"`)
- `Movements.jsx` : nouvelle colonne "Péremption lot" affichant `m.expiry_date`

### v4 — Page Paramètres avec réinitialisation
**Backend** : 2 nouveaux endpoints
- `POST /api/admin/reset-inventory` → supprime tous les produits + mouvements (garde catégories + fournisseurs)
- `POST /api/admin/reset-statistics` → supprime uniquement les mouvements (historique + stats)

**Frontend** :
- Nouvelle page `pages/Settings.jsx` + route `/parametres`
- Item sidebar "Paramètres" (icône Settings) dans `NAV_SECONDARY`
- `BackupCard` déplacé du Dashboard vers Settings (regroupement logique)
- "Zone de danger" avec 2 cartes (rose + ambre) et popups de confirmation détaillées
  listant explicitement ce qui sera supprimé

## Tests effectués
- **FEFO** : 4 cas couverts (remplacement, non-remplacement, pas de date, historique) → ✅
- **Reset endpoints** : statistics garde produits/categories/suppliers, inventory garde catégories/suppliers → ✅
- **Lint** Python (ruff) + JS (eslint) : 0 issue
- **Visuel** : screenshots Settings, Mouvements OK

## Procédure utilisateur après `git pull`
```bash
cd backend && pyinstaller opera-backend.spec
cp dist/opera-backend.exe ../electron/backend-dist/
cd ../frontend && yarn build && rm -rf ../electron/frontend-dist && cp -r build ../electron/frontend-dist
cd ../electron && npm start
```
Ou simplement lancer `COMPILER_OPERA_SANTE.bat`.

## Backlog
- Sur "À commander", trier les produits **épuisés** en tête (urgence > stock faible)
- Affichage groupé par lot (FIFO multi-lots) pour les produits avec plusieurs dates de péremption
