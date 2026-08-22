# ═══════════════════════════════════════════════════════════════════
#  FERTILIZER RECOMMENDATION  —  add this block to the END of main.py
# ═══════════════════════════════════════════════════════════════════

# ── STEP 1: Add this import at the TOP of main.py (with other imports) ──
# from fertilizer_engine import get_fertilizer_recommendation
# from models import Base, User, Prediction, SoilData, Farm, CropRecommendation, FertilizerRecommendation
# from schemas import RegisterRequest, LoginRequest, FarmCreate, FarmResponse, FertilizerRequest

# ── STEP 2: Paste the 3 endpoints below at the END of main.py ────────────


VALID_CROPS = [
    "rice", "wheat", "maize", "barley", "millets", "sorghum",
    "chickpea", "lentil", "kidneybeans", "pigeonpeas", "blackgram",
    "mungbean", "mothbeans", "pulses", "cotton", "sugarcane", "jute",
    "tobacco", "coffee", "oil seeds", "ground nuts", "mango", "banana",
    "papaya", "orange", "apple", "grapes", "pomegranate", "coconut",
    "watermelon", "muskmelon"
]

VALID_FARMING_TYPES = ["chemical", "organic", "traditional"]


# ── POST /recommend-fertilizer ────────────────────────────────────────────
@app.post("/recommend-fertilizer")
def recommend_fertilizer(
    request: FertilizerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate farming type
    if request.farming_type.lower() not in VALID_FARMING_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid farming_type. Must be one of: {VALID_FARMING_TYPES}"
        )

    # Validate crop — warn but don't block (engine uses default requirements)
    crop_lower = request.crop.lower().strip()
    if crop_lower not in VALID_CROPS:
        logger.warning(f"Crop '{request.crop}' not in known list — using default NPK requirements")

    # ── Resolve soil values ───────────────────────────────────────────────
    # Priority: use values from request body if provided, else fall back to latest SHC scan
    N = request.nitrogen
    P = request.phosphorous
    K = request.potassium
    ph = request.ph

    if any(v is None for v in [N, P, K, ph]):
        # Fetch latest soil data from DB
        soil = db.query(SoilData).filter(
            SoilData.user_id == current_user.id
        ).order_by(SoilData.timestamp.desc()).first()

        if not soil:
            raise HTTPException(
                status_code=404,
                detail="No soil data found. Please upload your Soil Health Card first, or provide N, P, K, pH values manually."
            )

        # Only fill in the missing values
        if N is None:
            if not soil.nitrogen:
                raise HTTPException(status_code=400, detail="Nitrogen value missing from soil data")
            N = float(soil.nitrogen)

        if P is None:
            if not soil.phosphorus:
                raise HTTPException(status_code=400, detail="Phosphorous value missing from soil data")
            P = float(soil.phosphorus)

        if K is None:
            if not soil.potassium:
                raise HTTPException(status_code=400, detail="Potassium value missing from soil data")
            K = float(soil.potassium)

        if ph is None:
            if not soil.ph:
                raise HTTPException(status_code=400, detail="pH value missing from soil data")
            ph = float(soil.ph)

    # ── Validate ranges ───────────────────────────────────────────────────
    if not (0 < ph <= 14):
        raise HTTPException(status_code=400, detail="Invalid pH value. Must be between 0 and 14.")
    if N < 0 or P < 0 or K < 0:
        raise HTTPException(status_code=400, detail="Nutrient values cannot be negative.")

    # ── Run the rule engine ───────────────────────────────────────────────
    result = get_fertilizer_recommendation(
        crop=request.crop,
        N=N,
        P=P,
        K=K,
        ph=ph,
        farming_type=request.farming_type
    )

    # ── Save to database ──────────────────────────────────────────────────
    new_rec = FertilizerRecommendation(
        user_id=current_user.id,
        crop=request.crop,
        farming_type=request.farming_type,
        nitrogen=N,
        phosphorous=P,
        potassium=K,
        ph=ph,
        result=json.dumps(result)
    )

    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)

    return {
        "id": new_rec.id,
        "created_at": new_rec.created_at,
        **result
    }


# ── GET /fertilizer-history ───────────────────────────────────────────────
@app.get("/fertilizer-history")
def get_fertilizer_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(FertilizerRecommendation).filter(
        FertilizerRecommendation.user_id == current_user.id
    ).order_by(FertilizerRecommendation.created_at.desc()).all()

    if not records:
        return []

    return [
        {
            "id": r.id,
            "crop": r.crop,
            "farming_type": r.farming_type,
            "nitrogen": r.nitrogen,
            "phosphorous": r.phosphorous,
            "potassium": r.potassium,
            "ph": r.ph,
            "result": json.loads(r.result),
            "created_at": r.created_at
        }
        for r in records
    ]


# ── GET /fertilizer-history/latest ───────────────────────────────────────
@app.get("/fertilizer-history/latest")
def get_latest_fertilizer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rec = db.query(FertilizerRecommendation).filter(
        FertilizerRecommendation.user_id == current_user.id
    ).order_by(FertilizerRecommendation.created_at.desc()).first()

    if not rec:
        return {"message": "No fertilizer recommendation found"}

    return {
        "id": rec.id,
        "crop": rec.crop,
        "farming_type": rec.farming_type,
        "result": json.loads(rec.result),
        "created_at": rec.created_at
    }
