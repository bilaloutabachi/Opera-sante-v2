# Opéra santé — Guide de packaging local (Electron)

Ce guide explique comment transformer l'application web en **logiciel de bureau**
installable sur un ordinateur, fonctionnant **100% hors ligne** et conservant les
données entre chaque utilisation.

---

## 🎯 Ce que vous obtiendrez

- Un installeur `OperaSante-Setup-1.0.0.exe` (Windows) ou `OperaSante-1.0.0.dmg` (Mac)
- Double-clic → installation → icône sur le bureau → double-clic → ça s'ouvre
- Aucune connexion internet requise après installation
- Toutes les modifications sont **automatiquement sauvegardées** dans un fichier
  `opera.db` stocké dans le profil utilisateur :
  - **Windows** : `C:\Users\<vous>\AppData\Roaming\opera-sante\opera.db`
  - **Mac** : `~/Library/Application Support/opera-sante/opera.db`
- Menu intégré : **Fichier → Sauvegarder la base / Restaurer une sauvegarde**

---

## 📋 Pré-requis (à installer une seule fois sur l'ordinateur qui fera le build)

| Outil | Windows | Mac |
|---|---|---|
| **Python 3.11+** | [python.org](https://www.python.org/downloads/) (cochez "Add Python to PATH") | `brew install python@3.11` |
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) | `brew install node` |
| **Yarn** | `npm install -g yarn` | `npm install -g yarn` |
| **PyInstaller** | `pip install pyinstaller` | `pip install pyinstaller` |

---

## 🏗️ Étapes de build

Les commandes se lancent depuis le **dossier racine du projet** (celui contenant `backend/`, `frontend/`, `electron/`).

### 1. Bundler le backend Python en exécutable

```bash
cd backend
pip install -r requirements.txt
pyinstaller --onefile --name opera-backend --hidden-import aiosqlite server.py
```

→ produit `backend/dist/opera-backend.exe` (Windows) ou `backend/dist/opera-backend` (Mac/Linux).

### 2. Builder le frontend React

Configurer d'abord `frontend/.env.production` :

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8001
```

Puis :

```bash
cd ../frontend
yarn install
yarn build
```

→ produit `frontend/build/` (fichiers statiques).

### 3. Préparer le dossier electron

```bash
cd ../electron

# Copier le backend compilé
mkdir -p backend-dist
cp ../backend/dist/opera-backend* backend-dist/

# Copier le frontend buildé
rm -rf frontend-dist
cp -r ../frontend/build frontend-dist

# Installer les dépendances Electron
yarn install
```

### 4. Tester en mode dev (optionnel mais recommandé)

```bash
# Dans un terminal, lancez le backend :
cd ../backend && python3 server.py

# Dans un autre terminal, le frontend en dev :
cd frontend && yarn start

# Dans un troisième terminal, Electron :
cd electron && yarn dev
```

L'application doit s'ouvrir. Créez un produit de test, fermez tout, relancez — le produit doit être là.

### 5. Générer l'installeur final

```bash
# Windows (à lancer sur Windows)
cd electron
yarn build:win

# Mac (à lancer sur Mac)
yarn build:mac

# Linux
yarn build:linux
```

→ L'installeur est dans `electron/dist/OperaSante-Setup-1.0.0.exe` (Windows) ou `electron/dist/OperaSante-1.0.0.dmg` (Mac).

### 6. Installation sur l'ordi du cabinet

Copiez l'installeur sur une clé USB, transférez-le sur l'ordinateur du cabinet,
double-cliquez dessus — c'est fini. Pas d'internet requis.

---

## 💾 Sauvegardes

### Sauvegarde manuelle (recommandé : 1× par mois minimum)

Dans l'app : **Menu → Fichier → Sauvegarder la base** → choisissez un emplacement
(clé USB, Google Drive, Dropbox...). Le fichier `.db` fait quelques Mo max.

### Restauration

**Menu → Fichier → Restaurer une sauvegarde** → choisissez le fichier `.db`.
L'app redémarre automatiquement.

### Emplacement du fichier en direct

Si besoin de copier manuellement :
- **Windows** : `%APPDATA%\opera-sante\opera.db`
- **Mac** : `~/Library/Application Support/opera-sante/opera.db`
- **Linux** : `~/.config/opera-sante/opera.db`

---

## 🔧 Dépannage

### "Le serveur interne s'est arrêté"
- Vérifiez qu'aucune autre application n'utilise le port 8001
  (Windows : `netstat -ano | findstr :8001`)
- Vérifiez les logs dans la console (Aide → Outils développeur en mode dev)

### Le frontend affiche "Network Error"
- Le backend met ~2 sec à démarrer au lancement de l'app
- Le port 8001 est-il bloqué par un firewall ? Autorisez l'application
- Vérifier que `frontend/.env.production` pointe bien sur `http://127.0.0.1:8001`

