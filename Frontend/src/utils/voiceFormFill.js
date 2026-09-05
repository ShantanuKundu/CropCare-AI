/**
 * voiceFormFill.js — Spoken value → form field value parser
 *
 * Parses a voice transcript to extract a field name + value and dispatches
 * a 'voice-fill' CustomEvent that the target form page listens for.
 *
 * Usage (from within a form page):
 *   import { useVoiceFill } from '../utils/voiceFormFill';
 *   useVoiceFill(FIELD_CONFIG, (field, value) => setFormData(...));
 *
 * Or standalone:
 *   dispatchVoiceFill('nitrogen', '45');
 */

import { useEffect } from 'react';

// ── Number word maps (spoken → digit) ────────────────────────────────────────
// Covers common ways farmers say numbers in Hindi and English
const NUMBER_WORDS = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, half: 0.5,
  // Hindi cardinal words
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5,
  'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15,
  'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19, 'बीस': 20,
  'तीस': 30, 'चालीस': 40, 'पचास': 50, 'साठ': 60,
  'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90, 'सौ': 100,
  'डेढ़': 1.5, 'ढाई': 2.5,
};

/**
 * parseNumber(text) — extract first numeric value from transcript.
 * Handles: "forty five", "45", "6.5", "पचास", "ढाई"
 */
export function parseNumber(text) {
  if (!text) return null;
  const t = text.trim().toLowerCase();

  // Direct digit (possibly decimal)
  const directMatch = t.match(/\d+(\.\d+)?/);
  if (directMatch) return parseFloat(directMatch[0]);

  // Word-based number
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (t.includes(word.toLowerCase())) return val;
  }

  return null;
}

