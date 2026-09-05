import { useState, useEffect } from 'react';
import { Droplets, Loader2, AlertCircle, Leaf } from 'lucide-react';
import { toolsService } from '../services/toolsService';
import { farmService } from '../services/farmService';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useVoiceFill, IRRIGATION_FIELDS } from '../utils/voiceFormFill';
import './Tools.css';

const SOIL_TYPES      = ['clay', 'sandy', 'loam', 'silt', 'clay_loam', 'sandy_loam', 'black', 'red', 'laterite', 'alluvial'];
const IRRIGATION_METHODS = ['drip', 'sprinkler', 'furrow', 'flood', 'rainfed'];

const IrrigationAdvisory = () => {
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();
  const [farms, setFarms]             = useState([]);
  const [supportedCrops, setSupportedCrops] = useState([]);
  const [form, setForm] = useState({
    crop: '',
    soil_type: 'loam',
    irrigation_method: 'furrow',
    days_after_sowing: '',
    farm_id: '',
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── Step 11d: Voice form fill ──
  useVoiceFill(
    IRRIGATION_FIELDS,
    (field, value) => setForm(f => ({ ...f, [field]: value })),
    speak
  );

  useEffect(() => {
    farmService.getFarms()
      .then(d => { console.log('[Irrigation] farms:', d); setFarms(Array.isArray(d) ? d : []); })
      .catch(e => console.warn('[Irrigation] farm fetch error:', e));

    toolsService.getSupportedIrrigationCrops()
      .then(d => setSupportedCrops(d?.supported_crops || []))
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.crop.trim()) { setError(t('irrigationErrCrop')); return; }
    if (!form.farm_id)     { setError(t('irrigationErrFarm')); return; }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const payload = {
        crop:               form.crop.trim().toLowerCase(),
        soil_type:          form.soil_type,
        irrigation_method:  form.irrigation_method,
        farm_id:            parseInt(form.farm_id, 10),
      };
      if (form.days_after_sowing) payload.days_after_sowing = parseInt(form.days_after_sowing, 10);

      console.log('[Irrigation] payload →', payload);
      const data = await toolsService.getIrrigationAdvisory(payload);
      console.log('[Irrigation] response ←', data);
      setResult(data);
      // ── Step 10e: Auto-speak water requirement ──
      const netDaily = data?.water_requirement?.net_daily_et_mm;
      if (netDaily != null) {
        speak(`${t('irrigationReadyTitle')}. ${t('irrigationNetDaily')}: ${netDaily.toFixed(1)} mm.`);
      }
    } catch (err) {
      console.error('[Irrigation] error:', err);
      setError(err?.response?.data?.detail || t('irrigationErrFetch'));
    } finally {
      setLoading(false);
    }
  };

  // ── Derived values from nested response ────────────────────────
  const wr       = result?.water_requirement  ?? {};
  const schedule = result?.schedule           ?? {};
  const volume   = result?.volume_per_irrigation;
  const tips     = result?.tips               ?? [];
  const warnings = result?.warnings           ?? [];

  return (
    <div className="tools-page">
      <div className="tools-page-header">
        <div className="tools-page-badge"><Droplets size={14} /> {t('irrigationAdvisory')}</div>
        <h1 className="tools-page-title">💧 {t('irrigationTitle')}</h1>
        <p className="tools-page-subtitle">{t('irrigationSubtitle')}</p>
      </div>

      <div className="tools-layout">
        {/* ── Form Panel ── */}
        <div className="tools-form-panel">
          <div className="tools-form-card">
            <h3 className="tools-form-title"><Leaf size={18} /> {t('irrigationFarmDetails')}</h3>
            <form className="tools-form" onSubmit={handleSubmit}>

              {/* Crop */}
              <div className="form-group">
                <label>🌾 {t('irrigationCropLabel')} <span style={{ color: '#ef4444' }}>*</span></label>
                {supportedCrops.length > 0 ? (
                  <select value={form.crop} onChange={e => set('crop', e.target.value)} required>
                    <option value="">{t('irrigationSelectCrop')}</option>
                    {supportedCrops.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. rice, wheat, maize"
                    value={form.crop}
                    onChange={e => set('crop', e.target.value)}
                    required
                  />
                )}
              </div>

              {/* Farm */}
              <div className="form-group">
                <label>🏡 {t('irrigationFarmLabel')} <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={form.farm_id} onChange={e => set('farm_id', e.target.value)} required>
                  <option value="">
                    {farms.length === 0 ? t('irrigationNoFarms') : t('irrigationSelectFarm')}
                  </option>
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name || f.farm_name || `Farm #${f.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Soil type + Irrigation method */}
              <div className="tools-form-row">
                <div className="form-group">
                  <label>🪨 {t('irrigationSoilType')}</label>
                  <select value={form.soil_type} onChange={e => set('soil_type', e.target.value)}>
                    {SOIL_TYPES.map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>🚿 {t('irrigationMethod')}</label>
                  <select value={form.irrigation_method} onChange={e => set('irrigation_method', e.target.value)}>
                    {IRRIGATION_METHODS.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Days after sowing */}
              <div className="form-group">
                <label>📅 {t('irrigationDAS')}</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  placeholder="e.g. 30"
                  value={form.days_after_sowing}
                  onChange={e => set('days_after_sowing', e.target.value)}
                />
              </div>

              {error && (
                <div className="tools-error"><AlertCircle size={16} /> {error}</div>
              )}

              <button type="submit" className="tools-submit-btn" disabled={loading}>
                {loading
                  ? <><Loader2 size={18} className="tools-spin" /> {t('irrigationFetching')}</>
                  : `💧 ${t('irrigationSubmit')}`}
              </button>
            </form>
          </div>
        </div>

        {/* ── Result Panel ── */}
        <div className="tools-result-panel">
          {!result ? (
            <div className="tools-empty-state">
              <span className="tools-empty-icon">💧</span>
              <h3>{t('irrigationReadyTitle')}</h3>
              <p>{t('irrigationReadyHint')}</p>
            </div>
          ) : (
            <>
              {/* Growth Stage */}
              {result.growth_stage_label && (
                <div className="tools-card">
                  <h3 className="tools-card-title">🌱 {t('irrigationGrowthStage')}</h3>
                  <p className="tools-summary-text">{result.growth_stage_label}</p>
                </div>
              )}

              {/* Water Requirements */}
              <div className="tools-card">
                <h3 className="tools-card-title"><Droplets size={17} /> {t('irrigationWaterReq')}</h3>
                <div className="tools-stat-grid">
                  {wr.net_daily_need_mm != null && (
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationNetDaily')}</span>
                      <span className="tools-stat-value">{wr.net_daily_need_mm}</span>
                      <span className="tools-stat-unit">mm / day</span>
                    </div>
                  )}
                  {wr.gross_apply_mm_day != null && (
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationGrossApply')}</span>
                      <span className="tools-stat-value">{wr.gross_apply_mm_day}</span>
                      <span className="tools-stat-unit">mm / day</span>
                    </div>
                  )}
                  {wr.irrigation_efficiency && (
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationEfficiency')}</span>
                      <span className="tools-stat-value">{wr.irrigation_efficiency}</span>
                      <span className="tools-stat-unit">method</span>
                    </div>
                  )}
                  {wr.effective_rain_mm_day != null && (
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationRainCredit')}</span>
                      <span className="tools-stat-value">{wr.effective_rain_mm_day}</span>
                      <span className="tools-stat-unit">mm / day</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule */}
              {schedule.interval_days != null && (
                <div className="tools-card">
                  <h3 className="tools-card-title">📅 {t('irrigationSchedule')}</h3>
                  <div className="tools-stat-grid" style={{ marginBottom: '1rem' }}>
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationInterval')}</span>
                      <span className="tools-stat-value">{schedule.interval_days}</span>
                      <span className="tools-stat-unit">days</span>
                    </div>
                    {schedule.apply_per_session_mm != null && (
                      <div className="tools-stat-item">
                        <span className="tools-stat-label">{t('irrigationPerSession')}</span>
                        <span className="tools-stat-value">{schedule.apply_per_session_mm}</span>
                        <span className="tools-stat-unit">mm</span>
                      </div>
                    )}
                  </div>
                  {schedule.summary && (
                    <p className="tools-summary-text">{schedule.summary}</p>
                  )}
                </div>
              )}

              {/* Volume per Irrigation */}
              {volume && (
                <div className="tools-card">
                  <h3 className="tools-card-title">🪣 {t('irrigationVolume')}</h3>
                  <div className="tools-stat-grid">
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationFarmArea')}</span>
                      <span className="tools-stat-value">{volume.area_acres}</span>
                      <span className="tools-stat-unit">acres</span>
                    </div>
                    <div className="tools-stat-item">
                      <span className="tools-stat-label">{t('irrigationTotalVolume')}</span>
                      <span className="tools-stat-value">
                        {volume.per_irrigation_litres != null
                          ? Number(volume.per_irrigation_litres).toLocaleString('en-IN')
                          : 'N/A'}
                      </span>
                      <span className="tools-stat-unit">litres</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="tools-card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
                  <h3 className="tools-card-title" style={{ color: '#f59e0b' }}>⚠️ {t('irrigationWarnings')}</h3>
                  <ul className="tools-tips-list">
                    {warnings.map((w, i) => (
                      <li key={i} style={{ borderLeftColor: 'rgba(245,158,11,0.5)' }}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tips */}
              {tips.length > 0 && (
                <div className="tools-card">
                  <h3 className="tools-card-title">💡 {t('irrigationTips')}</h3>
                  <ul className="tools-tips-list">
                    {tips.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              )}

              {/* Note */}
              {result.note && (
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: 0 }}>
                  ℹ️ {result.note}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default IrrigationAdvisory;
