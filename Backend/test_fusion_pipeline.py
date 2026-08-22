"""
test_fusion_pipeline.py
------------------------
CropCare AI — Branch 3 Fusion Integration Test Suite

Tests all three branches without requiring the FastAPI server to be running.

Run from the Backend/ directory:
    python test_fusion_pipeline.py

What this tests:
  ✓ Branch 2 (Soil)   — soil_branch.run_soil_branch()
  ✓ Branch 3 (Fusion) — fusion_engine.run_fusion()
  ✓ End-to-end pipeline using sample SHC values + simulated image vector
  ✓ Fusion math verification (0.7 × image + 0.3 × soil = expected result)
  ✓ Weight override (custom 60/40 split)
  ✓ Class name translation (PlantVillage → soil keyspace)
  ✓ Normalisation contract (both vectors sum to 1.0)
  ✓ Mismatch handling (alignment of different key sets)
  ✓ Error cases (invalid weights, unsupported crop)
"""

import sys
import math
import os

# Force UTF-8 output on Windows so Unicode chars print cleanly
sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None

# ─────────────────────────────────────────────────────────────────────────────
# Colour helpers
# ─────────────────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

_pass = 0
_fail = 0

def section(title: str):
    print(f"\n{BOLD}{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'='*65}{RESET}")

def ok(label: str):
    global _pass
    _pass += 1
    print(f"  {GREEN}[PASS]{RESET}  {label}")

def fail(label: str, detail: str = ""):
    global _fail
    _fail += 1
    print(f"  {RED}[FAIL]{RESET}  {label}")
    if detail:
        print(f"         {RED}-> {detail}{RESET}")

def assert_close(a: float, b: float, label: str, tol: float = 1e-4):
    if abs(a - b) <= tol:
        ok(f"{label}  [{a:.6f} ~= {b:.6f}]")
    else:
        fail(f"{label}", f"got {a:.6f}, expected {b:.6f} (diff {abs(a-b):.2e} > {tol})")

def assert_true(condition: bool, label: str, detail: str = ""):
    if condition:
        ok(label)
    else:
        fail(label, detail)

def assert_raises(exc_type, fn, label: str):
    try:
        fn()
        fail(label, f"Expected {exc_type.__name__} but no exception was raised")
    except exc_type as e:
        ok(f"{label}  [{exc_type.__name__}: {str(e)[:60]}]")
    except Exception as e:
        fail(label, f"Expected {exc_type.__name__} but got {type(e).__name__}: {e}")



# ═════════════════════════════════════════════════════════════════════════════
# Shared test data
# ═════════════════════════════════════════════════════════════════════════════

# SHC sample values used across all Step tests in the soil branch
SAMPLE_SHC = {
    "N":  480.00,   # Medium_N  (280–560)
    "P":  9.63,     # Low_P     (< 10)
    "K":  201.00,   # Medium_K  (108–280)
    "pH": 7.30,     # Neutral_pH (6.5–7.5)
    "OC": 0.90,     # High_OC   (> 0.75)
    "Zn": 5.32,     # Sufficient (≥ 0.60) → no flag
    "S":  42.00,    # Sufficient (≥ 10)   → no flag
}

# Simulated image branch output — PlantVillage class names, tomato crop
# (mirrors the Master Prompt example)
SAMPLE_IMAGE_VEC_PV = {
    "Tomato___Early_blight":        0.72,
    "Tomato___Late_blight":         0.10,
    "Tomato___Bacterial_spot":      0.05,
    "Tomato___Leaf_Mold":           0.08,
    "Tomato___Tomato_mosaic_virus": 0.03,
    "Tomato___healthy":             0.02,
}

# Master Prompt example soil vector (already in soil keyspace)
SAMPLE_SOIL_VEC_SOIL_KEYS = {
    "Tomato_Early_Blight":   0.45,
    "Tomato_Late_Blight":    0.20,
    "Tomato_Bacterial_Spot": 0.10,
    "Tomato_Leaf_Mold":      0.15,
    "Tomato_Mosaic_Virus":   0.00,
    "Tomato_Healthy":        0.10,
}


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 1 — soil_branch.py imports and pipeline
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 1 — Soil Branch (run_soil_branch)")

