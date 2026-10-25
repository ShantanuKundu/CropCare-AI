import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, Loader2, AlertCircle, Search, Sprout, Clock, ChevronRight } from 'lucide-react';
import { toolsService } from '../services/toolsService';
import { useLanguage } from '../context/LanguageContext';
import './Tools.css';
import './CropCalendar.css';

const INDIAN_STATES = [
  'Andhra Pradesh','Assam','Bihar','Chhattisgarh','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha',
  'Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
];

const SEASONS = ['All', 'Kharif', 'Rabi', 'Zaid'];

const STATUS_META = {
  open_now:     { label: 'SOW NOW',        icon: '🟢', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' },
  closing_soon: { label: 'WINDOW CLOSING', icon: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)' },
  upcoming:     { label: 'Coming Up',      icon: '🔵', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  just_closed:  { label: 'Window Closed',  icon: '🔴', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.25)' },
  off_season:   { label: 'Off-season',     icon: '⚪', color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
};

// ── Growth Stage Definitions ─────────────────────────────────────────
const STAGES = [
  {
    pct: [0, 25], label: 'Germination / Seedling', icon: '🌱', color: '#34d399',
    activities: [
      'Ensure uniform seed germination — check for gaps and replant if needed.',
      'Light irrigation every 2–3 days; avoid waterlogging.',
      'Apply pre-emergent herbicide within 3 days of sowing.',
      'Monitor for damping-off fungal disease in seedlings.',
    ],
  },
  {
    pct: [25, 55], label: 'Vegetative Growth', icon: '🌿', color: '#10b981',
    activities: [
      'First weeding: remove weeds before they compete for nutrients.',
      'Top-dress nitrogen (Urea) — split application at this stage.',
      'Apply systemic insecticide if early pest damage is observed.',
      'Irrigate based on soil moisture; avoid drought stress.',
    ],
  },
  {
    pct: [55, 80], label: 'Flowering / Grain Filling', icon: '🌾', color: '#f59e0b',
    activities: [
      '⚠️ CRITICAL STAGE — no water stress during flowering.',
      'Avoid spraying pesticides during active pollination hours.',
      'Apply potassium (MOP) fertiliser for grain/fruit filling.',
      'Scout for pod borers, fruit flies, or ear head pests.',
    ],
  },
  {
    pct: [80, 100], label: 'Maturity / Harvest Ready', icon: '🏆', color: '#a78bfa',
    activities: [
      'Stop irrigation 10–14 days before harvest (pre-harvest water cutoff).',
      'Check grain moisture content — harvest at 14–18% moisture.',
      'Prepare storage / market transport arrangements.',
      'Plan post-harvest residue management (straw, husk).',
    ],
  },
];

function getStageForDAS(das, totalDays) {
  const pct = (das / totalDays) * 100;
  return STAGES.find(s => pct >= s.pct[0] && pct < s.pct[1]) || STAGES[STAGES.length - 1];
}

// ── DAS Tracker Component ─────────────────────────────────────────────
const DASTracker = ({ cropName, totalDays }) => {
  const [sowDate, setSowDate] = useState('');
  const [das, setDas]         = useState(null);

  const handleDateChange = (e) => {
    const d = e.target.value;
    setSowDate(d);
    if (d) {
      const diff = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
      setDas(diff < 0 ? 0 : diff);
    } else {
      setDas(null);
    }
  };

  const effectiveTotalDays = totalDays || 120;
  const progressPct  = das !== null ? Math.min(100, (das / effectiveTotalDays) * 100) : 0;
  const currentStage = das !== null ? getStageForDAS(das, effectiveTotalDays) : null;
  const isComplete   = das !== null && das >= effectiveTotalDays;

  return (
    <div className="das-tracker">
      <div className="das-tracker-header">
        <span className="das-tracker-title"><Clock size={16} /> DAS Milestone Tracker</span>
        {cropName && <span className="das-crop-tag">{cropName}</span>}
      </div>

      {/* Date picker */}
      <div className="das-date-row">
        <label className="das-date-label">📅 Sowing Date</label>
        <input
          type="date"
          className="das-date-input"
          value={sowDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={handleDateChange}
          id="das-sowing-date"
        />
        {das !== null && (
          <span className="das-count-badge">{das} DAS</span>
        )}
      </div>

      {das !== null && (
        <>
          {/* Progress Bar */}
          <div className="das-progress-wrap">
            {/* Stage segments */}
            <div className="das-stage-bar">
              {STAGES.map((s, i) => (
                <div
                  key={i}
                  className="das-stage-segment"
                  style={{
                    width: `${s.pct[1] - s.pct[0]}%`,
                    background: progressPct > s.pct[0] ? s.color : 'rgba(255,255,255,0.07)',
                    opacity: currentStage === s ? 1 : 0.5,
                    transition: 'background 0.6s ease, opacity 0.3s ease',
                  }}
                  title={`${s.icon} ${s.label} (${s.pct[0]}%–${s.pct[1]}%)`}
                />
              ))}
              {/* Needle */}
              <div
                className="das-needle"
                style={{ left: `${progressPct}%` }}
              />
            </div>

            {/* Stage Labels below bar */}
            <div className="das-stage-labels">
              {STAGES.map((s, i) => (
                <div
                  key={i}
                  className={`das-stage-label ${currentStage === s ? 'das-stage-active' : ''}`}
                  style={{ width: `${s.pct[1] - s.pct[0]}%`, color: currentStage === s ? s.color : 'rgba(255,255,255,0.3)' }}
                >
                  <span>{s.icon}</span>
                  <span className="das-stage-text">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Progress numbers */}
            <div className="das-progress-meta">
              <span>Day 0</span>
              <span style={{ color: currentStage?.color || 'white', fontWeight: 700 }}>
                {isComplete ? '✅ Harvest Ready!' : `Day ${das} / ${effectiveTotalDays}`}
              </span>
              <span>Day {effectiveTotalDays}</span>
            </div>
          </div>

          {/* Current Stage Card */}
          {currentStage && !isComplete && (
            <div
              className="das-stage-card"
              style={{ borderColor: currentStage.color, background: `${currentStage.color}10` }}
            >
              <div className="das-stage-card-header">
                <span className="das-stage-card-icon">{currentStage.icon}</span>
                <div>
                  <div className="das-stage-card-label" style={{ color: currentStage.color }}>
                    Current Stage: {currentStage.label}
                  </div>
                  <div className="das-stage-card-sub">
                    Recommended field activities right now:
                  </div>
                </div>
              </div>
              <ul className="das-activity-list">
                {currentStage.activities.map((act, i) => (
                  <li key={i} style={{ borderLeftColor: currentStage.color }}>
                    <ChevronRight size={13} style={{ color: currentStage.color, flexShrink: 0, marginTop: 2 }} />
                    {act}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isComplete && (
            <div className="das-complete-banner">
              🏆 <strong>Crop Duration Complete!</strong> Your crop should be ready for harvest.
              Check grain moisture and prepare market logistics.
            </div>
          )}
        </>
      )}

      {das === null && (
        <p className="das-hint">Pick the date you sowed your crop to see stage progress and recommended activities.</p>
      )}
    </div>
  );
};

// ── Crop Card ────────────────────────────────────────────────────────
const CropCard = ({ crop, onTrack, isTracking }) => {
  const sm = STATUS_META[crop.status] || STATUS_META.off_season;
  return (
    <div
      className="cal-crop-card"
      style={{ borderColor: sm.border, '--card-accent': sm.color }}
    >
      {/* Top accent bar */}
      <div className="cal-card-accent" style={{ background: sm.color }} />

      <div className="cal-card-body">
        <div className="cal-card-top">
          <span className="cal-crop-name">{crop.crop}</span>
          <span className="cal-status-badge" style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
            {sm.icon} {sm.label}
          </span>
        </div>

        <div className="cal-card-pills">
          <span className="cal-pill cal-pill-season">{crop.season}</span>
          {crop.duration_days && (
            <span className="cal-pill cal-pill-duration">⏱ {crop.duration_days} days</span>
          )}
        </div>

        <div className="cal-window-row">
          {crop.sow_window?.length > 0 && (
            <div className="cal-window-item">
              <span className="cal-window-label">🌱 Sow</span>
              <span className="cal-window-value">
                {Array.isArray(crop.sow_window) ? crop.sow_window.join(' – ') : crop.sow_window}
              </span>
            </div>
          )}
          {crop.harvest_window?.length > 0 && (
            <div className="cal-window-item">
              <span className="cal-window-label">🌾 Harvest</span>
              <span className="cal-window-value">
                {Array.isArray(crop.harvest_window) ? crop.harvest_window.join(' – ') : crop.harvest_window}
              </span>
            </div>
          )}
        </div>

        {crop.advisory && (
          <p className="cal-advisory">{crop.advisory}</p>
        )}

        <button
          className={`cal-track-btn ${isTracking ? 'cal-track-btn-active' : ''}`}
          onClick={() => onTrack(crop)}
          id={`track-btn-${crop.crop?.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {isTracking ? '📍 Tracking This Crop' : '📅 Track DAS Milestones'}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────
const CropCalendar = () => {
  const { t } = useLanguage();
  const [form, setForm]             = useState({ state: '', zone: '', season_filter: '' });
  const [zones, setZones]           = useState([]);
  const [crops, setCrops]           = useState([]);
  const [summary, setSummary]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [searched, setSearched]     = useState(false);
  const [search, setSearch]         = useState('');
  const [activeSeason, setActiveSeason] = useState('All');
  const [activeStatus, setActiveStatus] = useState('all');
  const [trackedCrop, setTrackedCrop]   = useState(null);

  useEffect(() => {
    toolsService.getCropCalendarZones()
      .then(d => setZones(d.zones || []))
      .catch(() => {});
  }, []);

  const handleFetch = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const payload = {};
      if (form.state) payload.state = form.state;
      if (form.zone)  payload.zone  = form.zone;
      if (activeSeason !== 'All') payload.season_filter = activeSeason;

      const data = await toolsService.getCropCalendar(payload);
      setCrops(Array.isArray(data.crops) ? data.crops : []);
      setSummary(data.summary || '');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load crop calendar.');
    } finally {
      setLoading(false);
    }
  }, [form, activeSeason]);

  // Auto-fetch on mount
  useEffect(() => { handleFetch(); }, []); // eslint-disable-line

  // Re-fetch when season pill changes
  const handleSeasonChange = (s) => {
    setActiveSeason(s);
    setActiveStatus('all');
  };

  useEffect(() => {
    if (searched) handleFetch();
  }, [activeSeason]); // eslint-disable-line

  const filtered = useMemo(() => {
    let list = crops;
    if (search) list = list.filter(c => c.crop?.toLowerCase().includes(search.toLowerCase()));
    if (activeStatus !== 'all') list = list.filter(c => c.status === activeStatus);
    return list;
  }, [crops, search, activeStatus]);

  // Unique statuses present in results
  const presentStatuses = useMemo(() => {
    const s = new Set(crops.map(c => c.status));
    return ['all', ...Object.keys(STATUS_META).filter(k => s.has(k))];
  }, [crops]);

  const handleTrack = (crop) => {
    setTrackedCrop(prev => prev?.crop === crop.crop ? null : crop);
  };

  return (
    <div className="tools-page">
      <div className="tools-page-header">
        <div className="tools-page-badge"><CalendarDays size={14} /> {t('cropCalendar')}</div>
        <h1 className="tools-page-title">📅 {t('calendarTitle')}</h1>
        <p className="tools-page-subtitle">{t('calendarSubtitle')}</p>
      </div>

      {/* ── Controls Bar ── */}
      <div className="cal-controls-bar">
        {/* State selector */}
        <div className="form-group cal-state-group">
          <label>📍 State</label>
          <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} id="cal-state-select">
            <option value="">All India</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Season toggle pills */}
        <div className="cal-season-pills">
          {SEASONS.map(s => (
            <button
              key={s}
              className={`cal-season-pill ${activeSeason === s ? 'cal-season-pill-active' : ''}`}
              onClick={() => handleSeasonChange(s)}
              id={`season-pill-${s.toLowerCase()}`}
            >
              {s === 'All' ? '🌐' : s === 'Kharif' ? '🌧️' : s === 'Rabi' ? '❄️' : '☀️'} {s}
            </button>
          ))}
        </div>

        {/* Apply button */}
        <button className="tools-filter-btn" onClick={handleFetch} disabled={loading} id="cal-apply-btn">
          {loading ? <Loader2 size={16} className="tools-spin" /> : <Search size={16} />}
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {/* ── DAS Tracker (shown when a crop is tracked) ── */}
      {trackedCrop && (
        <DASTracker cropName={trackedCrop.crop} totalDays={trackedCrop.duration_days} />
      )}

      {/* ── Summary Banner ── */}
      {summary && !loading && (
        <div className="cal-summary-banner">
          <Sprout size={16} style={{ flexShrink: 0, color: '#10b981', marginTop: 2 }} />
          <span>{summary}</span>
        </div>
      )}

      {/* ── Status Filter Tags ── */}
      {!loading && crops.length > 0 && (
        <div className="cal-status-filters">
          {presentStatuses.map(s => {
            const meta = s === 'all' ? { label: 'All', icon: '📋', color: '#ffffff', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)' } : STATUS_META[s];
            const isActive = activeStatus === s;
            return (
              <button
                key={s}
                className="cal-status-tag"
                style={{
                  background: isActive ? meta.bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? meta.border : 'rgba(255,255,255,0.1)'}`,
                  color: isActive ? meta.color : 'rgba(255,255,255,0.5)',
                }}
                onClick={() => setActiveStatus(s)}
                id={`status-filter-${s}`}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Crop Search ── */}
      {crops.length > 0 && (
        <div className="cal-search-wrap">
          <Search size={15} className="cal-search-icon" />
          <input
            type="text"
            placeholder="Search crop…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="cal-search-input"
            id="cal-crop-search"
          />
        </div>
      )}

      {error && <div className="tools-error"><AlertCircle size={16} /> {error}</div>}

      {/* ── Grid ── */}
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
        <div className="cal-grid">
          {filtered.map((crop, i) => (
            <CropCard
              key={`${crop.crop}-${i}`}
              crop={crop}
              onTrack={handleTrack}
              isTracking={trackedCrop?.crop === crop.crop}
            />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {crops.length > 0 && !loading && (
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.28)', marginTop: '1.5rem', textAlign: 'center' }}>
          ℹ️ Calendar based on Indian agro-climatic zones. Confirm with your local KVK / Agriculture Extension Officer.
        </p>
      )}
    </div>
  );
};

export default CropCalendar;
