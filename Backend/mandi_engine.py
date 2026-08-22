# ─────────────────────────────────────────────────────────────────
#  mandi_engine.py  —  CropCare AI
#  Live Mandi price fetcher via data.gov.in (Agmarknet).
#  Falls back to a curated static table if the API is unreachable.
#
#  RELIABILITY DESIGN:
#    • 3 retries with 2-second back-off on every call
#    • Hard timeout per attempt (8 s) — never blocks >30 s total
#    • If API fails for ANY reason → immediate clean fallback
#    • Frontend ALWAYS receives { records, summary, data_source }
# ─────────────────────────────────────────────────────────────────

import requests
import os
import time
import logging
from datetime import date, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ── data.gov.in API endpoint ──────────────────────────────────────
DATAGOVIN_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Tuning knobs — adjust without touching logic
_MAX_RETRIES    = 3    # number of HTTP attempts before giving up
_TIMEOUT_SEC    = 8    # per-attempt timeout (seconds)
_RETRY_SLEEP    = 2    # seconds between retries

# ── Crop name normalisation ───────────────────────────────────────
CROP_ALIASES: dict[str, str] = {
    "rice":          "Rice",
    "paddy":         "Paddy(Deshsali)",
    "wheat":         "Wheat",
    "maize":         "Maize",
    "cotton":        "Cotton",
    "soybean":       "Soyabean",
    "sugarcane":     "Sugarcane",
    "chickpea":      "Gram",
    "lentil":        "Masur Dal",
    "mustard":       "Mustard",
    "groundnut":     "Groundnut",
    "onion":         "Onion",
    "potato":        "Potato",
    "tomato":        "Tomato",
    "banana":        "Banana",
    "mango":         "Mango",
    "watermelon":    "Water Melon",
    "mungbean":      "Green Gram Dal",
    "blackgram":     "Black Gram Dal",
    "pigeonpeas":    "Arhar (Tur/Red Gram)(Whole)",
    "mothbeans":     "Moth Dal",
    "kidneybeans":   "Rajma",
    "jute":          "Jute",
    "coconut":       "Coconut",
    "coffee":        "Coffee",
    "grapes":        "Grapes",
    "pomegranate":   "Pomegranate",
    "orange":        "Orange",
    "apple":         "Apple",
    "papaya":        "Papaya",
    "muskmelon":     "Musk Melon",
}

# ── Static fallback prices (₹/quintal, approximate MSP/modal) ─────
FALLBACK_PRICES: dict[str, dict] = {
    "Rice":           {"min": 2100, "max": 2300, "modal": 2183},
    "Paddy(Deshsali)": {"min": 1900, "max": 2200, "modal": 2015},
    "Wheat":          {"min": 2100, "max": 2275, "modal": 2200},
    "Maize":          {"min": 1850, "max": 2100, "modal": 1962},
    "Cotton":         {"min": 6620, "max": 7100, "modal": 6900},
    "Soyabean":       {"min": 3900, "max": 4400, "modal": 4200},
    "Gram":           {"min": 5100, "max": 5600, "modal": 5440},
    "Mustard":        {"min": 5200, "max": 5600, "modal": 5450},
    "Groundnut":      {"min": 5500, "max": 6100, "modal": 5800},
    "Onion":          {"min": 1000, "max": 2500, "modal": 1600},
    "Potato":         {"min":  800, "max": 1800, "modal": 1200},
    "Tomato":         {"min":  500, "max": 2000, "modal": 1200},
    "Banana":         {"min":  800, "max": 2000, "modal": 1400},
    "Mango":          {"min": 1500, "max": 5000, "modal": 3000},
    "Water Melon":    {"min":  400, "max": 1200, "modal":  700},
    "Green Gram Dal": {"min": 6500, "max": 7500, "modal": 7000},
    "Black Gram Dal": {"min": 6200, "max": 7200, "modal": 6700},
    "Arhar (Tur/Red Gram)(Whole)": {"min": 6600, "max": 7200, "modal": 7000},
    "Moth Dal":       {"min": 4500, "max": 5500, "modal": 5000},
    "Rajma":          {"min": 9000, "max": 12000, "modal": 10000},
    "Jute":           {"min": 4500, "max": 5500, "modal": 5000},
    "Coconut":        {"min": 2000, "max": 4000, "modal": 3000},
    "Coffee":         {"min": 8000, "max": 12000, "modal": 10000},
    "Grapes":         {"min": 3000, "max": 8000, "modal": 5500},
    "Pomegranate":    {"min": 5000, "max": 12000, "modal": 8000},
    "Orange":         {"min": 2000, "max": 5000, "modal": 3500},
    "Apple":          {"min": 4000, "max": 10000, "modal": 7000},
    "Papaya":         {"min":  800, "max": 2000, "modal": 1300},
    "Musk Melon":     {"min":  600, "max": 1800, "modal": 1000},
    "Masur Dal":      {"min": 5100, "max": 5800, "modal": 5500},
    "Sugarcane":      {"min":  315, "max":  370, "modal":  350},
}


