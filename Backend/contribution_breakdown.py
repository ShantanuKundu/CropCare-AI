"""
contribution_breakdown.py
--------------------------
Step 6 — Contribution Breakdown for CropCare AI Soil Branch

Takes:
  - The full Step 5 output (compute_vulnerability_scores result)
  - The flag_breakdown from Step 4 (included in vector_result)

Returns:
  - Per-disease explainability: which flags contributed how much, and in
    what direction (risk-increasing vs risk-reducing)
  - A top-flag ranking for the top predicted disease
  - A plain-language explanation string (farmer-readable)
  - A SHAP-style signed contribution table (for researcher/paper use)

──────────────────────────────────────────────────────
DESIGN NOTES
──────────────────────────────────────────────────────
  - This module is purely post-hoc: it reads already-computed weights from
    the contribution matrices and Step 4's flag_breakdown. It does NOT
    re-run any model or re-read the matrix files.
  - Contributions are the raw weight values from the matrix (not sigmoid
    scores). This mirrors SHAP convention: contributions are additive in
    the raw (pre-squash) space.
  - The "Healthy" pseudo-class is included in per-flag breakdowns so that
    soil health explainability is transparent alongside disease explainability.
  - Output is designed to slot directly into the API response for the
    frontend and the paper's Explainability section.
"""

import math
from typing import Optional

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

TOP_FLAGS_N: int = 3
"""
Number of top contributing flags to surface per disease in the
plain-language explanation. Default: 3.
"""

MIN_CONTRIBUTION_DISPLAY: float = 0.0
"""
Flags with |contribution| <= this threshold are excluded from the
farmer-readable text (but retained in the full breakdown table).
Set > 0.0 to suppress near-zero entries from narrative output.
"""

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _direction_label(weight: float) -> str:
    """Returns 'Risk-Increasing' or 'Risk-Reducing' based on weight sign."""
    return "Risk-Increasing" if weight > 0 else "Risk-Reducing"


def _pct_of_total(weight: float, total_positive: float) -> Optional[float]:
    """
    Computes this flag's share of the total positive raw score for a disease.
    Returns None if total_positive == 0 (avoid divide-by-zero).
    """
    if total_positive == 0:
        return None
    return round(abs(weight) / total_positive * 100, 1)


def _flag_to_human(flag: str) -> str:
    """
    Converts a flag string to a short human-readable description.
    e.g. 'Low_N'               → 'Low Nitrogen'
         'High_N'              → 'High Nitrogen'
         'Neutral_pH'          → 'Neutral pH'
         'Strongly_Acidic_pH'  → 'Strongly Acidic pH'
         'Low_Zn'              → 'Low Zinc'
         'Low_S'               → 'Low Sulphur'
         'Low_OC'              → 'Low Organic Carbon'
    """
    _nutrient_map = {
        "N":  "Nitrogen",
        "P":  "Phosphorus",
        "K":  "Potassium",
        "OC": "Organic Carbon",
        "Zn": "Zinc",
        "S":  "Sulphur",
    }

    # pH bands: handle multi-word prefixes first
    ph_labels = {
        "Strongly_Acidic_pH":   "Strongly Acidic pH",
        "Acidic_pH":            "Acidic pH",
        "Neutral_pH":           "Neutral pH",
        "Alkaline_pH":          "Alkaline pH",
        "Strongly_Alkaline_pH": "Strongly Alkaline pH",
    }
    if flag in ph_labels:
        return ph_labels[flag]

    # NPK / OC / micronutrient flags: format is <Level>_<Param>
    parts = flag.split("_", 1)   # split on first underscore only
    if len(parts) == 2:
        level, param = parts
        nutrient = _nutrient_map.get(param, param)
        return f"{level} {nutrient}"

    return flag   # fallback: return as-is


# ---------------------------------------------------------------------------
# Core: build_contribution_breakdown
# ---------------------------------------------------------------------------