### PyInstaller : "Failed to collect aiosqlite"
- Ajouter `--hidden-import aiosqlite` (déjà dans la commande ci-dessus)
- Sur Mac/Linux : vérifier que `python3 -c "import aiosqlite"` fonctionne

---

## 🔄 Mise à jour d'une version déjà installée

**Points clés :**
- Vos données (`opera.db`) sont stockées dans `%APPDATA%\opera-sante\` (Windows) ou
  `~/Library/Application Support/opera-sante/` (Mac) — **PAS** dans le dossier
  d'installation. **Les mises à jour ne touchent jamais à vos données.**
- Le backend détecte automatiquement les nouveaux champs ajoutés par une mise à
  jour et migre la base (ajoute les colonnes manquantes) — rien à faire de votre côté.

**Procédure recommandée :**

1. **Sur l'ordi du cabinet, avant toute mise à jour :**
   - Dans l'app : **Menu → Fichier → Sauvegarder la base** → copie sur clé USB.
   - C'est votre filet de sécurité.

2. **Côté build (sur votre ordi de dev) :**
   - Modifiez le code comme d'habitude.
   - Si vous ajoutez de nouveaux champs dans `Product` / etc., ajoutez-les
     également dans `EXPECTED_COLUMNS` de `server.py` pour que la
     migration automatique se fasse.
   - Bumpez la version dans `electron/package.json` (ex: `"version": "1.0.0"` → `"1.1.0"`).
   - Rebuild : `yarn build:win` (ou mac/linux).

3. **Sur l'ordi du cabinet :**
   - Copiez le nouvel installeur via clé USB ou réseau.
   - Double-clic → l'installeur détecte l'ancienne version, propose la mise à jour,
     écrase le code, garde vos données.
   - Lancez l'app → vos produits/fournisseurs/mouvements sont tous là, avec les
     nouvelles fonctionnalités.

4. **Si quelque chose cloche :**
   - Menu → Fichier → Restaurer une sauvegarde → pointez sur la sauvegarde
     faite à l'étape 1 → l'app redémarre avec l'état d'avant.

**Règle d'or** : ne JAMAIS supprimer manuellement le dossier `opera-sante` dans
`%APPDATA%`. Sans sauvegarde, vous perdriez tout.

---


- **Signature du code** (Windows) : pour éviter l'alerte "Éditeur inconnu" au lancement
  → acheter un certificat de signature de code (~100-300€/an)
- **Signature Apple** (Mac) : requiert un Apple Developer ID (~99$/an)
- **Pour un usage interne**, pas besoin de signer — l'avertissement Windows disparaît
  après la 1re exécution (SmartScreen).

---

## 🔐 Pour aller plus loin

- **Signature du code** (Windows) : pour éviter l'alerte "Éditeur inconnu" au lancement
  → acheter un certificat de signature de code (~100-300€/an)
- **Signature Apple** (Mac) : requiert un Apple Developer ID (~99$/an)
- **Pour un usage interne**, pas besoin de signer — l'avertissement Windows disparaît
  après la 1re exécution (SmartScreen).

---

## 📦 Récapitulatif de la structure

```
opera-sante/
├── backend/
│   ├── server.py          ← FastAPI + SQLite (unique backend)
│   └── requirements.txt
├── frontend/              ← React app
├── electron/
│   ├── main.js            ← Lance le backend + crée la fenêtre
│   ├── preload.js
│   ├── package.json
│   └── (après build):
│       ├── backend-dist/  ← Exécutable Python compilé
│       └── frontend-dist/ ← React buildé
└── PACKAGING.md           ← ce fichier
```

---

**Besoin d'aide pour un build qui coince ?** N'hésitez pas — ou confiez le build à
un développeur freelance qui fera tout ça en ~2-3 h.
