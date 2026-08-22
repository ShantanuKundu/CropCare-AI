"""
fusion_engine.py
----------------
Branch 3 — Weighted Late Fusion Engine for CropCare AI

Explainable Multimodal Crop Disease Detection Using Leaf Image Analysis
and Soil Health Card-Based Disease Susceptibility Fusion.

ARCHITECTURE
------------
Branch 1 (Image)  → EfficientNetB0 / PlantVillage
                    Output: disease probability vector  (softmax, sums to 1.0)
                    Key format: PlantVillage class names
                    e.g.  "Tomato___Early_blight"

Branch 2 (Soil)   → Knowledge-engineered rule system (soil_branch.run_soil_branch)
                    Output: susceptibility_vector (sigmoid-normalised, sums to 1.0)
                    Key format: contribution matrix disease names
                    e.g.  "Tomato_Early_Blight"

Branch 3 (Fusion) → This module
                    Method: Weighted Late Fusion
                    Formula: Final = w_image × Image + w_soil × Soil
                    Defaults: w_image = 0.70, w_soil = 0.30

DESIGN PRINCIPLES
-----------------
- No ML model in this layer — pure weighted arithmetic.
- Both input vectors are normalised to sum to 1.0 before fusion.
- Disease key spaces must match exactly after name translation.
- Fusion weights are fully configurable at call time (not hardcoded constants).
- The image branch is dominant: it carries direct visual evidence.
  The soil branch is supporting/contextual evidence.
- All operations are transparent and auditable for research explainability.

CLASS-NAME TRANSLATION
-----------------------
PlantVillage class names (image branch) use the format:
    <Crop>___<Disease>   (triple underscore, mixed/lower case)
    e.g. "Tomato___Early_blight"

Contribution matrix disease keys (soil branch) use the format:
    <Crop>_<Disease>     (single underscore, title case)
    e.g. "Tomato_Early_Blight"

A hard-coded translation table covers all 27 PlantVillage classes supported
by the six-crop model.  Keys not in the table are rejected with a clear error.

NORMALISATION CONTRACT
-----------------------
Both vectors MUST sum to 1.0 after normalisation.
    - If the image vector already sums to ~1.0 (softmax), it is re-normalised
      to exactly 1.0 to absorb any floating-point drift.
    - If the soil vector sums to ~1.0 (from soil_branch step 7), same applies.
    - If any vector sums to 0, a ValueError is raised.

FUSION FORMULA
--------------
    for each disease d in the shared disease space:
        final[d] = w_image * image_norm[d] + w_soil * soil_norm[d]

    The final vector is NOT re-normalised after fusion because it already sums
    to 1.0 by linearity:
        sum(final) = w_image * sum(image) + w_soil * sum(soil)
                   = w_image * 1.0 + w_soil * 1.0
                   = (w_image + w_soil) = 1.0   (when weights sum to 1.0)

OUTPUT
------
{
    "crop":           str,
    "fusion_weights": {"image": float, "soil": float},
    "top_3": [
        {"disease": str, "score": float, "rank": int},
        ...
    ],
    "full_vector":    {disease: float, ...},   # all diseases, sorted by score
    "image_vector":   {disease: float, ...},   # normalised input (soil keyspace)
    "soil_vector":    {disease: float, ...},   # normalised input
    "recommendation": str,                     # combined agronomic recommendation
    "fusion_meta": {
        "diseases_fused":     int,
        "image_top_disease":  str,
        "soil_top_disease":   str,
        "agreement":          bool,            # image & soil agree on top-1?
        "weight_note":        str,
    }
}
"""

from __future__ import annotations
from typing import Optional

# ---------------------------------------------------------------------------
# Default fusion weights — overridable at call time, NOT used as bare constants
# ---------------------------------------------------------------------------

DEFAULT_IMAGE_WEIGHT: float = 0.70
DEFAULT_SOIL_WEIGHT:  float = 0.30

# ---------------------------------------------------------------------------
# PlantVillage → Soil-Branch disease name translation table
#
# Key:   PlantVillage class name (as in six-crop-classes.json)
# Value: Contribution matrix disease key (as in *_contribution_matrix.py)
#
# Covers all 27 classes in the six-crop EfficientNetB0 model.
# ---------------------------------------------------------------------------

