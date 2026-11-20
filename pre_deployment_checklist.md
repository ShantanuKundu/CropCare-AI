# CropCare AI — Pre-Deployment Checklist

## 🔴 Critical (Must Fix Before Deploy)

### 1. Backend — Hardcoded `SECRET_KEY` in `.env`
**File:** [`Backend/.env`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/.env) · Line 1

The current secret key `shan@2k1` is a weak, guessable string. JWT tokens are signed with this key — anyone who knows it can forge tokens.

```diff
- SECRET_KEY=shan@2k1
+ SECRET_KEY=<generate a strong 32+ char random string>
```
> **Generate one:** `python -c "import secrets; print(secrets.token_hex(32))"`

---

### 2. Backend — Hardcoded Tesseract path (Windows-only)
**File:** [`Backend/main.py`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/main.py) · Line 56

```python
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
```

This path only works on Windows. On Linux/Docker (typical server), Tesseract is at `/usr/bin/tesseract`.

**Fix:** Make it conditional or move to `.env`:
```python
import shutil
tesseract_path = os.getenv("TESSERACT_CMD", shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe")
pytesseract.pytesseract.tesseract_cmd = tesseract_path
```
And add to `.env`:
```
TESSERACT_CMD=/usr/bin/tesseract
```

---

### 3. Backend — `DATABASE_URL` points to `localhost` in `database.py`
**File:** [`Backend/database.py`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/database.py) · Line 8

```python
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:sk-27@localhost:5432/cropcare_db")
```

The **fallback** hardcodes your local DB credentials including the password `sk-27`. The `.env` also has this. Update `.env` to use the production database URL (e.g. Supabase, Railway, Neon, etc.) before deploying.

```
# Backend/.env — update for production
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>
```

---

### 4. Frontend — `VITE_API_BASE_URL` still points to `localhost`
**File:** [`Frontend/.env`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Frontend/.env) · Line 1

```
VITE_API_BASE_URL=http://localhost:8000
```

Must be updated to the live backend URL **before** running `npm run build`:

```
VITE_API_BASE_URL=https://your-backend-domain.com
```

---

### 5. Backend — Debug `print()` statements left in `main.py`
**File:** [`Backend/main.py`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/main.py)

Several debug prints leak internal info and add noise to production logs:

| Line | Statement |
|------|-----------|
| 92 | `print("API KEY:", os.getenv("DATAGOVIN_API_KEY"))` — **leaks the API key to stdout!** |
| 173 | `print("Model loaded successfully.")` |
| 179 | `print("Disease info loaded successfully")` |
| 181 | `print("Class names loaded successfully")` |
| 189 | `print("PaddleOCR initialized successfully")` |
| 320–321 | `print("ALL CLASSES IN MODEL:...")` / `print("SEASON FILTER LIST:...")` |
| 747 | `print("RAW OCR TEXT:", clean_text)` |

> ⚠️ **Line 92 is especially dangerous** — it prints your live API key to logs.

**Fix:** Replace `print()` with `logger.info()` or remove entirely.

---

### 6. Frontend — `console.log()` debug statements in production code
Multiple pages have debug logs that expose internal API data in the browser console:

| File | Line | Statement |
|------|------|-----------|
| `History.jsx` | 60, 62, 92 | Logs raw API response + parsed recommendations |
| `CropRecommendation.jsx` | 159, 180 | Logs API response and display data |
| `Dashboard.jsx` | 47 | `console.log('use effect called')` |
| `IrrigationAdvisory.jsx` | 38, 64, 66 | Logs farms, payload, response |
| `SchemeEligibility.jsx` | 77, 79 | Logs payload and response |
| `MandiPrices.jsx` | 214 | Logs response |

**Fix:** Remove all these before building for production.

---

## 🟡 Important (Should Fix)

### 7. CORS — Vercel URLs might not match
**File:** [`Backend/main.py`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/main.py) · Lines 72–83

The allowed origins list has 4 Vercel URLs hardcoded. Confirm which one is your actual live Vercel URL and remove the unused ones. Also, move this list to an environment variable for flexibility:

```python
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, ...)
```

---

### 8. Frontend — `Final-Review-Updates.txt` items pending
**File:** [`Final-Review-Updates.txt`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Final-Review-Updates.txt)

Two items still pending before final review:
1. Update account information and password section
2. Update profile image

These are UI features that need to be completed in the frontend.

---

### 9. Backend — `ACCESS_TOKEN_EXPIRE_MINUTES=60` is short for production
**File:** [`Backend/.env`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/.env) · Line 3

60 minutes may cause frequent logouts. Consider increasing to `1440` (24 hours) or implementing refresh token logic.

---

### 10. Backend — Duplicate `verify_password` function definition
**File:** [`Backend/main.py`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/main.py) · Lines 156–164

The function is defined **twice** — the second one silently overrides the first. Clean this up.

---

### 11. Backend — `requirements.txt` has unpinned versions
**File:** [`Backend/requirements.txt`](file:///d:/MCA-27/CropCareAI-App%20-%20Local/Backend/requirements.txt)

Most packages have no version pins (e.g. `tensorflow`, `fastapi`, `numpy`). Only `bcrypt==4.2.1` is pinned. This can cause deployment breakage if a new incompatible version ships.

**Fix:** Pin versions from your working virtual environment:
```
pip freeze > requirements.txt
```

---

## 🟢 Pre-Deploy Steps Summary

```
1. Generate a strong SECRET_KEY and update Backend/.env
2. Update DATABASE_URL to the production database in Backend/.env
3. Update VITE_API_BASE_URL to the live backend URL in Frontend/.env
4. Fix the Tesseract path (use env var or shutil.which)
5. Remove print() of DATAGOVIN_API_KEY (line 92 of main.py)
6. Remove or replace remaining debug print() statements in main.py
7. Remove all console.log() statements from Frontend/src/
8. Confirm/clean up CORS allowed origins list
9. Run: npm run build  (in Frontend/)
10. Deploy Frontend dist/ to Vercel
11. Deploy Backend to your server (Railway/Render/VPS) with correct env vars
12. Run DB migrations / verify tables are created on production DB
```
