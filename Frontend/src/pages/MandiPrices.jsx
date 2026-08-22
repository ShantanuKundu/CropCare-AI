import { useState, useEffect } from 'react';
import { TrendingUp, Loader2, AlertCircle, Search } from 'lucide-react';
import { toolsService } from '../services/toolsService';
import { useLanguage } from '../context/LanguageContext';
import './Tools.css';

const INDIAN_STATES = [
  'Andhra Pradesh','Assam','Bihar','Chhattisgarh','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha',
  'Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
];

const MandiPrices = () => {
  const { t } = useLanguage();
  const [form, setForm] = useState({ crop: '', state: '', district: '' });
  const [supportedCrops, setSupportedCrops] = useState([]);
  const [cropsLoading, setCropsLoading]     = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    toolsService.getMandiSupportedCrops()
      .then(d => setSupportedCrops(d?.crops || []))
      .catch(() => {})
      .finally(() => setCropsLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.crop.trim()) { setError(t('mandiErrCrop')); return; }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await toolsService.getMandiPrices({
        crop:     form.crop.trim(),
        state:    form.state    || undefined,
        district: form.district.trim() || undefined,
      });
      console.log('[MandiPrices] response:', data);
      setResult(data);
    } catch (err) {
      console.error('[MandiPrices] error:', err);
      setError(err?.response?.data?.detail || t('mandiErrFetch'));
    } finally {
      setLoading(false);
    }
  };

  const records     = result?.records     ?? [];
  const summary     = result?.summary;
  const dataSource  = result?.data_source || '';
  const note        = result?.note        || '';
  const asOf        = result?.as_of       || '';
  const isNotAvail  = dataSource === 'not_available';

  return (
    <div className="tools-page">
      <div className="tools-page-header">
        <div className="tools-page-badge"><TrendingUp size={14} /> {t('mandiPrices')}</div>
        <h1 className="tools-page-title">📊 {t('mandiTitle')}</h1>
        <p className="tools-page-subtitle">{t('mandiSubtitle')}</p>
      </div>

      <div className="tools-layout">
        {/* ── Form ── */}
        <div className="tools-form-panel">
          <div className="tools-form-card">
            <h3 className="tools-form-title"><Search size={17} /> {t('mandiSearchTitle')}</h3>
            <form className="tools-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>🌾 {t('mandiCropLabel')} <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={form.crop}
                  onChange={e => set('crop', e.target.value)}
                  required
                  disabled={cropsLoading}
                >
                  <option value="">{cropsLoading ? t('mandiLoadingCrops') : t('mandiSelectCrop')}</option>
                  {supportedCrops.map(c => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>📍 {t('mandiStateLabel')}</label>
                <select value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">{t('mandiAllStates')}</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>🏙️ {t('mandiDistrictLabel')}</label>
                <input
                  type="text"
                  placeholder={t('mandiDistrictPlaceholder')}
                  value={form.district}
                  onChange={e => set('district', e.target.value)}
                />
              </div>
              {error && (
                <div className="tools-error"><AlertCircle size={16} /> {error}</div>
              )}
              <button type="submit" className="tools-submit-btn" disabled={loading}>
                {loading
                  ? <><Loader2 size={18} className="tools-spin" /> {t('mandiFetching')}</>
                  : `📊 ${t('mandiSubmit')}`}
              </button>
            </form>
          </div>
        </div>

        {/* ── Result ── */}
        <div className="tools-result-panel">
          {!result ? (
            <div className="tools-empty-state">
              <span className="tools-empty-icon">📊</span>
              <h3>{t('mandiSearchHint')}</h3>
              <p>{t('mandiSearchHintDesc')}</p>
            </div>
          ) : isNotAvail ? (
            <div className="tools-error" style={{ borderRadius: '14px', padding: '1.25rem' }}>
              <AlertCircle size={18} />
              <span>{result.message || t('mandiErrFetch')}</span>
            </div>
          ) : (
            <>
              {/* Meta: source + note */}
              <div className="tools-card" style={{ padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                    📡 Source:{' '}
                    <strong style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {dataSource === 'live' ? 'Live (Agmarknet)' : dataSource === 'fallback_msp' ? 'MSP Reference (Fallback)' : dataSource}
                    </strong>
                  </span>
                  {asOf && (
                    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>As of: {asOf}</span>
                  )}
                </div>
                {note && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{note}</p>
                )}
              </div>

              {/* Summary stats */}
              {summary && (
                <div className="tools-card">
                  <h3 className="tools-card-title"><TrendingUp size={17} /> {t('mandiPriceSummary')}</h3>
                  <div className="tools-stat-grid">
                    {summary.avg_modal_price != null && (
                      <div className="tools-stat-item">
                        <span className="tools-stat-label">{t('mandiAvgModal')}</span>
                        <span className="tools-stat-value">₹{Number(summary.avg_modal_price).toLocaleString('en-IN')}</span>
                        <span className="tools-stat-unit">/ quintal</span>
                      </div>
                    )}
                    {summary.min_across_mandis != null && (
                      <div className="tools-stat-item">
                        <span className="tools-stat-label">{t('mandiLowest')}</span>
                        <span className="tools-stat-value" style={{ color: '#f59e0b' }}>
                          ₹{Number(summary.min_across_mandis).toLocaleString('en-IN')}
                        </span>
                        <span className="tools-stat-unit">/ quintal</span>
                      </div>
                    )}
                    {summary.max_across_mandis != null && (
                      <div className="tools-stat-item">
                        <span className="tools-stat-label">{t('mandiHighest')}</span>
                        <span className="tools-stat-value" style={{ color: '#34d399' }}>
                          ₹{Number(summary.max_across_mandis).toLocaleString('en-IN')}
                        </span>
                        <span className="tools-stat-unit">/ quintal</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prices table */}
              {records.length === 0 ? (
                <div className="tools-empty-state">
                  <span className="tools-empty-icon">🔍</span>
                  <h3>{t('mandiNoRecords')}</h3>
                  <p>{t('mandiNoRecordsHint')}</p>
                </div>
              ) : (
                <div className="tools-card">
                  <h3 className="tools-card-title">
                    <TrendingUp size={17} />
                    {t('mandiPrices')} — {form.crop.charAt(0).toUpperCase() + form.crop.slice(1)}
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                      ({records.length} mandi{records.length > 1 ? 's' : ''})
                    </span>
                  </h3>
                  <div className="tools-table-wrapper">
                    <table className="tools-table">
                      <thead>
                        <tr>
                          <th>{t('mandiMarket')}</th>
                          <th>{t('mandiState')}</th>
                          <th>{t('mandiDistrict')}</th>
                          <th>{t('mandiMin')}</th>
                          <th>{t('mandiMax')}</th>
                          <th>{t('mandiModal')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => (
                          <tr key={i}>
                            <td>{r.mandi || r.market || '—'}</td>
                            <td>{r.state || '—'}</td>
                            <td>{r.district || '—'}</td>
                            <td className="price-col">
                              {r.min_price != null ? `₹${Number(r.min_price).toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="price-col">
                              {r.max_price != null ? `₹${Number(r.max_price).toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="price-col" style={{ color: '#10b981', fontWeight: 800 }}>
                              {r.modal_price != null ? `₹${Number(r.modal_price).toLocaleString('en-IN')}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MandiPrices;
