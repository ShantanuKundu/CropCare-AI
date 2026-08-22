import { useState } from 'react';
import { soilService } from '../services/soilService';
import './Predict.css';

const SoilHealth = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await soilService.extractSoilData(selectedFile);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'OCR extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <h1>Soil Health Analysis</h1>
      <p className="page-subtitle">Upload soil health certificate for OCR extraction</p>

      <div className="content-grid">
        <div className="upload-section">
          <form onSubmit={handleSubmit}>
            <div className="upload-zone">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                id="file-upload"
                className="file-input"
              />
              <label htmlFor="file-upload" className="file-label">
                {preview ? (
                  <img src={preview} alt="Preview" className="image-preview" />
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📄</span>
                    <p>Click to upload certificate</p>
                  </div>
                )}
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="btn-primary" disabled={!selectedFile || loading}>
              {loading ? 'Extracting...' : 'Extract Data'}
            </button>
          </form>
        </div>

        {result && (
          <div className="result-section">
            <h2>Extracted Soil Data</h2>
            
            <div className="soil-grid">
              <div className="soil-item">
                <span className="soil-icon">⚗️</span>
                <div>
                  <div className="label">pH Level</div>
                  <div className="value">{result.pH || 'N/A'}</div>
                </div>
              </div>

              <div className="soil-item">
                <span className="soil-icon">🌱</span>
                <div>
                  <div className="label">Nitrogen (N)</div>
                  <div className="value">{result.Nitrogen || 'N/A'}</div>
                </div>
              </div>

              <div className="soil-item">
                <span className="soil-icon">💧</span>
                <div>
                  <div className="label">Phosphorus (P)</div>
                  <div className="value">{result.Phosphorus || 'N/A'}</div>
                </div>
              </div>

              <div className="soil-item">
                <span className="soil-icon">⚡</span>
                <div>
                  <div className="label">Potassium (K)</div>
                  <div className="value">{result.Potassium || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoilHealth;