def build_contribution_breakdown(
    vuln_result: dict,
    vector_result: dict,
) -> dict:
    """
    Builds per-disease contribution breakdowns from Step 4 flag_breakdown
    and Step 5 vulnerability scores.

    Args:
        vuln_result:    Return value of compute_vulnerability_scores() (Step 5).
                        Must contain: 'crop', 'flags_used', 'top_disease',
                        'top_risk', 'top_score', 'soil_health_score', 'scores'.

        vector_result:  Return value of flags_to_vector() or
                        build_susceptibility_vector() (Step 4).
                        Must contain: 'flag_breakdown', 'raw_vector'.

    Returns:
        {
            "crop":         str,
            "top_disease":  str,
            "top_risk":     str,
            "top_score":    float,

            "per_disease": {
                "<disease>": {
                    "sigmoid_score":    float,
                    "risk":             str,
                    "raw_score":        float,
                    "total_positive":   float,   # sum of all +ve contributions
                    "total_negative":   float,   # sum of all -ve contributions
                    "net_raw":          float,   # total_positive + total_negative
                    "flag_contributions": [      # sorted by |weight| desc
                        {
                            "flag":        str,    # e.g. "Low_N"
                            "flag_human":  str,    # e.g. "Low Nitrogen"
                            "weight":      float,  # raw matrix weight
                            "direction":   str,    # "Risk-Increasing" | "Risk-Reducing"
                            "pct_of_pos":  float | None,  # % of total positive score
                        },
                        ...
                    ]
                }
            },

            "top_disease_breakdown": {            # shortcut: same as per_disease[top_disease]
                ...
            },

            "soil_health": {
                "score":    float,                 # Step 5 sigmoid of Healthy raw
                "raw":      float,                 # raw Healthy score from Step 4
                "interpretation": str,             # human-readable soil health label
                "top_supporting_flags":  list[str],  # flags that helped soil health
                "top_stressing_flags":   list[str],  # flags that hurt soil health
            },

            "narrative": {
                "top_disease_summary":  str,   # one paragraph, farmer-readable
                "soil_health_summary":  str,   # one sentence
            },
        }
    """

    crop:         str        = vuln_result.get("crop", "unknown")
    top_disease:  str        = vuln_result.get("top_disease")
    top_risk:     str        = vuln_result.get("top_risk")
    top_score:    float      = vuln_result.get("top_score")
    scores:       dict       = vuln_result.get("scores", {})
    soil_health:  float      = vuln_result.get("soil_health_score")

    flag_breakdown: dict     = vector_result.get("flag_breakdown", {})
    raw_vector:     dict     = vector_result.get("raw_vector", {})

    # ── Identify healthy key ──────────────────────────────────────────
    healthy_key = next(
        (k for k in raw_vector if k.endswith("_Healthy")), None
    )
    disease_keys = [k for k in scores if k != healthy_key]

    # ── Build per-disease breakdown ───────────────────────────────────
    per_disease: dict = {}

    for disease in disease_keys:
        disease_scores = scores.get(disease, {})
        contributions = []

        total_positive = 0.0
        total_negative = 0.0

        for flag, flag_contribs in flag_breakdown.items():
            weight = flag_contribs.get(disease, 0.0)
            if weight == 0.0:
                continue
            contributions.append({
                "flag":       flag,
                "flag_human": _flag_to_human(flag),
                "weight":     round(weight, 4),
                "direction":  _direction_label(weight),
            })
            if weight > 0:
                total_positive += weight
            else:
                total_negative += weight

        # Attach % of positive total
        for c in contributions:
            c["pct_of_pos"] = _pct_of_total(c["weight"], total_positive)

        # Sort by absolute weight descending
        contributions.sort(key=lambda x: abs(x["weight"]), reverse=True)

        per_disease[disease] = {
            "sigmoid_score":      disease_scores.get("sigmoid_score"),
            "risk":               disease_scores.get("risk"),
            "raw_score":          disease_scores.get("raw_score"),
            "total_positive":     round(total_positive, 4),
            "total_negative":     round(total_negative, 4),
            "net_raw":            round(total_positive + total_negative, 4),
            "flag_contributions": contributions,
        }

    # ── Soil health breakdown ─────────────────────────────────────────
    soil_health_entry: dict = {}
    if healthy_key:
        healthy_raw = raw_vector.get(healthy_key, 0.0)
        healthy_contribs_pos = []
        healthy_contribs_neg = []

        for flag, flag_contribs in flag_breakdown.items():
            w = flag_contribs.get(healthy_key, 0.0)
            if w == 0.0:
                continue
            entry = (flag, round(w, 4))
            if w > 0:
                healthy_contribs_pos.append(entry)
            else:
                healthy_contribs_neg.append(entry)

        # Sort by magnitude
        healthy_contribs_pos.sort(key=lambda x: x[1], reverse=True)
        healthy_contribs_neg.sort(key=lambda x: x[1])   # most negative first

        # Soil health interpretation
        if soil_health is None:
            interpretation = "Unknown"
        elif soil_health >= 0.60:
            interpretation = "Good"
        elif soil_health >= 0.45:
            interpretation = "Moderate"
        else:
            interpretation = "Poor"

        soil_health_entry = {
            "score":                soil_health,
            "raw":                  round(healthy_raw, 4),
            "interpretation":       interpretation,
            "top_supporting_flags": [_flag_to_human(f) for f, _ in healthy_contribs_pos[:TOP_FLAGS_N]],
            "top_stressing_flags":  [_flag_to_human(f) for f, _ in healthy_contribs_neg[:TOP_FLAGS_N]],
        }

    # ── Narrative generation ──────────────────────────────────────────
    narrative = _build_narrative(
        crop=crop,
        top_disease=top_disease,
        top_risk=top_risk,
        top_score=top_score,
        per_disease=per_disease,
        soil_health_entry=soil_health_entry,
    )

    return {
        "crop":                 crop,
        "top_disease":          top_disease,
        "top_risk":             top_risk,
        "top_score":            top_score,
        "per_disease":          per_disease,
        "top_disease_breakdown": per_disease.get(top_disease, {}),
        "soil_health":          soil_health_entry,
        "narrative":            narrative,
    }


