import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, FlaskConical, Leaf, Activity, BarChart3, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import './DetailView.css';
import './FertilizerRecommendation.css';

/* ─── helpers ──────────────────────────────────────────────── */
const statusColor = (status) => {
  if (!status) return '#6b7280';
  const s = status.toLowerCase();
  if (s.includes('low'))     return '#f59e0b';
  if (s.includes('high'))    return '#ef4444';
  if (s.includes('optimal') || s.includes('ideal') || s.includes('normal')) return '#10b981';
  return '#6b7280';
};

const statusClass = (status) => {
  if (!status) return 'status-unknown';
  const s = status.toLowerCase();
  if (s.includes('low'))     return 'status-low';
  if (s.includes('high'))    return 'status-high';
  if (s.includes('optimal') || s.includes('ideal') || s.includes('normal')) return 'status-optimal';
  return 'status-unknown';
};

/* ─── pH Correction renderer ──────────────────────────────── */
const PhCorrection = ({ phc, t }) => {
  if (!phc) return null;
  if (typeof phc === 'string') return <p className="fert-ph-text">{phc}</p>;
  const known = ['action', 'material', 'dosage', 'note'];
  return (
    <div className="fert-ph-content">
      {phc.action   && <p><strong>{t('action')}:</strong>   {phc.action}</p>}
      {phc.material && <p><strong>{t('material')}:</strong> {phc.material}</p>}
      {phc.dosage   && <p><strong>{t('dosage')}:</strong>   {phc.dosage}</p>}
      {phc.note     && <p className="fert-ph-note">{phc.note}</p>}
      {Object.entries(phc)
        .filter(([k]) => !known.includes(k))
        .map(([k, v]) => <p key={k}><strong>{k}:</strong> {String(v)}</p>)
      }
    </div>
  );
};

