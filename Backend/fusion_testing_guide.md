# CropCare AI — Branch 3 Fusion: Complete Testing Guide

> All 109 automated tests **pass**. This guide explains every layer of testing
> from pure Python unit tests to live HTTP API calls.

---

## Architecture Recap

```
POST /fusion  (multipart/form-data)
        │
        ├─── file  (leaf image)
        ├─── crop  e.g. "tomato"
        ├─── image_weight  (default 0.70)
        ├─── soil_weight   (default 0.30)
        └─── N / P / K / pH / OC / Zn / S  (optional; fallback → latest SHC in DB)
                │
                ▼
        ┌─────────────────────────────────┐
        │  Branch 1 — Image               │  EfficientNetB0 → 27-class softmax
        │  Tomato___Early_blight: 0.72    │  Full vector extracted from model
        └──────────────┬──────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │  Branch 2 — Soil                │  SHC → flags → vector → sigmoid scores
        │  Tomato_Early_Blight: 0.45      │  Normalised to sum = 1.0
        └──────────────┬──────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │  Branch 3 — Fusion              │  0.7 × Image + 0.3 × Soil
        │  top_3, full_vector             │  + recommendation + meta
        └─────────────────────────────────┘
```

---

## Level 1 — Pure Python Unit Tests (No Server Required)

### Run the test suite

```powershell
# From the Backend/ directory, using the project venv:
back-venv\Scripts\python.exe test_fusion_pipeline.py
```

### What is tested (109 assertions across 7 blocks)

| Block | Tests | What it validates |
|-------|-------|-------------------|
| **Block 1** — Soil Branch | 28 | `run_soil_branch()` output keys, normalisation, flags, soil health, all 6 crops |
| **Block 2** — Fusion Internals | 16 | `_normalise`, `_translate_image_vector`, `_align_vectors`, translation table |
| **Block 3** — End-to-End Math | 27 | Exact score verification: `0.7×0.72 + 0.3×0.45 = 0.639`, vector sum, top-3 order |
| **Block 4** — Weight Overrides | 12 | Custom 60/40, auto-normalisation of ratios (3:1 → 0.75/0.25), defaults, errors |
| **Block 5** — Full Pipeline | 18 | All 6 crops: Soil Branch → Fusion (uniform image vec + real SHC values) |
| **Block 6** — Error Handling | 5 | Empty vecs, wrong type, unsupported crop, cross-crop key mismatch |
| **Block 7** — Partial SHC | 3 | Missing nutrients gracefully skipped, vector still sums to 1.0 |

**Expected output:**
```
Total Tests : 109
Passed      : 109
Failed      : 0
[PASS]  ALL TESTS PASSED — Fusion pipeline is ready.
```

---

## Level 2 — Test Individual Branch Modules Directly

### Test Soil Branch alone

```python
# Run from Backend/ directory
back-venv\Scripts\python.exe soil_branch.py
```

Uses the hardcoded SHC sample: `N=480, P=9.63, K=201, pH=7.30, OC=0.90, Zn=5.32, S=42.00`  
Prints for tomato and pepper: flags → susceptibility vector → narrative.

### Test Fusion Engine alone (Master Prompt example)

```python
back-venv\Scripts\python.exe fusion_engine.py
```

Runs the exact Master Prompt v1.0 example vectors and prints the full fused output.
Expected top-1: `Tomato_Early_Blight` with score `0.639000`.

### Test individual soil steps

```powershell
back-venv\Scripts\python.exe flag_generator.py          # Step 2
back-venv\Scripts\python.exe suscpetibilty_vector.py    # Step 4
back-venv\Scripts\python.exe vulnerability_score_generator.py  # Step 5
back-venv\Scripts\python.exe contribution_breakdown.py  # Step 6
```

---

## Level 3 — Live FastAPI Server Testing

### Start the server

```powershell
back-venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

### Step 1 — Register + Login (get a token)

```http
POST http://localhost:8000/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@cropcare.ai",
  "password": "test1234",
  "confirm_password": "test1234"
}
```

```http
POST http://localhost:8000/login
Content-Type: application/x-www-form-urlencoded

username=test@cropcare.ai&password=test1234
```

Save the `access_token` from the response.

---

### Step 2 — Upload a Soil Health Card (or enter soil values manually)

**Option A — OCR upload:**
```http
POST http://localhost:8000/extract_shc
Authorization: Bearer <your_token>
Content-Type: multipart/form-data

file: <SHC image file>
```

**Option B — Manual entry via `/soil-branch`:**
```http
POST http://localhost:8000/soil-branch
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "crop": "tomato",
  "nitrogen": 480,
  "phosphorus": 9.63,
  "potassium": 201,
  "ph": 7.30,
  "organic_carbon": 0.90,
  "zinc": 5.32,
  "sulphur": 42.0
}
```

> [!NOTE]
> The `/fusion` endpoint automatically pulls the latest soil values from the DB.
> If you provide values in the request, those take priority.

---

### Step 3 — Call the Fusion Endpoint

```http
POST http://localhost:8000/fusion
Authorization: Bearer <your_token>
Content-Type: multipart/form-data