try:
    from soil_branch import run_soil_branch
    ok("soil_branch.py imports successfully")
except ImportError as e:
    fail("soil_branch.py import", str(e))
    sys.exit(1)

# 1.1 — Basic run (tomato)
try:
    soil_result = run_soil_branch(crop="tomato", shc_values=SAMPLE_SHC)
    ok("run_soil_branch('tomato') executes without error")
except Exception as e:
    fail("run_soil_branch('tomato') execution", str(e))
    soil_result = {}

# 1.2 — Check output keys
required_keys = [
    "crop", "susceptibility_vector", "top_disease",
    "vulnerability_score", "flags", "skipped_params",
    "soil_health_score", "scores", "contribution_breakdown", "narrative"
]
for key in required_keys:
    assert_true(key in soil_result, f"Output contains key: '{key}'")

# 1.3 — Normalisation: susceptibility_vector must sum to 1.0
sv = soil_result.get("susceptibility_vector", {})
sv_sum = sum(sv.values())
assert_close(sv_sum, 1.0, "susceptibility_vector sums to 1.0")

# 1.4 — All values non-negative
all_nonneg = all(v >= 0 for v in sv.values())
assert_true(all_nonneg, "All susceptibility_vector values ≥ 0.0")

# 1.5 — Flags raised (with our sample SHC: Low_P, High_OC, Neutral_pH expected)
flags = soil_result.get("flags", [])
assert_true(len(flags) > 0, f"Flags were raised: {flags}")
assert_true("Low_P" in flags,     "'Low_P' flag raised  (P=9.63 < 10)")
assert_true("High_OC" in flags,   "'High_OC' flag raised (OC=0.90 > 0.75)")
assert_true("Neutral_pH" in flags,"'Neutral_pH' flag raised (pH=7.30 in 6.5–7.5)")

# 1.6 — No flags for Zn and S (both sufficient)
assert_true("Low_Zn" not in flags, "'Low_Zn' NOT raised (Zn=5.32 ≥ 0.60)")
assert_true("Low_S"  not in flags, "'Low_S'  NOT raised (S=42.00 ≥ 10.0)")

# 1.7 — Soil health score is a float in [0,1]
shs = soil_result.get("soil_health_score")
assert_true(
    shs is not None and 0.0 <= shs <= 1.0,
    f"Soil health score in [0,1]: {shs}"
)

# 1.8 — Narrative present
narrative = soil_result.get("narrative", {})
assert_true(bool(narrative.get("top_disease_summary")), "Narrative: top_disease_summary present")
assert_true(bool(narrative.get("soil_health_summary")), "Narrative: soil_health_summary present")

# 1.9 — Other supported crops
for crop_name in ["pepper", "potato", "apple", "grape", "corn"]:
    try:
        r = run_soil_branch(crop=crop_name, shc_values=SAMPLE_SHC)
        sv_check = sum(r["susceptibility_vector"].values())
        assert_close(sv_check, 1.0, f"run_soil_branch('{crop_name}') vector sums to 1.0")
    except Exception as e:
        fail(f"run_soil_branch('{crop_name}')", str(e))

# 1.10 — Unsupported crop raises ValueError
assert_raises(
    ValueError,
    lambda: run_soil_branch(crop="mango", shc_values=SAMPLE_SHC),
    "Unsupported crop 'mango' raises ValueError"
)


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 2 — fusion_engine.py internals
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 2 — Fusion Engine Internals")

try:
    from fusion_engine import (
        run_fusion,
        get_supported_crops,
        get_translation_table,
        _normalise,
        _translate_image_vector,
        _align_vectors,
    )
    ok("fusion_engine.py imports successfully")
except ImportError as e:
    fail("fusion_engine.py import", str(e))
    sys.exit(1)

# 2.1 — Supported crops list
crops = get_supported_crops()
assert_true(
    set(["tomato","potato","pepper","apple","grape","corn"]).issubset(set(crops)),
    f"All 6 supported crops present: {crops}"
)

# 2.2 — Translation table completeness
table = get_translation_table()
assert_true(len(table) >= 27, f"Translation table has ≥27 entries: {len(table)}")

