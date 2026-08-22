# ─────────────────────────────────────────────────────────────────
#  calendar_engine.py  —  CropCare AI
#  Seasonal Crop Calendar: what to sow now, what windows are closing.
#  Tailored to Indian agro-climatic zones + current month.
# ─────────────────────────────────────────────────────────────────

from datetime import date
from typing import Optional

# ── Agro-climatic zone mapping by state ──────────────────────────
# Simplified: maps state → zone key
STATE_ZONE: dict[str, str] = {
    # North India (Indo-Gangetic Plain)
    "punjab": "north_igp", "haryana": "north_igp", "uttar pradesh": "north_igp",
    "uttarakhand": "north_igp", "delhi": "north_igp", "himachal pradesh": "north_hills",
    "jammu and kashmir": "north_hills", "ladakh": "north_hills",

    # Central India
    "madhya pradesh": "central", "chhattisgarh": "central",
    "rajasthan": "arid_semi_arid",

    # East India
    "bihar": "east_igp", "jharkhand": "east_igp", "west bengal": "east_igp",
    "odisha": "east_coastal", "assam": "northeast", "meghalaya": "northeast",
    "manipur": "northeast", "tripura": "northeast", "nagaland": "northeast",
    "mizoram": "northeast", "arunachal pradesh": "northeast",

    # West India
    "gujarat": "west", "maharashtra": "west",

    # South India
    "karnataka": "south", "andhra pradesh": "south_coastal",
    "telangana": "south", "kerala": "kerala", "tamil nadu": "south_coastal",

    # Hills / Deccan
    "goa": "south_coastal",
}


