import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictionService } from '../services/predictionService';
import { cropService } from '../services/cropService';
import { fertilizerService } from '../services/fertilizerService';
import { yieldService } from '../services/yieldService';
import { ChevronRight, Download, Loader2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { downloadDiseaseReport, downloadCropReport, downloadFertilizerReport, downloadYieldReport } from '../utils/pdfReport';
import './History.css';

// Normalize recommendations field: backend may return array OR JSON string
function normalizeRecs(recs) {
  if (!recs) return [];
  if (typeof recs === 'string') {
    try { return JSON.parse(recs); } catch (_) { return []; }
  }
  return Array.isArray(recs) ? recs : [];
}

const History = () => {
  const [predictions, setPredictions] = useState([]);
  const [cropRecHistory, setCropRecHistory] = useState([]);
  const [fertilizerHistory, setFertilizerHistory] = useState([]);
  const [yieldHistory, setYieldHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('predictions');
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);       // crop rec modal
  const [selectedYieldEntry, setSelectedYieldEntry] = useState(null); // yield modal
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    fetchHistory();
    fetchCropRecHistory();
    fetchFertilizerHistory();
    fetchYieldHistory();
  }, []);

  const fetchCropRecHistory = async () => {
    // ── Step 1: Load sessionStorage entries (current-session snapshots) ──
    let sessionEntries = [];
    try {
      const stored = JSON.parse(sessionStorage.getItem('cropRecHistory') || '[]');
      sessionEntries = (Array.isArray(stored) ? stored : []).map(entry => ({
        ...entry,
        recommendations: normalizeRecs(entry.recommendations),
        _source: 'session',
      }));
    } catch (_) {}

    // ── Step 2: Fetch latest saved record from backend (source of truth) ──
    let backendEntry = null;
    try {
      const data = await cropService.getLatestCropRecommendation();
      if (data) {
        console.log("RAW /latest-crop-recommendation:", data.recommendations);
        const recs = normalizeRecs(data.recommendations);
        console.log("PARSED /latest-crop-recommendation:", recs);
        backendEntry = {
          id: data.id || 'backend-latest',
          timestamp: data.created_at || data.timestamp || new Date().toISOString(),
          farmName: data.farm_name || data.farmName || '',
          city: data.city || '',
          soilData: data.soilData || {},
          season: data.season || '',
          weather: data.weather || {},
          recommendations: recs,
          _source: 'backend',
        };
      }
    } catch (err) {
      console.warn('Could not fetch /latest-crop-recommendation:', err.message);
    }

    // ── Step 3: Merge — backend record first, then session entries (deduplicate by id) ──
    const merged = [];
    const seen = new Set();
    if (backendEntry) {
      merged.push(backendEntry);
      seen.add(String(backendEntry.id));
    }
    for (const entry of sessionEntries) {
      if (!seen.has(String(entry.id))) {
        merged.push(entry);
        seen.add(String(entry.id));
      }
    }
    console.log("History cropRecHistory merged:", merged);
    setCropRecHistory(merged);
  };

  const fetchFertilizerHistory = async () => {
    try {
      const data = await fertilizerService.getFertilizerHistory();
      setFertilizerHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not fetch fertilizer history:', err.message);
    }
  };

  const fetchYieldHistory = async () => {
    try {
      const data = await yieldService.getYieldHistory();
      setYieldHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not fetch yield history:', err.message);
    }
  };

  const fetchHistory = async () => {
    try {
      const predData = await predictionService.getPredictionHistory();
      setPredictions(Array.isArray(predData) ? predData : []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePredictionClick = (prediction) => {
    // Merge any cached details (severity/cause/symptoms/treatment) from sessionStorage
    let details = {};
    try {
      const cache = JSON.parse(sessionStorage.getItem('predictionDetailsCache') || '{}');
      details = cache[prediction.id] || {};
    } catch (_) {}

    navigate(`/history/prediction/${prediction.id}`, {
      state: { prediction: { ...prediction, ...details } }
    });
  };

  const handleCropRecClick = (item) => {
    setSelectedEntry(item);
  };

  const handleFertilizerClick = (item) => {
    navigate(`/history/fertilizer/${item.id}`, { state: { data: item } });
  };

  const handleDownloadDisease = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      // Merge cached details (severity/cause/symptoms/treatment) from sessionStorage
      let detailsCache = {};
      try {
        detailsCache = JSON.parse(sessionStorage.getItem('predictionDetailsCache') || '{}');
      } catch (_) {}

      const enrichedPredictions = predictions.map(p => ({
        ...p,
        ...(detailsCache[p.id] || {}),
      }));

      await downloadDiseaseReport({ user, predictions: enrichedPredictions });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadCropRec = async () => {
    if (pdfLoading) return;
    if (cropRecHistory.length === 0) return;
    setPdfLoading(true);
    try {
      await downloadCropReport({ user, cropRecHistory });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadFertilizer = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      // Fetch fresh full history for the PDF
      const freshHistory = await fertilizerService.getFertilizerHistory();
      await downloadFertilizerReport({ user, fertilizerHistory: Array.isArray(freshHistory) ? freshHistory : fertilizerHistory });
    } catch (err) {
      console.error('Fertilizer PDF error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadYield = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const freshHistory = await yieldService.getYieldHistory();
      await downloadYieldReport({ user, yieldHistory: Array.isArray(freshHistory) ? freshHistory : yieldHistory });
    } catch (err) {
      console.error('Yield PDF error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">{t('loadingHistory')}</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('historyTitle')}</h1>
          <p className="page-subtitle">{t('historySubtitle')}</p>
        </div>
        {activeTab === 'predictions' && predictions.length > 0 && (
          <button
            className="history-download-btn"
            onClick={handleDownloadDisease}
            disabled={pdfLoading}
            id="download-disease-report-btn"
          >
            {pdfLoading
              ? <><Loader2 size={16} className="spin-icon" /> {t('generatingReport')}</>
              : <><Download size={16} /> {t('downloadDiseaseReport')}</>
            }
          </button>
        )}
        {activeTab === 'cropRec' && cropRecHistory.length > 0 && (
          <button
            className="history-download-btn"
            onClick={handleDownloadCropRec}
            disabled={pdfLoading}
            id="download-crop-rec-report-btn"
          >
            {pdfLoading
              ? <><Loader2 size={16} className="spin-icon" /> {t('generatingReport')}</>
              : <><Download size={16} /> {t('downloadCropReport')}</>
            }
          </button>
        )}
        {activeTab === 'fertilizer' && (
          <button
            className="history-download-btn"
            onClick={handleDownloadFertilizer}
            disabled={pdfLoading}
            id="download-fertilizer-report-btn"
          >
            {pdfLoading
              ? <><Loader2 size={16} className="spin-icon" /> {t('generatingReport')}</>
              : <><Download size={16} /> {t('downloadFertilizerReport')}</>
            }
          </button>
        )}
        {activeTab === 'yield' && (
          <button
            className="history-download-btn"
            onClick={handleDownloadYield}
            disabled={pdfLoading}
            id="download-yield-report-btn"
          >
            {pdfLoading
              ? <><Loader2 size={16} className="spin-icon" /> {t('generatingReport')}</>
              : <><Download size={16} /> {t('downloadYieldReport')}</>
            }
          </button>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          <span className="tab-icon">🔬</span>
          {t('diseaseDetections')}
          <span className="tab-count">{predictions.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'cropRec' ? 'active' : ''}`}
          onClick={() => setActiveTab('cropRec')}
        >
          <span className="tab-icon">🌱</span>
          {t('cropRecommendations')}
          <span className="tab-count">{cropRecHistory.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'fertilizer' ? 'active' : ''}`}
          onClick={() => setActiveTab('fertilizer')}
          id="fertilizer-history-tab"
        >
          <span className="tab-icon">🧪</span>
          {t('fertilizerRecommendations')}
          <span className="tab-count">{fertilizerHistory.length}</span>
        </button>
        <button
          className={`tab ${activeTab === 'yield' ? 'active' : ''}`}
          onClick={() => setActiveTab('yield')}
          id="yield-history-tab"
        >
          <span className="tab-icon">📈</span>
          {t('yieldPredictions')}
          <span className="tab-count">{yieldHistory.length}</span>
        </button>
      </div>

      {activeTab === 'predictions' && (
        <div className="history-grid">
          {predictions.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <h3>{t('noPredictionsYet')}</h3>
              <p>{t('noPredictionsHint')}</p>
            </div>
          ) : (
            predictions.map((item) => (
              <div 
                key={item.id} 
                className="history-card clickable"
                onClick={() => handlePredictionClick(item)}
              >
                {/* Leaf image thumbnail (Cloudinary) */}
                {item.image_url && (
                  <div className="card-thumb-wrapper">
                    <img
                      src={item.image_url}
                      alt="Leaf"
                      className="card-thumb"
                      onError={(e) => { e.target.parentNode.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="card-header">
                  <div className="header-left">
                    <h3>{item.disease || 'Unknown Disease'}</h3>
                    <span className="card-date">
                      {new Date(item.date).toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight className="card-arrow" size={20} />
                </div>
                
                <div className="card-body">
                  <div className="confidence-bar">
                    <div className="confidence-label">
                      <span>{t('confidence')}</span>
                      <span className="confidence-value">
                        {(item.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${item.confidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  <span className="view-details">{t('viewDetails')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'cropRec' && (
        <div className="history-grid">
          {cropRecHistory.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🌱</span>
              <h3>{t('noCropRecYet')}</h3>
              <p>{t('noCropRecHint')}</p>
            </div>
          ) : (
            cropRecHistory.map((item) => (
              <div
                key={item.id}
                className="history-card crop-rec-history-card clickable"
                onClick={() => handleCropRecClick(item)}
              >
                <div className="card-header">
                  <div className="header-left">
                    <h3>{t('cropRecEntry')}{item.farmName ? ` — ${item.farmName}` : ''}</h3>
                    <span className="card-date">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <ChevronRight className="card-arrow" size={20} />
                </div>

                {/* Season + weather summary strip */}
                <div className="crop-rec-card-summary">
                  <span className="crop-rec-season-badge">{item.season}</span>
                  {item.weather?.temperature != null && (
                    <span className="crop-rec-summary-chip">🌡️ {Number(item.weather.temperature).toFixed(1)}°C</span>
                  )}
                  {item.weather?.humidity != null && (
                    <span className="crop-rec-summary-chip">💧 {Number(item.weather.humidity).toFixed(1)}%</span>
                  )}
                  {item.weather?.rainfall != null && (
                    <span className="crop-rec-summary-chip">🌧️ {Number(item.weather.rainfall).toFixed(1)} mm</span>
                  )}
                </div>

                {/* Top crops preview — normalizeRecs guards against string-encoded old entries */}
                <div className="crop-rec-crops-list">
                  {normalizeRecs(item.recommendations).map((rec, idx) => (
                    <div key={idx} className={`crop-rec-crop-item ${idx === 0 ? 'top-crop' : ''}`}>
                      <span className="crop-rank">#{idx + 1}</span>
                      <span className="crop-name">{rec.crop}</span>
                      <span className={`crop-conf-badge ${rec.confidence_level === 'High' ? 'badge-high' : rec.confidence_level === 'Moderate' ? 'badge-moderate' : 'badge-low'}`}>
                        {rec.confidence_level} · {Number(rec.confidence).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="card-footer">
                  <span className="view-details">{t('viewDetails')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ Fertilizer History Tab ════════════════════ */}
      {activeTab === 'fertilizer' && (
        <div className="history-grid">
          {fertilizerHistory.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🧪</span>
              <h3>{t('noFertilizerYet')}</h3>
              <p>{t('noFertilizerHint')}</p>
            </div>
          ) : (
            fertilizerHistory.map((item) => {
              /* summary lives in item.result.summary for history records */
              const summaryText = item.result?.summary || item.summary || '';
              return (
                <div
                  key={item.id}
                  className="history-card clickable"
                  onClick={() => handleFertilizerClick(item)}
                  id={`fertilizer-history-card-${item.id}`}
                >
                  <div className="card-header">
                    <div className="header-left">
                      <h3>
                        🧪 {item.crop ? item.crop : t('fertilizerRecEntry')}
                        {item.farming_type && (
                          <span className="fert-hist-type-badge">
                            {item.farming_type.charAt(0).toUpperCase() + item.farming_type.slice(1)}
                          </span>
                        )}
                      </h3>
                      <span className="card-date">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <ChevronRight className="card-arrow" size={20} />
                  </div>

                  {/* Summary preview — reads from item.result.summary (history shape) */}
                  {summaryText && (
                    <div className="card-body">
                      <p className="fert-hist-summary-preview">
                        {summaryText.length > 120 ? summaryText.slice(0, 120) + '…' : summaryText}
                      </p>
                    </div>
                  )}

                  <div className="card-footer">
                    <span className="view-details">{t('viewDetails')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══ Yield History Tab ════════════════════════ */}
      {activeTab === 'yield' && (
        <div className="history-grid yield-history-grid">
          {yieldHistory.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📈</span>
              <h3>{t('yieldNoHistory')}</h3>
              <p>{t('yieldNoHistoryHint')}</p>
            </div>
          ) : (
            yieldHistory.map((item) => {
              const result = item.result ?? {};
              const yr = result.yield_range ?? {};
              const cropName = (item.crop || '').charAt(0).toUpperCase() + (item.crop || '').slice(1);
              return (
                <div
                  key={item.id}
                  className="history-card clickable"
                  id={`yield-history-card-${item.id}`}
                  onClick={() => setSelectedYieldEntry({ ...item, _result: result })}
                >
                  <div className="card-header">
                    <div className="header-left">
                      <h3>
                        📈 {cropName || t('yieldPredictionEntry')}
                        {item.farming_type && (
                          <span className="fert-hist-type-badge">
                            {item.farming_type.charAt(0).toUpperCase() + item.farming_type.slice(1)}
                          </span>
                        )}
                      </h3>
                      <span className="card-date">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <ChevronRight className="card-arrow" size={20} />
                  </div>

                  <div className="card-body">
                    <div className="crop-rec-card-summary">
                      {item.season && (
                        <span className="crop-rec-season-badge">{item.season}</span>
                      )}
                      {yr.mid != null && (
                        <span className="crop-rec-summary-chip">📊 {yr.mid} qtl/acre (expected)</span>
                      )}
                      {yr.low != null && (
                        <span className="crop-rec-summary-chip">↓ {yr.low} low</span>
                      )}
                      {yr.high != null && (
                        <span className="crop-rec-summary-chip">↑ {yr.high} high</span>
                      )}
                    </div>
                  </div>

                  <div className="card-footer">
                    <span className="view-details">View Details</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══ Yield Detail Modal ══════════════════════ */}
      {selectedYieldEntry && (() => {
        const item   = selectedYieldEntry;
        const result = item._result ?? {};
        const yr     = result.yield_range ?? {};
        const tp     = result.total_production;
        const cmp    = result.comparison;
        const lf     = result.limiting_factors;
        const wx     = result.weather_used;
        const cropName = (item.crop || '').charAt(0).toUpperCase() + (item.crop || '').slice(1);
        return (
          <div className="hist-modal-overlay" onClick={() => setSelectedYieldEntry(null)}>
            <div className="hist-modal hist-yield-modal" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="hist-modal-head">
                <div>
                  <h2 className="hist-modal-title">📈 {cropName || t('yieldPredictionEntry')}</h2>
                  <p className="hist-modal-sub">
                    <span className="crop-rec-season-badge" style={{ fontSize: '0.78rem', padding: '0.15rem 0.6rem' }}>{item.season}</span>
                    {item.farming_type && <span style={{ marginLeft: '0.4rem', color: 'rgba(255,255,255,0.5)' }}>· {item.farming_type} farming</span>}
                    <span className="hist-modal-date"> · {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</span>
                  </p>
                </div>
                <button className="hist-modal-close" onClick={() => setSelectedYieldEntry(null)} aria-label="Close">
                  <X size={20} />
                </button>
              </div>

              {/* Yield Range */}
              <div className="hist-modal-section-label">📊 {t('yieldResult')} ({t('yieldUnit')})</div>
              <div className="hist-yield-range-grid">
                <div className="hist-yield-range-item">
                  <span className="hist-modal-weather-label">{t('yieldLow')}</span>
                  <span className="hist-yield-val">{yr.low ?? 'N/A'}</span>
                  <span className="hist-yield-unit">qtl/acre</span>
                </div>
                <div className="hist-yield-range-item hist-yield-mid">
                  <span className="hist-modal-weather-label">{t('yieldExpected')}</span>
                  <span className="hist-yield-val hist-yield-mid-val">{yr.mid ?? 'N/A'}</span>
                  <span className="hist-yield-unit">qtl/acre</span>
                </div>
                <div className="hist-yield-range-item">
                  <span className="hist-modal-weather-label">{t('yieldHigh')}</span>
                  <span className="hist-yield-val">{yr.high ?? 'N/A'}</span>
                  <span className="hist-yield-unit">qtl/acre</span>
                </div>
              </div>

              {/* Total Production */}
              {tp && (
                <>
                  <div className="hist-modal-section-label" style={{ marginTop: '1.25rem' }}>🏭 {t('yieldExpected')}</div>
                  <div className="hist-modal-weather">
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">{t('areaHectares')}</span>
                      <span className="hist-modal-weather-val">{tp.area_acres ?? 'N/A'} acres</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">{t('yieldLow')}</span>
                      <span className="hist-modal-weather-val">{tp.low_quintals ?? 'N/A'} qtl</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">{t('yieldExpected')}</span>
                      <span className="hist-modal-weather-val" style={{ color: '#10b981' }}>{tp.mid_quintals ?? 'N/A'} qtl</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">{t('yieldHigh')}</span>
                      <span className="hist-modal-weather-val">{tp.high_quintals ?? 'N/A'} qtl</span>
                    </div>
                  </div>
                </>
              )}

              {/* Method Comparison */}
              {cmp && (
                <>
                  <div className="hist-modal-section-label" style={{ marginTop: '1.25rem' }}>⚖️ Method Comparison</div>
                  <div className="hist-modal-weather">
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">🧪 Chemical</span>
                      <span className="hist-modal-weather-val">{cmp.conventional_qtl_acre ?? 'N/A'} qtl/acre</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">🌿 Organic</span>
                      <span className="hist-modal-weather-val">{cmp.organic_qtl_acre ?? 'N/A'} qtl/acre</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">📉 Yield Gap</span>
                      <span className="hist-modal-weather-val" style={{ color: '#f59e0b' }}>{cmp.yield_gap_qtl_acre ?? 'N/A'} qtl/acre</span>
                    </div>
                  </div>
                  {cmp.note && <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', margin: '0.5rem 0 0' }}>{cmp.note}</p>}
                </>
              )}

              {/* Limiting Factors */}
              {lf && lf.length > 0 && (
                <>
                  <div className="hist-modal-section-label" style={{ marginTop: '1.25rem' }}>⚠️ Limiting Factors & Tips</div>
                  <ul className="hist-yield-factors">
                    {lf.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </>
              )}

              {/* Weather Used */}
              {wx && (
                <>
                  <div className="hist-modal-section-label" style={{ marginTop: '1.25rem' }}>🌦️ {t('weatherConditions')}</div>
                  <div className="hist-modal-weather">
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">🌡️ {t('temperature')}</span>
                      <span className="hist-modal-weather-val">{wx.temperature?.toFixed(1) ?? 'N/A'}°C</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">💧 {t('humidity')}</span>
                      <span className="hist-modal-weather-val">{wx.humidity?.toFixed(1) ?? 'N/A'}%</span>
                    </div>
                    <div className="hist-modal-weather-item">
                      <span className="hist-modal-weather-label">🌧️ {t('rainfall')}</span>
                      <span className="hist-modal-weather-val">{wx.rainfall?.toFixed(1) ?? 'N/A'} mm</span>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>
        );
      })()}

      {/* ══ Crop Rec Detail Modal ════════════════════ */}
      {selectedEntry && (
        <div className="hist-modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="hist-modal" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="hist-modal-head">
              <div>
                <h2 className="hist-modal-title">{t('cropRecEntry')}</h2>
                <p className="hist-modal-sub">
                  {selectedEntry.farmName && <span>🌾 {selectedEntry.farmName}</span>}
                  {selectedEntry.city && <span> — 📍 {selectedEntry.city}</span>}
                  <span className="hist-modal-date"> · {new Date(selectedEntry.timestamp).toLocaleString()}</span>
                </p>
              </div>
              <button className="hist-modal-close" onClick={() => setSelectedEntry(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Season + Weather */}
            <div className="hist-modal-weather">
              <div className="hist-modal-weather-item">
                <span className="hist-modal-weather-label">🗓️ Season</span>
                <span className="hist-modal-weather-val crop-rec-season-badge">{selectedEntry.season}</span>
              </div>
              {selectedEntry.weather?.temperature != null && (
                <div className="hist-modal-weather-item">
                  <span className="hist-modal-weather-label">{t('predictedTemperature')}</span>
                  <span className="hist-modal-weather-val">{Number(selectedEntry.weather.temperature).toFixed(1)}°C</span>
                </div>
              )}
              {selectedEntry.weather?.humidity != null && (
                <div className="hist-modal-weather-item">
                  <span className="hist-modal-weather-label">{t('predictedHumidity')}</span>
                  <span className="hist-modal-weather-val">{Number(selectedEntry.weather.humidity).toFixed(1)}%</span>
                </div>
              )}
              {selectedEntry.weather?.rainfall != null && (
                <div className="hist-modal-weather-item">
                  <span className="hist-modal-weather-label">{t('predictedRainfall')}</span>
                  <span className="hist-modal-weather-val">{Number(selectedEntry.weather.rainfall).toFixed(1)} mm</span>
                </div>
              )}
            </div>

            {/* Soil Data */}
            {selectedEntry.soilData && Object.values(selectedEntry.soilData).some(Boolean) && (
              <div className="hist-modal-soil">
                <div className="hist-modal-section-label">📋 {t('step2Label')}</div>
                <div className="hist-modal-soil-grid">
                  {selectedEntry.soilData.pH && <div className="hist-modal-soil-item"><span>pH</span><strong>{selectedEntry.soilData.pH}</strong></div>}
                  {selectedEntry.soilData.Nitrogen && <div className="hist-modal-soil-item"><span>{t('nitrogen')}</span><strong>{selectedEntry.soilData.Nitrogen}</strong></div>}
                  {selectedEntry.soilData.Phosphorus && <div className="hist-modal-soil-item"><span>{t('phosphorus')}</span><strong>{selectedEntry.soilData.Phosphorus}</strong></div>}
                  {selectedEntry.soilData.Potassium && <div className="hist-modal-soil-item"><span>{t('potassium')}</span><strong>{selectedEntry.soilData.Potassium}</strong></div>}
                </div>
              </div>
            )}

            {/* Crop Detail Cards — normalizeRecs handles both array & string shapes */}
            <div className="hist-modal-section-label">🌱 {t('topCropRec')}</div>
            <div className="hist-modal-crops">
              {normalizeRecs(selectedEntry.recommendations).map((rec, idx) => (
                <div key={idx} className={`hist-modal-crop-card ${idx === 0 ? 'hist-crop-top' : ''}`}>
                  <div className="hist-modal-crop-head">
                    <span className="hist-crop-rank">#{idx + 1}</span>
                    <span className="hist-crop-name">{rec.crop}</span>
                    <span className={`crop-conf-badge ${rec.confidence_level === 'High' ? 'badge-high' : rec.confidence_level === 'Moderate' ? 'badge-moderate' : 'badge-low'}`}>
                      {rec.confidence_level}
                    </span>
                  </div>
                  <div className="hist-modal-crop-conf">
                    <span>{Number(rec.confidence).toFixed(1)}% confidence</span>
                    <div className="hist-modal-conf-track">
                      <div
                        className={`hist-modal-conf-fill ${rec.confidence_level === 'High' ? 'badge-high' : rec.confidence_level === 'Moderate' ? 'badge-moderate' : 'badge-low'}`}
                        style={{ width: `${Math.min(Number(rec.confidence), 100)}%` }}
                      />
                    </div>
                  </div>
                  {rec.reason && (
                    <div className="hist-modal-reason">
                      <span className="hist-modal-reason-label">{t('whyThisCrop')}</span>
                      <p>{rec.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;