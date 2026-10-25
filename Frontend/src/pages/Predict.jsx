import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { predictionService } from '../services/predictionService';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';
import './Predict.css';

// Severity → colour class
function severityClass(severity = '') {
  const s = severity.toLowerCase();
  if (s === 'high') return 'sev-high';
  if (s === 'medium') return 'sev-medium';
  return 'sev-low';
}

const SAMPLE_LEAF_EXAMPLES = [
  {
    key: 'tomato',
    crop: 'Tomato',
    disease: 'Early Blight',
    filename: 'tomato_early_blight.jpg',
    path: '/sample-leaves/tomato_early_blight.jpg',
    badge: 'Fungal Infection',
    icon: '🍅',
    desc: 'Dark brown concentric target spots with yellow halo',
  },
  {
    key: 'potato',
    crop: 'Potato',
    disease: 'Late Blight',
    filename: 'potato_late_blight.jpg',
    path: '/sample-leaves/potato_late_blight.jpg',
    badge: 'Oomycete Lesion',
    icon: '🥔',
    desc: 'Water-soaked necrotic patches with pale borders',
  },
  {
    key: 'corn',
    crop: 'Corn (Maize)',
    disease: 'Common Rust',
    filename: 'corn_common_rust.jpg',
    path: '/sample-leaves/corn_common_rust.jpg',
    badge: 'Fungal Pustules',
    icon: '🌽',
    desc: 'Cinnamon brown powdery rust spots on leaf surface',
  },
  {
    key: 'pepper',
    crop: 'Bell Pepper',
    disease: 'Healthy Leaf',
    filename: 'pepper_healthy.jpg',
    path: '/sample-leaves/pepper_healthy.jpg',
    badge: 'Healthy Plant',
    icon: '🫑',
    desc: 'Vibrant green glossy foliage without lesions',
  },
];

const Predict = () => {
  const { t } = useLanguage();
  const { speak } = useVoiceAssistant();
  const [searchParams] = useSearchParams();

  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeExample, setActiveExample] = useState(null);
  const fileInputRef = useRef(null);

  // Load a sample leaf example into the form state
  const loadExample = useCallback(async (exampleKey) => {
    const example = SAMPLE_LEAF_EXAMPLES.find(
      (ex) => ex.key.toLowerCase() === exampleKey.toLowerCase()
    );
    if (!example) return;

    setActiveExample(example.key);
    setError('');
    setResult(null);

    try {
      const res = await fetch(example.path);
      const blob = await res.blob();
      const file = new File([blob], example.filename, { type: 'image/jpeg' });
      setSelectedFile(file);
      setPreview(example.path);
    } catch (err) {
      console.error('[Predict] Failed to load sample image:', err);
    }
  }, []);

  // Listen to URL search parameter `?example=tomato` from Voice Assistant or links
  useEffect(() => {
    const exampleParam = searchParams.get('example');
    if (exampleParam) {
      loadExample(exampleParam);
    }
  }, [searchParams, loadExample]);

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
      setActiveExample(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError(t('pleaseSelectImage'));
      return;
    }
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
        speak(
          `${data.disease}. ${t('confidence')}: ${conf}.${
            data.severity ? ` ${t('severity')}: ${data.severity}.` : ''
          }`
        );
      }

      // Cache full result in sessionStorage
      try {
        const cache = JSON.parse(sessionStorage.getItem('predictionDetailsCache') || '{}');
        cache[data.prediction_id] = {
          severity: data.severity,
          cause: data.cause,
          symptoms: data.symptoms,
          treatment: data.treatment,
        };
        sessionStorage.setItem('predictionDetailsCache', JSON.stringify(cache));
      } catch (_) {}
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
    setActiveExample(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isHealthy = result?.disease?.toLowerCase().includes('healthy');

  return (
    <div className="page-container">
      <div className="predict-header-row">
        <div>
          <h1>{t('diseaseDetectionTitle')}</h1>
          <p className="page-subtitle">{t('diseaseDetectionSubtitle')}</p>
        </div>
      </div>

      {/* ── Interactive Examples Showcase ── */}
      <div className="sample-examples-card">
        <div className="sample-examples-header">
          <div className="sample-title-group">
            <Sparkles size={18} className="sample-sparkle-icon" />
            <h3>{t('trySampleExamples') || 'Try with Sample Leaves'}</h3>
          </div>
          <span className="sample-hint">
            {t('sampleExampleHint') || 'Click an example leaf to test disease detection instantly'}
          </span>
        </div>

        <div className="sample-grid">
          {SAMPLE_LEAF_EXAMPLES.map((ex) => {
            const isSelected = activeExample === ex.key;
            return (
              <div
                key={ex.key}
                className={`sample-item-card ${isSelected ? 'sample-item-active' : ''}`}
                onClick={() => loadExample(ex.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadExample(ex.key);
                }}
              >
                <div className="sample-thumb-wrapper">
                  <img src={ex.path} alt={ex.crop} className="sample-thumb" />
                  {isSelected && (
                    <div className="sample-active-badge">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
                <div className="sample-meta">
                  <div className="sample-crop-name">
                    <span className="sample-icon">{ex.icon}</span>
                    <strong>{ex.crop}</strong>
                  </div>
                  <div className="sample-disease-label">{ex.disease}</div>
                  <span className={`sample-badge sample-badge-${ex.key}`}>{ex.badge}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                  <div className="preview-container">
                    <img src={preview} alt="Preview" className="image-preview" />
                    {activeExample && (
                      <div className="active-example-indicator">
                        ✨ Example: {SAMPLE_LEAF_EXAMPLES.find((e) => e.key === activeExample)?.crop} -{' '}
                        {SAMPLE_LEAF_EXAMPLES.find((e) => e.key === activeExample)?.disease}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <p>{t('clickToUpload')}</p>
                    <span className="upload-hint">{t('jpgPngSupported')}</span>
                    <span
                      className="upload-hint"
                      style={{ color: 'rgba(16,185,129,0.85)', marginTop: '0.25rem' }}
                    >
                      Please upload a clear crop leaf image or pick an example above.
                    </span>
                  </div>
                )}
              </label>
            </div>

            {selectedFile && <div className="file-name">{selectedFile.name}</div>}

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="btn-primary"
              disabled={!selectedFile || loading}
              id="analyze-btn"
            >
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  {t('analyzing')}
                </>
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

            {/* Leaf image preview */}
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

            {isHealthy && <div className="healthy-msg">{t('healthyMessage')}</div>}

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
