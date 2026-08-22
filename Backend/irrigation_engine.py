# ─────────────────────────────────────────────────────────────────
#  irrigation_engine.py  —  CropCare AI
#  Irrigation advisory: water requirement, frequency & schedule
#  based on crop, growth stage, soil type, and live weather.
# ─────────────────────────────────────────────────────────────────

from typing import Optional
from datetime import date

# ── Crop base ETc (mm/day) by growth stage ────────────────────────
# Source: FAO-56 crop coefficients (Kc) × mean ETo 5mm/day baseline
# Stages: initial, development, mid_season, late_season
CROP_WATER: dict[str, dict] = {
    "rice":          {"initial": 5.0, "development": 7.5, "mid_season": 9.0, "late_season": 6.0, "total_days": 120},
    "wheat":         {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.0, "total_days": 120},
    "maize":         {"initial": 3.5, "development": 5.5, "mid_season": 7.5, "late_season": 5.0, "total_days": 100},
    "cotton":        {"initial": 3.0, "development": 5.5, "mid_season": 7.5, "late_season": 5.5, "total_days": 180},
    "sugarcane":     {"initial": 4.0, "development": 6.5, "mid_season": 8.0, "late_season": 6.0, "total_days": 365},
    "soybean":       {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.5, "total_days": 100},
    "chickpea":      {"initial": 2.5, "development": 4.5, "mid_season": 5.5, "late_season": 3.5, "total_days": 100},
    "lentil":        {"initial": 2.5, "development": 4.0, "mid_season": 5.0, "late_season": 3.0, "total_days": 100},
    "groundnut":     {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.5, "total_days": 130},
    "mustard":       {"initial": 2.5, "development": 4.5, "mid_season": 5.5, "late_season": 3.5, "total_days": 110},
    "potato":        {"initial": 3.0, "development": 5.5, "mid_season": 7.0, "late_season": 5.0, "total_days": 105},
    "onion":         {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 5.0, "total_days": 150},
    "tomato":        {"initial": 3.0, "development": 5.5, "mid_season": 7.0, "late_season": 5.0, "total_days": 120},
    "banana":        {"initial": 5.5, "development": 7.0, "mid_season": 8.5, "late_season": 7.0, "total_days": 300},
    "mango":         {"initial": 3.5, "development": 5.0, "mid_season": 6.0, "late_season": 4.5, "total_days": 365},
    "watermelon":    {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.5, "total_days": 85},
    "mungbean":      {"initial": 2.5, "development": 4.5, "mid_season": 5.5, "late_season": 3.5, "total_days": 75},
    "blackgram":     {"initial": 2.5, "development": 4.5, "mid_season": 5.5, "late_season": 3.5, "total_days": 75},
    "pigeonpeas":    {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.5, "total_days": 160},
    "mothbeans":     {"initial": 2.0, "development": 3.5, "mid_season": 4.5, "late_season": 3.0, "total_days": 75},
    "coconut":       {"initial": 4.0, "development": 5.5, "mid_season": 6.5, "late_season": 5.5, "total_days": 365},
    "coffee":        {"initial": 3.5, "development": 5.0, "mid_season": 6.0, "late_season": 5.0, "total_days": 365},
    "jute":          {"initial": 4.5, "development": 6.5, "mid_season": 8.0, "late_season": 5.5, "total_days": 120},
    "grapes":        {"initial": 2.0, "development": 4.5, "mid_season": 6.0, "late_season": 4.0, "total_days": 180},
    "pomegranate":   {"initial": 2.5, "development": 4.0, "mid_season": 5.5, "late_season": 4.0, "total_days": 180},
    "orange":        {"initial": 3.0, "development": 4.5, "mid_season": 6.0, "late_season": 4.5, "total_days": 365},
    "apple":         {"initial": 2.5, "development": 4.0, "mid_season": 5.5, "late_season": 4.0, "total_days": 180},
    "papaya":        {"initial": 4.0, "development": 6.0, "mid_season": 7.5, "late_season": 6.0, "total_days": 270},
    "muskmelon":     {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.5, "total_days": 85},
    "kidneybeans":   {"initial": 3.0, "development": 5.0, "mid_season": 6.5, "late_season": 4.5, "total_days": 95},
    "maize":         {"initial": 3.5, "development": 5.5, "mid_season": 7.5, "late_season": 5.0, "total_days": 100},
}

