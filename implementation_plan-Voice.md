# Voice Assistant for CropCareAI 🎙️

## Background

CropCareAI serves farmers — many of whom may be illiterate or not comfortable reading text. A voice assistant lets them **speak a command** in their native language and **hear the app respond back** in the same language. The app already supports **11 languages** (English, Hindi, Bengali, Marathi, Telugu, Odia, Tamil, Gujarati, Kannada, Malayalam, Punjabi) via `translations.js` and `LanguageContext`, so the voice layer must seamlessly respect whichever language the farmer has selected.

---

## How It Will Work — End to End

```
Farmer taps 🎙️ button
        │
        ▼
[Browser captures mic audio]
        │
        ▼  (Speech-to-Text)
[User's spoken words → text]  ← Web Speech API (no API key)
        │
        ▼  (Intent Understanding)
[Text → what feature to open / what to do]  ← Rule-based matcher + Gemini API (optional)
        │
        ▼
[App navigates to page / reads result aloud]
        │
        ▼  (Text-to-Speech)
[Text → speech in farmer's language]  ← Web Speech Synthesis API (no API key)
```

The farmer can say things like:
- *"Fasal ki bimari check karo"* → opens Disease Detection page
- *"Khaad ki salah do"* → opens Fertilizer Recommendation
- *"Mandi bhav batao"* → opens Mandi Prices
- *"Dashboard dikha"* → goes to Dashboard
- After a result appears, the assistant reads it back aloud automatically.

---

## Do You Need to Hardcode Anything or Call an API?

| Component | Approach | API Key Required? |
|---|---|---|
| **Speech-to-Text (STT)** | **Web Speech API** (`window.SpeechRecognition`) — built into Chrome/Edge, zero cost | ❌ No |
| **Text-to-Speech (TTS)** | **Web Speech Synthesis API** (`window.speechSynthesis`) — built into all modern browsers | ❌ No |
| **Intent Matching (what did the user ask for?)** | **Rule-based keyword matching** — hardcoded keyword→route map per language | ❌ No |
| **Smart NLP fallback** | **Gemini API** — only if keyword matching fails (optional upgrade) | ✅ Yes (Gemini key) |
| **Reading results aloud** | Use existing `t()` translation strings + TTS | ❌ No |

### Recommended Approach: Start Free, Upgrade Later

**Phase 1 (MVP — zero API cost):**
- Web Speech API for STT
- Rule-based keyword map per language (hardcoded, ~50 phrases per language)
- Web Speech Synthesis for TTS

**Phase 2 (optional polish):**
- Add Gemini API call as a fallback when no keyword matches
- This handles free-form farming questions like *"Meri tomato ki fasal ko kya rog hai?"*

> [!IMPORTANT]
> The Web Speech API works **only on Chrome and Chromium-based browsers** (Chrome, Edge, Android Chrome). It does NOT work on Firefox or Safari. For a farming audience using Android phones, Chrome is the dominant browser, so this is acceptable.

---

## Languages Supported (Auto-inherited)

All 11 languages already present in the project will be supported. The voice assistant reads `language` from `LanguageContext` and:
1. Sets `SpeechRecognition.lang` to the right BCP-47 locale code
2. Sets `SpeechSynthesisUtterance.lang` to the same code
3. Loads the matching keyword→intent map for that language

| Language | Code in App | BCP-47 for Speech API |
|---|---|---|
| English | `en` | `en-IN` |
| Hindi | `hi` | `hi-IN` |
| Bengali | `bn` | `bn-IN` |
| Marathi | `mr` | `mr-IN` |
| Telugu | `te` | `te-IN` |
| Odia | `or` | `or-IN` |
| Tamil | `ta` | `ta-IN` |
| Gujarati | `gu` | `gu-IN` |
| Kannada | `kn` | `kn-IN` |
| Malayalam | `ml` | `ml-IN` |
| Punjabi | `pa` | `pa-IN` |

---

## What Gets Built

### Frontend (React — no backend changes needed for MVP)

#### [NEW] `src/hooks/useVoiceAssistant.js`
The core hook. Manages:
- `startListening()` / `stopListening()` — wraps Web Speech API
- `speak(text)` — wraps Web Speech Synthesis
- `processCommand(transcript)` — keyword matching → navigation / action
- Language switching: automatically respects `useLanguage()`

#### [NEW] `src/utils/voiceCommands.js`
A static map:
```js
{
  en: { "disease": "/predict", "dashboard": "/dashboard", "mandi": "/tools/mandi", ... },
  hi: { "बीमारी": "/predict", "फसल जांच": "/predict", "मंडी": "/tools/mandi", ... },
  // ... all 11 languages
}
```
This is the **hardcoded** part. About 10–15 command phrases per language (≈150 entries total). Easy to maintain.

#### [NEW] `src/components/VoiceAssistant.jsx`
A floating microphone button (bottom-right corner) visible on all pages. Shows:
- 🎙️ idle state
- 🔴 listening state (animated pulse ring)
- 💬 transcript bubble (shows what it heard)
- 🔊 speaking state (when reading results aloud)

#### [MODIFY] `src/App.jsx`
Add `<VoiceAssistant />` globally inside the layout so it persists across all routes.

#### [MODIFY] `src/utils/translations.js`
Add ~10 new translation keys for voice assistant UI text:
- `voiceAssistantReady`, `listening`, `didntUnderstand`, `navigatingTo`, etc.

#### [NEW] `src/components/VoiceAssistant.css`
Styles for the floating button, pulse animation, and transcript bubble.

### Backend
**No backend changes needed for MVP.** The voice assistant is entirely a frontend feature.

---

## Verification Plan

### Manual Verification
1. Switch language to Hindi → tap mic → say *"मंडी भाव बताओ"* → app should navigate to Mandi Prices page and speak confirmation in Hindi
2. Switch language to Tamil → tap mic → say *"நோய் கண்டறிதல்"* → app opens Disease Detection
3. Say an unknown command → assistant says *"मुझे समझ नहीं आया, कृपया फिर से कहें"* in selected language
4. After navigating to a page, verify TTS reads back the page name/confirmation
5. Test on Android Chrome (primary farmer device)

---

## Open Questions

> [!IMPORTANT]
> **1. Gemini API fallback** — Do you want Phase 2 (Gemini NLP) included from the start, or should we ship MVP (rule-based only) first?

> [!IMPORTANT]
> **2. Auto-speak results** — After the app shows a result (e.g., disease diagnosis), should the assistant automatically read the result aloud, or only when the farmer asks it to?

> [!NOTE]
> **3. Wake word** — Should the farmer have to tap the mic button each time, or do you want a wake word like *"CropCare suno"* for hands-free triggering? (Wake word needs a persistent listener — uses slightly more battery.)

> [!NOTE]
> **4. Scope of voice control** — For now the plan covers **navigation + reading results back**. Should the assistant also be able to **fill in form fields by voice** (e.g., speak "pH 6.5" to fill the soil pH field)? This adds complexity but is very useful for illiterate farmers.
