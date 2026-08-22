import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Loader2, AlertCircle, Search } from 'lucide-react';
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

// Maps backend status keys → CSS class + human label + icon
const STATUS_MAP = {
  open_now:      { cls: 'cal-open-now',      icon: '🟢', label: 'SOW NOW' },
  closing_soon:  { cls: 'cal-closing-soon',  icon: '🟡', label: 'WINDOW CLOSING' },
  upcoming:      { cls: 'cal-upcoming',       icon: '🔵', label: 'Coming Up' },
  just_closed:   { cls: 'cal-just-closed',   icon: '🔴', label: 'Window Closed' },
  off_season:    { cls: 'cal-off-season',    icon: '⚪', label: 'Off-season' },
};

function getStatus(statusKey = '') {
  return STATUS_MAP[statusKey] || STATUS_MAP.off_season;
}

const CropCalendar = () => {
  const { t } = useLanguage();
  const [form, setForm]       = useState({ state: '', zone: '', season_filter: '' });
  const [zones, setZones]     = useState([]);
  const [crops, setCrops]     = useState([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [searched, setSearched] = useState(false);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    toolsService.getCropCalendarZones()
      .then(d => setZones(d.zones || []))
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFetch = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const payload = {};
      if (form.state)         payload.state = form.state;
      if (form.zone)          payload.zone = form.zone;
      if (form.season_filter) payload.season_filter = form.season_filter;

      const data = await toolsService.getCropCalendar(payload);
      console.log('[CropCalendar] response:', data);
      setCrops(Array.isArray(data.crops) ? data.crops : []);
      setSummary(data.summary || '');
    } catch (err) {
      console.error('[CropCalendar] error:', err);
      setError(err?.response?.data?.detail || 'Failed to load crop calendar.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Auto-load on mount with default zone
  useEffect(() => { handleFetch(); }, []); // eslint-disable-line

  const filtered = crops.filter(c =>
    !search || c.crop?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="tools-page">
      <div className="tools-page-header">
        <div className="tools-page-badge"><CalendarDays size={14} /> {t('cropCalendar')}</div>
        <h1 className="tools-page-title">📅 {t('calendarTitle')}</h1>
        <p className="tools-page-subtitle">
          {t('calendarSubtitle')}
        </p>
      </div>

      {/* Filter bar */}
      <form className="tools-filter-bar" onSubmit={handleFetch}>
        <div className="form-group">
          <label>📍 State</label>
          <select value={form.state} onChange={e => set('state', e.target.value)}>
            <option value="">All India</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>🗺️ Zone</label>
          <select value={form.zone} onChange={e => set('zone', e.target.value)}>
            <option value="">Any Zone</option>
            {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>🌿 Season</label>
          <select value={form.season_filter} onChange={e => set('season_filter', e.target.value)}>
            <option value="">All Seasons</option>
            <option value="Kharif">Kharif</option>
            <option value="Rabi">Rabi</option>
            <option value="Zaid">Zaid</option>
          </select>
        </div>
        <button type="submit" className="tools-filter-btn" disabled={loading}>
          {loading ? <Loader2 size={16} className="tools-spin" /> : <Search size={16} />}
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </form>

      {/* Summary banner */}
      {summary && !loading && (
        <div style={{
          padding: '0.85rem 1.25rem',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '12px',
          marginBottom: '1.25rem',
          fontSize: '0.9rem',
          color: 'rgba(255,255,255,0.8)',
          lineHeight: 1.6,
        }}>
          {summary}
        </div>
      )}

      {/* Legend */}
      {!loading && crops.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {Object.values(STATUS_MAP).map(s => (
            <span key={s.cls} className={`tools-status-badge cal-badge-${s.cls}`}>
              {s.icon} {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      {crops.length > 0 && (
        <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search crop…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.7rem 1rem 0.7rem 2.4rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: 'white',
              fontFamily: 'inherit', fontSize: '0.9rem',
            }}
          />
        </div>
      )}

      {error && <div className="tools-error"><AlertCircle size={16} /> {error}</div>}

      {loading ? (
        <div className="tools-loading">
          {[1,2,3,4,5,6].map(i => <div key={i} className="tools-skeleton" />)}
        </div>
      ) : searched && filtered.length === 0 ? (
        <div className="tools-empty-state">
          <span className="tools-empty-icon">📅</span>
          <h3>No crops found</h3>
          <p>{t('calendarNoData')}</p>
        </div>
      ) : (
        <div className="tools-cal-grid">
          {filtered.map((crop, i) => {
            const statusMeta = getStatus(crop.status);
            return (
              <div key={`${crop.crop}-${i}`} className={`tools-cal-item cal-item-${crop.status || 'off_season'}`}>
                <span className="tools-cal-crop-name">{crop.crop}</span>
                <div className="tools-cal-meta">
                  <span className="tools-cal-season">{crop.season}</span>
                  <span className={`tools-status-badge cal-status-${crop.status || 'off_season'}`}>
                    {statusMeta.icon} {statusMeta.label}
                  </span>
                </div>
                {crop.sow_window?.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.38)' }}>
                    Sow: {Array.isArray(crop.sow_window) ? crop.sow_window.join(', ') : crop.sow_window}
                  </span>
                )}
                {crop.advisory && (
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', margin: '0.35rem 0 0', lineHeight: 1.5 }}>
                    {crop.advisory}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CropCalendar;