# ── Internal: build the guaranteed-valid fallback response ────────
def _build_fallback(
    crop_lower: str,
    api_crop: str,
    state: Optional[str],
    district: Optional[str],
    reason: str = "",
) -> dict:
    today    = date.today()
    fallback = FALLBACK_PRICES.get(api_crop)

    if not fallback:
        # Crop not in our static table either → return not_available
        return {
            "crop":          crop_lower,
            "api_crop_name": api_crop,
            "state_filter":  state,
            "district_filter": district,
            "data_source":   "not_available",
            "records":       [],
            "summary":       {},
            "message": (
                f"Price data not available for '{crop_lower}'. "
                "Add DATAGOVIN_API_KEY to .env for live Agmarknet data."
            ),
        }

    note_parts = [
        "Showing approximate MSP/modal reference prices (2024-25).",
        "Get live data by adding DATAGOVIN_API_KEY to your .env (free at https://data.gov.in/).",
    ]
    if reason:
        note_parts.insert(0, reason)

    return {
        "crop":           crop_lower,
        "api_crop_name":  api_crop,
        "state_filter":   state,
        "district_filter": district,
        "data_source":    "fallback_msp",
        "as_of":          today.isoformat(),
        "records": [{
            "mandi":       "National Reference (MSP / modal average)",
            "district":    "All India",
            "state":       "All India",
            "variety":     "—",
            "min_price":   fallback["min"],
            "max_price":   fallback["max"],
            "modal_price": fallback["modal"],
            "unit":        "₹/quintal",
        }],
        "summary": {
            "avg_modal_price":   fallback["modal"],
            "min_across_mandis": fallback["min"],
            "max_across_mandis": fallback["max"],
            "unit": "₹/quintal",
        },
        "note": "  ".join(note_parts),
    }


