"""
Opéra santé — Backend FastAPI + SQLite (100% local).

Un seul fichier de base SQLite, pas de MongoDB. Conçu pour tourner :
  - En preview Emergent (supervisor)
  - En local bureau via Electron (PyInstaller + spawn)

Usage local :
    uvicorn server:app --host 127.0.0.1 --port 8001

Le fichier de base est :
  - OPERA_DB_PATH si défini (utile pour Electron)
  - Sinon ~/.opera-sante/opera.db (Linux/Mac) ou %APPDATA%/opera-sante/opera.db (Windows)
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
import aiosqlite
import csv
import io
import os
import sys
import json
import uuid
import secrets
import logging
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, date, timedelta
from contextlib import asynccontextmanager


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


# ===================== DB path =====================
def default_db_path() -> Path:
    env = os.environ.get("OPERA_DB_PATH")
    if env:
        p = Path(env)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home())) / "opera-sante"
    else:
        base = Path.home() / ".opera-sante"
    base.mkdir(parents=True, exist_ok=True)
    return base / "opera.db"


DB_PATH = str(default_db_path())
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("opera")
logger.info(f"SQLite DB path: {DB_PATH}")


# ===================== Helpers =====================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def row_to_dict(row) -> dict:
    return {k: row[k] for k in row.keys()}


async def one(conn, sql: str, params=()) -> Optional[dict]:
    async with conn.execute(sql, params) as cur:
        row = await cur.fetchone()
        return row_to_dict(row) if row else None


async def many(conn, sql: str, params=()) -> List[dict]:
    async with conn.execute(sql, params) as cur:
        rows = await cur.fetchall()
        return [row_to_dict(r) for r in rows]


# ===================== Models (same shape as server.py) =====================
class Category(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    color: Optional[str] = "#059669"
    created_at: str = Field(default_factory=now_iso)


class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = "#059669"


class Supplier(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    contact_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)


class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    brand: Optional[str] = ""
    barcode: Optional[str] = ""
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    quantity: int = 0
    min_threshold: int = 5
    unit_price: float = 0.0
    expiry_date: Optional[str] = None
    description: Optional[str] = ""
    product_url: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = ""
    barcode: Optional[str] = ""
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    quantity: int = 0
    min_threshold: int = 5
    unit_price: float = 0.0
    expiry_date: Optional[str] = None
    description: Optional[str] = ""
    product_url: Optional[str] = ""


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[str] = None
    supplier_id: Optional[str] = None
    quantity: Optional[int] = None
    min_threshold: Optional[int] = None
    unit_price: Optional[float] = None
    expiry_date: Optional[str] = None
    description: Optional[str] = None
    product_url: Optional[str] = None


class Movement(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    product_name: str
    type: Literal["in", "out"]
    quantity: int
    reason: Optional[str] = ""
    note: Optional[str] = ""
    expiry_date: Optional[str] = None  # péremption du lot entrant (uniquement type="in")
    created_at: str = Field(default_factory=now_iso)


class MovementCreate(BaseModel):
    product_id: str
    type: Literal["in", "out"]
    quantity: int
    reason: Optional[str] = ""
    note: Optional[str] = ""
    expiry_date: Optional[str] = None


class ScanAction(BaseModel):
    barcode: str
    type: Literal["in", "out"] = "out"
    quantity: int = 1
    reason: Optional[str] = ""
    expiry_date: Optional[str] = None


# ===================== Schema =====================
SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#059669',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT DEFAULT '',
    barcode TEXT DEFAULT '',
    category_id TEXT,
    supplier_id TEXT,
    quantity INTEGER DEFAULT 0,
    min_threshold INTEGER DEFAULT 5,
    unit_price REAL DEFAULT 0.0,
    expiry_date TEXT,
    description TEXT DEFAULT '',
    product_url TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_barcode
    ON products(barcode) WHERE barcode != '';

CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    quantity INTEGER NOT NULL,
    reason TEXT DEFAULT '',
    note TEXT DEFAULT '',
    expiry_date TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON movements(created_at DESC);
"""