# ── Crop calendar per zone ────────────────────────────────────────
# Format per crop entry:
#   sow_months : list of calendar months when sowing window is open
#   harvest_months : approx harvest window
#   season : Kharif | Rabi | Zaid
#   notes  : key advisory
#   duration_days : approx days to harvest
ZONE_CALENDARS: dict[str, list[dict]] = {

    "north_igp": [
        {"crop": "Wheat",    "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [3,4],     "duration_days": 140, "notes": "Sow before Nov 15 for best yield. Late sowing reduces grain weight."},
        {"crop": "Rice (Paddy)", "season": "Kharif", "sow_months": [6,7], "harvest_months": [10,11],   "duration_days": 120, "notes": "Transplant 25–30 days after nursery sowing. Requires standing water."},
        {"crop": "Maize",    "season": "Kharif", "sow_months": [6,7],     "harvest_months": [9,10],    "duration_days": 95,  "notes": "Prefer well-drained fields. Gap sowing avoids waterlogging risk."},
        {"crop": "Mustard",  "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3],     "duration_days": 110, "notes": "Ideal temp 10–25°C. Avoid frost during flowering."},
        {"crop": "Chickpea (Gram)", "season": "Rabi", "sow_months": [10,11], "harvest_months": [2,3],  "duration_days": 100, "notes": "Tolerates light frost. Avoid waterlogging — raised beds help."},
        {"crop": "Sugarcane","season": "Kharif", "sow_months": [2,3,4],   "harvest_months": [11,12,1], "duration_days": 300, "notes": "Spring planting (Feb–Mar) gives highest yield. Ratoon possible."},
        {"crop": "Watermelon","season": "Zaid",  "sow_months": [2,3],     "harvest_months": [5,6],     "duration_days": 85,  "notes": "Requires warm dry weather. Sandy-loam soils ideal."},
        {"crop": "Potato",   "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [1,2,3],   "duration_days": 90,  "notes": "Cool weather at tuber initiation is critical. Avoid frost."},
        {"crop": "Sunflower","season": "Rabi",   "sow_months": [11,12],   "harvest_months": [3,4],     "duration_days": 90,  "notes": "Drought-tolerant. Good rotation crop after rice."},
        {"crop": "Lentil",   "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [3,4],     "duration_days": 110, "notes": "Sow on residual moisture. Does not need heavy irrigation."},
    ],

    "north_hills": [
        {"crop": "Maize",    "season": "Kharif", "sow_months": [4,5],     "harvest_months": [9,10],    "duration_days": 110, "notes": "Hill maize benefits from terrace farming. Weed early."},
        {"crop": "Rice (Paddy)", "season": "Kharif", "sow_months": [5,6], "harvest_months": [9,10],    "duration_days": 120, "notes": "High altitude varieties needed above 1500m."},
        {"crop": "Wheat",    "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [5,6],     "duration_days": 180, "notes": "Longer season at altitude. Use hill-specific varieties."},
        {"crop": "Apple",    "season": "Perennial","sow_months": [1,2],   "harvest_months": [8,9,10],  "duration_days": 180, "notes": "Chilling hours >1000 hrs required. Thin fruit for size."},
        {"crop": "Potato",   "season": "Kharif", "sow_months": [3,4],     "harvest_months": [8,9],     "duration_days": 90,  "notes": "Hill potatoes fetch premium prices. Cool nights aid tuber quality."},
        {"crop": "Ginger",   "season": "Kharif", "sow_months": [4,5],     "harvest_months": [11,12],   "duration_days": 210, "notes": "Partial shade beneficial. Avoid waterlogged soils."},
    ],

    "central": [
        {"crop": "Soybean",  "season": "Kharif", "sow_months": [6,7],     "harvest_months": [10,11],   "duration_days": 100, "notes": "MP/Vidarbha soybean belt. Sow after first monsoon rain."},
        {"crop": "Cotton",   "season": "Kharif", "sow_months": [5,6],     "harvest_months": [10,11,12],"duration_days": 180, "notes": "Black cotton soil ideal. BT varieties dominate."},
        {"crop": "Wheat",    "season": "Rabi",   "sow_months": [11,12],   "harvest_months": [3,4],     "duration_days": 115, "notes": "MP wheat (GW322) gives high protein. Timely sowing critical."},
        {"crop": "Chickpea", "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3],     "duration_days": 100, "notes": "MP is major chickpea producer. Wilt-resistant varieties recommended."},
        {"crop": "Lentil",   "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [3,4],     "duration_days": 110, "notes": "Highly profitable in MP. Minimal irrigation needed."},
        {"crop": "Maize",    "season": "Kharif", "sow_months": [6,7],     "harvest_months": [9,10],    "duration_days": 95,  "notes": "Poultry feed market gives good price. Avoid low-lying fields."},
    ],

    "arid_semi_arid": [
        {"crop": "Bajra (Pearl Millet)", "season": "Kharif", "sow_months": [6,7], "harvest_months": [9,10], "duration_days": 80,  "notes": "Most drought-tolerant cereal. Can be sown on light sandy soils."},
        {"crop": "Cluster Bean (Guar)","season": "Kharif","sow_months": [6,7],   "harvest_months": [9,10],  "duration_days": 90,  "notes": "High export value. Gum extraction fetch premium. Drought-hardy."},
        {"crop": "Mustard",  "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3],     "duration_days": 110, "notes": "Rajasthan is India's largest mustard producer. Low water need."},
        {"crop": "Cumin",    "season": "Rabi",   "sow_months": [11,12],   "harvest_months": [2,3],     "duration_days": 90,  "notes": "Very high value crop. Requires cool dry weather at maturity."},
        {"crop": "Sesame",   "season": "Kharif", "sow_months": [6,7],     "harvest_months": [9,10],    "duration_days": 85,  "notes": "Drought-tolerant oilseed. Ideal on light soils."},
        {"crop": "Watermelon","season": "Zaid",  "sow_months": [1,2,3],   "harvest_months": [5,6],     "duration_days": 85,  "notes": "River-bed cultivation common in Rajasthan."},
    ],

    "east_igp": [
        {"crop": "Rice (Paddy)", "season": "Kharif","sow_months": [6,7],  "harvest_months": [10,11],   "duration_days": 120, "notes": "Bihar/WB flood plain. Prefer short-duration varieties in flood zones."},
        {"crop": "Wheat",    "season": "Rabi",   "sow_months": [11,12],   "harvest_months": [3,4],     "duration_days": 115, "notes": "Sow by Nov 25. HD2967 / K307 popular in Bihar."},
        {"crop": "Maize",    "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3],     "duration_days": 90,  "notes": "Bihar rabi maize growing fast. Winter temp suits."},
        {"crop": "Lentil",   "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [3,4],     "duration_days": 110, "notes": "Bihar is top lentil state. Zero-till after rice saves moisture."},
        {"crop": "Mustard",  "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3],     "duration_days": 110, "notes": "Quick-maturing mustard fits rice-mustard rotation well."},
        {"crop": "Jute",     "season": "Kharif", "sow_months": [3,4,5],   "harvest_months": [7,8],     "duration_days": 120, "notes": "WB & Bihar dominant. Retting quality depends on clean water."},
    ],

    "east_coastal": [
        {"crop": "Rice (Paddy)", "season": "Kharif","sow_months": [6,7],  "harvest_months": [10,11],   "duration_days": 120, "notes": "Odisha coastal. Cyclone risk — prefer medium-duration varieties."},
        {"crop": "Groundnut", "season": "Kharif","sow_months": [6,7],     "harvest_months": [9,10],    "duration_days": 110, "notes": "Sandy coastal soils ideal. High oil content varieties preferred."},
        {"crop": "Blackgram","season": "Kharif", "sow_months": [6,7],     "harvest_months": [9,10],    "duration_days": 75,  "notes": "Short duration — good as intercrop with cotton."},
    ],

    "west": [
        {"crop": "Cotton",   "season": "Kharif", "sow_months": [5,6],     "harvest_months": [10,11,12],"duration_days": 180, "notes": "Vidarbha / Saurashtra cotton belt. Drip irrigation boosts yield significantly."},
        {"crop": "Groundnut","season": "Kharif", "sow_months": [6,7],     "harvest_months": [10,11],   "duration_days": 110, "notes": "Gujarat is top groundnut state. Kharif and summer crops possible."},
        {"crop": "Onion",    "season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3,4],   "duration_days": 150, "notes": "Nashik/Solapur onion belt. Avoid excess rain at bulb development."},
        {"crop": "Sugarcane","season": "Kharif", "sow_months": [1,2,3],   "harvest_months": [11,12,1], "duration_days": 300, "notes": "Maharashtra is India's top sugar state. Adsali & Suru planting systems."},
        {"crop": "Soybean",  "season": "Kharif", "sow_months": [6,7],     "harvest_months": [10,11],   "duration_days": 100, "notes": "Vidarbha yellow revolution. Requires timely sowing for good pod fill."},
        {"crop": "Banana",   "season": "Perennial","sow_months": [1,2,6,7],"harvest_months": [9,10,1,2],"duration_days": 300,"notes": "Jalgaon banana famous. Tissue culture planting gives uniform stands."},
        {"crop": "Grapes",   "season": "Perennial","sow_months": [6,7],   "harvest_months": [2,3,4],   "duration_days": 240, "notes": "Nashik wine/table grape region. Pruning timing determines harvest window."},
    ],

    "south": [
        {"crop": "Jowar (Sorghum)", "season": "Kharif","sow_months": [6,7],"harvest_months": [9,10],   "duration_days": 100, "notes": "Rabi jowar in Karnataka is premium quality. Dual-use (grain + fodder)."},
        {"crop": "Ragi (Finger Millet)","season": "Kharif","sow_months": [6,7],"harvest_months": [10,11],"duration_days": 120,"notes": "High nutritional value. Grows well on red soils without heavy inputs."},
        {"crop": "Cotton",   "season": "Kharif", "sow_months": [5,6],     "harvest_months": [10,11,12],"duration_days": 180, "notes": "Telangana/AP cotton. Early sowing (May) with drip gives best results."},
        {"crop": "Groundnut","season": "Kharif", "sow_months": [6,7],     "harvest_months": [10,11],   "duration_days": 110, "notes": "Red soils of AP/TN. Summer groundnut also possible with irrigation."},
        {"crop": "Turmeric", "season": "Kharif", "sow_months": [4,5],     "harvest_months": [1,2,3],   "duration_days": 270, "notes": "Nizamabad/Erode turmeric belt. High curcumin varieties fetch premium."},
        {"crop": "Chilli",   "season": "Kharif", "sow_months": [6,7],     "harvest_months": [12,1,2],  "duration_days": 180, "notes": "Guntur chilli is world-famous. Transplant 45-day-old seedlings."},
        {"crop": "Sunflower","season": "Rabi",   "sow_months": [10,11],   "harvest_months": [2,3],     "duration_days": 90,  "notes": "Karnataka major sunflower producer. Tolerates mild drought."},
    ],

    "south_coastal": [
        {"crop": "Rice (Paddy)", "season": "Kharif","sow_months": [6,7],  "harvest_months": [10,11],   "duration_days": 120, "notes": "Delta rice (Kaveri, Krishna). SRI method gives 20–30% yield boost."},
        {"crop": "Banana",   "season": "Perennial","sow_months": [1,2,6,7],"harvest_months": [10,11,3,4],"duration_days": 300,"notes": "Year-round planting possible. G9 variety popular for export."},
        {"crop": "Coconut",  "season": "Perennial","sow_months": [5,6,7,8],"harvest_months": [1,2,3,4,5,6,7,8,9,10,11,12],"duration_days": 365,"notes": "Perennial. Takes 5–7 years to bear. Intercrop with banana, cocoa."},
        {"crop": "Chilli",   "season": "Kharif", "sow_months": [6,7],     "harvest_months": [12,1,2],  "duration_days": 180, "notes": "Guntur & Byadagi varieties. Transplant well-rooted nursery seedlings."},
        {"crop": "Tomato",   "season": "Rabi",   "sow_months": [9,10],    "harvest_months": [1,2,3],   "duration_days": 100, "notes": "Cool season improves fruit quality. Staking needed for indeterminate types."},
    ],

    "northeast": [
        {"crop": "Rice (Paddy)", "season": "Kharif","sow_months": [5,6],  "harvest_months": [10,11],   "duration_days": 140, "notes": "Jhum (shifting) and wet paddy both practiced. Traditional varieties preferred."},
        {"crop": "Maize",    "season": "Kharif", "sow_months": [4,5],     "harvest_months": [8,9],     "duration_days": 100, "notes": "Hill maize important in Nagaland, Manipur. Manual harvesting common."},
        {"crop": "Ginger",   "season": "Kharif", "sow_months": [4,5],     "harvest_months": [11,12],   "duration_days": 210, "notes": "NE ginger fetches premium. Organic growing suits local conditions."},
        {"crop": "Pineapple","season": "Perennial","sow_months": [5,6],   "harvest_months": [4,5,6],   "duration_days": 540, "notes": "Meghalaya/Tripura pineapple. Queen variety gives best flavour."},
        {"crop": "Banana",   "season": "Perennial","sow_months": [3,4,9], "harvest_months": [9,10,11], "duration_days": 300, "notes": "Year-round possible. Bhimkol local variety important for tribal use."},
        {"crop": "Black Pepper","season": "Perennial","sow_months": [5,6],"harvest_months": [11,12],   "duration_days": 365, "notes": "Shade-loving vine. Requires good rainfall. Stakes or trees needed."},
    ],

    "kerala": [
        {"crop": "Rice (Paddy)", "season": "Kharif","sow_months": [5,6],  "harvest_months": [8,9],     "duration_days": 100, "notes": "Pokkali and Jaya varieties in Kuttanad. Flood-tolerant types needed."},
        {"crop": "Coconut",  "season": "Perennial","sow_months": [5,6,7], "harvest_months": [1,2,3,4,5,6,7,8,9,10,11,12],"duration_days": 365,"notes": "Kerala's primary crop. High-yielding dwarf hybrids (WCT) preferred."},
        {"crop": "Banana",   "season": "Perennial","sow_months": [1,2,9,10],"harvest_months": [7,8,3,4],"duration_days": 270,"notes": "Nendran variety premium price. Year-round cultivation possible."},
        {"crop": "Pepper (Black)","season": "Perennial","sow_months": [5,6],"harvest_months": [1,2,3],"duration_days": 365,"notes": "Kerala is black pepper heartland. Panniyur-1 is popular variety."},
        {"crop": "Ginger",   "season": "Kharif", "sow_months": [4,5,6],  "harvest_months": [11,12],   "duration_days": 210, "notes": "Wayanad ginger has GI tag. Seed rhizome selection critical."},
        {"crop": "Tapioca (Cassava)","season": "Kharif","sow_months": [4,5,6],"harvest_months": [9,10,11,12],"duration_days": 210,"notes": "Staple in Kerala. Hardy, drought-tolerant. Multiple harvests possible."},
    ],
}


# ── Window status helpers ─────────────────────────────────────────
def _window_status(crop_entry: dict, current_month: int) -> str:
    sow = crop_entry["sow_months"]
    if current_month in sow:
        remaining = sorted([m for m in sow if m >= current_month])
        months_left = len(remaining)
        if months_left == 1:
            return "closing_soon"   # last month of the window
        return "open_now"
    # Check if window just closed (prev 1–2 months)
    just_closed = [(m % 12) + 1 for m in [current_month - 1, current_month - 2]]
    if any(m in sow for m in just_closed):
        return "just_closed"
    # Check if window is upcoming (next 1–2 months)
    upcoming = [(current_month % 12) + 1, ((current_month + 1) % 12) + 1]
    if any(m in sow for m in upcoming):
        return "upcoming"
    return "off_season"


MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

STATUS_LABELS = {
    "open_now":      "🟢 SOW NOW",
    "closing_soon":  "🟡 WINDOW CLOSING — sow this month or miss it",
    "upcoming":      "🔵 Coming up — prepare land / nursery",
    "just_closed":   "🔴 Window just closed — wait for next season",
    "off_season":    "⚪ Off-season",
}


def get_crop_calendar(
    state: Optional[str] = None,
    zone: Optional[str]  = None,
    current_month: Optional[int] = None,
    season_filter: Optional[str] = None,   # "Kharif" | "Rabi" | "Zaid" | None
) -> dict:
    """
    Returns the seasonal crop calendar for a given state/zone.

    Parameters
    ----------
    state          : Indian state name (e.g. "Punjab", "Maharashtra")
    zone           : direct zone key override (if state unknown)
    current_month  : 1–12; defaults to today's month
    season_filter  : optional — only return crops for one season

    Returns list of crops with sowing window status, harvest window, and advice.
    """
    today = date.today()
    month = current_month or today.month

    # ── Resolve zone ──────────────────────────────────────────────
    if state:
        zone_key = STATE_ZONE.get(state.strip().lower())
        if not zone_key:
            # Fuzzy fallback: try to match partial name
            for k in STATE_ZONE:
                if state.lower() in k or k in state.lower():
                    zone_key = STATE_ZONE[k]
                    break
        if not zone_key:
            zone_key = "north_igp"   # national default
    elif zone:
        zone_key = zone.strip().lower()
    else:
        zone_key = "north_igp"

    calendar = ZONE_CALENDARS.get(zone_key, ZONE_CALENDARS["north_igp"])

    # ── Filter by season if requested ────────────────────────────
    if season_filter:
        sf = season_filter.capitalize()
        calendar = [c for c in calendar if c["season"] == sf]

    # ── Annotate each crop with window status ─────────────────────
    results = []
    for entry in calendar:
        status = _window_status(entry, month)
        results.append({
            "crop":          entry["crop"],
            "season":        entry["season"],
            "sow_window":    [MONTH_NAMES[m] for m in entry["sow_months"]],
            "harvest_window": [MONTH_NAMES[m] for m in entry["harvest_months"]],
            "duration_days": entry["duration_days"],
            "status":        status,
            "status_label":  STATUS_LABELS[status],
            "advisory":      entry["notes"],
        })

    # ── Sort: open_now first, closing_soon second, upcoming third ─
    priority = {"open_now": 0, "closing_soon": 1, "upcoming": 2, "just_closed": 3, "off_season": 4}
    results.sort(key=lambda r: priority.get(r["status"], 5))

    # ── Summary counts ────────────────────────────────────────────
    sow_now    = [r for r in results if r["status"] in ("open_now", "closing_soon")]
    upcoming_r = [r for r in results if r["status"] == "upcoming"]

    summary_text = f"In {MONTH_NAMES[month]}, you can sow {len(sow_now)} crop(s) right now."
    if upcoming_r:
        summary_text += f" {len(upcoming_r)} crop(s) are coming up — start preparing nurseries/land."

    closing_warn = [r["crop"] for r in results if r["status"] == "closing_soon"]
    if closing_warn:
        summary_text += f" ⚠️ Window closing this month for: {', '.join(closing_warn)}."

    return {
        "state":         state,
        "zone":          zone_key,
        "current_month": MONTH_NAMES[month],
        "season_filter": season_filter,
        "summary":       summary_text,
        "crops":         results,
        "legend": {
            "🟢 SOW NOW":              "Sowing window is open right now",
            "🟡 WINDOW CLOSING":       "Last month of the sowing window — act now",
            "🔵 Coming up":            "Sowing starts next 1–2 months — prepare land/nursery",
            "🔴 Window just closed":   "Too late this season — wait for next cycle",
            "⚪ Off-season":           "Not the right season for this crop",
        },
        "note": (
            "Calendar based on traditional agro-climatic zones for India. "
            "Exact dates vary by local microclimate, variety, and irrigation availability. "
            "Always confirm with your local KVK or Agriculture Extension Officer."
        ),
    }
