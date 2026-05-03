"""Iteration 4 backend tests — final verification before Electron packaging.

Covers:
  - / → 'Opéra santé API'
  - /api/seed → removed (404/405)
  - unique barcode index (create + update)
  - /categories/seed-dental idempotent, 20 categories
  - full CRUD suppliers + products with new fields
  - /products/{id}/generate-barcode (OS-XXXXXX, idempotent)
  - /products?with_usage=true fields
  - /scan + /movements flow
  - /reorder/suggestions rule (qty <= min_threshold)
  - /dashboard/stats fields
  - /alerts structure

All test-created resources are cleaned up in teardown.
"""
import os
import pytest
import requests

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


def _wipe_test_data():
    """Wipe ALL TEST_* records directly in SQLite. Targets the live DB used by
    the running server (not whatever OPERA_DB_PATH was last set to by another test)."""
    import sqlite3
    # Prefer the canonical location used by the running supervisor backend.
    candidates = [
        "/app/backend/opera.db",
        os.environ.get("OPERA_DB_PATH", ""),
    ]
    for db_path in candidates:
        if not db_path or not os.path.exists(db_path):
            continue
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("DELETE FROM movements WHERE product_name LIKE 'TEST_%'")
            c.execute("DELETE FROM products WHERE name LIKE 'TEST_%' OR barcode LIKE 'TEST-%'")
            c.execute("DELETE FROM suppliers WHERE name LIKE 'TEST_%'")
            conn.commit()
            conn.close()
        except Exception:
            pass


@pytest.fixture(scope="module", autouse=True)
def clean_around_tests():
    """Guarantee a clean DB state before AND after the test module."""
    _wipe_test_data()
    yield
    _wipe_test_data()


@pytest.fixture(scope="module")
def cleanup(s):
    created = {"products": [], "suppliers": []}
    yield created
    for pid in created["products"]:
        try:
            s.delete(f"{API}/products/{pid}", timeout=10)
        except Exception:
            pass
    for sid in created["suppliers"]:
        try:
            s.delete(f"{API}/suppliers/{sid}", timeout=10)
        except Exception:
            pass
    # Final safety net in case the session-scope created things we don't track
    _wipe_test_data()


# ---------- Root ----------
def test_root_message(s):
    r = s.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "Opéra santé API" in data["message"]


# ---------- /api/seed removed ----------
def test_seed_endpoint_removed(s):
    r = s.post(f"{API}/seed", timeout=10)
    assert r.status_code in (404, 405), f"/api/seed should be gone, got {r.status_code}"


