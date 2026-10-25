import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { predictionService } from '../services/predictionService';
import { soilService } from '../services/soilService';
import { farmService } from '../services/farmService';
import { khataService } from '../services/khataService';
import { Activity, Map, X, Plus, TrendingUp, TrendingDown, Wallet, ArrowRight } from 'lucide-react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useVoiceFill, ADD_FARM_FIELDS } from '../utils/voiceFormFill';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();

  // ── Step 11f: Voice fill for Add Farm modal ──
  useVoiceFill(
    ADD_FARM_FIELDS,
    (field, value) => setFarmForm(prev => ({ ...prev, [field]: value })),
    speak
  );
  const [predictions, setPredictions] = useState([]);
  const [soilData, setSoilData] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [farmForm, setFarmForm] = useState({
    farm_name: '',
    location_name: '',
    latitude: '',
    longitude: '',
    area_hectares: '',
  });
  const [farmError, setFarmError] = useState('');
  const [farmLoading, setFarmLoading] = useState(false);
  const [useCoords, setUseCoords] = useState(false);

  // Kisan Khata state
  const [khataSummary, setKhataSummary] = useState(null);
  const [recentKhataEntries, setRecentKhataEntries] = useState([]);
  const [khataLoading, setKhataLoading] = useState(true);

  useEffect(() => {
    console.log('use effect called');
    fetchData();
    fetchKhataData();
  }, []);

  const fetchData = async () => {
    try {
      const [predData, soilDataRes, farmsRes] = await Promise.all([
        predictionService.getPredictionHistory(),
        soilService.getSoilHistory(),
        farmService.getFarms().catch(() => []),
      ]);
      setPredictions(Array.isArray(predData) ? predData : []);
      setSoilData(Array.isArray(soilDataRes) ? soilDataRes : []);
      setFarms(Array.isArray(farmsRes) ? farmsRes : []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKhataData = async () => {
    try {
      const [summary, entries] = await Promise.all([
        khataService.getSummary().catch(() => null),
        khataService.getEntries().catch(() => []),
      ]);
      setKhataSummary(summary);
      setRecentKhataEntries(entries.slice(0, 3));
    } catch (err) {
      console.error('Failed to load khata data:', err);
    } finally {
      setKhataLoading(false);
    }
  };

  const handleFarmFormChange = (e) => {
    setFarmForm({ ...farmForm, [e.target.name]: e.target.value });
  };

  const handleAddFarm = async (e) => {
    e.preventDefault();
    setFarmError('');
    if (!farmForm.farm_name.trim()) {
      setFarmError('Farm name is required.');
      return;
    }
    if (!farmForm.area_hectares || isNaN(farmForm.area_hectares)) {
      setFarmError('Please enter a valid area.');
      return;
    }

    const payload = {
      farm_name: farmForm.farm_name.trim(),
      area_hectares: parseFloat(farmForm.area_hectares),
    };

    if (useCoords) {
      if (!farmForm.latitude || !farmForm.longitude) {
        setFarmError('Please enter both latitude and longitude.');
        return;
      }
      payload.latitude = parseFloat(farmForm.latitude);
      payload.longitude = parseFloat(farmForm.longitude);
    } else {
      if (!farmForm.location_name.trim()) {
        setFarmError('Location name is required.');
        return;
      }
      payload.location_name = farmForm.location_name.trim();
    }

    try {
      setFarmLoading(true);
      await farmService.addFarm(payload);
      setShowAddFarm(false);
      setFarmForm({ farm_name: '', location_name: '', latitude: '', longitude: '', area_hectares: '' });
      // Refresh farms
      const farmsRes = await farmService.getFarms().catch(() => []);
      setFarms(Array.isArray(farmsRes) ? farmsRes : []);
    } catch (err) {
      setFarmError(err.response?.data?.detail || 'Failed to add farm. Please try again.');
    } finally {
      setFarmLoading(false);
    }
  };

  // Recent activity (top 5)
  const recentActivity = [...predictions.map(p => ({
    ...p,
    type: 'prediction',
    timestamp: p.date
  })), ...soilData.map(s => ({
    ...s,
    type: 'soil',
    timestamp: s.timestamp
  }))]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);

  const netProfit = khataSummary?.net_profit ?? null;
  const isProfit = netProfit !== null && netProfit >= 0;

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">{t('loadingDashboard')}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>{t('analyticsDashboard')}</h1>
          <p className="dashboard-subtitle">
            {t('welcomeBack')}, {user?.name}! {t('cropHealthOverview')}
          </p>
        </div>
      </div>

      {/* ── Two-Column Main Grid ── */}
      <div className="dashboard-main-grid">

        {/* ── LEFT: Recent Activity ── */}
        <div className="activity-card dashboard-activity-col">
          <h3><Activity size={18} /> {t('recentActivity')}</h3>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((item, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {item.type === 'prediction' ? '🔬' : '🧪'}
                  </div>
                  <div className="activity-content">
                    <p className="activity-title">
                      {item.type === 'prediction'
                        ? `${t('diseaseDetected')}: ${item.disease}`
                        : t('soilAnalysisCompleted')}
                    </p>
                    <span className="activity-time">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-small">{t('noRecentActivity')}</div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Stacked My Farms + Expense Ledger ── */}
        <div className="dashboard-right-col">

          {/* My Farms */}
          <div className="farms-panel">
            <div className="farms-header">
              <h3>
                <Map size={18} />
                {t('myFarms')}
              </h3>
              <button
                className="add-farm-btn"
                onClick={() => { setShowAddFarm(true); setFarmError(''); }}
                id="add-farm-btn"
              >
                <Plus size={15} />
                {t('addFarm')}
              </button>
            </div>

            {farms.length === 0 ? (
              <div className="farms-empty">
                <span>🌾</span>
                <p>{t('noFarmsYet')}</p>
              </div>
            ) : (
              <div className="farms-list">
                {farms.map((farm, index) => (
                  <div key={farm.id || index} className="farm-card">
                    <div className="farm-card-icon">🌾</div>
                    <div className="farm-card-body">
                      <h4 className="farm-name">{farm.farm_name}</h4>
                      <p className="farm-location">
                        📍 {farm.location_name || (farm.latitude && farm.longitude
                          ? `${Number(farm.latitude).toFixed(4)}, ${Number(farm.longitude).toFixed(4)}`
                          : 'N/A')}
                      </p>
                      <span className="farm-area">
                        {farm.area_hectares} {t('hectares')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expense Ledger (Kisan Khata) */}
          <div className="khata-panel">
            <div className="khata-header">
              <h3><Wallet size={18} /> Expense Ledger</h3>
              <Link to="/khata" className="khata-view-all-link" id="view-full-ledger-btn">
                View Full Ledger <ArrowRight size={14} />
              </Link>
            </div>

            {khataLoading ? (
              <div className="khata-loading">Loading ledger…</div>
            ) : (
              <>
                {/* Summary Metrics */}
                <div className="khata-summary-grid">
                  <div className="khata-metric khata-income">
                    <TrendingUp size={16} />
                    <div>
                      <span className="khata-metric-label">Total Income</span>
                      <span className="khata-metric-value">
                        ₹{khataSummary ? khataSummary.total_income.toLocaleString('en-IN') : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="khata-metric khata-expense">
                    <TrendingDown size={16} />
                    <div>
                      <span className="khata-metric-label">Total Expense</span>
                      <span className="khata-metric-value">
                        ₹{khataSummary ? khataSummary.total_expense.toLocaleString('en-IN') : '—'}
                      </span>
                    </div>
                  </div>
                  <div className={`khata-metric khata-net ${netProfit !== null ? (isProfit ? 'profit' : 'loss') : ''}`}>
                    <span className="khata-net-emoji">{isProfit ? '📈' : '📉'}</span>
                    <div>
                      <span className="khata-metric-label">Net {isProfit ? 'Profit' : 'Loss'}</span>
                      <span className="khata-metric-value">
                        {netProfit !== null
                          ? `${isProfit ? '+' : ''}₹${Math.abs(netProfit).toLocaleString('en-IN')}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Entries Mini List */}
                <div className="khata-entries">
                  <p className="khata-entries-label">Recent Transactions</p>
                  {recentKhataEntries.length > 0 ? (
                    recentKhataEntries.map((entry) => (
                      <div key={entry.id} className="khata-entry-row">
                        <span className="khata-entry-icon">
                          {entry.transaction_type === 'income' ? '💰' : '💸'}
                        </span>
                        <div className="khata-entry-info">
                          <span className="khata-entry-title">{entry.title}</span>
                          <span className="khata-entry-cat">{entry.category}</span>
                        </div>
                        <span className={`khata-entry-amount ${entry.transaction_type}`}>
                          {entry.transaction_type === 'income' ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="khata-empty">
                      <span>📒</span>
                      <p>No transactions yet. <Link to="/khata">Add your first entry</Link></p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>{/* end dashboard-right-col */}
      </div>{/* end dashboard-main-grid */}

      {/* Add Farm Modal */}
      {showAddFarm && (
        <div className="modal-overlay" onClick={() => setShowAddFarm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🌾 {t('addFarmTitle')}</h3>
              <button className="modal-close" onClick={() => setShowAddFarm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddFarm} className="farm-form">
              <div className="form-group">
                <label>{t('farmName')}</label>
                <input
                  type="text"
                  name="farm_name"
                  value={farmForm.farm_name}
                  onChange={handleFarmFormChange}
                  placeholder="e.g. North Field"
                  className="form-input"
                  id="farm-name-input"
                />
              </div>

              <div className="form-group">
                <div className="toggle-row">
                  <label>{t('locationName')}</label>
                  <button
                    type="button"
                    className="toggle-coords-btn"
                    onClick={() => setUseCoords(!useCoords)}
                  >
                    {useCoords ? 'Use Location Name' : 'Use Coordinates'}
                  </button>
                </div>
                {!useCoords ? (
                  <input
                    type="text"
                    name="location_name"
                    value={farmForm.location_name}
                    onChange={handleFarmFormChange}
                    placeholder="e.g. Pune, Maharashtra"
                    className="form-input"
                    id="farm-location-input"
                  />
                ) : (
                  <div className="coords-row">
                    <input
                      type="number"
                      name="latitude"
                      value={farmForm.latitude}
                      onChange={handleFarmFormChange}
                      placeholder={t('latitude')}
                      className="form-input"
                      step="any"
                      id="farm-lat-input"
                    />
                    <input
                      type="number"
                      name="longitude"
                      value={farmForm.longitude}
                      onChange={handleFarmFormChange}
                      placeholder={t('longitude')}
                      className="form-input"
                      step="any"
                      id="farm-lng-input"
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>{t('areaHectares')}</label>
                <input
                  type="number"
                  name="area_hectares"
                  value={farmForm.area_hectares}
                  onChange={handleFarmFormChange}
                  placeholder="e.g. 5.5"
                  className="form-input"
                  step="0.01"
                  min="0"
                  id="farm-area-input"
                />
              </div>

              {farmError && <div className="form-error">{farmError}</div>}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddFarm(false)}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={farmLoading}
                  id="submit-farm-btn"
                >
                  {farmLoading ? t('adding') : t('addFarm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