# ── Soil water-holding capacity (mm water / m depth) ─────────────
SOIL_WHC: dict[str, float] = {
    "sandy":          80,   # drains fast, low holding
    "sandy_loam":    120,
    "loam":          160,   # ideal
    "clay_loam":     180,
    "clay":          200,   # high holding but poor drainage
    "silty_loam":    170,
    "black":         190,   # Vertisol / black cotton soil
    "red":           130,
    "laterite":      110,
    "alluvial":      160,
}

# ── Irrigation method efficiency (fraction of water used by crop) ─
IRRIGATION_EFFICIENCY: dict[str, float] = {
    "flood":    0.55,
    "furrow":   0.65,
    "sprinkler": 0.80,
    "drip":     0.90,
    "rainfed":  1.00,   # no applied water — rain only
}

# ── Growth stage from days-after-sowing ───────────────────────────
def _get_growth_stage(days_after_sowing: int, total_days: int) -> str:
    pct = days_after_sowing / total_days
    if pct < 0.20:
        return "initial"
    elif pct < 0.45:
        return "development"
    elif pct < 0.75:
        return "mid_season"
    else:
        return "late_season"


def _stage_label(stage: str) -> str:
    return {
        "initial":     "Initial (germination / establishment)",
        "development": "Crop Development (vegetative growth)",
        "mid_season":  "Mid-Season (flowering / grain filling) — CRITICAL stage",
        "late_season": "Late Season (maturation / ripening)",
    }.get(stage, stage)