# 2.3 — _normalise: basic case
raw = {"A": 0.6, "B": 0.4}
norm = _normalise(raw)
assert_close(sum(norm.values()), 1.0, "_normalise({'A':0.6,'B':0.4}) sums to 1.0")

# 2.4 — _normalise: already normalised (no-op)
raw2 = {"A": 0.5, "B": 0.5}
norm2 = _normalise(raw2)
assert_close(sum(norm2.values()), 1.0, "_normalise already-normalised vector")

# 2.5 — _normalise: negative value raises ValueError
assert_raises(
    ValueError,
    lambda: _normalise({"A": 0.5, "B": -0.1}),
    "_normalise raises ValueError on negative value"
)

# 2.6 — _normalise: zero sum raises ValueError
assert_raises(
    ValueError,
    lambda: _normalise({"A": 0.0, "B": 0.0}),
    "_normalise raises ValueError when sum is 0"
)

# 2.7 — _translate_image_vector: valid tomato
trans = _translate_image_vector(SAMPLE_IMAGE_VEC_PV, "tomato")
assert_true(
    "Tomato_Early_Blight" in trans,
    "Translation: 'Tomato___Early_blight' → 'Tomato_Early_Blight'"
)
assert_true(
    "Tomato_Healthy" in trans,
    "Translation: 'Tomato___healthy' → 'Tomato_Healthy'"
)
assert_true(
    "Tomato_Mosaic_Virus" in trans,
    "Translation: 'Tomato___Tomato_mosaic_virus' → 'Tomato_Mosaic_Virus'"
)
# Cross-crop keys must be excluded
cross_crop_keys = [k for k in trans if not k.startswith("Tomato")]
assert_true(
    len(cross_crop_keys) == 0,
    f"Translation: no cross-crop keys leaked (got: {cross_crop_keys})"
)

# 2.8 — _translate_image_vector: unsupported crop
assert_raises(
    ValueError,
    lambda: _translate_image_vector(SAMPLE_IMAGE_VEC_PV, "mango"),
    "_translate_image_vector raises ValueError for unsupported crop"
)

# 2.9 — _align_vectors: same keys → no change
img_t  = {"A": 0.7, "B": 0.3}
soil_t = {"A": 0.4, "B": 0.6}
ai, as_ = _align_vectors(img_t, soil_t)
assert_true(set(ai.keys()) == set(as_.keys()), "_align_vectors: same keys untouched")

# 2.10 — _align_vectors: different keys → 0.0 fill
img_t2  = {"A": 0.7, "B": 0.3}
soil_t2 = {"A": 0.5, "C": 0.5}   # B missing in soil, C missing in image
ai2, as2 = _align_vectors(img_t2, soil_t2)
assert_true("C" in ai2 and ai2["C"] == 0.0,  "_align_vectors: missing key filled with 0.0 in image")
assert_true("B" in as2 and as2["B"] == 0.0, "_align_vectors: missing key filled with 0.0 in soil")


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 3 — run_fusion() end-to-end
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 3 — run_fusion() End-to-End")

try:
    result = run_fusion(
        crop         = "tomato",
        image_vector = SAMPLE_IMAGE_VEC_PV,
        soil_vector  = SAMPLE_SOIL_VEC_SOIL_KEYS,
        image_weight = 0.7,
        soil_weight  = 0.3,
    )
    ok("run_fusion('tomato') executes without error")
except Exception as e:
    fail("run_fusion('tomato') execution", str(e))
    sys.exit(1)

# 3.1 — Required output keys
required_fusion_keys = [
    "crop", "fusion_weights", "top_3", "full_vector",
    "image_vector", "soil_vector", "recommendation", "fusion_meta"
]
for key in required_fusion_keys:
    assert_true(key in result, f"Fusion output contains key: '{key}'")

# 3.2 — Weights recorded correctly
fw = result.get("fusion_weights", {})
assert_close(fw.get("image", 0), 0.7, "fusion_weights.image = 0.70")
assert_close(fw.get("soil",  0), 0.3, "fusion_weights.soil  = 0.30")

# 3.3 — full_vector sums to ~1.0 (weighted sum of two normalised vectors)
fv_sum = sum(result["full_vector"].values())
assert_close(fv_sum, 1.0, "full_vector sums to 1.0")