# ---------------------------------------------------------------------------
# Narrative builder
# ---------------------------------------------------------------------------

def _build_narrative(
    crop: str,
    top_disease: Optional[str],
    top_risk: Optional[str],
    top_score: Optional[float],
    per_disease: dict,
    soil_health_entry: dict,
) -> dict:
    """
    Builds farmer-readable plain-language summaries.

    Top disease summary: states the disease, risk level, and lists the
    top contributing soil flags by magnitude.

    Soil health summary: one sentence on soil health score.
    """

    # ── Top disease narrative ─────────────────────────────────────────
    if not top_disease or not per_disease.get(top_disease):
        top_disease_summary = (
            "No disease risk could be determined from the available soil data."
        )
    else:
        td_data    = per_disease[top_disease]
        contribs   = [
            c for c in td_data["flag_contributions"]
            if abs(c["weight"]) > MIN_CONTRIBUTION_DISPLAY
        ]
        risk_contribs    = [c for c in contribs if c["direction"] == "Risk-Increasing"]
        protect_contribs = [c for c in contribs if c["direction"] == "Risk-Reducing"]

        disease_display = top_disease.replace("_", " ")
        risk_phrase = {
            "High":     "high risk",
            "Moderate": "moderate risk",
            "Low":      "low risk",
        }.get(top_risk, "undetermined risk")

        # Primary risk factors
        if risk_contribs:
            top_risk_flags = ", ".join(
                c["flag_human"] for c in risk_contribs[:TOP_FLAGS_N]
            )
            risk_sentence = (
                f"The primary soil risk factors are: {top_risk_flags}."
            )
        else:
            risk_sentence = "No major soil-based risk factors were identified."

        # Protective factors
        if protect_contribs:
            top_protect_flags = ", ".join(
                c["flag_human"] for c in protect_contribs[:TOP_FLAGS_N]
            )
            protect_sentence = (
                f"Soil factors providing some protection include: {top_protect_flags}."
            )
        else:
            protect_sentence = ""

        top_disease_summary = (
            f"Based on the soil profile, the crop shows {risk_phrase} for "
            f"{disease_display} (vulnerability score: {top_score:.2f}). "
            f"{risk_sentence} {protect_sentence}".strip()
        )

    # ── Soil health narrative ─────────────────────────────────────────
    interp      = soil_health_entry.get("interpretation", "Unknown")
    sh_score    = soil_health_entry.get("score")
    stressors   = soil_health_entry.get("top_stressing_flags", [])

    if sh_score is None:
        soil_health_summary = "Soil health could not be determined."
    elif interp == "Good":
        soil_health_summary = (
            f"Soil health is good (score: {sh_score:.2f}), indicating a well-balanced "
            f"nutrient profile that supports crop immunity."
        )
    elif interp == "Moderate":
        stress_text = f" Key stressors: {', '.join(stressors)}." if stressors else ""
        soil_health_summary = (
            f"Soil health is moderate (score: {sh_score:.2f}).{stress_text} "
            f"Addressing the flagged deficiencies would improve disease resistance."
        )
    else:
        stress_text = f" Key stressors: {', '.join(stressors)}." if stressors else ""
        soil_health_summary = (
            f"Soil health is poor (score: {sh_score:.2f}).{stress_text} "
            f"Significant nutrient corrections are recommended before the next crop cycle."
        )

    return {
        "top_disease_summary": top_disease_summary,
        "soil_health_summary": soil_health_summary,
    }