DENTAL_CATEGORIES = [
    {"name": "Anesthésie", "color": "#0891b2"},
    {"name": "Consommables", "color": "#059669"},
    {"name": "Instruments", "color": "#7c3aed"},
    {"name": "Hygiène", "color": "#d97706"},
    {"name": "Stérilisation", "color": "#0284c7"},
    {"name": "Implants", "color": "#be123c"},
    {"name": "Endodontie", "color": "#c026d3"},
    {"name": "Empreintes", "color": "#16a34a"},
    {"name": "Chirurgie", "color": "#dc2626"},
    {"name": "Composites / Soins", "color": "#2563eb"},
    {"name": "Orthodontie", "color": "#db2777"},
    {"name": "Prothèse", "color": "#b45309"},
    {"name": "Parodontie", "color": "#4d7c0f"},
    {"name": "Pédodontie", "color": "#ea580c"},
    {"name": "Radiologie", "color": "#475569"},
    {"name": "Blanchiment", "color": "#0ea5e9"},
    {"name": "Prévention", "color": "#0d9488"},
    {"name": "Rotatifs (fraises, limes)", "color": "#7e22ce"},
    {"name": "Ciments / Adhésifs", "color": "#a16207"},
    {"name": "Digues & Isolation", "color": "#65a30d"},
]


# ===================== DB connection helper =====================
@asynccontextmanager
async def get_db():
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    try:
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        yield conn
        await conn.commit()
    finally:
        await conn.close()


async def init_db():
    async with get_db() as conn:
        await conn.executescript(SCHEMA)
        # Auto-migration: add any missing columns on existing DBs so upgrades
        # from older versions don't lose data.
        await _migrate_schema(conn)
        # Seed dental categories if empty
        cur = await conn.execute("SELECT COUNT(*) AS c FROM categories")
        row = await cur.fetchone()
        if row[0] == 0:
            for cat in DENTAL_CATEGORIES:
                c = Category(**cat)
                await conn.execute(
                    "INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)",
                    (c.id, c.name, c.color, c.created_at),
                )
            logger.info(f"Seeded {len(DENTAL_CATEGORIES)} dental categories")
    logger.info("Database ready")


# Expected columns per table. When we add a new column in a future version,
# just add it here and the migration runs automatically.
EXPECTED_COLUMNS = {
    "products": {
        "brand": "TEXT DEFAULT ''",
        "product_url": "TEXT DEFAULT ''",
        # add future columns here
    },
    "movements": {
        "expiry_date": "TEXT",
        # add future columns here
    },
    "suppliers": {
        # add future columns here
    },
    "categories": {
        # add future columns here
    },
}


async def _migrate_schema(conn):
    """Apply idempotent column additions to upgrade older databases."""
    for table, cols in EXPECTED_COLUMNS.items():
        cur = await conn.execute(f"PRAGMA table_info({table})")
        existing = {row[1] for row in await cur.fetchall()}
        for col_name, col_def in cols.items():
            if col_name not in existing:
                try:
                    await conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
                    logger.info(f"Migration: added column {table}.{col_name}")
                except Exception as e:
                    logger.warning(f"Migration skipped {table}.{col_name}: {e}")


# ===================== App =====================
app = FastAPI(title="Opéra santé")
api_router = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    await init_db()


# ===================== Root =====================
@api_router.get("/")
async def root():
    return {"message": "Opéra santé API (SQLite)", "version": "1.0"}


# ===================== Categories =====================
@api_router.get("/categories", response_model=List[Category])
async def list_categories():
    async with get_db() as conn:
        return await many(conn, "SELECT * FROM categories ORDER BY name ASC")


@api_router.post("/categories", response_model=Category)
async def create_category(payload: CategoryCreate):
    cat = Category(**payload.model_dump())
    async with get_db() as conn:
        await conn.execute(
            "INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)",
            (cat.id, cat.name, cat.color, cat.created_at),
        )
    return cat


@api_router.put("/categories/{cat_id}", response_model=Category)
async def update_category(cat_id: str, payload: CategoryCreate):
    async with get_db() as conn:
        existing = await one(conn, "SELECT * FROM categories WHERE id = ?", (cat_id,))
        if not existing:
            raise HTTPException(404, "Catégorie introuvable")
        await conn.execute(
            "UPDATE categories SET name = ?, color = ? WHERE id = ?",
            (payload.name, payload.color, cat_id),
        )
        return Category(**{**existing, **payload.model_dump()})


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    async with get_db() as conn:
        cur = await conn.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Catégorie introuvable")
    return {"ok": True}


