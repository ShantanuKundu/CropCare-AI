import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2, AlertCircle, Search, IndianRupee } from 'lucide-react';
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

// ── Sell / Hold badge colour map ─────────────────────────────────────
const BADGE_STYLES = {
  green: {
    bg:     'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.45)',
    text:   '#10b981',
    glow:   '0 4px 24px rgba(16,185,129,0.25)',
    bar:    '#10b981',
    icon:   '📈',
  },
  teal: {
    bg:     'rgba(20, 184, 166, 0.12)',
    border: 'rgba(20, 184, 166, 0.45)',
    text:   '#14b8a6',
    glow:   '0 4px 24px rgba(20,184,166,0.2)',
    bar:    '#14b8a6',
    icon:   '✅',
  },
  amber: {
    bg:     'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.4)',
    text:   '#f59e0b',
    glow:   '0 4px 24px rgba(245,158,11,0.2)',
    bar:    '#f59e0b',
    icon:   '⚠️',
  },
  red: {
    bg:     'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.4)',
    text:   '#ef4444',
    glow:   '0 4px 24px rgba(239,68,68,0.2)',
    bar:    '#ef4444',
    icon:   '🔻',
  },
};

// ── Sell / Hold Widget ────────────────────────────────────────────────
const SellHoldWidget = ({ sellHold, mspPrice }) => {
  if (!sellHold) return null;
  const s = BADGE_STYLES[sellHold.badge] || BADGE_STYLES.amber;

  // Gauge: clamp margin between -30% and +30% → 0..100%
  const gaugeMin = -30, gaugeMax = 30;
  const clamp    = Math.min(Math.max(sellHold.margin_pct, gaugeMin), gaugeMax);
  const gaugePct = ((clamp - gaugeMin) / (gaugeMax - gaugeMin)) * 100;

  const isPositive = sellHold.margin_pct >= 0;

  return (
    <div className="tools-card" style={{
      border:    `1px solid ${s.border}`,
      background: s.bg,
      boxShadow:  s.glow,
      padding: 0,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{ padding: '1rem 1.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <h3 className="tools-card-title" style={{ margin: 0 }}>
          {s.icon} Sell or Hold Signal
        </h3>
      </div>

      <div style={{ padding: '1.25rem 1.5rem' }}>
        {/* Main badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
          background: 'rgba(0,0,0,0.2)', border: `1px solid ${s.border}`,
          borderRadius: '50px', padding: '0.5rem 1.2rem', marginBottom: '1.1rem',
        }}>
          <span style={{ fontSize: '1.3rem' }}>{s.icon}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: s.text, letterSpacing: '0.04em' }}>
            {sellHold.label}
          </span>
        </div>

        {/* Price comparison row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.1rem',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
            padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
          }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg Market Price
            </span>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: s.text }}>
              ₹{Number(sellHold.modal_price).toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>per quintal</span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
            padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem',
          }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              MSP Benchmark
            </span>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
              ₹{Number(sellHold.msp_price).toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>per quintal</span>
          </div>
        </div>

        {/* Margin gauge */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Margin vs MSP</span>
            <span style={{
              fontSize: '0.9rem', fontWeight: 800,
              color: isPositive ? '#10b981' : '#f87171',
            }}>
              {isPositive ? '+' : ''}{sellHold.margin_pct}%
            </span>
          </div>
          {/* Track */}
          <div style={{
            width: '100%', height: '8px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '999px', overflow: 'hidden', position: 'relative',
          }}>
            {/* MSP midpoint marker */}
            <div style={{
              position: 'absolute', left: '50%', top: 0,
              width: '2px', height: '100%',
              background: 'rgba(255,255,255,0.3)', transform: 'translateX(-50%)',
            }} />
            {/* Fill */}
            <div style={{
              position: 'absolute',
              left: isPositive ? '50%' : `${gaugePct}%`,
              width: isPositive ? `${gaugePct - 50}%` : `${50 - gaugePct}%`,
              height: '100%',
              background: s.bar,
              borderRadius: '999px',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.25rem',
          }}>
            <span>-30%</span>
            <span>MSP</span>
            <span>+30%</span>
          </div>
        </div>

        {/* Advice text */}
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${s.border}`,
          borderRadius: '10px',
          fontSize: '0.875rem',
          color: 'rgba(255,255,255,0.78)',
          lineHeight: '1.55',
          borderLeft: `4px solid ${s.bar}`,
        }}>
          {sellHold.advice}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────
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

  const records    = result?.records     ?? [];
  const summary    = result?.summary;
  const dataSource = result?.data_source || '';
  const note       = result?.note        || '';
  const asOf       = result?.as_of       || '';
  const sellHold   = result?.sell_hold   ?? null;
  const mspPrice   = result?.msp_price   ?? null;
  const isNotAvail = dataSource === 'not_available';
  const isLive     = dataSource === 'live';

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
                  id="mandi-crop-select"
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
                <select value={form.state} onChange={e => set('state', e.target.value)} id="mandi-state-select">
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
                  id="mandi-district-input"
                />
              </div>
              {error && (
                <div className="tools-error"><AlertCircle size={16} /> {error}</div>
              )}
              <button type="submit" className="tools-submit-btn" disabled={loading} id="mandi-search-btn">
                {loading
                  ? <><Loader2 size={18} className="tools-spin" /> {t('mandiFetching')}</>
                  : `📊 ${t('mandiSubmit')}`}
              </button>
            </form>
          </div>

          {/* MSP Reference note — always visible when result present */}
          {mspPrice !== null && (
            <div style={{
              marginTop: '1rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px',
              padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <IndianRupee size={18} color="#10b981" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.15rem' }}>
                  MSP / Reference Price
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                  ₹{Number(mspPrice).toLocaleString('en-IN')} <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/quintal</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Result Panel ── */}
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
              {/* ── Sell / Hold Widget ── */}
              <SellHoldWidget sellHold={sellHold} mspPrice={mspPrice} />

              {/* Meta: source + note */}
              <div className="tools-card" style={{ padding: '0.9rem 1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                    📡 Source:{' '}
                    <strong style={{ color: isLive ? '#10b981' : 'rgba(255,255,255,0.7)' }}>
                      {isLive ? '🟢 Live (Agmarknet)' : '🟡 MSP Reference (Fallback)'}
                    </strong>
                  </span>
                  {asOf && (
                    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>As of: {asOf}</span>
                  )}
                </div>
                {note && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>{note}</p>
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
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
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
                          <th>Variety</th>
                          <th>{t('mandiMin')}</th>
                          <th>{t('mandiMax')}</th>
                          <th>{t('mandiModal')}</th>
                          <th>vs MSP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => {
                          const modal      = r.modal_price;
                          const vsSign     = mspPrice && modal != null
                            ? ((modal - mspPrice) / mspPrice * 100).toFixed(1)
                            : null;
                          const vsColor    = vsSign !== null
                            ? (Number(vsSign) >= 0 ? '#10b981' : '#f87171')
                            : 'rgba(255,255,255,0.4)';
                          return (
                            <tr key={i}>
                              <td>{r.mandi || r.market || '—'}</td>
                              <td>{r.state || '—'}</td>
                              <td>{r.district || '—'}</td>
                              <td style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.83rem' }}>
                                {r.variety || '—'}
                              </td>
                              <td className="price-col">
                                {r.min_price != null ? `₹${Number(r.min_price).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="price-col">
                                {r.max_price != null ? `₹${Number(r.max_price).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="price-col" style={{ color: '#10b981', fontWeight: 800 }}>
                                {modal != null ? `₹${Number(modal).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td style={{ fontWeight: 700, color: vsColor, fontSize: '0.85rem' }}>
                                {vsSign !== null ? `${Number(vsSign) >= 0 ? '+' : ''}${vsSign}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.28)', margin: 0, textAlign: 'right' }}>
                ℹ️ Prices in ₹/quintal. MSP reference is the government-notified Minimum Support Price or modal benchmark for 2024-25.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MandiPrices;
