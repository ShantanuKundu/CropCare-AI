import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import './DetailView.css';

function severityClass(severity = '') {
  const s = severity.toLowerCase();
  if (s === 'high') return 'sev-high';
  if (s === 'medium') return 'sev-medium';
  return 'sev-low';
}

const PredictionDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const prediction = location.state?.prediction;

  if (!prediction) {
    return (
      <div className="page-container">
        <div className="error-container">
          <AlertCircle size={60} />
          <h2>Prediction Not Found</h2>
          <p>The requested prediction details could not be loaded.</p>
          <button className="btn-primary" onClick={() => navigate('/history')}>
            {t('backToHistory')}
          </button>
        </div>
      </div>
    );
  }

  const confidencePct = (prediction.confidence * 100).toFixed(1);
  const isHealthy = prediction.disease?.toLowerCase().includes('healthy');

  return (
    <div className="page-container">
      <button className="back-button" onClick={() => navigate('/history')}>
        <ArrowLeft size={20} />
        {t('backToHistory')}
      </button>

      <div className="detail-container">
        <div className="detail-header">
          <div className={`status-badge ${isHealthy ? 'healthy' : 'diseased'}`}>
            {isHealthy ? '✓ Healthy' : '⚠ Disease Detected'}
          </div>
          <h1>{prediction.disease || 'Unknown Disease'}</h1>
          <p className="detail-subtitle">Disease Detection Analysis</p>
        </div>

        {/* Leaf Image (Cloudinary image_url) */}
        {prediction.image_url && (
          <div className="detail-leaf-image-wrapper">
            <img
              src={prediction.image_url}
              alt={`Leaf - ${prediction.disease}`}
              className="detail-leaf-image"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        <div className="detail-grid">
          {/* ── Main Info Card ─────────────────────────── */}
          <div className="info-card main-card">
            <h3>{t('detectionDetails')}</h3>

            <div className="info-section">
              <div className="info-row">
                <div className="info-item">
                  <Calendar className="info-icon" size={20} />
                  <div className="info-content">
                    <span className="info-label">{t('dateTime')}</span>
                    <span className="info-value">
                      {prediction.date
                        ? new Date(prediction.date).toLocaleString('en-IN', {
                            dateStyle: 'full',
                            timeStyle: 'short',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence circle */}
              <div className="confidence-section">
                <div className="confidence-header">
                  <TrendingUp size={20} />
                  <span>{t('confidenceLevel')}</span>
                </div>
                <div className="confidence-display">
                  <div className="confidence-circle">
                    <svg viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        style={{
                          strokeDasharray: `${2 * Math.PI * 45}`,
                          strokeDashoffset: `${2 * Math.PI * 45 * (1 - prediction.confidence)}`,
                        }}
                      />
                    </svg>
                    <div className="confidence-text">
                      <span className="confidence-number">{confidencePct}%</span>
                      {prediction.severity && (
                        <span className={`confidence-severity ${severityClass(prediction.severity)}`}>
                          {prediction.severity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Disease Analysis Card ───────────────────── */}
          <div className="info-card">
            <h3>{t('analysisSummary')}</h3>
            <div className="analysis-content">
              <div className="analysis-item">
                <span className="analysis-label">{t('disease')}:</span>
                <span className="analysis-value">{prediction.disease || 'N/A'}</span>
              </div>
              {prediction.severity && (
                <div className="analysis-item">
                  <span className="analysis-label">{t('severity')}:</span>
                  <span className={`analysis-value sev-text ${severityClass(prediction.severity)}`}>
                    {prediction.severity}
                  </span>
                </div>
              )}
              <div className="analysis-item">
                <span className="analysis-label">{t('status')}:</span>
                <span className={`status-text ${isHealthy ? 'healthy' : 'warning'}`}>
                  {isHealthy ? t('noActionRequired') : t('treatmentRecommended')}
                </span>
              </div>
              <div className="analysis-item">
                <span className="analysis-label">{t('detectionId')}:</span>
                <span className="analysis-value">#{prediction.id}</span>
              </div>
            </div>
          </div>

          {/* ── Cause, Symptoms, Treatment ─────────────── */}
          {(prediction.cause || prediction.symptoms || prediction.treatment) && (
            <div className="info-card full-width-card">
              <h3>{t('diagnosisDetail')}</h3>
              <div className="diagnosis-grid">
                {prediction.cause && (
                  <div className="diagnosis-item">
                    <div className="diag-label">🦠 {t('cause')}</div>
                    <p>{prediction.cause}</p>
                  </div>
                )}
                {prediction.symptoms && (
                  <div className="diagnosis-item">
                    <div className="diag-label">🔍 {t('symptoms')}</div>
                    <p>{prediction.symptoms}</p>
                  </div>
                )}
                {prediction.treatment && (
                  <div className="diagnosis-item diagnosis-full">
                    <div className="diag-label">💊 {t('treatment')}</div>
                    <p>{prediction.treatment}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button className="btn-outline" onClick={() => navigate('/history')}>
              {t('backToHistory')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionDetail;
