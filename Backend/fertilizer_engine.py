# ─────────────────────────────────────────────────────────────────
#  fertilizer_engine.py
#  Rule-based fertilizer recommendation engine for CropCare AI
#  Supports: Chemical | Organic | Traditional farming types
#  Logic: Compare soil N, P, K and pH against crop ideal ranges,
#         identify deficiencies, map to appropriate fertilizer inputs
# ─────────────────────────────────────────────────────────────────

# ── 1. CROP IDEAL NPK + pH RANGES ────────────────────────────────
# Values are (min, max) in kg/ha for N, P, K and pH units
# Sources: ICAR recommendations, Indian Council of Agricultural Research

CROP_REQUIREMENTS = {
    # Cereals
    "rice":         {"N": (80, 120),  "P": (40, 60),  "K": (40, 60),  "pH": (5.5, 7.0)},
    "wheat":        {"N": (100, 130), "P": (50, 70),  "K": (40, 60),  "pH": (6.0, 7.5)},
    "maize":        {"N": (100, 120), "P": (50, 70),  "K": (40, 60),  "pH": (5.8, 7.0)},
    "barley":       {"N": (60,  90),  "P": (30, 50),  "K": (30, 50),  "pH": (6.0, 7.5)},
    "millets":      {"N": (40,  80),  "P": (20, 40),  "K": (20, 40),  "pH": (5.5, 7.5)},
    "sorghum":      {"N": (60,  90),  "P": (30, 50),  "K": (30, 50),  "pH": (5.5, 7.5)},
    # Pulses
    "chickpea":     {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (6.0, 8.0)},
    "lentil":       {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (6.0, 8.0)},
    "kidneybeans":  {"N": (20,  40),  "P": (40, 60),  "K": (30, 50),  "pH": (6.0, 7.5)},
    "pigeonpeas":   {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (5.5, 7.5)},
    "blackgram":    {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (6.0, 7.5)},
    "mungbean":     {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (6.0, 7.5)},
    "mothbeans":    {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (6.0, 7.5)},
    "pulses":       {"N": (20,  40),  "P": (40, 60),  "K": (20, 40),  "pH": (6.0, 7.5)},
    # Cash Crops
    "cotton":       {"N": (100, 140), "P": (50, 70),  "K": (50, 80),  "pH": (6.0, 8.0)},
    "sugarcane":    {"N": (150, 200), "P": (60, 80),  "K": (80, 120), "pH": (6.0, 7.5)},
    "jute":         {"N": (60,  90),  "P": (30, 50),  "K": (30, 50),  "pH": (6.0, 7.5)},
    "tobacco":      {"N": (60,  90),  "P": (30, 50),  "K": (80, 120), "pH": (5.5, 7.0)},
    "coffee":       {"N": (100, 140), "P": (30, 50),  "K": (80, 120), "pH": (5.0, 6.5)},
    "oil seeds":    {"N": (40,  70),  "P": (30, 50),  "K": (20, 40),  "pH": (6.0, 7.5)},
    "ground nuts":  {"N": (20,  40),  "P": (40, 70),  "K": (40, 70),  "pH": (6.0, 7.5)},
    # Fruits
    "mango":        {"N": (100, 140), "P": (50, 70),  "K": (80, 120), "pH": (5.5, 7.5)},
    "banana":       {"N": (150, 200), "P": (50, 70),  "K": (150, 200),"pH": (5.5, 7.0)},
    "papaya":       {"N": (100, 140), "P": (50, 70),  "K": (80, 120), "pH": (6.0, 7.5)},
    "orange":       {"N": (100, 140), "P": (40, 60),  "K": (80, 120), "pH": (6.0, 7.5)},
    "apple":        {"N": (80,  120), "P": (40, 60),  "K": (80, 120), "pH": (5.5, 7.0)},
    "grapes":       {"N": (80,  120), "P": (40, 60),  "K": (80, 120), "pH": (6.0, 7.5)},
    "pomegranate":  {"N": (60,  100), "P": (30, 50),  "K": (60, 100), "pH": (5.5, 7.5)},
    "coconut":      {"N": (100, 140), "P": (40, 60),  "K": (150, 200),"pH": (5.5, 8.0)},
    # Melons
    "watermelon":   {"N": (80, 120),  "P": (40, 60),  "K": (60, 100), "pH": (6.0, 7.5)},
    "muskmelon":    {"N": (80, 120),  "P": (40, 60),  "K": (60, 100), "pH": (6.0, 7.5)},
}