// ── Crop name normaliser ──────────────────────────────────────────────────────
// Maps common spoken crop names (any language) → English crop name used by backend
const CROP_MAP = {
  // English
  rice: 'rice', paddy: 'rice', wheat: 'wheat', maize: 'maize', corn: 'maize',
  cotton: 'cotton', sugarcane: 'sugarcane', potato: 'potato', tomato: 'tomato',
  onion: 'onion', chickpea: 'chickpea', lentil: 'lentil', mustard: 'mustard',
  soybean: 'soybean', groundnut: 'groundnut', peanut: 'groundnut',
  millet: 'millet', sorghum: 'sorghum', jowar: 'sorghum', bajra: 'millet',
  barley: 'barley', pea: 'pea', gram: 'chickpea', arhar: 'pigeonpea',
  pigeonpea: 'pigeonpea', moong: 'moong', urad: 'urad',
  // Hindi
  'गेहूं': 'wheat', 'गेहूँ': 'wheat', 'चावल': 'rice', 'धान': 'rice',
  'मक्का': 'maize', 'कपास': 'cotton', 'गन्ना': 'sugarcane',
  'आलू': 'potato', 'टमाटर': 'tomato', 'प्याज': 'onion',
  'चना': 'chickpea', 'मसूर': 'lentil', 'सरसों': 'mustard',
  'सोयाबीन': 'soybean', 'मूंगफली': 'groundnut', 'बाजरा': 'millet',
  'ज्वार': 'sorghum', 'जौ': 'barley', 'मूंग': 'moong', 'उड़द': 'urad',
  'अरहर': 'pigeonpea', 'तुअर': 'pigeonpea',
  // Marathi
  'गहू': 'wheat', 'तांदूळ': 'rice', 'भात': 'rice', 'मका': 'maize',
  'कापूस': 'cotton', 'ऊस': 'sugarcane', 'बटाटा': 'potato',
  'टोमॅटो': 'tomato', 'कांदा': 'onion', 'हरभरा': 'chickpea',
  // Tamil
  'கோதுமை': 'wheat', 'அரிசி': 'rice', 'நெல்': 'rice', 'மக்காச்சோளம்': 'maize',
  'பருத்தி': 'cotton', 'கரும்பு': 'sugarcane', 'உருளைக்கிழங்கு': 'potato',
  'தக்காளி': 'tomato', 'வெங்காயம்': 'onion',
  // Gujarati
  'ઘઉં': 'wheat', 'ચોખા': 'rice', 'મકાઈ': 'maize', 'કપાસ': 'cotton',
  'શેરડી': 'sugarcane', 'બટાકા': 'potato', 'ટામેટા': 'tomato',
  'ડુંગળી': 'onion',
  // Telugu
  'గోధుమ': 'wheat', 'వరి': 'rice', 'మొక్కజొన్న': 'maize',
  'పత్తి': 'cotton', 'చెరకు': 'sugarcane', 'బంగాళాదుంప': 'potato',
  'టమాటో': 'tomato', 'ఉల్లిపాయ': 'onion',
  // Kannada
  'ಗೋಧಿ': 'wheat', 'ಅಕ್ಕಿ': 'rice', 'ಭತ್ತ': 'rice', 'ಜೋಳ': 'sorghum',
  'ಮೆಕ್ಕೆಜೋಳ': 'maize', 'ಹತ್ತಿ': 'cotton', 'ಕಬ್ಬು': 'sugarcane',
  'ಆಲೂಗಡ್ಡೆ': 'potato', 'ಟೊಮೆಟೊ': 'tomato', 'ಈರುಳ್ಳಿ': 'onion',
  // Bengali
  'গম': 'wheat', 'চাল': 'rice', 'ধান': 'rice', 'ভুট্টা': 'maize',
  'তুলা': 'cotton', 'আখ': 'sugarcane', 'আলু': 'potato',
  'টমেটো': 'tomato', 'পেঁয়াজ': 'onion',
  // Punjabi
  'ਕਣਕ': 'wheat', 'ਝੋਨਾ': 'rice', 'ਮੱਕੀ': 'maize',
  'ਕਪਾਹ': 'cotton', 'ਗੰਨਾ': 'sugarcane', 'ਆਲੂ': 'potato',
  'ਟਮਾਟਰ': 'tomato', 'ਪਿਆਜ਼': 'onion',
  // Odia
  'ଗହମ': 'wheat', 'ଚାଉଳ': 'rice', 'ଧାନ': 'rice', 'ମକା': 'maize',
  'କଳ': 'cotton', 'ଆଖୁ': 'sugarcane', 'ଆଳୁ': 'potato',
  'ଟମାଟୋ': 'tomato', 'ପିଆଜ': 'onion',
  // Malayalam
  'ഗോതമ്പ്': 'wheat', 'അരി': 'rice', 'നെല്ല്': 'rice',
  'ചോളം': 'maize', 'പരുത്തി': 'cotton', 'കരിമ്പ്': 'sugarcane',
  'ഉരുളക്കിഴങ്ങ്': 'potato', 'തക്കാളി': 'tomato', 'സവോള': 'onion',
};

export function parseCropName(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [spoken, english] of Object.entries(CROP_MAP)) {
    if (lower.includes(spoken.toLowerCase())) return english;
  }
  return null;
}

// ── Dropdown option maps ──────────────────────────────────────────────────────

const SEASON_MAP = {
  kharif: 'Kharif', 'खरीफ': 'Kharif', 'ਖਰੀਫ਼': 'Kharif',
  'খরিফ': 'Kharif', 'ఖరీఫ్': 'Kharif', 'ಖರೀಫ್': 'Kharif',
  rabi: 'Rabi', 'रबी': 'Rabi', 'ਰਬੀ': 'Rabi', 'রবি': 'Rabi',
  'రబీ': 'Rabi', 'ರಬಿ': 'Rabi',
  zaid: 'Zaid', 'जायद': 'Zaid', 'ਜ਼ੈਦ': 'Zaid',
  summer: 'Zaid', 'गर्मी': 'Zaid',
};

