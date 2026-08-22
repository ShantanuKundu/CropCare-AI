"""
soil_branch.py
--------------
Step 7 — Soil Branch Entry-Point Wrapper for CropCare AI

This is the single callable interface for the Soil Branch (Branch 2).
It chains all prior soil steps into one call and returns:
  - The full pipeline output (flags, vector, vulnerability scores, breakdown)
  - A normalised disease susceptibility probability vector (sum = 1.0)
    keyed by disease name in the same format as the contribution matrices
    (e.g. "Tomato_Early_Blight", "Tomato_Healthy")

This normalised vector is the direct input consumed by fusion_engine.py
(Branch 3).

Pipeline:
    SHC values
        ↓  Step 2 — flag_generator.generate_flags()
    Deficiency flags
        ↓  Step 4 — suscpetibilty_vector.flags_to_vector()
    Raw susceptibility vector
        ↓  Step 5 — vulnerability_score_generator.compute_vulnerability_scores()
    Sigmoid vulnerability scores
        ↓  Step 6 — contribution_breakdown.build_contribution_breakdown()
    Explainability breakdown
        ↓  Step 7 — normalise sigmoid scores → probability vector
    Soil susceptibility probability vector  ← consumed by fusion_engine.py

Supported crops (must match contribution matrix keys):
    tomato | pepper | corn | potato | apple | grape
"""

from typing import Optional

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalise_vector(scores: dict) -> dict:
    """
    Converts raw sigmoid scores into a probability vector that sums to 1.0.

    Diseases with raw_score == 0.0 (i.e. no flag contributed any evidence
    toward that disease) are excluded from the normalised vector, consistent
    with the same exclusion rule applied during top-disease selection in
    Step 5. This prevents a disease with zero soil evidence from receiving
    a non-trivial probability mass purely as an artefact of the shift
    operation pushing other (genuinely evidenced) diseases negative.

    The Healthy pseudo-class is always retained regardless of its raw_score,
    since it represents the absence of disease rather than a disease itself.

    Args:
        scores: dict[disease_name, {sigmoid_score, risk, raw_score}]

    Returns:
        dict[disease_name, float] — all values in (0, 1), sum == 1.0
    """
    raw: dict[str, float] = {
        disease: entry["sigmoid_score"]
        for disease, entry in scores.items()
        if entry.get("sigmoid_score") is not None
        and (
            entry.get("raw_score", 0.0) != 0.0
            or disease.endswith("_Healthy")
        )
    }

    total = sum(raw.values())
    if total == 0.0:
        # No disease had any evidence — uniform fallback over retained diseases
        n = len(raw)
        return {d: round(1.0 / n, 6) for d in raw} if n > 0 else {}

    return {d: round(v / total, 6) for d, v in raw.items()}


# ---------------------------------------------------------------------------
# Public API: run_soil_branch
# ---------------------------------------------------------------------------

def run_soil_branch(
    crop: str,
    shc_values: dict,
    sigmoid_steepness: Optional[float] = None,
    low_threshold: Optional[float] = None,
    high_threshold: Optional[float] = None,
) -> dict:
    """
    Full Soil Branch pipeline (Steps 2 → 4 → 5 → 6 → 7).

    Args:
        crop:               Lowercase crop name.
                            e.g. 'tomato' | 'pepper' | 'corn' | 'potato' | 'apple' | 'grape'
        shc_values:         Soil Health Card parameter dict.
                            Keys: 'N', 'P', 'K', 'pH', 'OC', 'Zn', 'S'  (any may be None)
                            Units: N/P/K in kg/ha, OC in %, Zn/S in ppm, pH dimensionless
        sigmoid_steepness:  Optional override for vulnerability score sigmoid steepness.
        low_threshold:      Optional override for vulnerability score low-risk threshold.
        high_threshold:     Optional override for vulnerability score high-risk threshold.

    Returns:
        {
            # ── Step 7 outputs ──────────────────────────────────────────
            "crop":                 str,
            "susceptibility_vector": dict[str, float],  # normalised, sums to 1.0
            "top_disease":          str,                # highest-risk disease (soil view)
            "vulnerability_score":  float,              # sigmoid score of top disease

            # ── Step 2 outputs ──────────────────────────────────────────
            "flags":                list[str],
            "skipped_params":       list[str],

            # ── Step 5 outputs ──────────────────────────────────────────
            "soil_health_score":    float,              # 0–1; higher = healthier
            "scores":               dict,               # per-disease sigmoid scores & risk

            # ── Step 6 outputs ──────────────────────────────────────────
            "contribution_breakdown": dict,             # full explainability breakdown
            "narrative":              dict,             # farmer-readable summaries
        }

    Raises:
        ValueError:  if crop is not supported by the contribution matrices
        ImportError: if a required module cannot be found
    """
    from flag_generator import generate_flags
    from suscpetibilty_vector import flags_to_vector
    from vulnerability_score_generator import compute_vulnerability_scores
    from contribution_breakdown import build_contribution_breakdown

    # ── Step 2: Generate deficiency flags ─────────────────────────────
    flag_result = generate_flags(shc_values)

    # ── Step 4: Build raw susceptibility vector ────────────────────────
    vector_result = flags_to_vector(flag_result, crop=crop)

    # ── Step 5: Compute vulnerability (sigmoid) scores ────────────────
    vuln_result = compute_vulnerability_scores(
        vector_result,
        sigmoid_steepness=sigmoid_steepness,
        low_threshold=low_threshold,
        high_threshold=high_threshold,
    )

    # ── Step 6: Build explainability breakdown ─────────────────────────
    breakdown = build_contribution_breakdown(
        vuln_result=vuln_result,
        vector_result=vector_result,
    )

    # ── Step 7: Normalise sigmoid scores → probability vector ──────────
    susceptibility_vector = _normalise_vector(vuln_result.get("scores", {}))

    return {
        # Step 7
        "crop":                   crop.lower(),
        "susceptibility_vector":  susceptibility_vector,
        "top_disease":            vuln_result.get("top_disease"),
        "vulnerability_score":    vuln_result.get("top_score"),

        # Step 2
        "flags":                  flag_result.get("flags", []),
        "skipped_params":         flag_result.get("skipped_params", []),

        # Step 5
        "soil_health_score":      vuln_result.get("soil_health_score"),
        "scores":                 vuln_result.get("scores", {}),

        # Step 6
        "contribution_breakdown": breakdown,
        "narrative":              breakdown.get("narrative", {}),
    }


# ---------------------------------------------------------------------------
# Standalone test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
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
        print(f"Step 7 — Soil Branch Output  [{crop.upper()}]")
        print("=" * 65)

        result = run_soil_branch(crop=crop, shc_values=sample_shc)

        print(f"Top disease         : {result['top_disease']}")
        print(f"Vulnerability score : {result['vulnerability_score']}")
        print(f"Soil health score   : {result['soil_health_score']}")
        print(f"Flags raised        : {result['flags']}")
        print(f"Skipped params      : {result['skipped_params']}")
        print()
        print("Normalised Susceptibility Vector (sums to 1.0):")
        for disease, prob in result["susceptibility_vector"].items():
            print(f"  {disease:<42} {prob:.6f}")
        print()
        print("Narrative:")
        print(f"  {result['narrative'].get('top_disease_summary', '')}")
        print(f"  {result['narrative'].get('soil_health_summary', '')}")
        print()