# Fallback for unknown crops — moderate requirements
DEFAULT_REQUIREMENTS = {"N": (60, 100), "P": (30, 60), "K": (30, 60), "pH": (6.0, 7.5)}


# ── 2. FERTILIZER LOOKUP TABLES ──────────────────────────────────
# Each entry: { "name", "npk" or "description", "dosage", "benefit" }

CHEMICAL_FERTILIZERS = {
    "N_low": {
        "name": "Urea",
        "npk": "46-0-0",
        "dosage": "100–150 kg/ha",
        "benefit": "Fast-acting nitrogen source, rapidly corrects N deficiency"
    },
    "N_low_P_low": {
        "name": "DAP (Di-Ammonium Phosphate)",
        "npk": "18-46-0",
        "dosage": "100–120 kg/ha",
        "benefit": "Corrects both nitrogen and phosphorus deficiency simultaneously"
    },
    "P_low": {
        "name": "SSP (Single Super Phosphate)",
        "npk": "0-16-0",
        "dosage": "150–200 kg/ha",
        "benefit": "Corrects phosphorus deficiency, also supplies calcium and sulfur"
    },
    "K_low": {
        "name": "MOP (Muriate of Potash)",
        "npk": "0-0-60",
        "dosage": "60–100 kg/ha",
        "benefit": "Concentrated potassium source, improves crop quality and drought resistance"
    },
    "N_low_K_low": {
        "name": "NPK 28-28-0",
        "npk": "28-28-0",
        "dosage": "100–130 kg/ha",
        "benefit": "Balances nitrogen and potassium deficiency together"
    },
    "balanced": {
        "name": "NPK 17-17-17",
        "npk": "17-17-17",
        "dosage": "150–200 kg/ha",
        "benefit": "Complete balanced fertilizer suitable when all nutrients are moderately low"
    },
    "P_low_K_low": {
        "name": "NPK 10-26-26",
        "npk": "10-26-26",
        "dosage": "100–150 kg/ha",
        "benefit": "Corrects phosphorus and potassium deficiency, good for fruiting stage"
    },
    "N_low_P_low_K_low": {
        "name": "NPK 14-35-14",
        "npk": "14-35-14",
        "dosage": "120–150 kg/ha",
        "benefit": "High-phosphorus NPK blend for severely deficient soils"
    },
    "sufficient": {
        "name": "NPK 20-20-0",
        "npk": "20-20-0",
        "dosage": "100 kg/ha (maintenance dose)",
        "benefit": "Maintenance dose to sustain soil fertility for healthy soils"
    },
    "pH_acidic": {
        "name": "Agricultural Lime (CaCO₃)",
        "npk": "—",
        "dosage": "1–2 tonnes/ha",
        "benefit": "Raises soil pH, reduces aluminum toxicity in acidic soils"
    },
    "pH_alkaline": {
        "name": "Gypsum (CaSO₄)",
        "npk": "—",
        "dosage": "500–1000 kg/ha",
        "benefit": "Lowers soil pH, improves calcium and sulfur availability in alkaline soils"
    },
}

