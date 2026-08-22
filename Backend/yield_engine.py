# ─────────────────────────────────────────────────────────────────
#  yield_engine.py  —  CropCare AI
#  Inference wrapper for the trained XGBoost yield model.
# ─────────────────────────────────────────────────────────────────

import numpy as np
import joblib

yield_model   = joblib.load("yield_model.pkl")
yield_scaler  = joblib.load("yield_scaler.pkl")
yield_le      = joblib.load("yield_label_encoder.pkl")

FARMING_MULTIPLIER = {
    "chemical":    1.00,
    "organic":     0.78,
    "traditional": 0.83,
}

IRRIGATION_FACTOR = {
    "irrigated": 1.10,
    "drip":      1.15,
    "rainfed":   1.00,
}

def get_limiting_factors(N, P, K, ph, rainfall, humidity):
    factors = []
    if N < 40:
        factors.append("Low nitrogen — consider nitrogen-rich inputs before sowing.")
    if P < 20:
        factors.append("Low phosphorus — affects root development and early growth.")
    if K < 15:
        factors.append("Low potassium — reduces drought resistance and grain quality.")
    if ph < 5.5:
        factors.append("Soil too acidic — apply lime to raise pH above 6.0.")
    if ph > 8.0:
        factors.append("Soil too alkaline — apply gypsum or organic matter.")
    if rainfall < 50:
        factors.append("Low seasonal rainfall — ensure supplemental irrigation is available.")
    if humidity < 40:
        factors.append("Low humidity — crop may face moisture stress.")
    if not factors:
        factors.append("No major limiting factors detected. Conditions are adequate.")
    return factors


def predict_yield(
    crop: str,
    N: float,
    P: float,
    K: float,
    ph: float,
    temperature: float,
    humidity: float,
    rainfall: float,
    farming_type: str,
    irrigation_type: str = "rainfed",
    area_acres: float = None
) -> dict:

    crop_lower = crop.strip().lower()
    known_crops = list(yield_le.classes_)

    if crop_lower not in known_crops:
        return {
            "error": f"Crop '{crop}' not supported by yield model.",
            "supported_crops": known_crops
        }

    crop_encoded = float(yield_le.transform([crop_lower])[0])

    features = np.array(
        [[N, P, K, temperature, humidity, ph, rainfall, crop_encoded]],
        dtype=np.float64
    )
    features[:, 0:3] = np.log1p(features[:, 0:3])
    features_scaled = yield_scaler.transform(features)

    pred_conventional = float(yield_model.predict(features_scaled)[0])
    pred_conventional = max(pred_conventional, 0.1)

    irr_key = (irrigation_type or "rainfed").lower()
    pred_conventional *= IRRIGATION_FACTOR.get(irr_key, 1.0)

    ft_key = (farming_type or "chemical").lower()
    pred_final = pred_conventional * FARMING_MULTIPLIER.get(ft_key, 1.0)

    yield_low  = round(pred_final * 0.88, 2)
    yield_mid  = round(pred_final, 2)
    yield_high = round(pred_final * 1.12, 2)

    conv_yield = round(pred_conventional, 2)
    org_yield  = round(pred_conventional * FARMING_MULTIPLIER["organic"], 2)
    yield_gap  = round(conv_yield - org_yield, 2)

    total_production = None
    if area_acres and area_acres > 0:
        total_production = {
            "low_quintals":  round(yield_low  * area_acres, 2),
            "mid_quintals":  round(yield_mid  * area_acres, 2),
            "high_quintals": round(yield_high * area_acres, 2),
            "area_acres":    area_acres
        }

    return {
        "crop": crop_lower,
        "farming_type": ft_key,
        "irrigation_type": irr_key,
        "yield_range": {
            "low":  yield_low,
            "mid":  yield_mid,
            "high": yield_high,
            "unit": "quintals/acre"
        },
        "total_production": total_production,
        "limiting_factors": get_limiting_factors(N, P, K, ph, rainfall, humidity),
        "comparison": {
            "conventional_qtl_acre": conv_yield,
            "organic_qtl_acre":      org_yield,
            "yield_gap_qtl_acre":    yield_gap,
            "note": "Organic yield estimated at 78% of conventional (ICAR transition data)"
        },
        "model_inputs": {
            "N": N, "P": P, "K": K, "ph": ph,
            "temperature": round(temperature, 2),
            "humidity":    round(humidity, 2),
            "rainfall":    round(rainfall, 2)
        }
    }