# ---------------------------------------------------------------------------
# Convenience wrapper: full pipeline (Steps 2 → 4 → 5 → 6) in one call
# ---------------------------------------------------------------------------

def shc_to_full_explanation(
    shc_values: dict,
    crop: str,
) -> dict:
    """
    Full pipeline wrapper: SHC values → flags → vector → scores → breakdown.

    Returns the Step 6 breakdown dict plus:
        "flags":          list[str]   — Step 2 flags
        "skipped_params": list[str]   — missing SHC params
        "vuln_scores":    dict        — full Step 5 output
    """
    from flag_generator import generate_flags
    from suscpetibilty_vector import flags_to_vector
    from vulnerability_score_generator import compute_vulnerability_scores

    flag_result   = generate_flags(shc_values)
    vector_result = flags_to_vector(flag_result, crop=crop)
    vuln_result   = compute_vulnerability_scores(vector_result)

    breakdown = build_contribution_breakdown(
        vuln_result=vuln_result,
        vector_result=vector_result,
    )

    breakdown["flags"]          = flag_result["flags"]
    breakdown["skipped_params"] = flag_result["skipped_params"]
    breakdown["vuln_scores"]    = vuln_result
    return breakdown


# ---------------------------------------------------------------------------
# Test — same SHC sample used across all prior steps
# N=480, P=9.63, K=201, pH=7.30, OC=0.90, Zn=5.32, S=42.00
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from flag_generator import generate_flags
    from suscpetibilty_vector import flags_to_vector
    from vulnerability_score_generator import compute_vulnerability_scores

    sample_shc = {
        "N":  480.00,
        "P":  9.63,
        "K":  201.00,
        "pH": 7.30,
        "OC": 0.90,
        "Zn": 5.32,
        "S":  42.00,
    }

    for crop in ["tomato", "pepper"]:
        print("=" * 65)
        print(f"Step 6 — Contribution Breakdown  [{crop.upper()}]")
        print("=" * 65)

        flag_result   = generate_flags(sample_shc)
        vector_result = flags_to_vector(flag_result, crop=crop)
        vuln_result   = compute_vulnerability_scores(vector_result)
        result        = build_contribution_breakdown(vuln_result, vector_result)

        print(f"Top Disease  : {result['top_disease']}")
        print(f"Risk Level   : {result['top_risk']}  ({result['top_score']:.4f})")
        print()

        # ── Top disease breakdown ──────────────────────────────────────
        print(f"  ── Contribution Breakdown: {result['top_disease']} ──")
        td = result["top_disease_breakdown"]
        print(f"  Net raw score      : {td.get('net_raw', 'N/A'):+.4f}")
        print(f"  Total positive     : {td.get('total_positive', 'N/A'):+.4f}")
        print(f"  Total negative     : {td.get('total_negative', 'N/A'):+.4f}")
        print()
        print(f"  {'Flag':<25} {'Weight':>8}  {'Direction':<17}  {'% of Pos'}")
        print(f"  {'-'*25} {'-'*8}  {'-'*17}  {'-'*8}")
        for c in td.get("flag_contributions", []):
            pct = f"{c['pct_of_pos']:.1f}%" if c["pct_of_pos"] is not None else "  —"
            print(
                f"  {c['flag_human']:<25} {c['weight']:>+8.4f}  "
                f"{c['direction']:<17}  {pct}"
            )
        print()

        # ── Soil health ────────────────────────────────────────────────
        sh = result["soil_health"]
        print(f"  ── Soil Health ──")
        print(f"  Score          : {sh.get('score', 'N/A'):.4f}  ({sh.get('interpretation', 'N/A')})")
        print(f"  Supporting     : {sh.get('top_supporting_flags', [])}")
        print(f"  Stressors      : {sh.get('top_stressing_flags', [])}")
        print()

        # ── Narrative ─────────────────────────────────────────────────
        print(f"  ── Narrative ──")
        print(f"  {result['narrative']['top_disease_summary']}")
        print(f"  {result['narrative']['soil_health_summary']}")
        print()