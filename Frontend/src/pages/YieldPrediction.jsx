import { useState, useEffect } from 'react';
import {
  TrendingUp, Loader2, AlertCircle, Leaf,
  BarChart3, Activity, ChevronDown
} from 'lucide-react';
import { yieldService } from '../services/yieldService';
import { farmService } from '../services/farmService';
import { useLanguage } from '../context/LanguageContext';
import './YieldPrediction.css';

/* ─── helpers ──────────────────────────────────────────────────────────── */
// Auto-detect season from current month (same logic as CropRecommendation)
function getSeason() {
  const month = new Date().getMonth() + 1;
  if ([6, 7, 8, 9].includes(month)) return 'Kharif';
  if ([10, 11, 12, 1, 2].includes(month)) return 'Rabi';
  if ([3, 4, 5].includes(month)) return 'Zaid';
  return 'Kharif';
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
  if (n.includes('watermelon') || n.includes('melon')) return '🍉';
  if (n.includes('chickpea') || n.includes('lentil')) return '🫘';
  return '🌱';
}

/* ─── component ────────────────────────────────────────────────────────── */
const YieldPrediction = () => {
  const { t } = useLanguage();

  /* form state */
  const [formData, setFormData] = useState({
    crop: '',
    farming_type: 'chemical',
    season: getSeason(),
    farm_id: '',
    irrigation_type: 'rainfed',
  });

  /* farms list */
  const [farms, setFarms] = useState([]);

  /* supported crops from backend */
  const [supportedCrops, setSupportedCrops] = useState([]);

  /* result state */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  /* fetch farms + supported crops on mount */
  useEffect(() => {
    farmService.getFarms()
      .then(data => setFarms(Array.isArray(data) ? data : []))
      .catch(() => setFarms([]));

    yieldService.getSupportedCrops()
      .then(data => setSupportedCrops(Array.isArray(data?.supported_crops) ? data.supported_crops : []))
      .catch(() => setSupportedCrops([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!formData.crop.trim()) {
      setError(t('irrigationErrCrop'));
      return;
    }

    setLoading(true);
    try {
      const payload = {
        crop: formData.crop.trim().toLowerCase(),
        farming_type: formData.farming_type,
        season: formData.season,
        irrigation_type: formData.irrigation_type,
      };
      if (formData.farm_id) payload.farm_id = parseInt(formData.farm_id, 10);

      const data = await yieldService.predictYield(payload);
      setResult(data);
      setTimeout(() => {
        document.getElementById('yield-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'string' && detail.includes('not supported')) {
        setError(`${detail}. Please choose from the supported crops listed above.`);
      } else {
        setError(detail || err?.message || 'Yield prediction failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── JSX ─────────────────────────────────────────────────────────────── */
  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="yield-page-header">
        <div className="yield-header-content">
          <TrendingUp className="yield-page-icon" size={40} />
          <div>
            <h1>{t('cropYieldPrediction')}</h1>
            <p className="page-subtitle">
              {t('yieldPredictionSubtitle')}
            </p>
          </div>
        </div>
      </div>

      <div className="yield-layout">

        {/* ════════ FORM PANEL ════════ */}
        <div className="yield-form-panel">
          <div className="yield-form-card">
            <h2 className="yield-form-title">
              <Leaf size={20} /> {t('irrigationFarmDetails')}
            </h2>

            <form onSubmit={handleSubmit} className="yield-form">

              {/* Crop Selection */}
              <div className="form-group">
                <label htmlFor="yield-crop">
                  {t('yieldCrop')} <span className="required-star">*</span>
                </label>
                {supportedCrops.length > 0 ? (
                  <select
                    id="yield-crop"
                    name="crop"
                    value={formData.crop}
                    onChange={handleChange}
                    required
                    className="yield-select"
                  >
                    <option value="">— {t('irrigationSelectCrop')} —</option>
                    {supportedCrops.map(crop => (
                      <option key={crop} value={crop}>
                        {cropEmoji(crop)} {crop.charAt(0).toUpperCase() + crop.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="yield-crop"
                    type="text"
                    name="crop"
                    value={formData.crop}
                    onChange={handleChange}
                    placeholder="e.g., rice, wheat, maize"
                    required
                  />
                )}
              </div>

              {/* Farming Type */}
              <div className="form-group">
                <label htmlFor="yield-farming-type">
                  {t('yieldFarmingType')} <span className="required-star">*</span>
                </label>
                <select
                  id="yield-farming-type"
                  name="farming_type"
                  value={formData.farming_type}
                  onChange={handleChange}
                  required
                  className="yield-select"
                >
                  <option value="chemical">🧪 Chemical</option>
                  <option value="organic">🌿 Organic</option>
                  <option value="traditional">🌾 Traditional</option>
                </select>
              </div>

              {/* Season */}
              <div className="form-group">
                <label htmlFor="yield-season">
                  {t('yieldSeason')} <span className="required-star">*</span>
                </label>
                <select
                  id="yield-season"
                  name="season"
                  value={formData.season}
                  onChange={handleChange}
                  required
                  className="yield-select"
                >
                  <option value="Kharif">☔ Kharif (Jun–Sep)</option>
                  <option value="Rabi">❄️ Rabi (Oct–Feb)</option>
                  <option value="Zaid">☀️ Zaid (Mar–May)</option>
                </select>
              </div>

              {/* Farm Selection */}
              <div className="form-group">
                <label htmlFor="yield-farm">
                  {t('yieldFarm')} <span className="yield-optional-tag">({t('optional')})</span>
                </label>
                {farms.length === 0 ? (
                  <div className="yield-no-farms">
                    <AlertCircle size={15} />
                    <span>{t('noFarmsYet')}</span>
                  </div>
                ) : (
                  <select
                    id="yield-farm"
                    name="farm_id"
                    value={formData.farm_id}
                    onChange={handleChange}
                    className="yield-select"
                  >
                    <option value="">— {t('selectFarm')} —</option>
                    {farms.map(farm => (
                      <option key={farm.id} value={farm.id}>
                        {farm.farm_name}{farm.location_name ? ` — ${farm.location_name}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Irrigation Type (optional) */}
              <div className="form-group">
                <label htmlFor="yield-irrigation">
                  {t('irrigationMethod')} <span className="yield-optional-tag">({t('optional')})</span>
                </label>
                <select
                  id="yield-irrigation"
                  name="irrigation_type"
                  value={formData.irrigation_type}
                  onChange={handleChange}
                  className="yield-select"
                >
                  <option value="rainfed">🌧️ Rainfed</option>
                  <option value="irrigated">💧 Irrigated</option>
                  <option value="drip">🚿 Drip Irrigation</option>
                </select>
              </div>

              {/* Error */}
              {error && (
                <div className="yield-error-alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary yield-submit-btn"
                id="yield-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 size={18} className="spin-icon" /> {t('yieldPredicting')}</>
                ) : (
                  <><TrendingUp size={18} /> {t('yieldSubmit')}</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ════════ RESULT PANEL ════════ */}
        {result && (
          <div className="yield-result-panel" id="yield-result">

            {/* Hero yield range */}
            <div className="yield-card yield-hero-card">
              <h3 className="yield-card-title">
                <TrendingUp size={18} /> 📊 {t('yieldResult')}
              </h3>
              <div className="yield-hero-crop">
                <span className="yield-crop-emoji">{cropEmoji(result.crop)}</span>
                <span className="yield-crop-name">
                  {result.crop?.charAt(0).toUpperCase() + result.crop?.slice(1)}
                </span>
              </div>
              <div className="yield-range-grid">
                <div className="yield-range-item yield-low">
                  <span className="yield-range-label">{t('yieldLow')}</span>
                  <span className="yield-range-value">{result.yield_range?.low}</span>
                  <span className="yield-range-unit">qtl/acre</span>
                </div>
                <div className="yield-range-item yield-mid yield-mid-highlighted">
                  <span className="yield-range-label">{t('yieldExpected')}</span>
                  <span className="yield-range-value">{result.yield_range?.mid}</span>
                  <span className="yield-range-unit">qtl/acre</span>
                </div>
                <div className="yield-range-item yield-high">
                  <span className="yield-range-label">{t('yieldHigh')}</span>
                  <span className="yield-range-value">{result.yield_range?.high}</span>
                  <span className="yield-range-unit">qtl/acre</span>
                </div>
              </div>

              {/* Tags */}
              <div className="yield-tags">
                <span className="yield-tag">
                  {result.farming_type?.charAt(0).toUpperCase() + result.farming_type?.slice(1)} Farming
                </span>
                <span className="yield-tag">{result.irrigation_type}</span>
              </div>
            </div>

            {/* Total Production (if farm area was resolved) */}
            {result.total_production && (
              <div className="yield-card yield-production-card">
                <h3 className="yield-card-title">
                  <BarChart3 size={18} /> 🏭 {t('yieldExpected')}
                </h3>
                <p className="yield-production-note">
                  {t('irrigationFarmArea')}: <strong>{result.total_production.area_acres} acres</strong>
                </p>
                <div className="yield-range-grid">
                  <div className="yield-range-item yield-low">
                    <span className="yield-range-label">{t('yieldLow')}</span>
                    <span className="yield-range-value">{result.total_production.low_quintals}</span>
                    <span className="yield-range-unit">quintals</span>
                  </div>
                  <div className="yield-range-item yield-mid yield-mid-highlighted">
                    <span className="yield-range-label">{t('yieldExpected')}</span>
                    <span className="yield-range-value">{result.total_production.mid_quintals}</span>
                    <span className="yield-range-unit">quintals</span>
                  </div>
                  <div className="yield-range-item yield-high">
                    <span className="yield-range-label">{t('yieldHigh')}</span>
                    <span className="yield-range-value">{result.total_production.high_quintals}</span>
                    <span className="yield-range-unit">quintals</span>
                  </div>
                </div>
              </div>
            )}

            {/* Farming Method Comparison */}
            {result.comparison && (
              <div className="yield-card yield-comparison-card">
                <h3 className="yield-card-title">
                  <Activity size={18} /> ⚖️ Method Comparison
                </h3>
                <div className="yield-comparison-grid">
                  <div className="yield-comparison-item">
                    <span className="yield-comp-label">🧪 Chemical</span>
                    <span className="yield-comp-value">{result.comparison.conventional_qtl_acre} qtl/acre</span>
                  </div>
                  <div className="yield-comparison-item">
                    <span className="yield-comp-label">🌿 Organic</span>
                    <span className="yield-comp-value">{result.comparison.organic_qtl_acre} qtl/acre</span>
                  </div>
                  <div className="yield-comparison-item yield-gap-item">
                    <span className="yield-comp-label">📉 Yield Gap</span>
                    <span className="yield-comp-value">{result.comparison.yield_gap_qtl_acre} qtl/acre</span>
                  </div>
                </div>
                {result.comparison.note && (
                  <p className="yield-comparison-note">{result.comparison.note}</p>
                )}
              </div>
            )}

            {/* Limiting Factors */}
            {result.limiting_factors && result.limiting_factors.length > 0 && (
              <div className="yield-card yield-factors-card">
                <h3 className="yield-card-title">⚠️ Limiting Factors & Tips</h3>
                <ul className="yield-factors-list">
                  {result.limiting_factors.map((factor, i) => (
                    <li key={i} className="yield-factor-item">
                      <span className="yield-factor-bullet">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weather Used */}
            {result.weather_used && (
              <div className="yield-card yield-weather-card">
                <h3 className="yield-card-title">🌦️ {t('weatherConditions')}</h3>
                <div className="yield-weather-grid">
                  <div className="yield-weather-item">
                    <span className="yield-weather-label">🌡️ {t('temperature')}</span>
                    <span className="yield-weather-val">{result.weather_used.temperature?.toFixed(1)}°C</span>
                  </div>
                  <div className="yield-weather-item">
                    <span className="yield-weather-label">💧 {t('humidity')}</span>
                    <span className="yield-weather-val">{result.weather_used.humidity?.toFixed(1)}%</span>
                  </div>
                  <div className="yield-weather-item">
                    <span className="yield-weather-label">🌧️ {t('rainfall')}</span>
                    <span className="yield-weather-val">{result.weather_used.rainfall?.toFixed(1)} mm</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default YieldPrediction;