const FARMING_TYPE_MAP = {
  chemical: 'chemical', 'रासायनिक': 'chemical', 'chemical farming': 'chemical',
  organic: 'organic', 'जैविक': 'organic', 'organic farming': 'organic',
  traditional: 'traditional', 'परंपरागत': 'traditional', 'पारंपरिक': 'traditional',
  conventional: 'conventional',
};

const IRRIGATION_MAP = {
  drip: 'drip', 'ड्रिप': 'drip', 'टपक': 'drip',
  sprinkler: 'sprinkler', 'फव्वारा': 'sprinkler',
  furrow: 'furrow', 'कूड़': 'furrow',
  flood: 'flood', 'बाढ़': 'flood', 'तालाब': 'flood',
  rainfed: 'rainfed', 'वर्षा': 'rainfed', 'बारिश': 'rainfed',
  canal: 'canal', 'नहर': 'canal',
  borewell: 'borewell', 'बोरवेल': 'borewell', 'ट्यूबवेल': 'borewell',
};

const SOIL_TYPE_MAP = {
  clay: 'clay', 'चिकनी': 'clay', 'मिट्टी': 'clay',
  sandy: 'sandy', 'रेतीली': 'sandy', 'बलुई': 'sandy',
  loam: 'loam', 'दोमट': 'loam',
  silt: 'silt', 'गाद': 'silt',
  black: 'black', 'काली': 'black', 'काली मिट्टी': 'black',
  red: 'red', 'लाल': 'red', 'लाल मिट्टी': 'red',
  alluvial: 'alluvial', 'जलोढ़': 'alluvial',
  laterite: 'laterite', 'लैटेराइट': 'laterite',
};

function matchMap(text, map) {
  const lower = text.toLowerCase();
  for (const [spoken, value] of Object.entries(map)) {
    if (lower.includes(spoken.toLowerCase())) return value;
  }
  return null;
}

// ── Field config used by form pages ──────────────────────────────────────────
/**
 * FIELD_CONFIGS — describes which voice triggers and parsers apply to each
 * form page.  Each entry:
 *   triggers: string[]  — keywords that indicate this field is being filled
 *   parse: fn           — extracts the value from the full transcript
 *   field: string       — the form state key to update
 */
export const CROP_REC_FIELDS = [
  { field: 'pH',        triggers: ['ph', 'पीएच', 'पी एच'], parse: t => parseNumber(t) },
  { field: 'Nitrogen',  triggers: ['nitrogen', 'नाइट्रोजन', 'n value', 'n '], parse: t => parseNumber(t) },
  { field: 'Phosphorus',triggers: ['phosphorus', 'phosphorous', 'फास्फोरस'], parse: t => parseNumber(t) },
  { field: 'Potassium', triggers: ['potassium', 'पोटाश', 'पोटेशियम'], parse: t => parseNumber(t) },
  { field: 'season',    triggers: ['season', 'मौसम', 'ऋतु', 'kharif', 'rabi', 'zaid', 'खरीफ', 'रबी'], parse: t => matchMap(t, SEASON_MAP) },
];

export const FERTILIZER_FIELDS = [
  { field: 'crop',         triggers: ['crop', 'फसल', 'पैदावार के लिए', 'for crop'], parse: t => parseCropName(t) },
  { field: 'farming_type', triggers: ['farming', 'खेती', 'organic', 'chemical', 'जैविक', 'रासायनिक'], parse: t => matchMap(t, FARMING_TYPE_MAP) },
  { field: 'nitrogen',     triggers: ['nitrogen', 'नाइट्रोजन'], parse: t => parseNumber(t) },
  { field: 'phosphorous',  triggers: ['phosphorus', 'phosphorous', 'फास्फोरस'], parse: t => parseNumber(t) },
  { field: 'potassium',    triggers: ['potassium', 'पोटाश'], parse: t => parseNumber(t) },
  { field: 'ph',           triggers: ['ph', 'पीएच'], parse: t => parseNumber(t) },
];

