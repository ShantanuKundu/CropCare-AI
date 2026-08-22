# ─────────────────────────────────────────────────────────────────
#  scheme_engine.py  —  CropCare AI
#  Govt. agricultural scheme eligibility checker.
#  Rules are encoded locally; no external API needed.
#  Add new schemes to SCHEMES list as they are announced.
# ─────────────────────────────────────────────────────────────────

from typing import Optional
from dataclasses import dataclass, field

# ── Eligibility result for a single scheme ───────────────────────
@dataclass
class SchemeResult:
    name: str
    category: str          # "insurance" | "subsidy" | "credit" | "income_support"
    eligible: bool
    reason: str            # human-readable verdict
    benefit: str           # what the farmer gets
    how_to_apply: str
    portal: str
    failed_criteria: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────
#  Master scheme definitions
#  Each entry is a lambda(farmer_profile) → SchemeResult
# ─────────────────────────────────────────────────────────────────

def _pmfby(p: dict) -> SchemeResult:
    """PM Fasal Bima Yojana — crop insurance"""
    fails = []
    if p.get("is_tenant") is False and not p.get("has_land_records"):
        fails.append("Land ownership/tenancy documents required")
    if not p.get("crop"):
        fails.append("Crop name is required")
    eligible = len(fails) == 0
    return SchemeResult(
        name         = "PM Fasal Bima Yojana (PMFBY)",
        category     = "insurance",
        eligible     = eligible,
        reason       = "Eligible for crop insurance." if eligible
                       else "Missing: " + "; ".join(fails),
        benefit      = "Crop loss insurance covering up to 100% of sum insured at 2% premium (Kharif), 1.5% (Rabi).",
        how_to_apply = "Visit nearest bank branch, CSC centre, or apply online before the cut-off date of your season.",
        portal       = "https://pmfby.gov.in",
        failed_criteria = fails,
    )


def _pmkisan(p: dict) -> SchemeResult:
    """PM-KISAN — ₹6,000/year income support"""
    fails = []
    if p.get("is_institutional_farmer"):
        fails.append("Institutional farmers (companies, societies) not eligible")
    if p.get("family_income_lakh") and p["family_income_lakh"] > 6:
        fails.append("Family income exceeds ₹6 lakh/year threshold")
    if p.get("is_government_employee"):
        fails.append("Government employees not eligible")
    area = p.get("land_area_hectares")
    # No land ceiling since 2019 amendment — just need to be a landholder
    if area is not None and area <= 0:
        fails.append("Must own or cultivate at least some agricultural land")
    eligible = len(fails) == 0
    return SchemeResult(
        name         = "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        category     = "income_support",
        eligible     = eligible,
        reason       = "Eligible for ₹6,000/year in 3 instalments." if eligible
                       else "Not eligible: " + "; ".join(fails),
        benefit      = "₹6,000/year direct benefit transfer in 3 instalments of ₹2,000.",
        how_to_apply = "Register at pmkisan.gov.in or through nearest CSC/Patwari with Aadhaar, bank account, and land records.",
        portal       = "https://pmkisan.gov.in",
        failed_criteria = fails,
    )


def _kcc(p: dict) -> SchemeResult:
    """Kisan Credit Card — low-interest crop credit"""
    fails = []
    if p.get("has_existing_npa"):
        fails.append("Existing NPA/loan default disqualifies for KCC")
    eligible = len(fails) == 0
    return SchemeResult(
        name         = "Kisan Credit Card (KCC)",
        category     = "credit",
        eligible     = eligible,
        reason       = "Eligible for KCC crop loan at 4% effective interest." if eligible
                       else "Not eligible: " + "; ".join(fails),
        benefit      = "Short-term crop credit up to ₹3 lakh at 4% p.a. (7% - 3% interest subvention).",
        how_to_apply = "Apply at nearest bank (SBI, cooperative bank, RRB) with land records, identity proof, and Aadhaar.",
        portal       = "https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?ID=497",
        failed_criteria = fails,
    )


def _smam(p: dict) -> SchemeResult:
    """Sub-Mission on Agricultural Mechanisation — equipment subsidy"""
    fails = []
    area = p.get("land_area_hectares")
    if area is not None and area > 5:
        fails.append("Priority for small/marginal farmers (≤5 ha), larger farms may receive reduced subsidy")
    eligible = len(fails) == 0
    return SchemeResult(
        name         = "Sub-Mission on Agricultural Mechanisation (SMAM)",
        category     = "subsidy",
        eligible     = eligible,
        reason       = "Eligible for machinery subsidy (40–50% for general; 50–80% for SC/ST/women)." if eligible
                       else "Reduced benefit likely: " + "; ".join(fails),
        benefit      = "40–80% subsidy on tractors, threshers, seed drills, sprayers, and more.",
        how_to_apply = "Apply through your state Agriculture Department or via agrimachinery.nic.in portal.",
        portal       = "https://agrimachinery.nic.in",
        failed_criteria = fails,
    )


def _pmksy(p: dict) -> SchemeResult:
    """PM Krishi Sinchayee Yojana — irrigation subsidy (Drip/Sprinkler)"""
    fails = []
    irrigation = (p.get("irrigation_type") or "").lower()
    if irrigation not in ("", "rainfed", "drip", "sprinkler"):
        fails.append("Scheme targets adoption of micro-irrigation (drip/sprinkler)")
    eligible = len(fails) == 0
    return SchemeResult(
        name         = "PM Krishi Sinchayee Yojana — Per Drop More Crop (PMKSY-PDMC)",
        category     = "subsidy",
        eligible     = eligible,
        reason       = "Eligible for drip/sprinkler installation subsidy." if eligible
                       else "Not eligible: " + "; ".join(fails),
        benefit      = "55% subsidy (small/marginal), 45% (others) on micro-irrigation installation cost.",
        how_to_apply = "Apply through state Horticulture/Agriculture dept or pmksy.gov.in.",
        portal       = "https://pmksy.gov.in",
        failed_criteria = fails,
    )