@api_router.post("/categories/seed-dental")
async def seed_dental_categories():
    added = []
    async with get_db() as conn:
        existing = {r["name"].lower() for r in await many(conn, "SELECT name FROM categories")}
        for cat in DENTAL_CATEGORIES:
            if cat["name"].lower() not in existing:
                c = Category(**cat)
                await conn.execute(
                    "INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)",
                    (c.id, c.name, c.color, c.created_at),
                )
                added.append(c.name)
    return {"added": added, "count": len(added)}


# ===================== Suppliers =====================
@api_router.get("/suppliers", response_model=List[Supplier])
async def list_suppliers():
    async with get_db() as conn:
        return await many(conn, "SELECT * FROM suppliers ORDER BY name ASC")


@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(payload: SupplierCreate):
    sup = Supplier(**payload.model_dump())
    async with get_db() as conn:
        await conn.execute(
            "INSERT INTO suppliers (id, name, contact_name, email, phone, address, notes, created_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (sup.id, sup.name, sup.contact_name, sup.email, sup.phone, sup.address, sup.notes, sup.created_at),
        )
    return sup


@api_router.put("/suppliers/{sup_id}", response_model=Supplier)
async def update_supplier(sup_id: str, payload: SupplierCreate):
    async with get_db() as conn:
        existing = await one(conn, "SELECT * FROM suppliers WHERE id = ?", (sup_id,))
        if not existing:
            raise HTTPException(404, "Fournisseur introuvable")
        d = payload.model_dump()
        await conn.execute(
            "UPDATE suppliers SET name=?, contact_name=?, email=?, phone=?, address=?, notes=? WHERE id=?",
            (d["name"], d["contact_name"], d["email"], d["phone"], d["address"], d["notes"], sup_id),
        )
        return Supplier(**{**existing, **d})


@api_router.delete("/suppliers/{sup_id}")
async def delete_supplier(sup_id: str):
    async with get_db() as conn:
        cur = await conn.execute("DELETE FROM suppliers WHERE id = ?", (sup_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Fournisseur introuvable")
    return {"ok": True}


# ===================== Products =====================
async def _compute_usage(conn, product_id: str, days: int = 30) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = await conn.execute(
        "SELECT COALESCE(SUM(quantity),0) AS total, COUNT(*) AS count "
        "FROM movements WHERE product_id=? AND type='out' AND created_at >= ?",
        (product_id, since),
    )
    row = await cur.fetchone()
    return {"total": row[0], "count": row[1], "days": days}


async def _enrich_with_usage(conn, product: dict) -> dict:
    u = await _compute_usage(conn, product["id"], 30)
    avg_daily = u["total"] / 30.0 if u["total"] else 0.0
    days_until_out = None
    if avg_daily > 0 and product.get("quantity", 0) > 0:
        days_until_out = int(product["quantity"] / avg_daily)
    product["avg_monthly_usage"] = round(u["total"], 1)
    product["avg_daily_usage"] = round(avg_daily, 2)
    product["days_until_out"] = days_until_out
    return product


@api_router.get("/products")
async def list_products(search: Optional[str] = None, category_id: Optional[str] = None, with_usage: bool = False):
    sql = "SELECT * FROM products WHERE 1=1"
    params = []
    if search:
        sql += " AND (LOWER(name) LIKE ? OR LOWER(barcode) LIKE ?)"
        params += [f"%{search.lower()}%", f"%{search.lower()}%"]
    if category_id:
        sql += " AND category_id = ?"
        params.append(category_id)
    sql += " ORDER BY name ASC"
    async with get_db() as conn:
        rows = await many(conn, sql, tuple(params))
        if with_usage:
            rows = [await _enrich_with_usage(conn, r) for r in rows]
        return rows


@api_router.get("/products/by-barcode/{barcode}", response_model=Product)
async def get_product_by_barcode(barcode: str):
    async with get_db() as conn:
        r = await one(conn, "SELECT * FROM products WHERE barcode = ?", (barcode,))
        if not r:
            raise HTTPException(404, "Produit introuvable")
        return r


@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    async with get_db() as conn:
        r = await one(conn, "SELECT * FROM products WHERE id = ?", (product_id,))
        if not r:
            raise HTTPException(404, "Produit introuvable")
        return r


def _product_cols():
    return ["id", "name", "brand", "barcode", "category_id", "supplier_id",
            "quantity", "min_threshold", "unit_price", "expiry_date",
            "description", "product_url", "created_at", "updated_at"]


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductCreate):
    prod = Product(**payload.model_dump())
    d = prod.model_dump()
    async with get_db() as conn:
        try:
            placeholders = ",".join(["?"] * len(_product_cols()))
            await conn.execute(
                f"INSERT INTO products ({','.join(_product_cols())}) VALUES ({placeholders})",
                tuple(d[c] for c in _product_cols()),
            )
        except aiosqlite.IntegrityError:
            raise HTTPException(400, "Ce code-barres est déjà utilisé par un autre produit")
    return prod


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductUpdate):
    async with get_db() as conn:
        existing = await one(conn, "SELECT * FROM products WHERE id = ?", (product_id,))
        if not existing:
            raise HTTPException(404, "Produit introuvable")
        updates = {k: v for k, v in payload.model_dump().items() if v is not None}
        updates["updated_at"] = now_iso()
        merged = {**existing, **updates}
        set_clause = ",".join([f"{k}=?" for k in updates.keys()])
        try:
            await conn.execute(
                f"UPDATE products SET {set_clause} WHERE id=?",
                tuple(list(updates.values()) + [product_id]),
            )
        except aiosqlite.IntegrityError:
            raise HTTPException(400, "Ce code-barres est déjà utilisé par un autre produit")
        return Product(**merged)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    async with get_db() as conn:
        cur = await conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Produit introuvable")
    return {"ok": True}