/* ─── Component ───────────────────────────────────────────── */
const FertilizerDetail = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const { t }     = useLanguage();

  /*
   * History list passes:   { state: { data: item } }
   * item from /fertilizer-history: { id, crop, farming_type, …, result: {...}, created_at }
   *
   * POST /recommend-fertilizer (flat): { id, crop, farming_type, soil_analysis, summary, … }
   *
   * We support BOTH.
   */
  const data   = location.state?.data;    // history click
  const record = location.state?.record;  // legacy
  const raw    = data || record;

  if (!raw) {
    return (
      <div className="page-container">
        <div className="error-container">
          <AlertCircle size={60} />
          <h2>Fertilizer Record Not Found</h2>
          <p>The requested fertilizer recommendation details could not be loaded.</p>
          <button className="btn-primary" onClick={() => navigate('/history')}>
            {t('backToHistory')}
          </button>
        </div>
      </div>
    );
  }

  /* Normalise: history records have a `result` wrapper; flat POST response does not */
  const result = raw.result ?? raw;

  const soil_analysis          = result.soil_analysis;
  const summary                = result.summary;
  const primary_recommendation = result.primary_recommendation;
  const ph_correction          = result.ph_correction;

  const crop         = raw.crop;
  const farming_type = raw.farming_type;
  const created_at   = raw.created_at;

  const dateStr = created_at
    ? new Date(created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })
    : 'N/A';

  /* Soil analysis field definitions — labels use t() */
  const soilFields = [
    { key: 'nitrogen',    label: t('pdf_nitrogen'),    unit: 'kg/ha' },
    { key: 'phosphorous', label: t('pdf_phosphorous'), unit: 'kg/ha' },
    { key: 'potassium',   label: t('pdf_potassium'),   unit: 'kg/ha' },
    { key: 'ph',          label: t('pdf_pHLevel'),     unit: '' },
  ];

  const renderSoilRow = ({ key, label, unit }) => {
    const entry = soil_analysis?.[key];
    if (!entry && entry !== 0) return null;

    const val    = (typeof entry === 'object') ? (entry.value ?? 'N/A') : entry;
    const status = (typeof entry === 'object') ? (entry.status ?? '') : '';
    const ideal  = (typeof entry === 'object') ? (entry.ideal_range ?? entry.ideal ?? '') : '';

    return (
      <div key={key} className="fert-soil-row">
        <span className="fert-soil-label">{label}</span>
        <span className="fert-soil-value">
          {val !== undefined && val !== null ? `${val}${unit ? ' ' + unit : ''}` : 'N/A'}
        </span>
        {status && (
          <span
            className={`fert-soil-status ${statusClass(status)}`}
            style={{ color: statusColor(status) }}
          >
            {status}
          </span>
        )}
        {ideal && <span className="fert-soil-ideal">Ideal: {ideal}</span>}
      </div>
    );
  };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="page-container">
      <button className="back-button" onClick={() => navigate('/history')}>
        <ArrowLeft size={20} /> {t('backToHistory')}
      </button>

      <div className="detail-container">
        {/* Header */}
        <div className="detail-header">
          <div className="status-badge soil">
            <FlaskConical size={18} />
            {t('fertilizerRecommendation')}
          </div>
          <h1>{crop ? `Report – ${crop}` : t('fertilizerRecEntry')}</h1>
          <p className="detail-subtitle">
            {farming_type
              ? `${farming_type.charAt(0).toUpperCase() + farming_type.slice(1)} ${t('farmingType')} · `
              : ''}
            {dateStr}
          </p>
        </div>

        <div className="detail-grid">
          {/* ── Soil Analysis ── */}
          {soil_analysis && (
            <div className="info-card full-width-card">
              <h3><Activity size={18} /> 🧪 {t('soilAnalysisHeading')}</h3>
              <div className="fert-soil-table">
                <div className="fert-soil-thead">
                  <span>Nutrient</span>
                  <span>Value</span>
                  <span>Status</span>
                  <span>Ideal Range</span>
                </div>
                {soilFields.map(renderSoilRow)}
              </div>
            </div>
          )}

          {/* ── Summary ── */}
          {summary && (
            <div className="info-card full-width-card">
              <h3><BarChart3 size={18} /> 📊 {t('summaryHeading')}</h3>
              <p style={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.75, margin: 0 }}>
                {summary}
              </p>
            </div>
          )}

          {/* ── Primary Recommendation ── */}
          {primary_recommendation && (
            <div className="info-card full-width-card">
              <h3><Leaf size={18} /> 🌱 {t('primaryRecommendationHeading')}</h3>
              <div className="fert-primary-inner">
                {primary_recommendation.name && (
                  <div className="fert-primary-name">{primary_recommendation.name}</div>
                )}
                {(primary_recommendation.npk || primary_recommendation.description) && (
                  <p className="fert-primary-meta">
                    {primary_recommendation.npk || primary_recommendation.description}
                  </p>
                )}
                <div className="fert-primary-details">
                  {primary_recommendation.dosage && (
                    <div className="fert-detail-chip fert-chip-dosage">
                      <span className="fert-chip-label">💊 {t('dosage')}</span>
                      <span className="fert-chip-val">{primary_recommendation.dosage}</span>
                    </div>
                  )}
                  {primary_recommendation.preparation && (
                    <div className="fert-detail-chip fert-chip-preparation">
                      <span className="fert-chip-label">🔧 Preparation Method</span>
                      <span className="fert-chip-val">{primary_recommendation.preparation}</span>
                    </div>
                  )}
                  {primary_recommendation.benefit && (
                    <div className="fert-detail-chip fert-chip-benefit">
                      <span className="fert-chip-label">✅ {t('benefit')}</span>
                      <span className="fert-chip-val">{primary_recommendation.benefit}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── pH Correction ── */}
          {ph_correction && (
            <div className="info-card full-width-card fert-ph-card">
              <h3>⚖️ {t('phCorrectionHeading')}</h3>
              <PhCorrection phc={ph_correction} t={t} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FertilizerDetail;
