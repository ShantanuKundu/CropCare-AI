import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Droplets, AlertCircle } from 'lucide-react';
import './DetailView.css';

const SoilDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const soil = location.state?.soil;

  if (!soil) {
    return (
      <div className="page-container">
        <div className="error-container">
          <AlertCircle size={60} />
          <h2>Soil Analysis Not Found</h2>
          <p>The requested soil analysis details could not be loaded.</p>
          <button className="btn-primary" onClick={() => navigate('/history')}>
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const nutrients = [
    { name: 'Nitrogen (N)', value: soil.Nitrogen, unit: 'kg/ha', optimal: '40-60', status: getNutrientStatus(soil.Nitrogen, 40, 60) },
    { name: 'Phosphorus (P)', value: soil.Phosphorus, unit: 'kg/ha', optimal: '30-50', status: getNutrientStatus(soil.Phosphorus, 30, 50) },
    { name: 'Potassium (K)', value: soil.Potassium, unit: 'kg/ha', optimal: '35-55', status: getNutrientStatus(soil.Potassium, 35, 55) },
    { name: 'pH Level', value: soil.pH, unit: '', optimal: '6.0-7.5', status: getNutrientStatus(soil.pH, 6.0, 7.5) }
  ];

  function getNutrientStatus(value, min, max) {
    if (!value) return 'unknown';
    const num = parseFloat(value);
    if (num < min) return 'low';
    if (num > max) return 'high';
    return 'optimal';
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'optimal': return '#10b981';
      case 'low': return '#f59e0b';
      case 'high': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'optimal': return 'Optimal';
      case 'low': return 'Below Optimal';
      case 'high': return 'Above Optimal';
      default: return 'Unknown';
    }
  };

  return (
    <div className="page-container">
      <button className="back-button" onClick={() => navigate('/history')}>
        <ArrowLeft size={20} />
        Back to History
      </button>

      <div className="detail-container">
        <div className="detail-header">
          <div className="status-badge soil">
            <Droplets size={18} />
            Soil Analysis
          </div>
          <h1>Soil Health Report</h1>
          <p className="detail-subtitle">Comprehensive Nutrient Analysis</p>
        </div>

        <div className="detail-grid">
          {/* Analysis Info Card */}
          <div className="info-card main-card">
            <h3>Analysis Details</h3>
            
            <div className="info-section">
              <div className="info-item">
                <Calendar className="info-icon" size={20} />
                <div className="info-content">
                  <span className="info-label">Analysis Date</span>
                  <span className="info-value">
                    {new Date(soil.timestamp).toLocaleString('en-US', {
                      dateStyle: 'full',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">🔬</span>
                <div className="info-content">
                  <span className="info-label">Report ID</span>
                  <span className="info-value">#{soil.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nutrients Overview */}
          <div className="info-card nutrients-card">
            <h3>Nutrient Levels</h3>
            <div className="nutrients-grid">
              {nutrients.map((nutrient, index) => (
                <div key={index} className="nutrient-item">
                  <div className="nutrient-header">
                    <span className="nutrient-name">{nutrient.name}</span>
                    <span 
                      className="nutrient-status"
                      style={{ color: getStatusColor(nutrient.status) }}
                    >
                      {getStatusText(nutrient.status)}
                    </span>
                  </div>
                  <div className="nutrient-value-row">
                    <span className="nutrient-value">
                      {nutrient.value || 'N/A'} {nutrient.unit}
                    </span>
                    <span className="nutrient-optimal">
                      Optimal: {nutrient.optimal}
                    </span>
                  </div>
                  <div className="nutrient-bar">
                    <div 
                      className="nutrient-fill"
                      style={{ 
                        width: nutrient.value ? '100%' : '0%',
                        background: getStatusColor(nutrient.status)
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SoilDetail;