export const YIELD_FIELDS = [
  { field: 'crop',             triggers: ['crop', 'फसल'], parse: t => parseCropName(t) },
  { field: 'farming_type',     triggers: ['farming', 'खेती'], parse: t => matchMap(t, FARMING_TYPE_MAP) },
  { field: 'season',           triggers: ['season', 'मौसम'], parse: t => matchMap(t, SEASON_MAP) },
  { field: 'irrigation_type',  triggers: ['irrigation', 'सिंचाई'], parse: t => matchMap(t, IRRIGATION_MAP) },
];

export const IRRIGATION_FIELDS = [
  { field: 'crop',               triggers: ['crop', 'फसल'], parse: t => parseCropName(t) },
  { field: 'soil_type',          triggers: ['soil', 'मिट्टी'], parse: t => matchMap(t, SOIL_TYPE_MAP) },
  { field: 'irrigation_method',  triggers: ['method', 'drip', 'sprinkler', 'flood', 'furrow', 'canal'], parse: t => matchMap(t, IRRIGATION_MAP) },
  { field: 'days_after_sowing',  triggers: ['days', 'दिन', 'बोने के बाद'], parse: t => parseNumber(t) },
];

export const SCHEME_FIELDS = [
  { field: 'crop',                triggers: ['crop', 'फसल'], parse: t => parseCropName(t) },
  { field: 'land_area_hectares',  triggers: ['area', 'hectare', 'हेक्टेयर', 'जमीन'], parse: t => parseNumber(t) },
  { field: 'family_income_lakh',  triggers: ['income', 'आय', 'लाख'], parse: t => parseNumber(t) },
  { field: 'farming_type',        triggers: ['farming', 'खेती'], parse: t => matchMap(t, FARMING_TYPE_MAP) },
];

export const ADD_FARM_FIELDS = [
  { field: 'farm_name',      triggers: ['farm name', 'name', 'खेत का नाम', 'नाम'], parse: t => {
    // Extract everything after the trigger phrase
    const m = t.match(/(?:farm name|name|नाम)\s+(.+)/i);
    return m ? m[1].trim() : null;
  }},
  { field: 'location_name',  triggers: ['location', 'village', 'गाँव', 'जगह'], parse: t => {
    const m = t.match(/(?:location|village|गाँव|जगह)\s+(.+)/i);
    return m ? m[1].trim() : null;
  }},
  { field: 'area_hectares',  triggers: ['area', 'hectare', 'हेक्टेयर', 'एकड़'], parse: t => parseNumber(t) },
];

// ── Hook: useVoiceFill ────────────────────────────────────────────────────────
/**
 * useVoiceFill(fieldConfigs, onFill)
 *
 * Listens for 'voice-fill' CustomEvents dispatched by useVoiceAssistant
 * and applies the spoken value to the matching form field.
 *
 * @param {Array}    fieldConfigs  — one of the FIELD config arrays above
 * @param {Function} onFill       — callback(field: string, value: any)
 * @param {Function} speak        — optional speak() from useVoiceAssistant for confirmation
 */
export function useVoiceFill(fieldConfigs, onFill, speak) {
  useEffect(() => {
    const handler = (event) => {
      const { raw } = event.detail;
      if (!raw) return;

      const lower = raw.toLowerCase();

      for (const config of fieldConfigs) {
        const triggered = config.triggers.some(trigger =>
          lower.includes(trigger.toLowerCase())
        );
        if (!triggered) continue;

        const parsed = config.parse(raw);
        if (parsed !== null && parsed !== undefined) {
          onFill(config.field, String(parsed));
          if (speak) speak(`${config.field}: ${parsed}`);
          break; // one field per utterance
        }
      }
    };

    window.addEventListener('voice-fill', handler);
    return () => window.removeEventListener('voice-fill', handler);
  }, [fieldConfigs, onFill, speak]);
}