ORGANIC_FERTILIZERS = {
    "N_low": {
        "name": "Neem Cake",
        "description": "Neem seed residue after oil extraction",
        "dosage": "150–200 kg/ha",
        "benefit": "Slow-release nitrogen, also acts as a natural pesticide and nematicide"
    },
    "N_low_P_low": {
        "name": "Vermicompost",
        "description": "Earthworm-processed organic matter",
        "dosage": "2–3 tonnes/ha",
        "benefit": "Provides balanced N and P, improves soil structure and microbial activity"
    },
    "P_low": {
        "name": "Bone Meal",
        "description": "Steamed and ground animal bones",
        "dosage": "200–300 kg/ha",
        "benefit": "Slow-release phosphorus, also provides calcium for root development"
    },
    "K_low": {
        "name": "Wood Ash",
        "description": "Ash from burning wood or crop residues",
        "dosage": "500–800 kg/ha",
        "benefit": "Rich in potassium and calcium, also slightly raises soil pH"
    },
    "N_low_K_low": {
        "name": "Farmyard Manure (FYM)",
        "description": "Well-rotted cattle dung and urine mix",
        "dosage": "10–15 tonnes/ha",
        "benefit": "Provides nitrogen and potassium, improves water retention and soil biology"
    },
    "balanced": {
        "name": "Compost",
        "description": "Decomposed plant and animal waste",
        "dosage": "5–8 tonnes/ha",
        "benefit": "Balanced macro and micronutrients, builds long-term soil organic matter"
    },
    "P_low_K_low": {
        "name": "Rock Phosphate + Wood Ash Mix",
        "description": "Natural mineral phosphate combined with wood ash",
        "dosage": "300 kg/ha rock phosphate + 400 kg/ha wood ash",
        "benefit": "Corrects both P and K together using natural mineral sources"
    },
    "N_low_P_low_K_low": {
        "name": "Compost + Neem Cake Mix",
        "description": "Compost blended with neem cake for enhanced N release",
        "dosage": "5 tonnes/ha compost + 150 kg/ha neem cake",
        "benefit": "Addresses all three major nutrient deficiencies holistically"
    },
    "sufficient": {
        "name": "Green Manure (Dhaincha / Sunhemp)",
        "description": "Leguminous crops ploughed back into soil",
        "dosage": "Grow and incorporate at 45–60 days",
        "benefit": "Maintains nitrogen through biological fixation, adds organic matter"
    },
    "pH_acidic": {
        "name": "Wood Ash",
        "description": "Ash from crop residue or wood burning",
        "dosage": "1–2 tonnes/ha",
        "benefit": "Naturally raises soil pH without chemical intervention"
    },
    "pH_alkaline": {
        "name": "Composted Leaf Litter + Sulfur Powder",
        "description": "Acidic organic material combined with elemental sulfur",
        "dosage": "3 tonnes/ha compost + 100 kg/ha sulfur",
        "benefit": "Gently lowers pH while adding organic matter"
    },
}

