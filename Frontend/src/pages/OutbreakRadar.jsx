import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { farmService } from '../services/farmService';
import { outbreakService } from '../services/outbreakService';
import { useLanguage } from '../context/LanguageContext';
import './OutbreakRadar.css';

// ── Fix Leaflet default icon for Vite ─────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Custom icons ──────────────────────────────────────────────────────────
const myFarmIcon = L.divIcon({
  className: '',
  html: `<div class="or-my-farm-pin">🏡</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

function alertIcon(severity) {
  const color = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#10b981';
  return L.divIcon({
    className: '',
    html: `<div class="or-alert-pin" style="background:${color}">⚠</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

const otherFarmIcon = L.divIcon({
  className: '',
  html: `<div class="or-other-farm-pin">🌾</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

// ── Fly-to helper (must be a child of MapContainer) ───────────────────────
function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 14, { duration: 1 });
  }, [target, map]);
  return null;
}

// ── Recenter when farm changes ────────────────────────────────────────────
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.latitude, center.longitude], 12);
  }, [center, map]);
  return null;
}

const RADIUS_OPTIONS = [5, 15, 25, 50];
const CROP_OPTIONS   = ['All Crops', 'Tomato', 'Potato', 'Corn', 'Apple', 'Grape', 'Pepper'];

const TIPS = {
  default: 'Inspect your crops regularly and isolate infected plants immediately.',
  blight:  'Remove affected leaves. Avoid overhead watering. Apply copper-based fungicide.',
  rust:    'Apply sulfur or triazole fungicides. Ensure good air circulation.',
  virus:   'Control insect vectors. Remove infected plants to prevent spread.',
  rot:     'Improve drainage. Avoid waterlogging. Apply approved fungicides.',
};

function getTip(disease = '') {
  const d = disease.toLowerCase();
  if (d.includes('blight')) return TIPS.blight;
  if (d.includes('rust'))   return TIPS.rust;
  if (d.includes('virus') || d.includes('mosaic')) return TIPS.virus;
  if (d.includes('rot'))    return TIPS.rot;
  return TIPS.default;
}

function alertBadge(level) {
  if (level === 'HIGH')     return { label: 'Active Outbreak Nearby', cls: 'or-badge-high' };
  if (level === 'MODERATE') return { label: 'Disease Reports Nearby', cls: 'or-badge-moderate' };
  return { label: 'Area Clear', cls: 'or-badge-safe' };
}

// ════════════════════════════════════════════════════════════════════════════
export default function OutbreakRadar() {
  const { t } = useLanguage();
  const [farms,      setFarms]      = useState([]);
  const [farmId,     setFarmId]     = useState('');
  const [radiusKm,   setRadiusKm]   = useState(25);
  const [cropFilter, setCropFilter] = useState('');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [flyTarget,  setFlyTarget]  = useState(null);

  // Load farms once
  useEffect(() => {
    farmService.getFarms()
      .then(f => { setFarms(f); if (f.length) setFarmId(String(f[0].id)); })
      .catch(() => {});
  }, []);

  const fetchRadar = useCallback(async () => {
    setLoading(true);
    setError('');
    setFlyTarget(null);
    try {
      const res = await outbreakService.getRadar({
        farmId:     farmId ? parseInt(farmId) : undefined,
        radiusKm,
        days:       30,
        cropFilter: cropFilter || '',
      });
      setData(res);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load radar data.');
    } finally {
      setLoading(false);
    }
  }, [farmId, radiusKm, cropFilter]);

  // Auto-fetch whenever controls change
  useEffect(() => {
    if (farmId) fetchRadar();
  }, [farmId, radiusKm, cropFilter, fetchRadar]);

  const center    = data?.center;
  const summary   = data?.summary;
  const outbreaks = data?.outbreaks ?? [];
  const badge     = summary ? alertBadge(summary.alert_level) : null;
  const mapCenter = center ? [center.latitude, center.longitude] : [20.5937, 78.9629];

  return (
    <div className="or-page">
      {/* ── Header ── */}
      <div className="or-header">
        <div className="or-badge-label">🛰️ Hyperlocal Surveillance</div>
        <h1 className="or-title">Outbreak Radar</h1>
        <p className="or-subtitle">
          Track nearby crop disease alerts and protect your farm before outbreaks spread
        </p>
      </div>

      {/* ── Control Bar ── */}
      <div className="or-controls">
        {/* Farm selector */}
        <div className="or-ctrl-group">
          <label className="or-ctrl-label">🏡 Farm</label>
          <select
            className="or-select"
            value={farmId}
            onChange={e => setFarmId(e.target.value)}
          >
            {farms.length === 0 && <option value="">No farms added</option>}
            {farms.map(f => (
              <option key={f.id} value={String(f.id)}>{f.farm_name}</option>
            ))}
          </select>
        </div>

        {/* Radius pills */}
        <div className="or-ctrl-group">
          <label className="or-ctrl-label">📡 Radius</label>
          <div className="or-pills">
            {RADIUS_OPTIONS.map(r => (
              <button
                key={r}
                className={`or-pill ${radiusKm === r ? 'or-pill-active' : ''}`}
                onClick={() => setRadiusKm(r)}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Crop filter */}
        <div className="or-ctrl-group">
          <label className="or-ctrl-label">🌱 Crop</label>
          <select
            className="or-select"
            value={cropFilter}
            onChange={e => setCropFilter(e.target.value === 'All Crops' ? '' : e.target.value)}
          >
            {CROP_OPTIONS.map(c => (
              <option key={c} value={c === 'All Crops' ? '' : c}>{c}</option>
            ))}
          </select>
        </div>

        <button className="or-refresh-btn" onClick={fetchRadar} disabled={loading || !farmId}>
          {loading ? <span className="or-spinner" /> : '🔄'} Refresh
        </button>
      </div>

      {error && <div className="or-error">{error}</div>}

      {/* ── Main 2-col layout ── */}
      <div className="or-layout">

        {/* ── Left: Map ── */}
        <div className="or-map-card">
          <MapContainer
            center={mapCenter}
            zoom={12}
            className="or-map"
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {center && <MapRecenter center={center} />}
            {flyTarget && <MapFlyTo target={flyTarget} />}

            {/* Geofence circle */}
            {center && (
              <Circle
                center={[center.latitude, center.longitude]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#10b981',
                  fillColor: '#10b981',
                  fillOpacity: 0.07,
                  weight: 2,
                  dashArray: '6 4',
                }}
              />
            )}

            {/* My Farm marker (selected center farm) */}
            {center && (
              <Marker position={[center.latitude, center.longitude]} icon={myFarmIcon}>
                <Popup className="or-popup">
                  <strong>🏡 {center.farm_name}</strong>
                  <br />Selected farm center
                </Popup>
              </Marker>
            )}

            {/* All other user farms shown simultaneously */}
            {farms
              .filter(f => String(f.id) !== String(farmId) && f.latitude && f.longitude)
              .map(f => (
                <Marker
                  key={`other-farm-${f.id}`}
                  position={[f.latitude, f.longitude]}
                  icon={otherFarmIcon}
                >
                  <Popup className="or-popup">
                    <div className="or-popup-inner">
                      <div className="or-popup-disease">🌾 {f.farm_name}</div>
                      <div className="or-popup-meta">
                        <span>Your other farm</span>
                        <span>🌱 {f.crop_type || ''}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))
            }

            {/* Outbreak markers */}
            {outbreaks.map(ob => (
              <Marker
                key={ob.id}
                position={[ob.latitude, ob.longitude]}
                icon={alertIcon(ob.severity)}
              >
                <Popup className="or-popup">
                  <div className="or-popup-inner">
                    <div className="or-popup-disease">⚠️ {ob.disease.replace(/_/g, ' ')}</div>
                    <div className="or-popup-meta">
                      <span>📍 {ob.distance_km} km away</span>
                      <span>🌱 {ob.crop}</span>
                    </div>
                    <div className="or-popup-date">
                      🗓 {new Date(ob.detected_at).toLocaleDateString()}
                    </div>
                    <div className="or-popup-tip">💡 {getTip(ob.disease)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="or-sidebar">

          {/* Alert Status Card */}
          {badge && (
            <div className={`or-alert-card ${badge.cls}`}>
              <div className="or-alert-title">{badge.label}</div>
              {summary.high_risk_disease && (
                <div className="or-alert-disease">
                  Most reported: <strong>{summary.high_risk_disease.replace(/_/g, ' ')}</strong>
                </div>
              )}
              <div className="or-alert-count">
                {summary.total_cases} case{summary.total_cases !== 1 ? 's' : ''} within {radiusKm} km
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="or-legend-card">
            <div className="or-legend-title">Map Legend</div>
            <div className="or-legend-items">
              <span><span className="or-legend-emoji">🏡</span> Selected Farm</span>
              <span><span className="or-legend-emoji">🌾</span> Other Farm</span>
            </div>
            <div className="or-legend-items" style={{marginTop:'0.5rem'}}>
              <span><span className="or-dot" style={{background:'#ef4444'}} /> High</span>
              <span><span className="or-dot" style={{background:'#f59e0b'}} /> Medium</span>
              <span><span className="or-dot" style={{background:'#10b981'}} /> Low</span>
            </div>
          </div>

          {/* Detection feed */}
          <div className="or-feed-card">
            <div className="or-feed-title">📡 Nearby Detections</div>
            {loading && <div className="or-feed-loading">Loading radar data…</div>}
            {!loading && outbreaks.length === 0 && (
              <div className="or-feed-empty">
                ✅ No disease reports within {radiusKm} km in the last 30 days.
              </div>
            )}
            <div className="or-feed-list">
              {outbreaks.map(ob => (
                <button
                  key={ob.id}
                  className="or-feed-item"
                  onClick={() => setFlyTarget(ob)}
                >
                  <div className="or-feed-item-left">
                    <span
                      className="or-feed-sev"
                      style={{
                        background:
                          ob.severity === 'High'   ? '#ef4444' :
                          ob.severity === 'Medium' ? '#f59e0b' : '#10b981',
                      }}
                    />
                    <div>
                      <div className="or-feed-disease">{ob.disease.replace(/_/g, ' ')}</div>
                      <div className="or-feed-crop">{ob.crop}</div>
                    </div>
                  </div>
                  <div className="or-feed-dist">{ob.distance_km} km</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
