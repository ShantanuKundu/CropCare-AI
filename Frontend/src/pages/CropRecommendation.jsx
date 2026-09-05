import { useState, useEffect } from 'react';
import { Upload, Thermometer, Droplets, CloudRain, AlertCircle, CheckCircle } from 'lucide-react';
import { soilService } from '../services/soilService';
import { cropService } from '../services/cropService';
import { farmService } from '../services/farmService';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useVoiceFill, CROP_REC_FIELDS } from '../utils/voiceFormFill';
import './CropRecommendation.css';

// Auto-detect season from current month
function getSeason() {
  const month = new Date().getMonth() + 1;
  if ([6, 7, 8, 9].includes(month)) return 'Kharif';
  if ([10, 11, 12, 1, 2].includes(month)) return 'Rabi';
  if ([3, 4, 5].includes(month)) return 'Zaid';
  return 'Kharif';
}

function confidenceClass(level) {
  if (level === 'High') return 'badge-high';
  if (level === 'Moderate') return 'badge-moderate';
  return 'badge-low';
}

function cropEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('rice') || n.includes('paddy')) return '🌾';
  if (n.includes('wheat')) return '🌾';
  if (n.includes('maize') || n.includes('corn')) return '🌽';
  if (n.includes('cotton')) return '🌿';
  if (n.includes('sugarcane')) return '🎋';
  if (n.includes('potato')) return '🥔';
  if (n.includes('tomato')) return '🍅';
  if (n.includes('onion')) return '🧅';
  if (n.includes('watermelon') || n.includes('melon')) return '🍉';
  if (n.includes('chickpea') || n.includes('lentil') || n.includes('pulse')) return '🫘';
  return '🌱';
}

const SEASONS = ['Kharif', 'Rabi', 'Zaid'];

