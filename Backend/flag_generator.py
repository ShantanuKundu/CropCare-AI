"""
flag_generator.py
-----------------
Step 2 — Deficiency Flag Generator for CropCare AI Soil Branch

Takes parsed SHC values, compares against ICAR thresholds (Step 1),
and returns a list of deficiency/excess flags.

Flags generated:
  N    → Low_N | Medium_N | High_N
  P    → Low_P | Medium_P | High_P
  K    → Low_K | Medium_K | High_K
  OC   → Low_OC | Medium_OC | High_OC
  pH   → Strongly_Acidic_pH | Acidic_pH | Neutral_pH | Alkaline_pH | Strongly_Alkaline_pH
  Zn   → Low_Zn  (only raised on deficiency; no flag if sufficient)
  S    → Low_S   (only raised on deficiency; no flag if sufficient)
"""

from icar_thresholds import ICAR_THRESHOLDS
from typing import Optional


# ---------------------------------------------------------------------------
# Individual Flag Functions
# ---------------------------------------------------------------------------

def _flag_npk_oc(param: str, value: float) -> str:
    """
    Generic flag generator for N, P, K, OC — all use low/medium/high bands.
    """
    t = ICAR_THRESHOLDS[param]
    if value < t["low"]:
        return f"Low_{param}"
    elif value <= t["high"]:
        return f"Medium_{param}"
    else:
        return f"High_{param}"


def _flag_ph(value: float) -> str:
    """
    pH uses 5 named bands based on ICAR-IISS Bhopal ranges.
    """
    t = ICAR_THRESHOLDS["pH"]
    if value < t["strongly_acidic"]:
        return "Strongly_Acidic_pH"
    elif value < t["acidic"]:
        return "Acidic_pH"
    elif value <= t["neutral_upper"]:
        return "Neutral_pH"
    elif value <= t["alkaline"]:
        return "Alkaline_pH"
    else:
        return "Strongly_Alkaline_pH"


def _flag_zn(value: float) -> Optional[str]:
    """
    Zn: only flag on deficiency. Returns None if sufficient.
    """
    if value < ICAR_THRESHOLDS["Zn"]["deficient"]:
        return "Low_Zn"
    return None


def _flag_s(value: float) -> Optional[str]:
    """
    S: only flag on deficiency. Returns None if sufficient.
    """
    if value < ICAR_THRESHOLDS["S"]["deficient"]:
        return "Low_S"
    return None


# ---------------------------------------------------------------------------
# Main Flag Generator
# ---------------------------------------------------------------------------

def generate_flags(shc_values: dict) -> dict:
    """
    Compare SHC parameter values against ICAR thresholds and return flags.

    Args:
        shc_values: dict with keys and float values:
            {
                "N":   float,   # kg/ha
                "P":   float,   # kg/ha
                "K":   float,   # kg/ha
                "pH":  float,
                "OC":  float,   # %
                "Zn":  float,   # ppm
                "S":   float,   # ppm
            }
            Any key may be missing or None — skipped gracefully.

    Returns:
        {
            "flags":          list[str],   # all raised flags
            "skipped_params": list[str],   # params missing or None in input
        }
    """
    flags = []
    skipped = []

    # N, P, K, OC — low/medium/high
    for param in ["N", "P", "K", "OC"]:
        val = shc_values.get(param)
        if val is None:
            skipped.append(param)
            continue
        flags.append(_flag_npk_oc(param, float(val)))

    # pH — 5 bands
    ph_val = shc_values.get("pH")
    if ph_val is None:
        skipped.append("pH")
    else:
        flags.append(_flag_ph(float(ph_val)))

    # Zn — deficiency only
    zn_val = shc_values.get("Zn")
    if zn_val is None:
        skipped.append("Zn")
    else:
        flag = _flag_zn(float(zn_val))
        if flag:
            flags.append(flag)

    # S — deficiency only
    s_val = shc_values.get("S")
    if s_val is None:
        skipped.append("S")
    else:
        flag = _flag_s(float(s_val))
        if flag:
            flags.append(flag)

    return {
        "flags": flags,
        "skipped_params": skipped,
    }


# ---------------------------------------------------------------------------
# Test using SHC Sample values
# N=480, P=9.63, K=201, pH=7.30, OC=0.90, Zn=5.32, S=42.00
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    sample_shc = {
        "N":   480.00,
        "P":   9.63,
        "K":   201.00,
        "pH":  7.30,
        "OC":  0.90,
        "Zn":  5.32,
        "S":   42.00,
    }

    result = generate_flags(sample_shc)

    print("SHC Sample — Flag Generation Output")
    print("=" * 40)
    print(f"Flags raised    : {result['flags']}")
    print(f"Skipped params  : {result['skipped_params']}")