@api_router.post("/products/{product_id}/generate-barcode", response_model=Product)
async def generate_internal_barcode(product_id: str):
    async with get_db() as conn:
        existing = await one(conn, "SELECT * FROM products WHERE id = ?", (product_id,))
        if not existing:
            raise HTTPException(404, "Produit introuvable")
        if existing.get("barcode"):
            return existing
        for _ in range(20):
            candidate = "OS-" + secrets.token_hex(3).upper()
            clash = await one(conn, "SELECT id FROM products WHERE barcode = ?", (candidate,))
            if not clash:
                break
        else:
            raise HTTPException(500, "Impossible de générer un code-barres unique")
        await conn.execute(
            "UPDATE products SET barcode=?, updated_at=? WHERE id=?",
            (candidate, now_iso(), product_id),
        )
        return {**existing, "barcode": candidate, "updated_at": now_iso()}


# ===================== CSV Import =====================
CSV_HEADER_ALIASES = {
    "name": ["name", "nom", "produit", "designation", "désignation", "libelle", "libellé"],
    "brand": ["brand", "marque"],
    "barcode": ["barcode", "code_barres", "code-barres", "codebarre", "ean", "code"],
    "category": ["category", "categorie", "catégorie"],
    "supplier": ["supplier", "fournisseur"],
    "quantity": ["quantity", "stock", "quantite", "quantité", "qte", "qté"],
    "min_threshold": ["min_threshold", "seuil", "seuil_min", "alerte", "minimum"],
    "unit_price": ["unit_price", "prix", "prix_unitaire", "price"],
    "expiry_date": ["expiry_date", "peremption", "péremption", "date_peremption", "expiration"],
    "description": ["description", "desc", "notes"],
    "product_url": ["product_url", "url", "lien", "lien_produit", "supplier_url"],
}


def _normalize_header(h: str) -> str:
    return (h or "").strip().lower().replace(" ", "_")


def _build_header_map(fieldnames: List[str]) -> dict:
    out = {}
    for raw in fieldnames or []:
        norm = _normalize_header(raw)
        for field, aliases in CSV_HEADER_ALIASES.items():
            if norm in aliases:
                out[raw] = field
                break
    return out


def _parse_int_csv(v, default=None):
    if v is None or str(v).strip() == "":
        return default
    try:
        return int(float(str(v).replace(",", ".").strip()))
    except (ValueError, TypeError):
        return default


def _parse_float_csv(v, default=None):
    if v is None or str(v).strip() == "":
        return default
    try:
        return float(str(v).replace(",", ".").strip())
    except (ValueError, TypeError):
        return default


def _parse_date_csv(v):
    if not v or not str(v).strip():
        return None
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