file:          <tomato leaf image>
crop:          tomato
image_weight:  0.7
soil_weight:   0.3
```

#### With manual soil override (bypasses DB lookup):

```http
POST http://localhost:8000/fusion
Authorization: Bearer <your_token>
Content-Type: multipart/form-data

file:          <leaf image>
crop:          tomato
image_weight:  0.7
soil_weight:   0.3
nitrogen:      480
phosphorus:    9.63
potassium:     201
ph:            7.3
organic_carbon: 0.9
zinc:          5.32
sulphur:       42.0
```

---

### Expected `/fusion` Response Shape

```json
{
  "crop": "tomato",
  "fusion_weights": { "image": 0.7, "soil": 0.3 },

  "top_3": [
    { "disease": "Tomato_Early_Blight",  "score": 0.639, "rank": 1 },
    { "disease": "Tomato_Late_Blight",   "score": 0.130, "rank": 2 },
    { "disease": "Tomato_Leaf_Mold",     "score": 0.101, "rank": 3 }
  ],

  "full_vector": {
    "Tomato_Early_Blight":   0.639,
    "Tomato_Late_Blight":    0.130,
    "Tomato_Leaf_Mold":      0.101,
    "Tomato_Bacterial_Spot": 0.065,
    "Tomato_Mosaic_Virus":   0.038,
    "Tomato_Healthy":        0.027
  },

  "image_vector":  { "...": "normalised image probs in soil keyspace" },
  "soil_vector":   { "...": "normalised soil susceptibility probs" },

  "recommendation": "[Tomato — Fused Diagnosis]\nPrimary predicted disease: ...",

  "fusion_meta": {
    "diseases_fused":     6,
    "image_top_disease":  "Tomato_Early_Blight",
    "soil_top_disease":   "Tomato_Early_Blight",
    "agreement":          true,
    "weight_note":        "Weights used as provided (image=0.7000, soil=0.3000)"
  },

  "image_branch_raw": {
    "predicted_class": "Tomato___Early_blight",
    "top_confidence":  0.8412,
    "severity":        "High"
  },

  "soil_branch_raw": {
    "top_disease":         "Tomato_Early_Blight",
    "vulnerability_score": 0.5821,
    "soil_health_score":   0.5187,
    "flags":               ["Medium_N", "Low_P", "Medium_K", "High_OC", "Neutral_pH"],
    "skipped_params":      [],
    "narrative": {
      "top_disease_summary": "Based on the soil profile...",
      "soil_health_summary": "Soil health is moderate..."
    }
  }
}
```

---

## Level 4 — Test via FastAPI Swagger UI

Navigate to **`http://localhost:8000/docs`** in your browser.

1. Click **Authorize** → paste your Bearer token
2. Find `POST /fusion`
3. Click **Try it out**
4. Upload a leaf image, set `crop=tomato`
5. Click **Execute**

> [!TIP]
> The Swagger UI is the fastest way to test multipart/form-data endpoints without writing curl commands.

---

## Level 5 — cURL Commands

### Full fusion call with inline soil values:

```bash
curl -X POST http://localhost:8000/fusion \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@tomato_leaf.jpg" \
  -F "crop=tomato" \
  -F "image_weight=0.7" \
  -F "soil_weight=0.3" \
  -F "nitrogen=480" \
  -F "phosphorus=9.63" \
  -F "potassium=201" \
  -F "ph=7.3" \
  -F "organic_carbon=0.9"
```

### Fusion relying on DB soil data (minimal call):

```bash
curl -X POST http://localhost:8000/fusion \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@tomato_leaf.jpg" \
  -F "crop=tomato"
```

---

## Supported Crops & Class Mapping

| Crop | Example image class (PV format) | Mapped soil key |
|------|--------------------------------|-----------------|
| tomato | `Tomato___Early_blight` | `Tomato_Early_Blight` |
| potato | `Potato___Late_blight` | `Potato_Late_Blight` |
| pepper | `Pepper,_bell___Bacterial_spot` | `Pepper_Bacterial_Spot` |
| apple | `Apple___Apple_scab` | `Apple_Scab` |
| grape | `Grape___Black_rot` | `Grape_Black_Rot` |
| corn | `Corn_(maize)___Common_rust_` | `Corn_Common_Rust` |

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `No soil data available` | No SHC in DB, no manual values in request | Upload SHC via `/extract_shc` first, OR pass `nitrogen`, `phosphorus`, etc. in the form |
| `Crop 'X' is not supported` | `crop` not in supported list | Use one of: tomato, potato, pepper, apple, grape, corn |
| `No image vector classes could be mapped` | Image result crop doesn't match `crop` param | Ensure the leaf image is of the same crop you specify |
| `image_weight must be > 0` | `image_weight=0` or negative | Use a positive value (any ratio is fine, e.g. `3.0` for 3:1 split) |
| `401 Unauthorized` | Missing or expired token | Re-login via `/login`, use fresh `access_token` |

---

## Quick Verification Checklist

After any code change, run these in order:

```powershell
# 1. Unit tests (no server needed, fast)
back-venv\Scripts\python.exe test_fusion_pipeline.py

# 2. Start server
back-venv\Scripts\uvicorn.exe main:app --reload

# 3. Health check
curl http://localhost:8000/health

# 4. Open Swagger and test /fusion manually
start http://localhost:8000/docs
```