def get_irrigation_advisory(
    crop: str,
    soil_type: str                  = "loam",
    irrigation_method: str          = "furrow",
    days_after_sowing: Optional[int] = None,
    temperature: Optional[float]    = None,   # °C
    humidity: Optional[float]       = None,   # %
    rainfall_mm_last7days: Optional[float] = None,
    area_acres: Optional[float]     = None,
) -> dict:
    """
    Returns daily water need, irrigation frequency, and schedule advice.

    Parameters
    ----------
    crop                   : crop name (flexible matching)
    soil_type              : "loam" | "clay" | "sandy" | "sandy_loam" | "clay_loam" |
                             "silty_loam" | "black" | "red" | "laterite" | "alluvial"
    irrigation_method      : "flood" | "furrow" | "sprinkler" | "drip" | "rainfed"
    days_after_sowing      : for growth-stage adjustment
    temperature            : current / forecast temp (°C) — raises ETo if hot
    humidity               : % — low humidity increases crop water demand
    rainfall_mm_last7days  : recent effective rainfall — reduces net irrigation need
    area_acres             : if given, total volume per irrigation is returned
    """
    crop_key = crop.strip().lower()
    crop_data = CROP_WATER.get(crop_key)

    if not crop_data:
        return {
            "error": f"Crop '{crop}' not in irrigation database.",
            "supported_crops": sorted(CROP_WATER.keys()),
        }

    # ── Determine growth stage ────────────────────────────────────
    total_days = crop_data["total_days"]
    if days_after_sowing is not None and days_after_sowing > 0:
        stage = _get_growth_stage(days_after_sowing, total_days)
    else:
        stage = "mid_season"   # conservative default (highest demand)

    base_etc = crop_data[stage]   # mm/day

    # ── Weather adjustment ────────────────────────────────────────
    # ETo increases with heat and low humidity
    eto_factor = 1.0
    if temperature is not None:
        if temperature > 35:
            eto_factor += 0.15
        elif temperature > 30:
            eto_factor += 0.08
        elif temperature < 15:
            eto_factor -= 0.10

    if humidity is not None:
        if humidity < 40:
            eto_factor += 0.10
        elif humidity > 80:
            eto_factor -= 0.05

    adjusted_etc = round(base_etc * eto_factor, 2)   # mm/day needed by crop

    # ── Effective rainfall credit ─────────────────────────────────
    effective_rain_per_day = 0.0
    if rainfall_mm_last7days is not None and rainfall_mm_last7days > 0:
        # FAO: 70–80% of recent rain is "effective" (rest is runoff/evap)
        effective_rain_per_day = round((rainfall_mm_last7days * 0.75) / 7, 2)

    net_daily_need = max(0.0, round(adjusted_etc - effective_rain_per_day, 2))

    # ── Irrigation method efficiency ──────────────────────────────
    method_key  = irrigation_method.strip().lower()
    efficiency  = IRRIGATION_EFFICIENCY.get(method_key, 0.65)
    gross_daily = round(net_daily_need / efficiency, 2) if efficiency < 1.0 else net_daily_need

    # ── Soil-based interval (days between irrigations) ────────────
    soil_key    = soil_type.strip().lower().replace(" ", "_")
    whc         = SOIL_WHC.get(soil_key, SOIL_WHC["loam"])
    # Root zone assumed 0.3 m; readily available water = 40% of WHC
    raw_mm      = whc * 0.3 * 0.40   # mm readily available water in root zone
    if net_daily_need > 0:
        interval_days = max(1, round(raw_mm / net_daily_need))
    else:
        interval_days = 99   # rain covers it all

    # Cap intervals at realistic maxima per crop type
    if crop_key == "rice":
        interval_days = min(interval_days, 3)   # rice needs near-continuous flooding

    # ── Volume per irrigation (if area given) ─────────────────────
    volume_info = None
    if area_acres and area_acres > 0:
        area_m2 = area_acres * 4046.86
        volume_liters = round((gross_daily * interval_days / 1000) * area_m2 * 1000, 0)
        volume_info = {
            "per_irrigation_litres": volume_liters,
            "area_acres":            area_acres,
            "area_m2":               round(area_m2, 0),
        }

    # ── Schedule summary text ──────────────────────────────────────
    if method_key == "rainfed":
        schedule_text = (
            "This crop is rainfed. Monitor soil moisture and rainfall weekly. "
            "If rainfall falls below 40 mm/week during mid-season, consider supplemental irrigation."
        )
    elif net_daily_need == 0.0:
        schedule_text = (
            f"Recent rainfall ({rainfall_mm_last7days} mm/week) is sufficient for current demand. "
            "Monitor soil moisture; skip scheduled irrigations until soil dries."
        )
    else:
        schedule_text = (
            f"Irrigate every {interval_days} day(s) applying ~{round(gross_daily * interval_days, 1)} mm "
            f"({method_key} method, {int(efficiency*100)}% efficiency). "
            f"Net crop demand is {net_daily_need} mm/day after rainfall credit."
        )

    # ── Critical stage warning ────────────────────────────────────
    warnings = []
    if stage == "mid_season":
        warnings.append(
            f"⚠️  {crop.title()} is in its CRITICAL water stage (flowering/grain filling). "
            "Any water stress now significantly reduces yield. Do not skip irrigations."
        )
    if soil_key in ("sandy", "laterite") and interval_days > 3:
        warnings.append(
            "Sandy/laterite soils drain quickly. Reduce interval or use drip/sprinkler to avoid moisture stress."
        )
    if method_key == "flood" and crop_key not in ("rice", "sugarcane"):
        warnings.append(
            "Flood irrigation wastes ~45% water for this crop. Consider upgrading to furrow or drip."
        )

    return {
        "crop":               crop_key,
        "growth_stage":       stage,
        "growth_stage_label": _stage_label(stage),
        "days_after_sowing":  days_after_sowing,
        "soil_type":          soil_key,
        "irrigation_method":  method_key,

        "water_requirement": {
            "base_etc_mm_day":      base_etc,
            "adjusted_etc_mm_day":  adjusted_etc,
            "effective_rain_mm_day": effective_rain_per_day,
            "net_daily_need_mm":    net_daily_need,
            "gross_apply_mm_day":   gross_daily,
            "irrigation_efficiency": f"{int(efficiency*100)}%",
        },

        "schedule": {
            "interval_days":         interval_days,
            "apply_per_session_mm":  round(gross_daily * interval_days, 1),
            "summary":               schedule_text,
        },

        "volume_per_irrigation": volume_info,
        "warnings":              warnings,

        "tips": _get_tips(crop_key, method_key, stage, soil_key),

        "note": (
            "Water needs based on FAO-56 crop coefficients. "
            "Actual field requirements vary by microclimate and crop variety. "
            "Use soil moisture sensors where available."
        ),
    }


def _get_tips(crop: str, method: str, stage: str, soil: str) -> list[str]:
    tips = []
    if method == "drip":
        tips.append("With drip, irrigate daily at lower volumes rather than once every few days.")
    if crop == "rice":
        tips.append("Maintain 2–5 cm standing water in paddy fields during tillering and panicle initiation.")
    if crop in ("wheat", "chickpea", "mustard"):
        tips.append("Avoid waterlogging — these crops are sensitive to excess moisture at root zone.")
    if soil in ("clay", "black"):
        tips.append("Black/clay soils retain moisture longer; reduce frequency during rainy spells to prevent waterlogging.")
    if stage == "late_season":
        tips.append("Reduce irrigation in late season to allow the crop to mature and harden properly.")
    return tips