@api_router.post("/products/import-csv")
async def import_products_csv(file: UploadFile = File(...)):
    """Import products from a CSV file (SQLite version).
    Same behaviour as the Mongo backend: auto-creates categories/suppliers,
    upserts on barcode match.
    """
    if not file.filename.lower().endswith((".csv", ".txt")):
        raise HTTPException(400, "Le fichier doit être un .csv")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        first_line = text.split("\n", 1)[0]
        candidates = [",", ";", "\t", "|"]
        delimiter = max(candidates, key=lambda d: first_line.count(d))
        if first_line.count(delimiter) == 0:
            delimiter = ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise HTTPException(400, "Le fichier CSV est vide ou invalide")

    header_map = _build_header_map(reader.fieldnames)
    if "name" not in header_map.values():
        raise HTTPException(400, "Colonne 'name' (ou 'nom') manquante dans le CSV")

    created = 0
    updated = 0
    errors = []

    async with get_db() as conn:
        cats = await many(conn, "SELECT * FROM categories")
        cat_by_name = {c["name"].strip().lower(): c["id"] for c in cats}
        sups = await many(conn, "SELECT * FROM suppliers")
        sup_by_name = {s["name"].strip().lower(): s["id"] for s in sups}

        for idx, row in enumerate(reader, start=2):
            try:
                mapped = {}
                for raw_h, field in header_map.items():
                    mapped[field] = (row.get(raw_h) or "").strip()

                # Silently skip completely empty rows (e.g. trailing newline)
                if not any(v for v in mapped.values()):
                    continue

                name = mapped.get("name", "").strip()
                if not name:
                    errors.append({"line": idx, "error": "Nom manquant"})
                    continue

                category_id = None
                cat_name = mapped.get("category", "").strip()
                if cat_name:
                    key = cat_name.lower()
                    if key in cat_by_name:
                        category_id = cat_by_name[key]
                    else:
                        new_cat = Category(name=cat_name)
                        await conn.execute(
                            "INSERT INTO categories (id, name, color, created_at) VALUES (?,?,?,?)",
                            (new_cat.id, new_cat.name, new_cat.color, new_cat.created_at),
                        )
                        cat_by_name[key] = new_cat.id
                        category_id = new_cat.id

                supplier_id = None
                sup_name = mapped.get("supplier", "").strip()
                if sup_name:
                    key = sup_name.lower()
                    if key in sup_by_name:
                        supplier_id = sup_by_name[key]
                    else:
                        new_sup = Supplier(name=sup_name)
                        await conn.execute(
                            "INSERT INTO suppliers (id, name, contact_name, email, phone, address, notes, created_at) "
                            "VALUES (?,?,?,?,?,?,?,?)",
                            (new_sup.id, new_sup.name, new_sup.contact_name, new_sup.email,
                             new_sup.phone, new_sup.address, new_sup.notes, new_sup.created_at),
                        )
                        sup_by_name[key] = new_sup.id
                        supplier_id = new_sup.id

                barcode = mapped.get("barcode", "").strip()
                quantity = _parse_int_csv(mapped.get("quantity"), default=0)
                min_threshold = _parse_int_csv(mapped.get("min_threshold"), default=5)
                unit_price = _parse_float_csv(mapped.get("unit_price"), default=0.0)
                expiry_date = _parse_date_csv(mapped.get("expiry_date"))

                existing = None
                if barcode:
                    existing = await one(conn, "SELECT * FROM products WHERE barcode = ?", (barcode,))

                if existing:
                    merged = {**existing}
                    merged["name"] = name
                    if mapped.get("brand"):
                        merged["brand"] = mapped["brand"]
                    if category_id:
                        merged["category_id"] = category_id
                    if supplier_id:
                        merged["supplier_id"] = supplier_id
                    if mapped.get("quantity") != "":
                        merged["quantity"] = quantity
                    if mapped.get("min_threshold") != "":
                        merged["min_threshold"] = min_threshold
                    if mapped.get("unit_price") != "":
                        merged["unit_price"] = unit_price
                    if expiry_date:
                        merged["expiry_date"] = expiry_date
                    if mapped.get("description"):
                        merged["description"] = mapped["description"]
                    if mapped.get("product_url"):
                        merged["product_url"] = mapped["product_url"]
                    merged["updated_at"] = now_iso()
                    await conn.execute(
                        "UPDATE products SET name=?, brand=?, category_id=?, supplier_id=?, "
                        "quantity=?, min_threshold=?, unit_price=?, expiry_date=?, "
                        "description=?, product_url=?, updated_at=? WHERE id=?",
                        (merged["name"], merged.get("brand", ""), merged.get("category_id"),
                         merged.get("supplier_id"), merged["quantity"], merged["min_threshold"],
                         merged["unit_price"], merged.get("expiry_date"),
                         merged.get("description", ""), merged.get("product_url", ""),
                         merged["updated_at"], existing["id"]),
                    )
                    updated += 1
                else:
                    prod = Product(
                        name=name,
                        brand=mapped.get("brand", ""),
                        barcode=barcode,
                        category_id=category_id,
                        supplier_id=supplier_id,
                        quantity=quantity,
                        min_threshold=min_threshold,
                        unit_price=unit_price,
                        expiry_date=expiry_date,
                        description=mapped.get("description", ""),
                        product_url=mapped.get("product_url", ""),
                    )
                    d = prod.model_dump()
                    try:
                        cols = ["id", "name", "brand", "barcode", "category_id", "supplier_id",
                                "quantity", "min_threshold", "unit_price", "expiry_date",
                                "description", "product_url", "created_at", "updated_at"]
                        placeholders = ",".join(["?"] * len(cols))
                        await conn.execute(
                            f"INSERT INTO products ({','.join(cols)}) VALUES ({placeholders})",
                            tuple(d[c] for c in cols),
                        )
                        created += 1
                    except aiosqlite.IntegrityError:
                        errors.append({"line": idx, "error": f"Code-barres '{barcode}' déjà utilisé"})
            except Exception as e:
                errors.append({"line": idx, "error": str(e)})

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "total_processed": created + updated + len(errors),
    }


