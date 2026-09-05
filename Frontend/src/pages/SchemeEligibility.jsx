import { useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { toolsService } from '../services/toolsService';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useVoiceFill, SCHEME_FIELDS } from '../utils/voiceFormFill';
import './Tools.css';

const INDIAN_STATES = [
  'Andhra Pradesh','Assam','Bihar','Chhattisgarh','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha',
  'Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
];

const IRRIGATION_TYPES = ['drip', 'sprinkler', 'furrow', 'flood', 'rainfed', 'canal', 'borewell'];
const FARMING_TYPES    = ['organic', 'conventional', 'mixed'];

const Toggle = ({ id, checked, onChange, label }) => (
  <div className="tools-toggle-row">
    <span className="tools-toggle-label">{label}</span>
    <label className="tools-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="tools-toggle-slider" />
    </label>
  </div>
);

const SchemeEligibility = () => {
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();
  const [form, setForm] = useState({
    crop: '',
    land_area_hectares: '',
    state: '',
    irrigation_type: '',
    family_income_lakh: '',
    farming_type: '',
    is_tenant: false,
    has_land_records: true,
    is_government_employee: false,
    is_institutional_farmer: false,
    has_existing_npa: false,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');

  // ── Step 11e: Voice form fill ──
  useVoiceFill(
    SCHEME_FIELDS,
    (field, value) => setForm(f => ({ ...f, [field]: value })),
    speak
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const payload = { ...form };
      // Convert numeric strings
      if (payload.land_area_hectares) payload.land_area_hectares = parseFloat(payload.land_area_hectares);
      else delete payload.land_area_hectares;
      if (payload.family_income_lakh) payload.family_income_lakh = parseFloat(payload.family_income_lakh);
      else delete payload.family_income_lakh;
      // Remove empty strings
      if (!payload.crop)            delete payload.crop;
      if (!payload.state)           delete payload.state;
      if (!payload.irrigation_type) delete payload.irrigation_type;
      if (!payload.farming_type)    delete payload.farming_type;

      console.log('[SchemeEligibility] payload →', payload);
      const data = await toolsService.checkSchemeEligibility(payload);
      console.log('[SchemeEligibility] response ←', data);
      setResult(data);
      // ── Step 10f: Auto-speak eligible scheme count ──
      const count = data?.eligible_count ?? 0;
      const total = data?.total_schemes_checked ?? 0;
      speak(`${t('schemeEligibleLabel')}: ${count} out of ${total}.`);
    } catch (err) {
      console.error('[SchemeEligibility] error:', err);
      setError(err?.response?.data?.detail || 'Failed to check eligibility. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Backend response shape (scheme_engine.py):
  //  { eligible_schemes: [...], not_eligible_schemes: [...],
  //    eligible_count, total_schemes_checked, state_note, disclaimer, profile_used }
  // Each scheme: { name, category, eligible, reason, benefit, how_to_apply, portal, failed_criteria }
  const eligibleSchemes    = result?.eligible_schemes     ?? [];
  const notEligibleSchemes = result?.not_eligible_schemes ?? [];
  const stateNote          = result?.state_note           || '';
  const disclaimer         = result?.disclaimer           || '';
  const eligibleCount      = result?.eligible_count       ?? 0;
  const totalChecked       = result?.total_schemes_checked ?? 0;

  return (
    <div className="tools-page">
      <div className="tools-page-header">
        <div className="tools-page-badge"><ShieldCheck size={14} /> {t('schemeEligibility')}</div>
        <h1 className="tools-page-title">🏛️ {t('schemeTitle')}</h1>
        <p className="tools-page-subtitle">
          {t('schemeSubtitle')}
        </p>
      </div>

      <div className="tools-layout">
        {/* ── Form ── */}
        <div className="tools-form-panel">
          <div className="tools-form-card">
            <h3 className="tools-form-title"><ShieldCheck size={18} /> Your Details</h3>
            <form className="tools-form" onSubmit={handleSubmit}>

              <div className="tools-form-row">
                <div className="form-group">
                  <label>🌾 Crop</label>
                  <input type="text" placeholder="e.g. rice, wheat"
                    value={form.crop} onChange={e => set('crop', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>📐 Land Area (ha)</label>
                  <input type="number" min="0" step="0.01" placeholder="e.g. 2.5"
                    value={form.land_area_hectares}
                    onChange={e => set('land_area_hectares', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>📍 State</label>
                <select value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="tools-form-row">
                <div className="form-group">
                  <label>💧 Irrigation Type</label>
                  <select value={form.irrigation_type} onChange={e => set('irrigation_type', e.target.value)}>
                    <option value="">Select…</option>
                    {IRRIGATION_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>🌿 Farming Type</label>
                  <select value={form.farming_type} onChange={e => set('farming_type', e.target.value)}>
                    <option value="">Select…</option>
                    {FARMING_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>💰 Family Income (₹ lakh / year)</label>
                <input type="number" min="0" step="0.1" placeholder="e.g. 3.5"
                  value={form.family_income_lakh}
                  onChange={e => set('family_income_lakh', e.target.value)} />
              </div>

              <div className="tools-divider" />

              <Toggle id="is_tenant"    checked={form.is_tenant}    onChange={v => set('is_tenant', v)}    label="🏠 Tenant Farmer" />
              <Toggle id="has_land_rec" checked={form.has_land_records} onChange={v => set('has_land_records', v)} label="📄 Has Land Records" />
              <Toggle id="is_govt_emp"  checked={form.is_government_employee}  onChange={v => set('is_government_employee', v)}  label="🏛️ Government Employee" />
              <Toggle id="is_inst"      checked={form.is_institutional_farmer} onChange={v => set('is_institutional_farmer', v)} label="🏢 Institutional Farmer" />
              <Toggle id="has_npa"      checked={form.has_existing_npa}  onChange={v => set('has_existing_npa', v)}  label="⚠️ Has Existing NPA" />

              {error && (
                <div className="tools-error"><AlertCircle size={16} /> {error}</div>
              )}

              <button type="submit" className="tools-submit-btn" disabled={loading}>
                {loading
                  ? <><Loader2 size={18} className="tools-spin" /> {t('schemeFetching')}</>
                  : `🏛️ ${t('schemeSubmit')}`}
              </button>
            </form>
          </div>
        </div>

        {/* ── Result ── */}
        <div className="tools-result-panel">
          {!result ? (
            <div className="tools-empty-state">
              <span className="tools-empty-icon">🏛️</span>
              <h3>{t('schemeTitle')}</h3>
              <p>{t('schemeSubtitle')}</p>
            </div>
          ) : (
            <>
              {/* Score summary */}
              <div className="tools-card">
                <h3 className="tools-card-title">📋 Eligibility Summary</h3>
                <div className="tools-stat-grid">
                  <div className="tools-stat-item">
                    <span className="tools-stat-label">Eligible</span>
                    <span className="tools-stat-value" style={{ color: '#10b981' }}>{eligibleCount}</span>
                    <span className="tools-stat-unit">schemes</span>
                  </div>
                  <div className="tools-stat-item">
                    <span className="tools-stat-label">Not Eligible</span>
                    <span className="tools-stat-value" style={{ color: '#f87171' }}>{totalChecked - eligibleCount}</span>
                    <span className="tools-stat-unit">schemes</span>
                  </div>
                  <div className="tools-stat-item">
                    <span className="tools-stat-label">Total Checked</span>
                    <span className="tools-stat-value">{totalChecked}</span>
                    <span className="tools-stat-unit">schemes</span>
                  </div>
                </div>
                {stateNote && (
                  <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                    📍 {stateNote}
                  </p>
                )}
              </div>

              {/* Eligible Schemes */}
              {eligibleSchemes.length > 0 && (
                <div className="tools-card">
                  <h3 className="tools-card-title" style={{ color: '#10b981' }}>
                    <CheckCircle size={17} /> Eligible Schemes ({eligibleSchemes.length})
                  </h3>
                  <div className="tools-scheme-list">
                    {eligibleSchemes.map((s, i) => (
                      <div key={i} className="tools-scheme-item">
                        <p className="tools-scheme-name">✅ {s.name}</p>
                        <p className="tools-scheme-reason">{s.reason}</p>
                        {s.benefit && (
                          <p style={{ fontSize: '0.82rem', color: '#10b981', margin: '0.4rem 0 0', lineHeight: 1.5 }}>
                            💰 {s.benefit}
                          </p>
                        )}
                        {s.how_to_apply && (
                          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', margin: '0.35rem 0 0', lineHeight: 1.5 }}>
                            📝 {s.how_to_apply}
                          </p>
                        )}
                        {s.portal && (
                          <a
                            href={s.portal}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              marginTop: '0.5rem', fontSize: '0.8rem',
                              color: '#60a5fa', textDecoration: 'none',
                            }}
                          >
                            <ExternalLink size={13} /> Apply Online
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not Eligible Schemes */}
              {notEligibleSchemes.length > 0 && (
                <div className="tools-card">
                  <h3 className="tools-card-title" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <XCircle size={17} /> Not Eligible ({notEligibleSchemes.length})
                  </h3>
                  <div className="tools-scheme-list">
                    {notEligibleSchemes.map((s, i) => (
                      <div key={i} className="tools-scheme-item tools-scheme-ineligible">
                        <p className="tools-scheme-name">❌ {s.name}</p>
                        <p className="tools-scheme-reason">{s.reason}</p>
                        {s.failed_criteria?.length > 0 && (
                          <ul style={{ margin: '0.4rem 0 0', padding: '0 0 0 1rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                            {s.failed_criteria.map((fc, j) => <li key={j}>{fc}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              {disclaimer && (
                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>
                  ⚖️ {disclaimer}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchemeEligibility;