const CropRecommendation = () => {
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();

  // ── Step 11a: Voice form fill — soil fields + season ──
  useVoiceFill(
    CROP_REC_FIELDS,
    (field, value) => {
      if (field === 'season') setSeason(value);
      else setSoilData(prev => ({ ...prev, [field]: value }));
    },
    speak
  );

  // ── Farms ─────────────────────────────────
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');

  // ── SHC Upload state ─────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractSuccess, setExtractSuccess] = useState(false);

  // ── Soil data fields (editable) ──────────
  const [soilData, setSoilData] = useState({ pH: '', Nitrogen: '', Phosphorus: '', Potassium: '' });

  // ── Season ───────────────────────────────
  const [season, setSeason] = useState(getSeason());

  // ── Recommendation state (live display — separate from History) ──
  // Three discrete states so each resets explicitly and atomically.
  const [loading, setLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [recommendations, setRecommendations] = useState([]);  // fresh POST only
  const [weather, setWeather] = useState(null);               // fresh POST only
  const [resultSeason, setResultSeason] = useState('');       // echoed by backend

  // Fetch farms on mount
  useEffect(() => {
    farmService.getFarms()
      .then(data => setFarms(Array.isArray(data) ? data : []))
      .catch(() => setFarms([]));
  }, []);

  // ── SHC file pick ────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setExtractError('');
    setExtractSuccess(false);
  };

  // ── SHC Extract ──────────────────────────
  const handleExtract = async () => {
    if (!selectedFile) { setExtractError(t('pleaseSelectSHC')); return; }
    setExtracting(true);
    setExtractError('');
    setExtractSuccess(false);
    try {
      const data = await soilService.extractSoilData(selectedFile);
      setSoilData({
        pH: data.pH || '',
        Nitrogen: data.Nitrogen || '',
        Phosphorus: data.Phosphorus || '',
        Potassium: data.Potassium || '',
      });
      setExtractSuccess(true);
    } catch (err) {
      setExtractError(err.response?.data?.detail || t('ocrFailed'));
    } finally {
      setExtracting(false);
    }
  };

  // ── Soil field change ────────────────────
  const handleSoilChange = (field, value) => {
    setSoilData(prev => ({ ...prev, [field]: value }));
  };

  // ── Get Recommendation ───────────────────
  const handleRecommend = async () => {
    setRecError('');

    // Req #3: Wipe all previous result state BEFORE every new request
    // so stale data is NEVER shown while the new response is in-flight.
    setRecommendations([]);
    setWeather(null);
    setResultSeason('');

    if (!selectedFarmId) {
      setRecError(t('selectFarmFirst'));
      return;
    }

    const farm = farms.find(f => String(f.id) === String(selectedFarmId));
    if (!farm || farm.latitude == null || farm.longitude == null) {
      setRecError(t('selectFarmFirst'));
      return;
    }

    setLoading(true);
    try {
      // Req #1 & #2: Call POST /recommend-crop — this is the ONLY source for live display.
      // /latest-crop-recommendation is ONLY used by History page.
      const data = await cropService.getRecommendation(
        farm.latitude,
        farm.longitude,
        season,
        farm.id
      );

      // Normalize: backend returns array from POST, string from GET history
      console.log("API RESPONSE:", data.recommendations);
      const normalizedRecs =
        typeof data.recommendations === 'string'
          ? JSON.parse(data.recommendations)
          : Array.isArray(data.recommendations)
            ? data.recommendations
            : [];

      // Preserve backend sort order — do NOT re-sort or shuffle
      const top3 = normalizedRecs.slice(0, 3);

      // Req #1: Populate display states from THIS response only
      setRecommendations(top3);
      setWeather(data.weather || null);
      setResultSeason(data.season || season);

      // ── Step 10b: Auto-speak top crop ──
      if (top3.length > 0) {
        speak(`${t('topCropRec')}: ${top3[0].crop}. ${t('confidence')}: ${Number(top3[0].confidence).toFixed(0)}%.`);
      }

      console.log("DISPLAYING:", top3);

      // ── Persist to sessionStorage for History tab (does NOT affect display) ──
      try {
        const existing = JSON.parse(sessionStorage.getItem('cropRecHistory') || '[]');
        const snapshot = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          farmName: farm.farm_name,
          city: farm.location_name || '',
          soilData: { ...soilData },
          season,
          weather: data.weather || {},
          recommendations: top3,
        };
        existing.unshift(snapshot);
        sessionStorage.setItem('cropRecHistory', JSON.stringify(existing.slice(0, 20)));
      } catch (_) {}
    } catch (err) {
      setRecError(err.response?.data?.detail || t('recFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cr-page">
      {/* ── Header ────────────────────────────── */}
      <div className="cr-header">
        <div>
          <h1>{t('cropRecTitle')}</h1>
          <p className="cr-subtitle">{t('cropRecSubtitle')}</p>
        </div>
      </div>

      <div className="cr-body">
        {/* ══ LEFT PANEL ══════════════════════════ */}
        <div className="cr-left">

          {/* ── Section 1: SHC Upload ─────────── */}
          <div className="cr-card">
            <div className="cr-section-label">
              <Upload size={16} />
              <span>{t('step1Label')} <span className="cr-optional">({t('optional')})</span></span>
            </div>

            <div className="cr-upload-zone">
              <input
                type="file"
                accept="image/*"
                id="shc-file"
                className="cr-file-input"
                onChange={handleFileChange}
              />
              <label htmlFor="shc-file" className="cr-upload-label">
                {preview ? (
                  <img src={preview} alt="SHC Preview" className="cr-img-preview" />
                ) : (
                  <div className="cr-upload-placeholder">
                    <Upload size={28} className="cr-upload-icon" />
                    <p>{t('clickToUploadSHC')}</p>
                    <span>{t('jpgPngSupported')}</span>
                  </div>
                )}
              </label>
            </div>

            {selectedFile && (
              <div className="cr-filename">{selectedFile.name}</div>
            )}

            {extractError && (
              <div className="cr-error-msg"><AlertCircle size={15} />{extractError}</div>
            )}
            {extractSuccess && (
              <div className="cr-success-msg"><CheckCircle size={15} />{t('dataExtracted')}</div>
            )}

            <button
              className="cr-btn-extract"
              onClick={handleExtract}
              disabled={!selectedFile || extracting}
              id="extract-btn"
            >
              {extracting ? <><div className="cr-spinner" /> {t('extracting')}</> : t('extractData')}
            </button>
          </div>

          {/* ── Section 2: Soil Data Form ─────── */}
          <div className="cr-card">
            <div className="cr-section-label">
              <span>📋</span>
              <span>{t('step2Label')} <span className="cr-optional">({t('step2Sub')})</span></span>
            </div>

            <div className="cr-soil-grid">
              {[
                { key: 'pH', label: t('pHLevel'), placeholder: 'e.g. 6.5' },
                { key: 'Nitrogen', label: t('nitrogen'), placeholder: 'e.g. 40' },
                { key: 'Phosphorus', label: t('phosphorus'), placeholder: 'e.g. 30' },
                { key: 'Potassium', label: t('potassium'), placeholder: 'e.g. 35' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="cr-form-group">
                  <label className="cr-label">{label}</label>
                  <input
                    type="text"
                    className="cr-input"
                    value={soilData[key]}
                    onChange={e => handleSoilChange(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            <p className="cr-note">ℹ️ {t('soilNote')}</p>
          </div>

          {/* ── Section 3: Season ─────────────── */}
          <div className="cr-card">
            <div className="cr-section-label">
              <span>🗓️</span>
              <span>{t('step3Label')} <span className="cr-required">*</span></span>
            </div>
            <select
              className="cr-select"
              value={season}
              onChange={e => setSeason(e.target.value)}
              id="season-select"
            >
              {SEASONS.map(s => (
                <option key={s} value={s}>
                  {s === 'Kharif' ? '☔ Kharif (Jun–Sep)' : s === 'Rabi' ? '❄️ Rabi (Oct–Feb)' : '☀️ Zaid (Mar–May)'}
                </option>
              ))}
            </select>
            <p className="cr-note">{t('seasonNote')}</p>
          </div>

          {/* ── Section 4: Select Farm ─────────── */}
          <div className="cr-card">
            <div className="cr-section-label">
              <span>🌾</span>
              <span>{t('step4Label')} <span className="cr-required">*</span></span>
            </div>

            {farms.length === 0 ? (
              <div className="cr-no-farms-msg">
                <AlertCircle size={15} />
                <span>{t('noFarmsForRec')}</span>
              </div>
            ) : (
              <div className="cr-select-wrapper">
                <select
                  className="cr-select"
                  value={selectedFarmId}
                  onChange={e => setSelectedFarmId(e.target.value)}
                  id="farm-select"
                >
                  <option value="">{t('selectFarm')}</option>
                  {farms.map(farm => (
                    <option key={farm.id} value={farm.id}>
                      {farm.farm_name}
                      {farm.location_name ? ` — ${farm.location_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show selected farm location */}
            {selectedFarmId && (() => {
              const f = farms.find(x => String(x.id) === String(selectedFarmId));
              return f && (f.latitude != null) ? (
                <p className="cr-farm-coords">
                  📍 {Number(f.latitude).toFixed(5)}, {Number(f.longitude).toFixed(5)}
                </p>
              ) : null;
            })()}
          </div>

          {/* ── Section 5: Action ─────────────── */}
          {recError && (
            <div className="cr-error-banner"><AlertCircle size={17} /><span>{recError}</span></div>
          )}

          <button
            className="cr-btn-recommend"
            onClick={handleRecommend}
            disabled={loading}
            id="get-recommendation-btn"
          >
            {loading ? (
              <><div className="cr-spinner" /> {t('fetchingRec')}</>
            ) : (
              t('getRecommendation')
            )}
          </button>
        </div>

        {/* ══ RIGHT PANEL — Results ═══════════════════════════════════
             Rendered ONLY when the fresh POST response has arrived.
             `recommendations`, `weather`, `resultSeason` are all sourced
             exclusively from that response — never from history.
        ════════════════════════════════════════════════════════════ */}
        {recommendations.length > 0 && (
          <div className="cr-right">
            {/* Predicted Weather */}
            {weather && (
              <div className="cr-card">
                <div className="cr-section-label">
                  <span>🌦</span>
                  <span>{t('predictedWeatherConditions')} — <strong>{resultSeason}</strong></span>
                </div>
                <div className="cr-weather-grid">
                  <div className="cr-weather-item">
                    <Thermometer size={20} className="cr-w-icon temp" />
                    <div className="cr-w-label">{t('predictedTemperature')}</div>
                    <div className="cr-w-value">{weather.temperature?.toFixed(1) ?? '—'}°C</div>
                  </div>
                  <div className="cr-weather-item">
                    <Droplets size={20} className="cr-w-icon hum" />
                    <div className="cr-w-label">{t('predictedHumidity')}</div>
                    <div className="cr-w-value">{weather.humidity?.toFixed(1) ?? '—'}%</div>
                  </div>
                  <div className="cr-weather-item">
                    <CloudRain size={20} className="cr-w-icon rain" />
                    <div className="cr-w-label">{t('predictedRainfall')}</div>
                    <div className="cr-w-value">{weather.rainfall?.toFixed(1) ?? '—'} mm</div>
                  </div>
                </div>
              </div>
            )}

            {/* Crop Cards — rendered from `recommendations` state only */}
            <div className="cr-section-label cr-crops-label">
              <span>🌱</span>
              <span>{t('topCropRec')}</span>
            </div>
            <div className="cr-crops cr-crops-horizontal">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`cr-crop-card ${i === 0 ? 'cr-crop-top' : ''}`}
                >
                  <div className="cr-crop-header">
                    <span className="cr-crop-rank">#{i + 1}</span>
                    <span className={`cr-badge ${confidenceClass(rec.confidence_level)}`}>
                      {rec.confidence_level}
                    </span>
                  </div>
                  <div className="cr-crop-body">
                    <span className="cr-crop-emoji">{cropEmoji(rec.crop)}</span>
                    <h3 className="cr-crop-name">{rec.crop}</h3>
                    <div className="cr-conf-label">
                      {t('confidence')}: <strong>{Number(rec.confidence).toFixed(1)}%</strong>
                    </div>
                    <div className="cr-conf-track">
                      <div
                        className={`cr-conf-fill ${confidenceClass(rec.confidence_level)}`}
                        style={{ width: `${Math.min(Number(rec.confidence), 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="cr-crop-reason">
                    <span className="cr-reason-label">{t('whyThisCrop')}</span>
                    <p>{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CropRecommendation;