# 3.4 — top_3 structure
top3 = result.get("top_3", [])
assert_true(len(top3) >= 1, f"top_3 has ≥1 entry (got {len(top3)})")
assert_true(top3[0].get("rank") == 1, "top_3[0].rank == 1")
assert_true(top3[0].get("score") > 0, f"top_3[0].score > 0 (got {top3[0].get('score')})")

# 3.5 — Rank order: scores must be descending
scores_ordered = [e["score"] for e in top3]
assert_true(
    all(scores_ordered[i] >= scores_ordered[i+1] for i in range(len(scores_ordered)-1)),
    f"top_3 scores are descending: {scores_ordered}"
)

# 3.6 — Tomato_Early_Blight should be top-1 (dominant in both branches)
top1_disease = top3[0]["disease"]
assert_true(
    top1_disease == "Tomato_Early_Blight",
    f"top_3[0].disease == 'Tomato_Early_Blight' (got '{top1_disease}')"
)

# 3.7 — MATH VERIFICATION: manual calculation for Tomato_Early_Blight
# image_vec  = {EB:0.72, LB:0.10, BS:0.05, LM:0.08, MV:0.03, H:0.02}, sum=1.0
# soil_vec   = {EB:0.45, LB:0.20, BS:0.10, LM:0.15, MV:0.00, H:0.10}, sum=1.0
# fused[EB]  = 0.7 * 0.72 + 0.3 * 0.45 = 0.504 + 0.135 = 0.639
expected_eb = round(0.7 * 0.72 + 0.3 * 0.45, 6)
actual_eb   = result["full_vector"].get("Tomato_Early_Blight", -1)
assert_close(
    actual_eb, expected_eb,
    f"MATH: Tomato_Early_Blight fused score = 0.7×0.72 + 0.3×0.45 = {expected_eb}"
)

# 3.8 — MATH VERIFICATION: Tomato_Late_Blight
# fused[LB] = 0.7 * 0.10 + 0.3 * 0.20 = 0.07 + 0.06 = 0.13
# But note: vectors are normalised, so image sums to 1.0 (already) and soil sums to 1.0
# soil MV=0.00 → after normalisation (sum=1.0) LB stays at 0.20 proportionally
# Let's compute from normalised vectors
img_norm_lb  = 0.10 / 1.0    # image already sums to 1.0
soil_norm_lb = 0.20 / 1.00   # soil already sums to 1.0
expected_lb  = round(0.7 * img_norm_lb + 0.3 * soil_norm_lb, 6)
actual_lb    = result["full_vector"].get("Tomato_Late_Blight", -1)
assert_close(
    actual_lb, expected_lb,
    f"MATH: Tomato_Late_Blight = 0.7×{img_norm_lb:.2f} + 0.3×{soil_norm_lb:.2f} = {expected_lb}"
)

# 3.9 — recommendation is a non-empty string
rec = result.get("recommendation", "")
assert_true(bool(rec) and len(rec) > 50, f"Recommendation is a non-empty string ({len(rec)} chars)")
assert_true("Tomato" in rec or "tomato" in rec.lower(), "Recommendation mentions the crop")

# 3.10 — fusion_meta fields
meta = result.get("fusion_meta", {})
assert_true("diseases_fused"    in meta, "fusion_meta.diseases_fused present")
assert_true("image_top_disease" in meta, "fusion_meta.image_top_disease present")
assert_true("soil_top_disease"  in meta, "fusion_meta.soil_top_disease present")
assert_true("agreement"         in meta, "fusion_meta.agreement present")
assert_true("weight_note"       in meta, "fusion_meta.weight_note present")
assert_true(
    meta["image_top_disease"] == "Tomato_Early_Blight",
    f"fusion_meta.image_top_disease == 'Tomato_Early_Blight' (got '{meta['image_top_disease']}')"
)


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 4 — Weight override and auto-normalisation
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 4 — Fusion Weight Overrides")