_PV_TO_SOIL: dict[str, str] = {

    # ── Tomato (6 disease classes + healthy) ─────────────────────────
    "Tomato___Bacterial_spot":                      "Tomato_Bacterial_Spot",
    "Tomato___Early_blight":                        "Tomato_Early_Blight",
    "Tomato___Late_blight":                         "Tomato_Late_Blight",
    "Tomato___Leaf_Mold":                           "Tomato_Leaf_Mold",
    "Tomato___Septoria_leaf_spot":                  "Tomato_Septoria_Leaf_Spot",
    "Tomato___Spider_mites Two-spotted_spider_mite":"Tomato_Spider_Mites",
    "Tomato___Target_Spot":                         "Tomato_Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus":       "Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus":                 "Tomato_Mosaic_Virus",
    "Tomato___healthy":                             "Tomato_Healthy",

    # ── Potato (2 disease classes + healthy) ─────────────────────────
    "Potato___Early_blight":                        "Potato_Early_Blight",
    "Potato___Late_blight":                         "Potato_Late_Blight",
    "Potato___healthy":                             "Potato_Healthy",

    # ── Pepper (1 disease class + healthy) ───────────────────────────
    "Pepper_Bell___Bacterial_spot":                "Pepper_Bacterial_Spot",
    "Pepper_Bell___healthy":                       "Pepper_Healthy",

    # ── Apple (3 disease classes + healthy) ──────────────────────────
    "Apple___Apple_scab":                           "Apple_Scab",
    "Apple___Black_rot":                            "Apple_Black_Rot",
    "Apple___Cedar_apple_rust":                     "Apple_Cedar_Rust",
    "Apple___healthy":                              "Apple_Healthy",

    # ── Grape (3 disease classes + healthy) ──────────────────────────
    "Grape___Black_rot":                            "Grape_Black_Rot",
    "Grape___Esca_(Black_Measles)":                 "Grape_Esca",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)":   "Grape_Leaf_Blight",
    "Grape___healthy":                              "Grape_Healthy",

    # ── Corn/Maize (3 disease classes + healthy) ─────────────────────
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Corn_Gray_Leaf_Spot",
    "Corn_(maize)___Common_rust_":                        "Corn_Common_Rust",
    "Corn_(maize)___Northern_Leaf_Blight":                "Corn_Northern_Leaf_Blight",
    "Corn_(maize)___healthy":                             "Corn_Healthy",
}

# Reverse mapping: soil key → PlantVillage key (for diagnostics)
_SOIL_TO_PV: dict[str, str] = {v: k for k, v in _PV_TO_SOIL.items()}


# ---------------------------------------------------------------------------
# Crop name → set of soil-branch disease keys (for quick lookup)
# ---------------------------------------------------------------------------

