"""
icar_thresholds.py
------------------
Step 1 — ICAR Threshold Configuration for CropCare AI Soil Branch

Defines nutrient interpretation ranges for all 7 SHC parameters.

Sources:
  - N, P, K, OC, pH, Zn : ICAR-IISS Bhopal, Soil Health Card Scheme Guidelines (2015)
                           https://agri.bot/soil-health
  - S                    : The Sulphur Institute / ICAR-TSI-FAI-IFA project
                           https://www.sulphurinstitute.org (< 10 ppm = deficient)

Units:
  N, P, K  → kg/ha
  OC       → %
  Zn, S    → ppm
  pH       → dimensionless
"""

# ---------------------------------------------------------------------------
# ICAR Thresholds
# ---------------------------------------------------------------------------

ICAR_THRESHOLDS = {

    "N": {
        "unit": "kg/ha",
        "low":    280,
        "high":   560,
        # < low  → Low_N
        # low–high → Medium_N  (no flag raised; medium is baseline)
        # > high → High_N
    },

    "P": {
        "unit": "kg/ha",
        "low":    10,
        "high":   25,
    },

    "K": {
        "unit": "kg/ha",
        "low":    108,
        "high":   280,
        # Corrected from 145: ICAR-IISS Bhopal threshold is 108 kg/ha
    },

    "OC": {
        "unit": "%",
        "low":    0.50,
        "high":   0.75,
        # < 0.50% → Low_OC
        # 0.50–0.75% → Medium_OC
        # > 0.75% → High_OC
    },

    "pH": {
        "unit": "dimensionless",
        # pH uses named bands, not low/high
        "strongly_acidic":   5.5,   # < 5.5 → Strongly_Acidic_pH
        "acidic":            6.5,   # 5.5–6.5 → Acidic_pH
        "neutral_upper":     7.5,   # 6.5–7.5 → Neutral_pH
        "alkaline":          8.5,   # 7.5–8.5 → Alkaline_pH
                                    # > 8.5   → Strongly_Alkaline_pH
    },

    "Zn": {
        "unit": "ppm",
        "deficient": 0.60,
        # < 0.60 → Low_Zn (DTPA extraction method, ICAR-IISS)
        # ≥ 0.60 → no flag
    },

    "S": {
        "unit": "ppm",
        "deficient": 10.0,
        # < 10 ppm → Low_S  (CaCl2 extraction, ICAR/TSI standard)
        # ≥ 10 ppm → no flag
    },
}


# ---------------------------------------------------------------------------
# Helper: Get threshold for a parameter
# ---------------------------------------------------------------------------

def get_threshold(param: str) -> dict:
    """
    Returns the threshold config for a given parameter name.

    Args:
        param: One of 'N', 'P', 'K', 'OC', 'pH', 'Zn', 'S'

    Returns:
        dict with threshold values and unit

    Raises:
        KeyError if param is not recognised
    """
    if param not in ICAR_THRESHOLDS:
        raise KeyError(
            f"Parameter '{param}' not found. "
            f"Valid parameters: {list(ICAR_THRESHOLDS.keys())}"
        )
    return ICAR_THRESHOLDS[param]


# ---------------------------------------------------------------------------
# Quick verification (run this cell in Colab to confirm thresholds load)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("ICAR Threshold Configuration — Loaded Successfully\n")
    print(f"{'Parameter':<10} {'Unit':<15} {'Thresholds'}")
    print("-" * 60)

    for param, config in ICAR_THRESHOLDS.items():
        unit = config["unit"]
        values = {k: v for k, v in config.items() if k != "unit"}
        print(f"{param:<10} {unit:<15} {values}")