# ---------- Dental categories ----------
def test_seed_dental_idempotent(s):
    r1 = s.post(f"{API}/categories/seed-dental", timeout=15)
    assert r1.status_code == 200
    r2 = s.post(f"{API}/categories/seed-dental", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["count"] == 0  # second call adds nothing


def test_20_dental_categories_present(s):
    r = s.get(f"{API}/categories", timeout=10)
    assert r.status_code == 200
    names = {c["name"] for c in r.json()}
    expected = {
        "Anesthésie", "Consommables", "Instruments", "Hygiène",
        "Stérilisation", "Implants", "Endodontie", "Empreintes",
        "Chirurgie", "Composites / Soins", "Orthodontie", "Prothèse",
        "Parodontie", "Pédodontie", "Radiologie", "Blanchiment",
        "Prévention", "Rotatifs (fraises, limes)", "Ciments / Adhésifs",
        "Digues & Isolation",
    }
    assert expected.issubset(names), f"Missing: {expected - names}"


# ---------- Suppliers CRUD ----------
def test_supplier_crud(s, cleanup):
    r = s.post(f"{API}/suppliers", json={"name": "TEST_Sup_it4", "email": "x@y.z"}, timeout=10)
    assert r.status_code == 200
    sid = r.json()["id"]
    cleanup["suppliers"].append(sid)

    r = s.put(f"{API}/suppliers/{sid}", json={"name": "TEST_Sup_it4_upd", "email": "x@y.z"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Sup_it4_upd"

    r = s.get(f"{API}/suppliers", timeout=10)
    assert any(x["id"] == sid for x in r.json())


# ---------- Products CRUD ----------
def test_product_fields(s, cleanup):
    payload = {
        "name": "TEST_Prod_it4_A",
        "brand": "BrandX",
        "barcode": "TEST-IT4-A-123",
        "quantity": 10,
        "min_threshold": 3,
        "unit_price": 2.5,
        "expiry_date": "2026-12-31",
        "description": "desc",
        "product_url": "https://shop.test/p/1",
    }
    r = s.post(f"{API}/products", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    p = r.json()
    cleanup["products"].append(p["id"])
    for k in ("name", "brand", "barcode", "quantity", "min_threshold",
              "unit_price", "expiry_date", "description", "product_url"):
        assert p[k] == payload[k]
    # No legacy fields
    assert "location" not in p
    assert "unit" not in p


# ---------- Unique barcode constraint ----------
def test_unique_barcode_on_create(s, cleanup):
    bc = "TEST-IT4-UNIQ-1"
    r1 = s.post(f"{API}/products", json={"name": "TEST_UB1", "barcode": bc}, timeout=10)
    assert r1.status_code == 200
    cleanup["products"].append(r1.json()["id"])

    r2 = s.post(f"{API}/products", json={"name": "TEST_UB2", "barcode": bc}, timeout=10)
    assert r2.status_code == 400
    assert "déjà utilisé" in r2.json().get("detail", "")


def test_unique_barcode_on_update(s, cleanup):
    bc1 = "TEST-IT4-UNIQ-U1"
    bc2 = "TEST-IT4-UNIQ-U2"
    a = s.post(f"{API}/products", json={"name": "TEST_UB_A", "barcode": bc1}, timeout=10).json()
    b = s.post(f"{API}/products", json={"name": "TEST_UB_B", "barcode": bc2}, timeout=10).json()
    cleanup["products"].extend([a["id"], b["id"]])

    r = s.put(f"{API}/products/{b['id']}", json={"barcode": bc1}, timeout=10)
    assert r.status_code == 400
    assert "déjà utilisé" in r.json().get("detail", "")


# ---------- generate-barcode ----------
def test_generate_barcode_idempotent(s, cleanup):
    r = s.post(f"{API}/products", json={"name": "TEST_GB"}, timeout=10)
    pid = r.json()["id"]
    cleanup["products"].append(pid)

    r1 = s.post(f"{API}/products/{pid}/generate-barcode", timeout=10)
    assert r1.status_code == 200
    bc = r1.json()["barcode"]
    assert bc.startswith("OS-") and len(bc) == 9  # OS- + 6 hex chars

    r2 = s.post(f"{API}/products/{pid}/generate-barcode", timeout=10)
    assert r2.status_code == 200
    assert r2.json()["barcode"] == bc  # idempotent


# ---------- with_usage ----------
def test_products_with_usage(s, cleanup):
    r = s.post(f"{API}/products", json={"name": "TEST_USE", "quantity": 10, "barcode": "TEST-USE-1"}, timeout=10)
    pid = r.json()["id"]
    cleanup["products"].append(pid)

    s.post(f"{API}/movements", json={"product_id": pid, "type": "out", "quantity": 3}, timeout=10)
    r = s.get(f"{API}/products?with_usage=true", timeout=15)
    assert r.status_code == 200
    p = next(x for x in r.json() if x["id"] == pid)
    assert "avg_monthly_usage" in p and "avg_daily_usage" in p and "days_until_out" in p
    assert p["avg_monthly_usage"] >= 3


# ---------- /scan ----------
def test_scan_flow(s, cleanup):
    bc = "TEST-SCAN-IT4"
    r = s.post(f"{API}/products", json={"name": "TEST_SCAN", "barcode": bc, "quantity": 5}, timeout=10)
    pid = r.json()["id"]
    cleanup["products"].append(pid)

    r = s.post(f"{API}/scan", json={"barcode": bc, "type": "out", "quantity": 2}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["movement"]["type"] == "out"
    assert data["product"]["quantity"] == 3


# ---------- /reorder/suggestions ----------
def test_reorder_only_low_stock(s, cleanup):
    low = s.post(f"{API}/products", json={"name": "TEST_REO_LOW", "quantity": 1, "min_threshold": 5, "barcode": "TEST-REO-L"}, timeout=10).json()
    high = s.post(f"{API}/products", json={"name": "TEST_REO_HIGH", "quantity": 50, "min_threshold": 5, "barcode": "TEST-REO-H"}, timeout=10).json()
    cleanup["products"].extend([low["id"], high["id"]])

    r = s.get(f"{API}/reorder/suggestions", timeout=15)
    assert r.status_code == 200
    data = r.json()
    all_items = list(data["unassigned"]) + [i for g in data["groups"] for i in g["items"]]
    ids = {i["product_id"] for i in all_items}
    assert low["id"] in ids
    assert high["id"] not in ids


# ---------- dashboard stats ----------
def test_dashboard_stats_fields(s):
    r = s.get(f"{API}/dashboard/stats", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_products", "total_suppliers", "total_categories",
              "low_stock_count", "expired_count", "expiring_soon_count",
              "total_stock_value", "reorder_count", "top_consumed",
              "recent_movements"):
        assert k in d


# ---------- alerts ----------
def test_alerts_structure(s):
    r = s.get(f"{API}/alerts", timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("low_stock", "expired", "expiring_soon"):
        assert k in d and isinstance(d[k], list)


# ---------- SQLite server.py syntactic validity ----------
def test_server_sqlite_importable():
    import importlib.util
    import sys
    spec = importlib.util.spec_from_file_location("server_sqlite_check", "/app/backend/server.py")
    mod = importlib.util.module_from_spec(spec)
    os.environ["OPERA_DB_PATH"] = "/tmp/opera_test_it4.db"
    try:
        spec.loader.exec_module(mod)
        assert hasattr(mod, "app")
        assert hasattr(mod, "init_db")
    finally:
        sys.modules.pop("server_sqlite_check", None)