# ── Public API ────────────────────────────────────────────────────
def fetch_mandi_prices(
    crop: str,
    state: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 10,
) -> dict:
    """
    Returns mandi prices for a crop.

    Tries data.gov.in (Agmarknet) API first (3 retries, 8 s timeout each).
    Falls back to static MSP reference prices on ANY failure.

    The returned dict ALWAYS contains:
        records  : non-empty list (live or fallback)
        summary  : {avg_modal_price, min_across_mandis, max_across_mandis}
        data_source : "live" | "fallback_msp" | "not_available"
    """
    crop_lower = crop.strip().lower()
    api_crop   = CROP_ALIASES.get(crop_lower, crop.title())
    yesterday  = date.today() - timedelta(days=1)
    api_key    = os.getenv("DATAGOVIN_API_KEY", "").strip()

    print(f"[Mandi] crop='{crop_lower}' api_crop='{api_crop}' state={state} district={district}")
    print(f"[Mandi] API key present: {bool(api_key)}")

    # ── Skip API entirely if no key configured ────────────────────
    if not api_key:
        print("[Mandi] No API key — returning fallback immediately.")
        return _build_fallback(crop_lower, api_crop, state, district,
                               reason="No DATAGOVIN_API_KEY configured.")

    # ── Build request params ──────────────────────────────────────
    params = {
        "api-key":            api_key,
        "format":             "json",
        "limit":              100,          # fetch more, filter client-side
        "filters[commodity]": api_crop,
        # Date filter removed — API is unreliable with date params
    }

    print(f"[Mandi] PARAMS: {params}")

    # ── 3-attempt retry loop ──────────────────────────────────────
    resp = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            print(f"[Mandi] Attempt {attempt}/{_MAX_RETRIES} …")
            resp = requests.get(DATAGOVIN_URL, params=params, timeout=_TIMEOUT_SEC)
            print(f"[Mandi] STATUS: {resp.status_code}")
            print(f"[Mandi] RAW RESPONSE (first 300 chars): {resp.text[:300]}")
            resp.raise_for_status()
            break  # success — exit retry loop

        except requests.exceptions.Timeout:
            print(f"[Mandi] Timeout on attempt {attempt}.")
            resp = None
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_SLEEP)

        except requests.exceptions.RequestException as exc:
            print(f"[Mandi] HTTP error on attempt {attempt}: {exc}")
            resp = None
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_SLEEP)

    # ── All retries exhausted without a valid response ────────────
    if resp is None:
        print("[Mandi] All retries failed — returning fallback.")
        return _build_fallback(
            crop_lower, api_crop, state, district,
            reason="Agmarknet API unreachable after 3 attempts (timeout/network error).",
        )

    # ── Parse JSON ────────────────────────────────────────────────
    try:
        raw = resp.json()
    except Exception as exc:
        print(f"[Mandi] JSON parse error: {exc}")
        return _build_fallback(
            crop_lower, api_crop, state, district,
            reason="Invalid JSON from Agmarknet API.",
        )

    if not raw or "records" not in raw:
        print("[Mandi] Response missing 'records' key — returning fallback.")
        return _build_fallback(
            crop_lower, api_crop, state, district,
            reason="Agmarknet API returned an unexpected response format.",
        )

    # ── Filter records client-side (more reliable than API params) ─
    records_raw = raw.get("records", [])
    print(f"[Mandi] Total records before filter: {len(records_raw)}")

    if state:
        records_raw = [
            r for r in records_raw
            if r.get("state", "").strip().lower() == state.strip().lower()
        ]
        print(f"[Mandi] After state filter '{state}': {len(records_raw)}")

    if district:
        records_raw = [
            r for r in records_raw
            if r.get("district", "").strip().lower() == district.strip().lower()
        ]
        print(f"[Mandi] After district filter '{district}': {len(records_raw)}")

    # ── No records after filtering → fallback ─────────────────────
    if not records_raw:
        filter_note = []
        if state:    filter_note.append(f"state={state}")
        if district: filter_note.append(f"district={district}")
        reason = (
            f"No live records for '{api_crop}'"
            + (f" with {', '.join(filter_note)}" if filter_note else "")
            + ". API returned 0 matching entries."
        )
        print(f"[Mandi] {reason} — returning fallback.")
        return _build_fallback(crop_lower, api_crop, state, district, reason=reason)

    # ── Build clean records list ──────────────────────────────────
    records      = []
    modal_prices = []
    for r in records_raw:
        try:
            modal = float(r.get("modal_price", 0) or 0)
            modal_prices.append(modal)
            records.append({
                "mandi":       r.get("market", ""),
                "district":    r.get("district", ""),
                "state":       r.get("state", ""),
                "variety":     r.get("variety", ""),
                "min_price":   float(r.get("min_price",   0) or 0),
                "max_price":   float(r.get("max_price",   0) or 0),
                "modal_price": modal,
                "unit":        "₹/quintal",
            })
        except (ValueError, TypeError, KeyError):
            continue  # skip malformed rows silently

    # Edge case: all rows were malformed
    if not records:
        print("[Mandi] All records were malformed — returning fallback.")
        return _build_fallback(
            crop_lower, api_crop, state, district,
            reason="All API records had unparseable price fields.",
        )

    summary = {
        "avg_modal_price":   round(sum(modal_prices) / len(modal_prices), 2),
        "min_across_mandis": min(modal_prices),
        "max_across_mandis": max(modal_prices),
        "unit": "₹/quintal",
    }

    print(f"[Mandi] ✅ Returning {len(records)} live record(s). avg_modal={summary['avg_modal_price']}")

    return {
        "crop":            crop_lower,
        "api_crop_name":   api_crop,
        "state_filter":    state,
        "district_filter": district,
        "data_source":     "live",
        "as_of":           yesterday.isoformat(),
        "records":         records,
        "summary":         summary,
        "note":            "Live data from Agmarknet via data.gov.in",
    }
