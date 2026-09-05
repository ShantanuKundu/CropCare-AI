import { useState, useRef, useEffect } from 'react';
import { predictionService } from '../services/predictionService';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { RefreshCw } from 'lucide-react';
import './Predict.css';

// Severity → colour class
function severityClass(severity = '') {
  const s = severity.toLowerCase();
  if (s === 'high') return 'sev-high';
  if (s === 'medium') return 'sev-medium';
  return 'sev-low';
}

const Predict = () => {
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Strict image-only validation
      if (!file.type.startsWith('image/')) {
        setError('Only image files are accepted (JPG, PNG, WEBP, etc.).');
        setSelectedFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) { setError(t('pleaseSelectImage')); return; }
    setLoading(true);
    setError('');
    try {
      const data = await predictionService.predictDisease(selectedFile);
      setResult(data);
      // ── Step 10a: Auto-speak result ──
      const isHealthyResult = data?.disease?.toLowerCase().includes('healthy');
      const conf = data?.confidence ? `${(data.confidence * 100).toFixed(0)}%` : '';
      if (isHealthyResult) {
        speak(t('healthyMessage'));
      } else if (data?.disease) {
        speak(`${data.disease}. ${t('confidence')}: ${conf}.${data.severity ? ` ${t('severity')}: ${data.severity}.` : ''}`);
      }
      // Cache full result (severity/cause/symptoms/treatment) in sessionStorage
      try {
        const cache = JSON.parse(sessionStorage.getItem('predictionDetailsCache') || '{}');
        cache[data.prediction_id] = {
          severity: data.severity,
          cause: data.cause,
          symptoms: data.symptoms,
          treatment: data.treatment,
        };
        sessionStorage.setItem('predictionDetailsCache', JSON.stringify(cache));
      } catch (_) { /* sessionStorage not critical */ }
    } catch (err) {
      setError(err.response?.data?.detail || t('predictionFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAnother = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isHealthy = result?.disease?.toLowerCase().includes('healthy');

  return (
    <div className="page-container">
      <h1>{t('diseaseDetectionTitle')}</h1>
      <p className="page-subtitle">{t('diseaseDetectionSubtitle')}</p>

      <div className="content-grid">
        {/* Upload Section */}
        <div className="upload-section">
          <form onSubmit={handleSubmit}>
            <div className="upload-zone">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                id="file-upload"
                className="file-input"
                ref={fileInputRef}
              />
              <label htmlFor="file-upload" className="file-label">
                {preview ? (
                  <img src={preview} alt="Preview" className="image-preview" />
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <p>{t('clickToUpload')}</p>
                    <span className="upload-hint">{t('jpgPngSupported')}</span>
                    <span className="upload-hint" style={{ color: 'rgba(16,185,129,0.85)', marginTop: '0.25rem' }}>
                      Please upload a clear crop leaf image.
                    </span>
                  </div>
                )}
              </label>
            </div>

            {selectedFile && (
              <div className="file-name">{selectedFile.name}</div>
            )}

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="btn-primary"
              disabled={!selectedFile || loading}
              id="analyze-btn"
            >
              {loading ? (
                <><span className="btn-spinner" />{t('analyzing')}</>
              ) : (
                t('analyzeImage')
              )}
            </button>
          </form>
        </div>

        {/* Result Section */}
        {result && (
          <div className="result-section">
            <h2>{t('diagnosisResult')}</h2>

            {/* Leaf image preview from Cloudinary (image_url) */}
            {result.image_url && (
              <div className="result-image-wrapper">
                <img src={result.image_url} alt="Analyzed leaf" className="result-leaf-img" />
              </div>
            )}

            {/* Disease + Confidence header */}
            <div className={`disease-banner ${isHealthy ? 'banner-healthy' : 'banner-disease'}`}>
              <div className="disease-icon">{isHealthy ? '✅' : '⚠️'}</div>
              <div className="disease-info">
                <div className="disease-name">{result.disease}</div>
                <div className="disease-conf">
                  {t('confidence')}: <strong>{(result.confidence * 100).toFixed(2)}%</strong>
                </div>
              </div>
              {result.severity && (
                <span className={`severity-badge ${severityClass(result.severity)}`}>
                  {result.severity} {t('severity')}
                </span>
              )}
            </div>

            {/* Confidence bar */}
            <div className="conf-bar-wrapper">
              <div className="conf-bar-track">
                <div
                  className="conf-bar-fill"
                  style={{ width: `${(result.confidence * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="conf-bar-pct">{(result.confidence * 100).toFixed(1)}%</span>
            </div>

            {/* Detail rows */}
            {!isHealthy && (
              <div className="detail-grid">
                {result.cause && (
                  <div className="detail-card">
                    <div className="detail-label">🦠 {t('cause')}</div>
                    <div className="detail-text">{result.cause}</div>
                  </div>
                )}
                {result.symptoms && (
                  <div className="detail-card">
                    <div className="detail-label">🔍 {t('symptoms')}</div>
                    <div className="detail-text">{result.symptoms}</div>
                  </div>
                )}
                {result.treatment && (
                  <div className="detail-card detail-card-full">
                    <div className="detail-label">💊 {t('treatment')}</div>
                    <div className="detail-text">{result.treatment}</div>
                  </div>
                )}
              </div>
            )}

            {isHealthy && (
              <div className="healthy-msg">{t('healthyMessage')}</div>
            )}

            {/* Action buttons */}
            <div className="result-actions">
              <button
                className="predict-upload-another-btn predict-upload-another-full"
                onClick={handleUploadAnother}
                id="upload-another-btn"
              >
                <RefreshCw size={15} />
                {t('uploadAnotherImage')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Predict;