def _nfsm(p: dict) -> SchemeResult:
    """National Food Security Mission — seeds/inputs for rice, wheat, pulses"""
    target_crops = {"rice", "wheat", "maize", "chickpea", "lentil", "pigeonpeas",
                    "blackgram", "mungbean", "mothbeans", "sorghum"}
    crop = (p.get("crop") or "").lower()
    eligible = crop in target_crops
    return SchemeResult(
        name         = "National Food Security Mission (NFSM)",
        category     = "subsidy",
        eligible     = eligible,
        reason       = f"'{crop}' is a supported NFSM crop — eligible for seed/input subsidy." if eligible
                       else f"'{crop}' is not a target crop under NFSM (rice, wheat, pulses, coarse cereals).",
        benefit      = "Subsidised certified seeds, micronutrients, soil amendments, and farm implements.",
        how_to_apply = "Contact your Block Agriculture Officer or state Agriculture Department.",
        portal       = "https://nfsm.gov.in",
        failed_criteria = [] if eligible else [f"Crop '{crop}' not in NFSM target list"],
    )


def _atma(p: dict) -> SchemeResult:
    """ATMA — extension/training support, available to all farmers"""
    return SchemeResult(
        name         = "Agricultural Technology Management Agency (ATMA)",
        category     = "training",
        eligible     = True,
        reason       = "All farmers are eligible for ATMA training and extension services.",
        benefit      = "Free training, farm demonstrations, exposure visits, and KVK linkage.",
        how_to_apply = "Contact Block Technology Team (BTT) or your nearest Krishi Vigyan Kendra (KVK).",
        portal       = "https://agricoop.nic.in/en/ATMA",
        failed_criteria = [],
    )


# ── Ordered list of scheme checkers ──────────────────────────────
_SCHEME_CHECKERS = [_pmkisan, _pmfby, _kcc, _smam, _pmksy, _nfsm, _atma]


# ── Public API ────────────────────────────────────────────────────
def check_scheme_eligibility(
    crop: Optional[str]            = None,
    land_area_hectares: Optional[float] = None,
    state: Optional[str]           = None,
    irrigation_type: Optional[str] = None,
    is_tenant: Optional[bool]      = None,
    has_land_records: Optional[bool] = True,
    family_income_lakh: Optional[float] = None,
    is_government_employee: Optional[bool] = False,
    is_institutional_farmer: Optional[bool] = False,
    has_existing_npa: Optional[bool] = False,
    farming_type: Optional[str]    = None,
) -> dict:
    """
    Checks eligibility for major Central Govt agricultural schemes.

    Parameters (all optional — provide what you know)
    ----------
    crop                   : crop being grown e.g. "rice"
    land_area_hectares     : farm size in hectares
    state                  : farmer's state (for state-level add-on schemes note)
    irrigation_type        : "rainfed" | "irrigated" | "drip" | "sprinkler"
    is_tenant              : True if tenant farmer
    has_land_records       : True if farmer has patta/RoR documents
    family_income_lakh     : annual family income in lakhs
    is_government_employee : True blocks PM-KISAN
    is_institutional_farmer: True blocks PM-KISAN
    has_existing_npa       : True blocks KCC
    farming_type           : "chemical" | "organic" | "traditional"

    Returns dict with eligible and not_eligible scheme lists.
    """
    profile = dict(
        crop                    = (crop or "").strip().lower(),
        land_area_hectares      = land_area_hectares,
        state                   = state,
        irrigation_type         = irrigation_type,
        is_tenant               = is_tenant,
        has_land_records        = has_land_records,
        family_income_lakh      = family_income_lakh,
        is_government_employee  = is_government_employee,
        is_institutional_farmer = is_institutional_farmer,
        has_existing_npa        = has_existing_npa,
        farming_type            = farming_type,
    )

    results = [checker(profile) for checker in _SCHEME_CHECKERS]

    eligible     = [r for r in results if r.eligible]
    not_eligible = [r for r in results if not r.eligible]

    def serialise(r: SchemeResult) -> dict:
        return {
            "name":             r.name,
            "category":         r.category,
            "eligible":         r.eligible,
            "reason":           r.reason,
            "benefit":          r.benefit,
            "how_to_apply":     r.how_to_apply,
            "portal":           r.portal,
            "failed_criteria":  r.failed_criteria,
        }

    state_note = (
        f"Additionally check {state}-specific schemes at your state agriculture department portal."
        if state else
        "Provide your state to get state-specific scheme recommendations."
    )

    return {
        "profile_used": {k: v for k, v in profile.items() if v is not None and v != False and v != ""},
        "eligible_schemes":     [serialise(r) for r in eligible],
        "not_eligible_schemes": [serialise(r) for r in not_eligible],
        "eligible_count":       len(eligible),
        "total_schemes_checked": len(results),
        "state_note":           state_note,
        "disclaimer": (
            "Eligibility rules are based on published Central Government guidelines as of 2024–25. "
            "Always verify with your Agriculture Department before applying."
        ),
    }