_CROP_PREFIX: dict[str, str] = {
    "tomato":  "Tomato",
    "potato":  "Potato",
    "pepper":  "Pepper",
    "apple":   "Apple",
    "grape":   "Grape",
    "corn":    "Corn",
    "maize":   "Corn",   # alias
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalise(vector: dict[str, float]) -> dict[str, float]:
    """
    Normalises a score vector so that all values sum to exactly 1.0.

    Args:
        vector: {disease_key: score}  — scores must be non-negative

    Returns:
        Normalised dict with same keys.

    Raises:
        ValueError if total is 0 or any value is negative.
    """
    if not vector:
        raise ValueError("Cannot normalise an empty vector.")

    negative_keys = [k for k, v in vector.items() if v < 0]
    if negative_keys:
        raise ValueError(
            f"Vector contains negative values for: {negative_keys}. "
            "Ensure the soil branch returns sigmoid-normalised scores "
            "(all ≥ 0) before passing to the fusion engine."
        )

    total = sum(vector.values())
    if total == 0.0:
        raise ValueError(
            "Vector sums to zero — cannot normalise. "
            "Check that the branch outputs are non-zero."
        )

    return {k: round(v / total, 8) for k, v in vector.items()}


def _translate_image_vector(
    image_vector: dict[str, float],
    crop: str,
) -> dict[str, float]:
    """
    Translates PlantVillage class names to soil-branch disease key format.

    Also filters the image vector to only include classes that belong
    to the specified crop (prevents cross-crop class contamination when
    the full 27-class softmax is passed).

    Args:
        image_vector:  {PlantVillage_class_name: probability}
        crop:          lowercase crop name e.g. 'tomato'

    Returns:
        {soil_branch_key: probability}  — crop-filtered & translated

    Raises:
        ValueError if crop is unsupported or no classes survive the filter.
    """
    crop_l = crop.lower().strip()
    prefix = _CROP_PREFIX.get(crop_l)
    if prefix is None:
        raise ValueError(
            f"Crop '{crop}' is not supported by the fusion engine. "
            f"Supported crops: {sorted(_CROP_PREFIX.keys())}"
        )

    translated: dict[str, float] = {}
    unknown_keys: list[str] = []

    for pv_key, score in image_vector.items():
        if pv_key in _PV_TO_SOIL:
            soil_key = _PV_TO_SOIL[pv_key]
            # Filter to this crop only
            if soil_key.startswith(prefix):
                translated[soil_key] = score
        else:
            unknown_keys.append(pv_key)

    if unknown_keys:
        # Non-fatal warning: classes not in the translation table are skipped
        import logging
        logging.getLogger(__name__).warning(
            "fusion_engine: Image vector contains unrecognised class names "
            "(not in translation table) — these are skipped: %s",
            unknown_keys,
        )

    if not translated:
        raise ValueError(
            f"No image vector classes could be mapped to crop '{crop}'. "
            f"Received image keys: {list(image_vector.keys())}. "
            "Ensure the image branch returns PlantVillage class names "
            "and the crop name matches."
        )

    return translated


def _align_vectors(
    image_translated: dict[str, float],
    soil_vector:      dict[str, float],
) -> tuple[dict[str, float], dict[str, float]]:
    """
    Aligns two disease vectors to the same shared key space.

    Both vectors must cover exactly the same set of disease keys.
    If the image vector contains keys absent in the soil vector, or
    vice versa, they are added with a score of 0.0 in the missing branch.

    This is a lenient alignment: it accommodates small matrix coverage
    differences without raising errors, while ensuring both vectors
    remain valid for normalisation.

    Returns:
        (aligned_image, aligned_soil) — both covering the union key set.
    """
    all_keys = set(image_translated.keys()) | set(soil_vector.keys())

    aligned_image = {k: image_translated.get(k, 0.0) for k in all_keys}
    aligned_soil  = {k: soil_vector.get(k, 0.0)      for k in all_keys}

    return aligned_image, aligned_soil


def _build_recommendation(
    crop:          str,
    top_disease:   str,
    top_score:     float,
    image_top:     str,
    soil_top:      str,
    agreement:     bool,
    w_image:       float,
    w_soil:        float,
) -> str:
    """
    Generates a combined agronomic recommendation string based on fusion results.

    The recommendation integrates:
    - Whether the image and soil branches agree on the primary threat
    - The confidence level of the fused prediction
    - Crop-specific general guidance for the top predicted disease

    Args:
        crop:        lowercase crop name
        top_disease: fused top-1 disease key (soil format)
        top_score:   fused top-1 score (0–1)
        image_top:   image branch top-1 disease key (soil format)
        soil_top:    soil branch top-1 disease key (soil format)
        agreement:   True if image_top == soil_top
        w_image:     image fusion weight
        w_soil:      soil fusion weight

    Returns:
        Human-readable agronomic recommendation string.
    """

    disease_display = top_disease.replace("_", " ") if top_disease else "Unknown"
    crop_display    = crop.capitalize()

    # Confidence framing
    if top_score >= 0.55:
        confidence_phrase = "with high confidence"
    elif top_score >= 0.35:
        confidence_phrase = "with moderate confidence"
    else:
        confidence_phrase = "with low confidence"

    # Agreement framing
    if agreement:
        evidence_phrase = (
            f"Both the leaf image analysis (weight: {w_image:.0%}) and the "
            f"soil health profile (weight: {w_soil:.0%}) independently "
            f"identified {disease_display} as the primary threat — "
            "strengthening the diagnostic confidence."
        )
    else:
        evidence_phrase = (
            f"The leaf image analysis (weight: {w_image:.0%}) detected "
            f"{image_top.replace('_', ' ')} as the primary visual symptom, "
            f"while the soil health profile (weight: {w_soil:.0%}) indicates "
            f"elevated susceptibility to {soil_top.replace('_', ' ')}. "
            f"The fused prediction prioritises {disease_display} based on "
            "weighted evidence."
        )

    # Disease-specific agronomic guidance (extends as disease library grows)
    _AGRONOMIC_TIPS: dict[str, str] = {
        # ── Tomato ──────────────────────────────────────────────────
        "Tomato_Early_Blight": (
            "Apply copper-based or mancozeb fungicides at 7–10 day intervals. "
            "Remove infected lower leaves. Ensure adequate nitrogen nutrition "
            "to reduce plant stress and slow Alternaria progression."
        ),
        "Tomato_Late_Blight": (
            "Immediately apply systemic fungicides (metalaxyl/mancozeb). "
            "Avoid overhead irrigation. Reduce excess nitrogen. "
            "Destroy infected plant material to limit Phytophthora spread."
        ),
        "Tomato_Bacterial_Spot": (
            "Apply copper bactericide sprays. Avoid working in the field "
            "when plants are wet. Ensure soil pH is below 7.5 to reduce "
            "bacterial wilt pressure. Use certified disease-free seed."
        ),
        "Tomato_Leaf_Mold": (
            "Improve greenhouse/field ventilation to reduce humidity. "
            "Apply fungicides (chlorothalonil or mancozeb). Avoid excess "
            "nitrogen — lush canopy growth traps moisture and favours Fulvia fulva."
        ),
        "Tomato_Mosaic_Virus": (
            "No curative treatment is available. Remove and destroy infected "
            "plants immediately. Control aphid vectors. Sanitise tools "
            "with 10% bleach solution. Use resistant varieties in subsequent seasons."
        ),
        "Tomato_Septoria_Leaf_Spot": (
            "Apply fungicides (chlorothalonil or mancozeb) at first sign. "
            "Remove and destroy infected leaves. Maintain 3-year crop rotation. "
            "Avoid overhead watering."
        ),
        "Tomato_Spider_Mites": (
            "Apply acaricides (abamectin or spiromesifen). Increase humidity "
            "around plants — spider mites thrive in hot, dry conditions. "
            "Introduce predatory mites (Phytoseiulus persimilis) for biocontrol."
        ),
        "Tomato_Yellow_Leaf_Curl_Virus": (
            "Control whitefly vectors with imidacloprid or yellow sticky traps. "
            "Use virus-resistant tomato varieties. Remove and destroy infected "
            "plants. There is no curative treatment for TYLCV."
        ),
        "Tomato_Target_Spot": (
            "Apply strobilurin or triazole fungicides. Improve airflow through "
            "pruning. Avoid excessive nitrogen. Rotate crops for 2–3 seasons."
        ),
        "Tomato_Healthy": (
            "No disease detected. Maintain current soil health and foliar "
            "management practices. Continue regular monitoring."
        ),

        # ── Potato ──────────────────────────────────────────────────
        "Potato_Early_Blight": (
            "Apply mancozeb or chlorothalonil fungicides. Ensure adequate "
            "potassium nutrition to strengthen cell walls. Avoid water stress. "
            "Remove heavily infected foliage."
        ),
        "Potato_Late_Blight": (
            "Apply systemic fungicides (metalaxyl or fluopicolide). "
            "Avoid overhead irrigation. Destroy infected crop debris. "
            "Monitor daily during humid conditions — P. infestans spreads rapidly."
        ),
        "Potato_Healthy": (
            "No disease detected. Maintain proper hilling, irrigation scheduling, "
            "and balanced NPK fertilisation."
        ),

        # ── Pepper ──────────────────────────────────────────────────
        "Pepper_Bacterial_Spot": (
            "Apply copper-based bactericides. Avoid overhead irrigation. "
            "Rotate with non-solanaceous crops for at least 2 years. "
            "Use pathogen-free transplants."
        ),
        "Pepper_Healthy": (
            "No disease detected. Maintain soil pH between 6.0–6.8 and "
            "balanced fertilisation for continued plant health."
        ),

        # ── Apple ───────────────────────────────────────────────────
        "Apple_Scab": (
            "Apply fungicides (captan or myclobutanil) during primary infection "
            "period (green tip to petal fall). Rake and destroy fallen leaves "
            "in autumn. Use scab-resistant apple varieties."
        ),
        "Apple_Black_Rot": (
            "Prune and remove infected wood, mummified fruit, and cankers. "
            "Apply fungicide sprays from bloom through summer. "
            "Improve orchard sanitation and airflow."
        ),
        "Apple_Cedar_Rust": (
            "Apply fungicides (myclobutanil or triadimefon) from tight cluster "
            "through cover spray. Remove nearby juniper/cedar hosts where possible. "
            "Use rust-resistant apple cultivars."
        ),
        "Apple_Healthy": (
            "No disease detected. Continue standard orchard management — "
            "balanced nutrition, adequate irrigation, and dormant pruning."
        ),

        # ── Grape ───────────────────────────────────────────────────
        "Grape_Black_Rot": (
            "Apply fungicides (mancozeb or myclobutanil) from bud break through "
            "post-bloom. Remove mummified berries and infected tendrils. "
            "Prune for canopy airflow."
        ),
        "Grape_Esca": (
            "No fully effective curative treatment. Remove infected wood "
            "and apply wound sealants. Avoid water stress. "
            "Consider trunk renewal for severely affected vines."
        ),
        "Grape_Leaf_Blight": (
            "Apply copper or mancozeb-based fungicides. Improve canopy management "
            "for air circulation. Avoid late-season nitrogen which extends "
            "the growing season and increases infection window."
        ),
        "Grape_Healthy": (
            "No disease detected. Maintain balanced nutrition and canopy "
            "management to sustain current health status."
        ),

        # ── Corn ───────────────────────────────────────────────────
        "Corn_Gray_Leaf_Spot": (
            "Use resistant hybrid varieties. Apply foliar fungicides (strobilurins) "
            "at tassel emergence if disease pressure is high. "
            "Improve air circulation through wider row spacing."
        ),
        "Corn_Common_Rust": (
            "Apply triazole or strobilurin fungicides when rust pustules are "
            "first observed. Use resistant hybrids. "
            "Early-planted corn typically escapes heavy rust pressure."
        ),
        "Corn_Northern_Leaf_Blight": (
            "Plant resistant hybrids. Apply fungicides (propiconazole or azoxystrobin) "
            "from tassel emergence. "
            "Rotate crops and incorporate residue to reduce inoculum."
        ),
        "Corn_Healthy": (
            "No disease detected. Maintain balanced nitrogen and potassium "
            "nutrition and monitor for early disease symptoms."
        ),
    }

    agronomic_tip = _AGRONOMIC_TIPS.get(
        top_disease,
        f"Consult a local agronomist for {disease_display} management guidance."
    )

    recommendation = (
        f"[{crop_display} — Fused Diagnosis]\n"
        f"Primary predicted disease: {disease_display} "
        f"(fused score: {top_score:.3f}, {confidence_phrase}).\n\n"
        f"{evidence_phrase}\n\n"
        f"Recommended action: {agronomic_tip}"
    )

    return recommendation


# ---------------------------------------------------------------------------
# Public API: run_fusion
# ---------------------------------------------------------------------------

def run_fusion(
    crop:          str,
    image_vector:  dict[str, float],
    soil_vector:   dict[str, float],
    image_weight:  Optional[float] = None,
    soil_weight:   Optional[float] = None,
) -> dict:
    """
    Weighted late fusion of Image Branch and Soil Branch disease vectors.

    Args:
        crop:          Lowercase crop name.
                       e.g. 'tomato' | 'potato' | 'pepper' | 'apple' | 'grape' | 'corn'

        image_vector:  Disease probability vector from Branch 1 (Image).
                       Keys MUST be PlantVillage class names from six-crop-classes.json.
                       e.g. {"Tomato___Early_blight": 0.72, "Tomato___healthy": 0.02, ...}
                       Values should be softmax probabilities (non-negative, ideally sum ≈ 1.0).

        soil_vector:   Disease susceptibility probability vector from Branch 2 (Soil).
                       Keys MUST be contribution-matrix disease names.
                       e.g. {"Tomato_Early_Blight": 0.45, "Tomato_Healthy": 0.10, ...}
                       Typically the 'susceptibility_vector' from run_soil_branch().

        image_weight:  Weight for Image Branch in fusion (default: 0.70).
                       Must be in (0, 1). image_weight + soil_weight need not sum to 1.0;
                       both are independently normalised if their sum != 1.0.

        soil_weight:   Weight for Soil Branch in fusion (default: 0.30).
                       Must be in (0, 1).

    Returns:
        {
            "crop":           str,
            "fusion_weights": {"image": float, "soil": float},
            "top_3": [
                {"disease": str, "score": float, "rank": int},
                ...  (up to 3; fewer if fewer diseases in vector)
            ],
            "full_vector":  {disease: float},    # all diseases, score desc
            "image_vector": {disease: float},    # normalised, soil keyspace
            "soil_vector":  {disease: float},    # normalised
            "recommendation": str,
            "fusion_meta": {
                "diseases_fused":     int,
                "image_top_disease":  str,
                "soil_top_disease":   str,
                "agreement":          bool,
                "weight_note":        str,
            }
        }

    Raises:
        ValueError:  For unsupported crop, empty/negative vectors,
                     or unresolvable key mismatches.
        TypeError:   For non-dict inputs.
    """

    # ── 0. Type guard ──────────────────────────────────────────────────
    if not isinstance(image_vector, dict):
        raise TypeError(f"image_vector must be a dict, got {type(image_vector)}")
    if not isinstance(soil_vector, dict):
        raise TypeError(f"soil_vector must be a dict, got {type(soil_vector)}")
    if not image_vector:
        raise ValueError("image_vector is empty.")
    if not soil_vector:
        raise ValueError("soil_vector is empty.")

    # ── 1. Resolve and validate fusion weights ─────────────────────────
    w_img  = image_weight if image_weight is not None else DEFAULT_IMAGE_WEIGHT
    w_soil = soil_weight  if soil_weight  is not None else DEFAULT_SOIL_WEIGHT

    if not (w_img > 0):
        raise ValueError(f"image_weight must be > 0, got {w_img}")
    if not (w_soil > 0):
        raise ValueError(f"soil_weight must be > 0, got {w_soil}")

    weight_sum = w_img + w_soil
    weight_note: str

    if abs(weight_sum - 1.0) > 1e-6:
        # Auto-normalise weights so they sum to 1.0
        w_img  = w_img  / weight_sum
        w_soil = w_soil / weight_sum
        weight_note = (
            f"Weights were auto-normalised to sum to 1.0 "
            f"(image={w_img:.4f}, soil={w_soil:.4f})"
        )
    else:
        weight_note = (
            f"Weights used as provided (image={w_img:.4f}, soil={w_soil:.4f})"
        )

    # ── 2. Translate image vector keys to soil keyspace ────────────────
    image_translated = _translate_image_vector(image_vector, crop)

    # ── 3. Align both vectors to the same disease key set ─────────────
    aligned_image, aligned_soil = _align_vectors(image_translated, soil_vector)

    # ── 4. Normalise both vectors independently ────────────────────────
    image_norm = _normalise(aligned_image)
    soil_norm  = _normalise(aligned_soil)

    # ── 5. Weighted late fusion ────────────────────────────────────────
    all_diseases = sorted(image_norm.keys())

    full_vector: dict[str, float] = {}
    for disease in all_diseases:
        fused_score = w_img * image_norm[disease] + w_soil * soil_norm[disease]
        full_vector[disease] = round(fused_score, 6)

    # ── 6. Sort by fused score descending ─────────────────────────────
    full_vector_sorted = dict(
        sorted(full_vector.items(), key=lambda x: x[1], reverse=True)
    )

    # ── 7. Build top-3 ────────────────────────────────────────────────
    top_3 = [
        {"disease": disease, "score": round(score, 6), "rank": rank + 1}
        for rank, (disease, score) in enumerate(
            list(full_vector_sorted.items())[:3]
        )
    ]

    # ── 8. Identify per-branch top diseases ───────────────────────────
    image_top = max(image_norm, key=image_norm.get) if image_norm else None
    soil_top  = max(soil_norm,  key=soil_norm.get)  if soil_norm  else None
    fusion_top = top_3[0]["disease"] if top_3 else None

    agreement = (image_top == soil_top) if (image_top and soil_top) else False

    # ── 9. Build recommendation ───────────────────────────────────────
    recommendation = _build_recommendation(
        crop        = crop,
        top_disease = fusion_top or "",
        top_score   = top_3[0]["score"] if top_3 else 0.0,
        image_top   = image_top or "",
        soil_top    = soil_top  or "",
        agreement   = agreement,
        w_image     = w_img,
        w_soil      = w_soil,
    )

    # ── 10. Assemble output ────────────────────────────────────────────
    return {
        "crop":           crop.lower().strip(),
        "fusion_weights": {
            "image": round(w_img,  4),
            "soil":  round(w_soil, 4),
        },
        "top_3":          top_3,
        "full_vector":    full_vector_sorted,
        "image_vector":   {k: round(v, 6) for k, v in image_norm.items()},
        "soil_vector":    {k: round(v, 6) for k, v in soil_norm.items()},
        "recommendation": recommendation,
        "fusion_meta": {
            "diseases_fused":    len(all_diseases),
            "image_top_disease": image_top,
            "soil_top_disease":  soil_top,
            "agreement":         agreement,
            "weight_note":       weight_note,
        },
    }


# ---------------------------------------------------------------------------
# Convenience: get supported crops
# ---------------------------------------------------------------------------

def get_supported_crops() -> list[str]:
    """Returns the list of crops supported by the fusion engine."""
    return sorted(set(_CROP_PREFIX.keys()))


def get_translation_table() -> dict[str, str]:
    """Returns the full PlantVillage → soil-branch class name map."""
    return dict(_PV_TO_SOIL)


# ---------------------------------------------------------------------------
# Standalone test using the exact example from the Master Prompt
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    # --- Exact example from Master Prompt v1.0 ---
    image_vec_pv = {
        # Using PlantVillage names as they would come from the image model
        "Tomato___Early_blight":   0.72,
        "Tomato___Late_blight":    0.10,
        "Tomato___Bacterial_spot": 0.05,
        "Tomato___Leaf_Mold":      0.08,
        "Tomato___Tomato_mosaic_virus": 0.03,
        "Tomato___healthy":        0.02,
    }

    soil_vec = {
        "Tomato_Early_Blight":   0.45,
        "Tomato_Late_Blight":    0.20,
        "Tomato_Bacterial_Spot": 0.10,
        "Tomato_Leaf_Mold":      0.15,
        "Tomato_Mosaic_Virus":   0.00,
        "Tomato_Healthy":        0.10,
    }

    result = run_fusion(
        crop          = "tomato",
        image_vector  = image_vec_pv,
        soil_vector   = soil_vec,
        image_weight  = 0.7,
        soil_weight   = 0.3,
    )

    print("=" * 65)
    print("FUSION ENGINE — Test Output")
    print("=" * 65)
    print(f"Crop            : {result['crop']}")
    print(f"Fusion Weights  : image={result['fusion_weights']['image']}, "
          f"soil={result['fusion_weights']['soil']}")
    print()
    print("Top-3 Predictions:")
    for entry in result["top_3"]:
        print(f"  Rank {entry['rank']}: {entry['disease']:<40}  score={entry['score']:.6f}")
    print()
    print("Full Fused Vector:")
    for disease, score in result["full_vector"].items():
        print(f"  {disease:<45}  {score:.6f}")
    print()
    print("Fusion Meta:")
    meta = result["fusion_meta"]
    print(f"  Image top     : {meta['image_top_disease']}")
    print(f"  Soil top      : {meta['soil_top_disease']}")
    print(f"  Agreement     : {meta['agreement']}")
    print(f"  Weight note   : {meta['weight_note']}")
    print()
    print("Recommendation:")
    print(result["recommendation"])