# 4.1 — Custom 60/40 weights
r_custom = run_fusion(
    crop="tomato",
    image_vector=SAMPLE_IMAGE_VEC_PV,
    soil_vector=SAMPLE_SOIL_VEC_SOIL_KEYS,
    image_weight=0.6,
    soil_weight=0.4,
)
fw_custom = r_custom["fusion_weights"]
assert_close(fw_custom["image"], 0.6, "Custom weights: image=0.60")
assert_close(fw_custom["soil"],  0.4, "Custom weights: soil=0.40")
fv_custom_sum = sum(r_custom["full_vector"].values())
assert_close(fv_custom_sum, 1.0, "Custom weights: full_vector sums to 1.0")

# 4.2 — Unbalanced weights that don't sum to 1.0 → auto-normalised
r_unnorm = run_fusion(
    crop="tomato",
    image_vector=SAMPLE_IMAGE_VEC_PV,
    soil_vector=SAMPLE_SOIL_VEC_SOIL_KEYS,
    image_weight=3.0,
    soil_weight=1.0,
)
fw_unnorm = r_unnorm["fusion_weights"]
assert_close(fw_unnorm["image"], 0.75, "Auto-normalised: 3.0/(3+1)=0.75")
assert_close(fw_unnorm["soil"],  0.25, "Auto-normalised: 1.0/(3+1)=0.25")
assert_true("auto-normalised" in r_unnorm["fusion_meta"]["weight_note"].lower(),
            "fusion_meta.weight_note mentions auto-normalisation")

# 4.3 — Default weights (no overrides) = 0.70 / 0.30
r_default = run_fusion(
    crop="tomato",
    image_vector=SAMPLE_IMAGE_VEC_PV,
    soil_vector=SAMPLE_SOIL_VEC_SOIL_KEYS,
)
fw_def = r_default["fusion_weights"]
assert_close(fw_def["image"], 0.70, "Default image weight = 0.70")
assert_close(fw_def["soil"],  0.30, "Default soil weight  = 0.30")

# 4.4 — Invalid weight (0) raises ValueError
assert_raises(
    ValueError,
    lambda: run_fusion("tomato", SAMPLE_IMAGE_VEC_PV, SAMPLE_SOIL_VEC_SOIL_KEYS, image_weight=0.0),
    "image_weight=0.0 raises ValueError"
)

# 4.5 — Invalid weight (negative) raises ValueError
assert_raises(
    ValueError,
    lambda: run_fusion("tomato", SAMPLE_IMAGE_VEC_PV, SAMPLE_SOIL_VEC_SOIL_KEYS, soil_weight=-0.5),
    "soil_weight=-0.5 raises ValueError"
)

# 4.6 — Weights >1 are valid (treated as ratios, auto-normalised)
r_ratio = run_fusion(
    crop="tomato",
    image_vector=SAMPLE_IMAGE_VEC_PV,
    soil_vector=SAMPLE_SOIL_VEC_SOIL_KEYS,
    image_weight=9.0,
    soil_weight=1.0,
)
fw_ratio = r_ratio["fusion_weights"]
assert_close(fw_ratio["image"], 0.9, "Ratio 9:1 -> image weight = 0.90")
assert_close(fw_ratio["soil"],  0.1, "Ratio 9:1 -> soil weight  = 0.10")


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 5 — Full pipeline: soil branch → fusion (no pre-made soil vec)
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 5 — Full Pipeline: Soil Branch → Fusion")