# ===================== Movements =====================
@api_router.get("/movements", response_model=List[Movement])
async def list_movements(limit: int = 200, product_id: Optional[str] = None):
    sql = "SELECT * FROM movements"
    params = []
    if product_id:
        sql += " WHERE product_id = ?"
        params.append(product_id)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    async with get_db() as conn:
        return await many(conn, sql, tuple(params))


@api_router.post("/movements", response_model=Movement)
async def create_movement(payload: MovementCreate):
    async with get_db() as conn:
        prod = await one(conn, "SELECT * FROM products WHERE id = ?", (payload.product_id,))
        if not prod:
            raise HTTPException(404, "Produit introuvable")
        new_qty = prod["quantity"] + payload.quantity if payload.type == "in" else prod["quantity"] - payload.quantity
        if new_qty < 0:
            raise HTTPException(400, "Stock insuffisant")

        # FEFO : si entrée avec une péremption, on remplace la péremption du produit
        # uniquement si la nouvelle date est plus proche que l'actuelle (ou s'il n'y en a pas).
        new_expiry_for_product = prod.get("expiry_date")
        lot_expiry = payload.expiry_date if payload.type == "in" else None
        if lot_expiry and (not prod.get("expiry_date") or lot_expiry < prod["expiry_date"]):
            new_expiry_for_product = lot_expiry

        await conn.execute(
            "UPDATE products SET quantity=?, expiry_date=?, updated_at=? WHERE id=?",
            (new_qty, new_expiry_for_product, now_iso(), payload.product_id),
        )
        mov = Movement(
            product_id=payload.product_id, product_name=prod["name"],
            type=payload.type, quantity=payload.quantity,
            reason=payload.reason or "", note=payload.note or "",
            expiry_date=lot_expiry,
        )
        await conn.execute(
            "INSERT INTO movements (id, product_id, product_name, type, quantity, reason, note, expiry_date, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (mov.id, mov.product_id, mov.product_name, mov.type, mov.quantity,
             mov.reason, mov.note, mov.expiry_date, mov.created_at),
        )
    return mov


