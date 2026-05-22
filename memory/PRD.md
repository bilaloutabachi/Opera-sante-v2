# Opéra santé — PRD

## Architecture (intangible)
Backend FastAPI + SQLite local · Frontend React/CRA · Desktop Electron + PyInstaller.
**Interdit** : `electron/main.js`, `electron/package.json`, PyInstaller spec, structure dossiers.

## Features livrées
### v1 — Alerte "Stock épuisé" (rouge foncé bg-red-800)
- `out_of_stock` exclusif de `low_stock` (qty=0 ≠ qty>0&&qty≤seuil)
- Priorité badge : out > expired > low > expiring

### v2 — Suggestion de réapprovisionnement
- Formule `suggested = max(1, (min_threshold * 2) - quantity)`
- Lit dynamiquement le seuil de chaque produit

### v3 — Péremption sur entrée (FEFO) — Mouvements
- `MovementCreate.expiry_date` + colonne `movements.expiry_date`
- Update produit uniquement si nouvelle date plus proche
- Dialogue dans Inventaire + ManualMovementDialog + colonne dans Mouvements

### v4 — Page Paramètres
- Route `/parametres` + nav sidebar
- BackupCard déplacé du Dashboard
- Endpoints `POST /api/admin/reset-inventory` et `POST /api/admin/reset-statistics`
- Popups de confirmation explicites

### v5 — Scanner avec péremption FEFO (NEW)
**Backend** :
- `ScanAction.expiry_date: Optional[str]`
- `/api/scan` applique FEFO comme `/api/movements` : update produit uniquement si plus proche
- Movement enregistré avec sa date de lot

**Frontend `Scanner.jsx`** :
- État `expiryDate` persistant entre scans (l'utilisateur peut scanner plusieurs articles d'un même lot sans re-saisir)
- Champ `type="date"` affiché uniquement en mode "Entrée" (`isIn && ...`)
- Bouton "Effacer" pour vider la date
- Date envoyée au backend uniquement si mode="in" ET date renseignée

### v6 — Tri automatique "À commander" (NEW)
**Backend `/api/reorder/suggestions`** :
- `items.sort(key=lambda it: it["current_quantity"])` dans chaque groupe fournisseur
- Idem pour `unassigned` (produits sans fournisseur)
- Produits épuisés (qty=0) systématiquement en haut, puis stock faible par quantité croissante
- Aucun badge ajouté, juste l'ordre

## Tests validés
- FEFO scan : 4 cas (remplacement, non-remplacement, sans date, sortie ignorée) ✅
- Tri reorder : qty=0 → 2 → 5 dans l'ordre attendu ✅
- Lint Python + JS : 0 issue ✅

## Procédure de déploiement sur PC
```bash
git pull
COMPILER_OPERA_SANTE.bat  # rebuild PyInstaller + frontend → electron/*-dist/
```

## Backlog
- Multi-lots : afficher la liste des dates de péremption par lot dans la fiche produit
- Suggestion "URGENT" textuelle (sans badge) sur les produits épuisés