for crop_name, pv_prefix in [
    ("tomato",  "Tomato___"),
    ("potato",  "Potato___"),
    ("pepper",  "Pepper,_bell___"),
    ("apple",   "Apple___"),
    ("grape",   "Grape___"),
    ("corn",    "Corn_(maize)___"),
]:
    try:
        # Step 1: Run soil branch with real SHC
        sb = run_soil_branch(crop=crop_name, shc_values=SAMPLE_SHC)
        soil_vec = sb["susceptibility_vector"]

        # Step 2: Build a simulated (uniform) image vector using real PlantVillage keys
        from fusion_engine import get_translation_table
        tt = get_translation_table()
        # Get all PV keys for this crop
        pv_keys_for_crop = [pv for pv, soil in tt.items() if soil.startswith(
            crop_name.capitalize() if crop_name != "corn" else "Corn"
        )]
        if not pv_keys_for_crop:
            fail(f"No PV keys found for crop: {crop_name}")
            continue
        # Uniform distribution over crop's PV classes
        img_vec = {k: 1.0 / len(pv_keys_for_crop) for k in pv_keys_for_crop}

        # Step 3: Fuse
        fr = run_fusion(
            crop         = crop_name,
            image_vector = img_vec,
            soil_vector  = soil_vec,
        )

        fv_s = sum(fr["full_vector"].values())
        assert_close(
            fv_s, 1.0,
            f"[{crop_name}] Full pipeline → full_vector sums to 1.0"
        )
        assert_true(
            len(fr["top_3"]) >= 1,
            f"[{crop_name}] top_3 has ≥1 entry"
        )
        assert_true(
            bool(fr["recommendation"]),
            f"[{crop_name}] Recommendation is non-empty"
        )

    except Exception as e:
        fail(f"Full pipeline [{crop_name}]", str(e))


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 6 — Error handling
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 6 — Error Handling")

# 6.1 — Empty image vector
assert_raises(
    ValueError,
    lambda: run_fusion("tomato", {}, SAMPLE_SOIL_VEC_SOIL_KEYS),
    "Empty image_vector raises ValueError"
)

# 6.2 — Empty soil vector
assert_raises(
    ValueError,
    lambda: run_fusion("tomato", SAMPLE_IMAGE_VEC_PV, {}),
    "Empty soil_vector raises ValueError"
)

# 6.3 — Wrong type for image_vector
assert_raises(
    TypeError,
    lambda: run_fusion("tomato", "not_a_dict", SAMPLE_SOIL_VEC_SOIL_KEYS),
    "Non-dict image_vector raises TypeError"
)

# 6.4 — Unsupported crop
assert_raises(
    ValueError,
    lambda: run_fusion("mango", SAMPLE_IMAGE_VEC_PV, SAMPLE_SOIL_VEC_SOIL_KEYS),
    "Unsupported crop 'mango' raises ValueError"
)

# 6.5 — Image vector with no keys matching the target crop
wrong_crop_vec = {"Apple___Apple_scab": 0.9, "Apple___healthy": 0.1}
assert_raises(
    ValueError,
    lambda: run_fusion("tomato", wrong_crop_vec, SAMPLE_SOIL_VEC_SOIL_KEYS),
    "Apple image vector passed to tomato run_fusion raises ValueError"
)


# ═════════════════════════════════════════════════════════════════════════════
# TEST BLOCK 7 — Soil branch with missing/partial SHC values
# ═════════════════════════════════════════════════════════════════════════════

section("BLOCK 7 — Partial SHC Values (Missing Nutrients)")

partial_shc = {
    "N":  280.0,
    "pH": 6.8,
    # P, K, OC, Zn, S are missing (None / absent)
}
try:
    result_partial = run_soil_branch(crop="tomato", shc_values=partial_shc)
    skipped = result_partial.get("skipped_params", [])
    assert_true(
        "P" in skipped and "K" in skipped and "OC" in skipped,
        f"skipped_params contains missing nutrients: {skipped}"
    )
    sv_partial = result_partial["susceptibility_vector"]
    sv_partial_sum = sum(sv_partial.values())
    assert_close(sv_partial_sum, 1.0, "Partial SHC: susceptibility_vector still sums to 1.0")
    ok("Partial SHC: pipeline runs gracefully with missing nutrients")
except Exception as e:
    fail("Partial SHC pipeline", str(e))


# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

print(f"\n{BOLD}{'═'*65}{RESET}")
print(f"{BOLD}  TEST SUMMARY{RESET}")
print(f"{BOLD}{'═'*65}{RESET}")
total = _pass + _fail
print(f"  Total Tests : {total}")
print(f"  {GREEN}Passed{RESET}      : {_pass}")
print(f"  {RED}Failed{RESET}      : {_fail}")

if _fail == 0:
    print(f"\n  {GREEN}{BOLD}✓ ALL TESTS PASSED — Fusion pipeline is ready.{RESET}\n")
else:
    print(f"\n  {RED}{BOLD}✗ {_fail} TEST(S) FAILED — Review output above.{RESET}\n")
    sys.exit(1)