@api_router.post("/scan")
async def scan_action(payload: ScanAction):
    async with get_db() as conn:
        prod = await one(conn, "SELECT * FROM products WHERE barcode = ?", (payload.barcode,))
        if not prod:
            raise HTTPException(404, "Produit introuvable pour ce code-barres")
        new_qty = prod["quantity"] + payload.quantity if payload.type == "in" else prod["quantity"] - payload.quantity
        if new_qty < 0:
            raise HTTPException(400, "Stock insuffisant")

        # FEFO : si scan d'entrée avec une péremption, on remplace la péremption du produit
        # uniquement si la nouvelle date est plus proche que l'actuelle (ou s'il n'y en a pas).
        new_expiry_for_product = prod.get("expiry_date")
        lot_expiry = payload.expiry_date if payload.type == "in" else None
        if lot_expiry and (not prod.get("expiry_date") or lot_expiry < prod["expiry_date"]):
            new_expiry_for_product = lot_expiry

        await conn.execute(
            "UPDATE products SET quantity=?, expiry_date=?, updated_at=? WHERE id=?",
            (new_qty, new_expiry_for_product, now_iso(), prod["id"]),
        )
        mov = Movement(
            product_id=prod["id"], product_name=prod["name"],
            type=payload.type, quantity=payload.quantity,
            reason=payload.reason or ("Scan entrée" if payload.type == "in" else "Scan sortie"),
            expiry_date=lot_expiry,
        )
        await conn.execute(
            "INSERT INTO movements (id, product_id, product_name, type, quantity, reason, note, expiry_date, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (mov.id, mov.product_id, mov.product_name, mov.type, mov.quantity, mov.reason, mov.note, mov.expiry_date, mov.created_at),
        )
        updated_product = {**prod, "quantity": new_qty, "expiry_date": new_expiry_for_product}
        return {"movement": mov.model_dump(), "product": updated_product}


# ===================== Reorder =====================
@api_router.get("/reorder/suggestions")
async def reorder_suggestions():
    async with get_db() as conn:
        products = await many(conn, "SELECT * FROM products")
        suppliers = {s["id"]: s for s in await many(conn, "SELECT * FROM suppliers")}
        groups = {}
        standalone = []
        for p in products:
            qty = p.get("quantity", 0)
            min_t = p.get("min_threshold", 0)
            if qty > min_t:
                continue
            enr = await _enrich_with_usage(conn, dict(p))
            monthly = enr.get("avg_monthly_usage", 0) or 0
            # Quantité suggérée = (seuil x 2) - stock actuel
            # Permet de commander assez pour avoir le double du seuil en stock,
            # pour éviter de recommander trop souvent.
            suggested = max(1, (min_t * 2) - qty)
            item = {
                "product_id": enr["id"], "product_name": enr["name"],
                "quantity": suggested, "unit_price": enr.get("unit_price", 0.0),
                "current_quantity": qty, "min_threshold": min_t,
                "monthly_usage": monthly, "barcode": enr.get("barcode", ""),
                "product_url": enr.get("product_url", ""),
            }
            sid = enr.get("supplier_id")
            if sid and sid in suppliers:
                if sid not in groups:
                    groups[sid] = {"supplier_id": sid, "supplier_name": suppliers[sid]["name"], "items": [], "total": 0.0}
                groups[sid]["items"].append(item)
                groups[sid]["total"] += item["quantity"] * item["unit_price"]
            else:
                standalone.append(item)
        result = list(groups.values())
        for g in result:
            g["total"] = round(g["total"], 2)
            # Trier les produits : épuisés (qty=0) en haut, puis stock faible par quantité croissante.
            g["items"].sort(key=lambda it: it["current_quantity"])
        # Idem pour les produits sans fournisseur.
        standalone.sort(key=lambda it: it["current_quantity"])
        result.sort(key=lambda g: -len(g["items"]))
        return {
            "groups": result, "unassigned": standalone,
            "total_items": sum(len(g["items"]) for g in result) + len(standalone),
        }


# ===================== Alerts =====================
@api_router.get("/alerts")
async def get_alerts(expiry_days: int = 60):
    today = date.today().isoformat()
    threshold = (date.today() + timedelta(days=expiry_days)).isoformat()
    async with get_db() as conn:
        products = await many(conn, "SELECT * FROM products")
        # "Stock épuisé" : quantité exactement 0
        out_of_stock = [p for p in products if p.get("quantity", 0) == 0]
        # "Stock faible" : stock > 0 mais <= seuil (exclusion mutuelle avec épuisé)
        low_stock = [
            p for p in products
            if p.get("quantity", 0) > 0 and p.get("quantity", 0) <= p.get("min_threshold", 0)
        ]
        expired = [p for p in products if p.get("expiry_date") and p["expiry_date"] < today]
        expiring_soon = [p for p in products if p.get("expiry_date") and today <= p["expiry_date"] <= threshold]
        return {
            "out_of_stock": out_of_stock,
            "low_stock": low_stock,
            "expired": expired,
            "expiring_soon": expiring_soon,
        }


