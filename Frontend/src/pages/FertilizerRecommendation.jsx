import { useState, useRef } from 'react';
import {
  Droplet, Loader2, AlertCircle, FlaskConical, Leaf,
  BarChart3, Activity, Upload, CheckCircle2, X
} from 'lucide-react';
import { fertilizerService } from '../services/fertilizerService';
import { soilService } from '../services/soilService';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useVoiceFill, FERTILIZER_FIELDS } from '../utils/voiceFormFill';
import './FertilizerRecommendation.css';

/* ─── helpers ──────────────────────────────────────────────────────────── */
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

/* ─── component ────────────────────────────────────────────────────────── */
const FertilizerRecommendation = () => {
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();

  /* form state */
  const [formData, setFormData] = useState({
    farming_type: 'chemical',
    crop: '',
    nitrogen: '',
    phosphorous: '',
    potassium: '',
    ph: '',
  });

  // ── Step 11b: Voice form fill ──
  useVoiceFill(
    FERTILIZER_FIELDS,
    (field, value) => setFormData(prev => ({ ...prev, [field]: value })),
    speak
  );

  /* which fields were auto-filled by SHC (to highlight them) */
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());

  /* SHC upload state — user picks file first, then clicks "Extract Data" */
  const [extracting, setExtracting]         = useState(false);
  const [extractError, setExtractError]     = useState('');
  const [extractSuccess, setExtractSuccess] = useState('');
  const [uploadedFile, setUploadedFile]     = useState(null);
  const fileInputRef = useRef(null);

  /* recommendation state */
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null);

  /* ── Step 1: user picks a file (NO API call yet) ─────────────────────── */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setExtractError('');
    setExtractSuccess('');
  };

  /* ── Step 2: user clicks "Extract Data" → NOW call the API ──────────── */
  const handleExtract = async () => {
    if (!uploadedFile || extracting) return;
    setExtractError('');
    setExtractSuccess('');
    setExtracting(true);

    try {
      const data = await soilService.extractSoilData(uploadedFile);

      /*
       * Backend returns: { pH, Nitrogen, Phosphorus, Potassium }
       * Note: backend uses "Phosphorus" (no 'eo'), our field key is "phosphorous"
       */
      const filled  = new Set();
      const updates = {};

      if (data.Nitrogen   != null && data.Nitrogen   !== '') { updates.nitrogen    = String(data.Nitrogen);   filled.add('nitrogen'); }
      if (data.Phosphorus != null && data.Phosphorus !== '') { updates.phosphorous = String(data.Phosphorus);  filled.add('phosphorous'); }
      if (data.Potassium  != null && data.Potassium  !== '') { updates.potassium   = String(data.Potassium);   filled.add('potassium'); }
      if (data.pH         != null && data.pH         !== '') { updates.ph          = String(data.pH);          filled.add('ph'); }

      setFormData(prev => ({ ...prev, ...updates }));
      setAutoFilledFields(filled);
      setExtractSuccess(t('shcExtractSuccess'));
    } catch (err) {
      setExtractError(
        err?.response?.data?.detail ||
        err?.message ||
        t('ocrFailed')
      );
    } finally {
      setExtracting(false);
    }
  };

  /* ── Clear the SHC upload ────────────────────────────────────────────── */
  const clearUpload = () => {
    setUploadedFile(null);
    setExtractSuccess('');
    setExtractError('');
    setAutoFilledFields(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Form change — clear auto-fill highlight on manual edit ─────────── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (autoFilledFields.has(name)) {
      setAutoFilledFields(prev => { const n = new Set(prev); n.delete(name); return n; });
    }
  };

  /* ── Recommendation submit ───────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    const payload = { farming_type: formData.farming_type };
    if (formData.crop.trim())        payload.crop        = formData.crop.trim();
    if (formData.nitrogen !== '')    payload.nitrogen    = parseFloat(formData.nitrogen);
    if (formData.phosphorous !== '') payload.phosphorous = parseFloat(formData.phosphorous);
    if (formData.potassium !== '')   payload.potassium   = parseFloat(formData.potassium);
    if (formData.ph !== '')          payload.ph          = parseFloat(formData.ph);

    try {
      const data = await fertilizerService.getFertilizerRecommendation(payload);
      setResult(data);
      // ── Step 10c: Auto-speak primary recommendation ──
      const primary = data?.recommendations?.[0];
      if (primary?.fertilizer_name) {
        speak(`${t('fertilizerRecommendation')}: ${primary.fertilizer_name}.`);
      }
      setTimeout(() => {
        document.getElementById('fert-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to get recommendation. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Soil analysis row renderer ─────────────────────────────────────── */
  const renderSoilAnalysis = (analysis) => {
    if (!analysis) return null;
    const fields = [
      { key: 'nitrogen',    label: t('pdf_nitrogen'),    unit: 'kg/ha' },
      { key: 'phosphorous', label: t('pdf_phosphorous'), unit: 'kg/ha' },
      { key: 'potassium',   label: t('pdf_potassium'),   unit: 'kg/ha' },
      { key: 'ph',          label: t('pdf_pHLevel'),     unit: '' },
    ];

    return fields.map(({ key, label, unit }) => {
      const entry  = analysis[key];
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
            <span className={`fert-soil-status ${statusClass(status)}`} style={{ color: statusColor(status) }}>
              {status}
            </span>
          )}
          {ideal && <span className="fert-soil-ideal">Ideal: {ideal}</span>}
        </div>
      );
    });
  };

  const inputClass = (fieldName) => autoFilledFields.has(fieldName) ? 'fert-autofilled' : '';

  /* ── JSX ─────────────────────────────────────────────────────────────── */
  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <Droplet className="page-icon fert-icon" size={40} />
          <div>
            <h1>{t('fertilizerRecommendation')}</h1>
            <p className="page-subtitle">
              Get AI-powered fertilizer suggestions based on your farming type &amp; soil nutrients
            </p>
          </div>
        </div>
      </div>

      <div className="fert-layout">

        {/* ════════ FORM PANEL ════════ */}
        <div className="fert-form-panel">
          <div className="fert-form-card">
            <h2 className="fert-form-title">
              <FlaskConical size={20} /> Input Details
            </h2>

            {/* ── SHC Upload Section ── */}
            <div className="fert-shc-section">
              <div className="fert-shc-header">
                <Upload size={18} />
                <span>{t('shcUploadTitle')}</span>
                <span className="optional-tag">({t('optional')})</span>
              </div>

              <p className="fert-shc-desc">{t('shcUploadDesc')}</p>

              {/* File picker row */}
              {!uploadedFile ? (
                <label
                  htmlFor="shc-file-input"
                  className={`fert-shc-drop ${extracting ? 'fert-shc-drop--loading' : ''}`}
                >
                  <Upload size={24} className="fert-shc-icon" />
                  <span className="fert-shc-drop-text">{t('shcClickToChoose')}</span>
                  <span className="fert-shc-drop-hint">{t('shcFileTypes')}</span>
                  <input
                    id="shc-file-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={extracting}
                    style={{ display: 'none' }}
                  />
                </label>
              ) : (
                <div className="fert-shc-uploaded">
                  <span className="fert-shc-file-icon">📄</span>
                  <span className="fert-shc-file-name">{uploadedFile.name}</span>
                  <button
                    type="button"
                    className="fert-shc-clear-btn"
                    onClick={clearUpload}
                    aria-label={t('shcRemoveFile')}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Extract Data button — only visible when a file is selected */}
              {uploadedFile && !extractSuccess && (
                <button
                  id="btn1"
                  type="button"
                  className="fert-extract-btn"
                  onClick={handleExtract}
                  disabled={extracting}
                >
                  {extracting ? (
                    <><Loader2 size={16} className="spin-icon" /> {t('shcExtracting')}</>
                  ) : (
                    <><Upload size={16} /> {t('shcExtractBtn')}</>
                  )}
                </button>
              )}

              {/* Success banner */}
              {extractSuccess && (
                <div className="fert-shc-success">
                  <CheckCircle2 size={16} />
                  <span>{extractSuccess}</span>
                </div>
              )}

              {/* Extract error */}
              {extractError && (
                <div className="error-alert fert-error" style={{ marginTop: '0.75rem' }}>
                  <AlertCircle size={16} />
                  <span>{extractError}</span>
                </div>
              )}
            </div>

            {/* ── OR Divider ── */}
            <div className="fert-or-divider">
              <span>OR ENTER MANUALLY</span>
            </div>

            {/* ── Main Form ── */}
            <form onSubmit={handleSubmit} className="fert-form">
              {/* Farming Type */}
              <div className="form-group">
                <label htmlFor="fert-farming-type">
                  {t('farmingType')} <span className="required-star">*</span>
                </label>
                <select
                  id="fert-farming-type"
                  name="farming_type"
                  value={formData.farming_type}
                  onChange={handleChange}
                  required
                >
                  <option value="chemical">Chemical</option>
                  <option value="organic">Organic</option>
                  <option value="traditional">Traditional</option>
                </select>
              </div>

              {/* Crop (optional) */}
              <div className="form-group">
                <label htmlFor="fert-crop">
                  {t('pdf_crop')} <span className="optional-tag">({t('optional')})</span>
                </label>
                <input
                  id="fert-crop"
                  type="text"
                  name="crop"
                  value={formData.crop}
                  onChange={handleChange}
                  placeholder="e.g., Rice, Wheat, Maize"
                />
              </div>

              {/* N, P, K, pH grid */}
              <div className="fert-nutrient-grid">
                <div className="form-group">
                  <label htmlFor="fert-nitrogen">
                    {t('pdf_nitrogen')}
                    {autoFilledFields.has('nitrogen') && <span className="fert-autofill-badge">✦ SHC</span>}
                  </label>
                  <input
                    id="fert-nitrogen"
                    type="number"
                    name="nitrogen"
                    value={formData.nitrogen}
                    onChange={handleChange}
                    placeholder="e.g., 28"
                    step="0.01"
                    min="0"
                    className={inputClass('nitrogen')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fert-phosphorous">
                    {t('pdf_phosphorous')}
                    {autoFilledFields.has('phosphorous') && <span className="fert-autofill-badge">✦ SHC</span>}
                  </label>
                  <input
                    id="fert-phosphorous"
                    type="number"
                    name="phosphorous"
                    value={formData.phosphorous}
                    onChange={handleChange}
                    placeholder="e.g., 42"
                    step="0.01"
                    min="0"
                    className={inputClass('phosphorous')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fert-potassium">
                    {t('pdf_potassium')}
                    {autoFilledFields.has('potassium') && <span className="fert-autofill-badge">✦ SHC</span>}
                  </label>
                  <input
                    id="fert-potassium"
                    type="number"
                    name="potassium"
                    value={formData.potassium}
                    onChange={handleChange}
                    placeholder="e.g., 35"
                    step="0.01"
                    min="0"
                    className={inputClass('potassium')}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fert-ph">
                    {t('pdf_pHLevel')}
                    {autoFilledFields.has('ph') && <span className="fert-autofill-badge">✦ SHC</span>}
                  </label>
                  <input
                    id="fert-ph"
                    type="number"
                    name="ph"
                    value={formData.ph}
                    onChange={handleChange}
                    placeholder="e.g., 6.5"
                    step="0.01"
                    min="0"
                    max="14"
                    className={inputClass('ph')}
                  />
                  <span className="field-hint">Range: 0–14</span>
                </div>
              </div>

              {/* Recommendation error */}
              {error && (
                <div className="error-alert fert-error">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary fert-submit-btn"
                id="fert-submit-btn"
                disabled={loading || extracting}
              >
                {loading ? (
                  <><Loader2 size={18} className="spin-icon" /> {t('fetchingRec')}</>
                ) : (
                  <><Droplet size={18} /> {t('getRecommendation')}</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ════════ RESULT PANEL ════════ */}
        {result && (
          <div className="fert-result-panel" id="fert-result">

            {/* Soil Analysis */}
            {result.soil_analysis && (
              <div className="fert-card fert-soil-card">
                <h3 className="fert-card-title">
                  <Activity size={18} /> 🧪 {t('soilAnalysisHeading')}
                </h3>
                <div className="fert-soil-table">
                  <div className="fert-soil-thead">
                    <span>Nutrient</span><span>Value</span><span>Status</span><span>Ideal Range</span>
                  </div>
                  {renderSoilAnalysis(result.soil_analysis)}
                </div>
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div className="fert-card fert-summary-card">
                <h3 className="fert-card-title">
                  <BarChart3 size={18} /> 📊 {t('summaryHeading')}
                </h3>
                <p className="fert-summary-text">{result.summary}</p>
              </div>
            )}

            {/* Primary Recommendation */}
            {result.primary_recommendation && (
              <div className="fert-card fert-primary-card">
                <h3 className="fert-card-title">
                  <Leaf size={18} /> 🌱 {t('primaryRecommendationHeading')}
                </h3>
                <div className="fert-primary-inner">
                  {result.primary_recommendation.name && (
                    <div className="fert-primary-name">{result.primary_recommendation.name}</div>
                  )}
                  {(result.primary_recommendation.npk || result.primary_recommendation.description) && (
                    <p className="fert-primary-meta">
                      {result.primary_recommendation.npk || result.primary_recommendation.description}
                    </p>
                  )}
                  <div className="fert-primary-details">
                    {result.primary_recommendation.dosage && (
                      <div className="fert-detail-chip fert-chip-dosage">
                        <span className="fert-chip-label">💊 {t('dosage')}</span>
                        <span className="fert-chip-val">{result.primary_recommendation.dosage}</span>
                      </div>
                    )}
                    {result.primary_recommendation.preparation && (
                      <div className="fert-detail-chip fert-chip-preparation">
                        <span className="fert-chip-label">🔧 Preparation Method</span>
                        <span className="fert-chip-val">{result.primary_recommendation.preparation}</span>
                      </div>
                    )}
                    {result.primary_recommendation.benefit && (
                      <div className="fert-detail-chip fert-chip-benefit">
                        <span className="fert-chip-label">✅ {t('benefit')}</span>
                        <span className="fert-chip-val">{result.primary_recommendation.benefit}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* pH Correction */}
            {result.ph_correction && (
              <div className="fert-card fert-ph-card">
                <h3 className="fert-card-title">⚖️ {t('phCorrectionHeading')}</h3>
                {typeof result.ph_correction === 'string' ? (
                  <p className="fert-ph-text">{result.ph_correction}</p>
                ) : (
                  <div className="fert-ph-content">
                    {result.ph_correction.action   && <p><strong>{t('action')}:</strong>   {result.ph_correction.action}</p>}
                    {result.ph_correction.material && <p><strong>{t('material')}:</strong> {result.ph_correction.material}</p>}
                    {result.ph_correction.dosage   && <p><strong>{t('dosage')}:</strong>   {result.ph_correction.dosage}</p>}
                    {result.ph_correction.note     && <p className="fert-ph-note">{result.ph_correction.note}</p>}
                    {Object.entries(result.ph_correction)
                      .filter(([k]) => !['action', 'material', 'dosage', 'note'].includes(k))
                      .map(([k, v]) => <p key={k}><strong>{k}:</strong> {String(v)}</p>)
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FertilizerRecommendation;