TRADITIONAL_FERTILIZERS = {
    "N_low": {
        "name": "Jeevamrutha",
        "description": "Fermented solution of cow dung, cow urine, jaggery, pulse flour and soil",
        "preparation": "Mix 10 kg cow dung + 10L cow urine + 2 kg jaggery + 2 kg pulse flour in 200L water. Ferment 48 hours.",
        "dosage": "200 litres/acre as soil drench or foliar spray every 15 days",
        "benefit": "Activates soil microorganisms, fixes atmospheric nitrogen, enhances root growth. Core input of ZBNF (Zero Budget Natural Farming)."
    },
    "N_low_P_low": {
        "name": "Panchagavya",
        "description": "Five cow-derived products: dung, urine, milk, curd, ghee fermented together",
        "preparation": "Mix 5 kg cow dung + 3L cow urine + 2L cow milk + 2L curd + 1L ghee. Ferment 30 days, stirring daily.",
        "dosage": "3% solution — 3L Panchagavya in 100L water, spray every 10 days",
        "benefit": "Stimulates plant growth hormones (auxin/cytokinin), improves N and P uptake, builds immunity"
    },
    "P_low": {
        "name": "Beejamrutha",
        "description": "Seed treatment solution using cow dung and lime water",
        "preparation": "Mix 5 kg cow dung + 5L cow urine + 50g lime in 20L water. Ferment overnight.",
        "dosage": "Seed treatment — soak seeds for 20–30 minutes before sowing",
        "benefit": "Protects seeds from soil-borne fungi, improves phosphorus availability at germination"
    },
    "K_low": {
        "name": "Amrit Pani",
        "description": "Cow dung, jaggery and water solution for soil application",
        "preparation": "Mix 1 kg cow dung + 250g jaggery in 20L water. Ferment 3 days.",
        "dosage": "20 litres/acre as soil drench at sowing and 30 days after",
        "benefit": "Improves potassium availability through microbial solubilization, enhances soil water retention"
    },
    "N_low_K_low": {
        "name": "Dashaparni Ark",
        "description": "Extract of 10 plant leaves fermented with cow dung and urine",
        "preparation": "Collect leaves of neem, papaya, pomegranate, guava, drumstick, castor, calotropis, lantana, tulsi, and custard apple (200g each). Mix with 2 kg cow dung + 2L cow urine in 10L water. Ferment 30 days.",
        "dosage": "3% dilution as foliar spray every 15 days",
        "benefit": "Natural pesticide and plant tonic, provides micronutrients and activates natural defense mechanisms"
    },
    "balanced": {
        "name": "Jeevamrutha + Panchagavya Rotation",
        "description": "Alternating application of Jeevamrutha and Panchagavya through the crop cycle",
        "preparation": "Prepare both separately as described. Alternate applications every 15 days.",
        "dosage": "Jeevamrutha: 200L/acre soil drench. Panchagavya: 3L/100L water foliar spray",
        "benefit": "Comprehensive soil and foliar nutrition using traditional ZBNF protocol. Supports all crop stages."
    },
    "P_low_K_low": {
        "name": "Panchagavya + Wood Ash Drench",
        "description": "Panchagavya combined with wood ash leachate for P and K correction",
        "preparation": "Prepare Panchagavya. Separately soak 2 kg wood ash in 10L water overnight, filter. Mix both.",
        "dosage": "Apply as soil drench at 200L/acre, repeat every 20 days",
        "benefit": "Addresses phosphorus and potassium deficiency using entirely farm-sourced inputs"
    },
    "N_low_P_low_K_low": {
        "name": "Full ZBNF Protocol",
        "description": "Complete Zero Budget Natural Farming input schedule",
        "preparation": "Use Beejamrutha for seed treatment, Jeevamrutha every 15 days as soil drench, Panchagavya as foliar spray, Dashaparni Ark for pest management.",
        "dosage": "Follow ZBNF schedule throughout crop cycle",
        "benefit": "Addresses all major deficiencies using no external inputs. Promoted by Govt. of India under PKVY scheme."
    },
    "sufficient": {
        "name": "Jeevamrutha (Maintenance)",
        "description": "Maintenance application of Jeevamrutha for healthy soils",
        "preparation": "Standard Jeevamrutha preparation",
        "dosage": "100 litres/acre once a month as soil drench",
        "benefit": "Maintains soil microbial diversity and organic matter even when nutrients are sufficient"
    },
    "pH_acidic": {
        "name": "Wood Ash + Cow Urine Drench",
        "description": "Traditional pH correction using alkaline wood ash with cow urine",
        "preparation": "Soak 3 kg wood ash in 20L cow urine for 24 hours. Filter and dilute 1:10 in water.",
        "dosage": "Apply as soil drench, 200L/acre. Repeat after 30 days.",
        "benefit": "Gently raises soil pH using traditional farm inputs without chemical intervention"
    },
    "pH_alkaline": {
        "name": "Fermented Rice Water (Kanji)",
        "description": "Fermented rice water, mildly acidic, used as soil conditioner",
        "preparation": "Soak 1 kg rice in 10L water for 3–4 days until lightly fermented. Do not cook.",
        "dosage": "Dilute 1:5 in water, apply as soil drench 100L/acre every 2 weeks",
        "benefit": "Mildly acidifies alkaline soils, introduces beneficial lactic acid bacteria"
    },
}


# ── 3. DEFICIENCY DETECTION LOGIC ────────────────────────────────

def classify_nutrient(value: float, req_min: float, req_max: float) -> str:
    """Return 'low', 'sufficient', or 'excess' for a given nutrient value."""
    if value < req_min * 0.75:      # below 75% of minimum → low
        return "low"
    elif value > req_max * 1.25:    # above 125% of maximum → excess
        return "excess"
    else:
        return "sufficient"

def classify_ph(ph: float, ph_min: float, ph_max: float) -> str:
    if ph < ph_min:
        return "acidic"
    elif ph > ph_max:
        return "alkaline"
    return "optimal"