# ===================== Dashboard =====================
@api_router.get("/dashboard/stats")
async def dashboard_stats():
    async with get_db() as conn:
        total_products = (await one(conn, "SELECT COUNT(*) AS c FROM products"))["c"]
        total_suppliers = (await one(conn, "SELECT COUNT(*) AS c FROM suppliers"))["c"]
        total_categories = (await one(conn, "SELECT COUNT(*) AS c FROM categories"))["c"]
        products = await many(conn, "SELECT * FROM products")
        today = date.today().isoformat()
        soon = (date.today() + timedelta(days=60)).isoformat()
        low_stock_count = sum(
            1 for p in products
            if p.get("quantity", 0) > 0 and p.get("quantity", 0) <= p.get("min_threshold", 0)
        )
        out_of_stock_count = sum(1 for p in products if p.get("quantity", 0) == 0)
        expired_count = sum(1 for p in products if p.get("expiry_date") and p["expiry_date"] < today)
        expiring_soon_count = sum(1 for p in products if p.get("expiry_date") and today <= p["expiry_date"] <= soon)
        total_stock_value = sum(p.get("quantity", 0) * p.get("unit_price", 0.0) for p in products)
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        top_consumed = await many(
            conn,
            "SELECT product_id, product_name AS name, SUM(quantity) AS total "
            "FROM movements WHERE type='out' AND created_at >= ? "
            "GROUP BY product_id ORDER BY total DESC LIMIT 5",
            (since,),
        )
        recent_movements = await many(
            conn, "SELECT * FROM movements ORDER BY created_at DESC LIMIT 8"
        )
        reorder_count = low_stock_count + out_of_stock_count
        return {
            "total_products": total_products, "total_suppliers": total_suppliers,
            "total_categories": total_categories, "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "expired_count": expired_count, "expiring_soon_count": expiring_soon_count,
            "total_stock_value": round(total_stock_value, 2),
            "pending_orders": 0, "reorder_count": reorder_count,
            "top_consumed": top_consumed, "recent_movements": recent_movements,
        }


# ===================== Backup / Restore =====================
from fastapi.responses import FileResponse


@api_router.get("/backup")
async def backup_db():
    """Télécharge le fichier SQLite complet pour sauvegarde."""
    filename = f"opera-sante-backup-{date.today().isoformat()}.db"
    return FileResponse(DB_PATH, media_type="application/octet-stream", filename=filename)


@api_router.post("/restore")
async def restore_db(file: UploadFile = File(...)):
    """Remplace la base actuelle par le fichier uploadé. Nécessite un redémarrage du backend."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Fichier vide")
    # Write to a temp then atomically replace
    tmp = DB_PATH + ".restore"
    with open(tmp, "wb") as f:
        f.write(content)
    os.replace(tmp, DB_PATH)
    return {"ok": True, "message": "Base restaurée. Redémarrez l'application pour finaliser."}


# ===================== Admin / Reset =====================
@api_router.post("/admin/reset-inventory")
async def reset_inventory():
    """Supprime tous les produits et mouvements. Conserve catégories et fournisseurs.
    Équivalent à une installation fraîche côté inventaire."""
    async with get_db() as conn:
        await conn.execute("DELETE FROM movements")
        await conn.execute("DELETE FROM products")
        deleted_products = (await one(conn, "SELECT COUNT(*) AS c FROM products"))["c"]
        deleted_movements = (await one(conn, "SELECT COUNT(*) AS c FROM movements"))["c"]
    logger.info("Inventory reset")
    return {
        "ok": True,
        "message": "Inventaire réinitialisé",
        "remaining_products": deleted_products,
        "remaining_movements": deleted_movements,
    }


@api_router.post("/admin/reset-statistics")
async def reset_statistics():
    """Supprime uniquement l'historique des mouvements. Les produits et leur stock actuel
    sont conservés. Utile pour repartir d'une page blanche statistique."""
    async with get_db() as conn:
        await conn.execute("DELETE FROM movements")
    logger.info("Statistics (movements history) reset")
    return {"ok": True, "message": "Historique des mouvements supprimé"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=False)
