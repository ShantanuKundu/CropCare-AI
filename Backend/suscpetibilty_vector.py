"""
susceptibility_vector_generator.py
------------------------------------
Step 4 — Susceptibility Vector Generator for CropCare AI Soil Branch

Takes:
  - A list of deficiency/excess flags (output of Step 2 — flag_generator.py)
  - A crop name (e.g. 'tomato', 'pepper', 'corn', 'potato', 'apple', 'grape')

Returns:
  - A raw susceptibility vector: {disease: raw_score}
  - The per-flag breakdown used to build that vector (for Step 6 explainability)

Design notes:
  - Scores are summed (not averaged) across all raised flags. This is intentional:
    multiple co-occurring deficiencies compound real-world disease risk, and the
    additive model reflects that co-stressor biology.
  - Scores are NOT clipped or normalised here. Normalisation and sigmoid-squashing
    happen downstream in Step 5 (Vulnerability Score Generator), which converts
    raw vectors into interpretable 0–1 scores.
  - Flags not present in the matrix for a given crop are silently skipped and
    recorded in `unmatched_flags` for diagnostics.
  - The "Healthy" pseudo-class is included in the vector. A high negative
    cumulative score on Healthy indicates an overall stressed soil profile.

Supported crops (must match keys in each *_contribution_matrix.py):
  tomato | pepper | corn | potato | apple | grape
"""

from typing import Optional

# ---------------------------------------------------------------------------
# Lazy matrix loader — imports only the matrix for the requested crop
# ---------------------------------------------------------------------------

_MATRIX_REGISTRY: dict[str, str] = {
    "tomato":  "tomato_contribution_matrix",
    "pepper":  "pepper_contribution_matrix",
    "corn":    "corn_contribution_matrix",       # corn lives here
    "potato":  "potato_contribution_matrix",
    "apple":   "apple_contribution_matrix",
    "grape":   "grape_contribution_matrix",
}


def _load_matrix(crop: str) -> dict:
    """
    Dynamically imports the correct contribution matrix module for the crop
    and returns its MATRIX[crop] dict.

    Args:
        crop: lowercase crop name

    Returns:
        dict of {flag: {disease: weight}}

    Raises:
        ValueError if crop is not supported
        ImportError if the module cannot be found
    """
    crop = crop.lower()
    if crop not in _MATRIX_REGISTRY:
        raise ValueError(
            f"Crop '{crop}' is not supported. "
            f"Supported crops: {sorted(_MATRIX_REGISTRY.keys())}"
        )

    module_name = _MATRIX_REGISTRY[crop]

    import importlib
    module = importlib.import_module(module_name)

    # Every matrix module exposes MATRIX[crop_key]
    return module.MATRIX[crop]


# ---------------------------------------------------------------------------
# Core: build_susceptibility_vector
# ---------------------------------------------------------------------------

def build_susceptibility_vector(
    flags: list[str],
    crop: str,
) -> dict:
    """
    Aggregates contribution weights across all raised flags to produce a
    raw disease susceptibility vector for the given crop.

    Args:
        flags:  list of flag strings from flag_generator.generate_flags()
                e.g. ['Low_N', 'Medium_P', 'High_K', 'Neutral_pH', 'Low_Zn']
        crop:   lowercase crop name
                e.g. 'tomato' | 'pepper' | 'corn' | 'potato' | 'apple' | 'grape'

    Returns:
        {
            "crop":             str,
            "flags_used":       list[str],   # flags that matched the matrix
            "unmatched_flags":  list[str],   # flags raised but not in matrix
            "raw_vector":       dict,        # {disease: cumulative_raw_score}
            "flag_breakdown":   dict,        # {flag: {disease: weight}} — for Step 6
        }

    Notes:
        - raw_vector scores are unbounded floats (can be negative or > 1.0).
        - Normalisation into a 0–1 score happens in Step 5.
        - The breakdown preserves per-flag contributions for explainability in Step 6.
    """
    crop = crop.lower()
    matrix = _load_matrix(crop)

    # Initialise accumulators
    raw_vector: dict[str, float] = {}
    flag_breakdown: dict[str, dict[str, float]] = {}
    flags_used: list[str] = []
    unmatched_flags: list[str] = []

    for flag in flags:
        if flag not in matrix:
            unmatched_flags.append(flag)
            continue

        flags_used.append(flag)
        contributions = matrix[flag]          # {disease: weight}
        flag_breakdown[flag] = contributions

        for disease, weight in contributions.items():
            raw_vector[disease] = raw_vector.get(disease, 0.0) + weight

    # Sort raw_vector descending by score for readability
    raw_vector = dict(
        sorted(raw_vector.items(), key=lambda x: x[1], reverse=True)
    )

    return {
        "crop":            crop,
        "flags_used":      flags_used,
        "unmatched_flags": unmatched_flags,
        "raw_vector":      raw_vector,
        "flag_breakdown":  flag_breakdown,
    }


# ---------------------------------------------------------------------------
# Convenience wrapper: flags_to_vector
# (accepts the full generate_flags() output dict directly)
# ---------------------------------------------------------------------------

def flags_to_vector(
    flag_result: dict,
    crop: str,
) -> dict:
    """
    Convenience wrapper — accepts the full dict returned by
    flag_generator.generate_flags() and passes its 'flags' list
    to build_susceptibility_vector().

    Args:
        flag_result:  return value of generate_flags()
                      must contain key 'flags': list[str]
        crop:         lowercase crop name

    Returns:
        Same structure as build_susceptibility_vector()
        plus an additional key:
            "skipped_params": list[str]  — params missing from SHC input
    """
    flags = flag_result.get("flags", [])
    skipped = flag_result.get("skipped_params", [])

    result = build_susceptibility_vector(flags=flags, crop=crop)
    result["skipped_params"] = skipped
    return result


# ---------------------------------------------------------------------------
# Test — SHC Sample values (same as flag_generator.py __main__ block)
# N=480, P=9.63, K=201, pH=7.30, OC=0.90, Zn=5.32, S=42.00
# Crop: tomato
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from flag_generator import generate_flags

    # ── Step 2 output ──────────────────────────────────────────────────
    sample_shc = {
        "N":  480.00,
        "P":  9.63,
        "K":  201.00,
        "pH": 7.30,
        "OC": 0.90,
        "Zn": 5.32,
        "S":  42.00,
    }

    flag_result = generate_flags(sample_shc)
    print("Step 2 — Flags raised:", flag_result["flags"])
    print("Step 2 — Skipped:     ", flag_result["skipped_params"])
    print()

    # ── Step 4 output ──────────────────────────────────────────────────
    for crop in ["tomato", "pepper"]:
        print("=" * 55)
        print(f"Step 4 — Susceptibility Vector  [{crop.upper()}]")
        print("=" * 55)

        result = flags_to_vector(flag_result, crop=crop)

        print(f"Flags matched : {result['flags_used']}")
        print(f"Unmatched     : {result['unmatched_flags']}")
        print()
        print("Raw Susceptibility Vector:")
        print(f"  {'Disease':<40} {'Raw Score':>10}")
        print(f"  {'-'*40} {'-'*10}")
        for disease, score in result["raw_vector"].items():
            print(f"  {disease:<40} {score:>+10.3f}")

        print()
        print("Per-Flag Breakdown:")
        for flag, contribs in result["flag_breakdown"].items():
            print(f"  [{flag}]")
            for disease, w in contribs.items():
                if w != 0.0:
                    print(f"    {disease:<40} {w:>+.2f}")
        print()