def get_deficiency_key(n_status: str, p_status: str, k_status: str) -> str:
    """
    Map the combination of N/P/K statuses to a fertilizer lookup key.
    Priority: worst deficiency combination first.
    """
    deficient = []
    if n_status == "low":
        deficient.append("N")
    if p_status == "low":
        deficient.append("P")
    if k_status == "low":
        deficient.append("K")

    if len(deficient) == 3:
        return "N_low_P_low_K_low"
    elif deficient == ["N", "P"]:
        return "N_low_P_low"
    elif deficient == ["N", "K"]:
        return "N_low_K_low"
    elif deficient == ["P", "K"]:
        return "P_low_K_low"
    elif deficient == ["N"]:
        return "N_low"
    elif deficient == ["P"]:
        return "P_low"
    elif deficient == ["K"]:
        return "K_low"
    else:
        return "sufficient"


# ── 4. MAIN RECOMMENDATION FUNCTION ─────────────────────────────

def get_fertilizer_recommendation(
    crop: str,
    N: float,
    P: float,
    K: float,
    ph: float,
    farming_type: str  # "chemical" | "organic" | "traditional"
) -> dict:
    """
    Core rule engine. Takes soil values and returns a structured
    fertilizer recommendation with deficiency analysis and pH advice.
    """
    crop_lower = crop.lower().strip()
    req = CROP_REQUIREMENTS.get(crop_lower, DEFAULT_REQUIREMENTS)

    # Classify each nutrient
    n_status = classify_nutrient(N, req["N"][0], req["N"][1])
    p_status = classify_nutrient(P, req["P"][0], req["P"][1])
    k_status = classify_nutrient(K, req["K"][0], req["K"][1])
    ph_status = classify_ph(ph, req["pH"][0], req["pH"][1])

    # Build human-readable soil analysis
    soil_analysis = {
        "nitrogen":   {"value": N,  "status": n_status,  "ideal_range": f"{req['N'][0]}–{req['N'][1]} kg/ha"},
        "phosphorous": {"value": P, "status": p_status,  "ideal_range": f"{req['P'][0]}–{req['P'][1]} kg/ha"},
        "potassium":  {"value": K,  "status": k_status,  "ideal_range": f"{req['K'][0]}–{req['K'][1]} kg/ha"},
        "pH":         {"value": ph, "status": ph_status, "ideal_range": f"{req['pH'][0]}–{req['pH'][1]}"},
    }

    # Select fertilizer lookup table
    farming_type = farming_type.lower().strip()
    if farming_type == "chemical":
        table = CHEMICAL_FERTILIZERS
    elif farming_type == "organic":
        table = ORGANIC_FERTILIZERS
    elif farming_type == "traditional":
        table = TRADITIONAL_FERTILIZERS
    else:
        raise ValueError(f"Invalid farming_type: {farming_type}. Must be chemical, organic, or traditional.")

    # Get primary fertilizer recommendation
    def_key = get_deficiency_key(n_status, p_status, k_status)
    primary = table[def_key]

    # Get pH correction advice if needed
    ph_advice = None
    if ph_status == "acidic":
        ph_advice = table.get("pH_acidic")
    elif ph_status == "alkaline":
        ph_advice = table.get("pH_alkaline")

    # Build summary message
    deficient_nutrients = [k for k, v in [("Nitrogen", n_status), ("Phosphorous", p_status), ("Potassium", k_status)] if v == "low"]
    excess_nutrients = [k for k, v in [("Nitrogen", n_status), ("Phosphorous", p_status), ("Potassium", k_status)] if v == "excess"]

    if def_key == "sufficient":
        summary = f"Soil nutrients are adequate for {crop}. Maintenance application recommended."
    else:
        summary = f"{', '.join(deficient_nutrients)} {'is' if len(deficient_nutrients) == 1 else 'are'} deficient for {crop} cultivation."

    if excess_nutrients:
        summary += f" Note: {', '.join(excess_nutrients)} is in excess — avoid adding more."

    return {
        "crop": crop,
        "farming_type": farming_type,
        "soil_analysis": soil_analysis,
        "deficiency_key": def_key,
        "summary": summary,
        "primary_recommendation": primary,
        "ph_correction": ph_advice,
    }
