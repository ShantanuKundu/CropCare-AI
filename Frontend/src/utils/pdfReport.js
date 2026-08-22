import jsPDF from 'jspdf';
import { getTForPDF } from '../context/LanguageContext';

// â”€â”€ In-memory font cache (avoids re-fetching on same page session) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FONT_CACHE = {};

async function fetchFontBase64(publicPath) {
  if (FONT_CACHE[publicPath]) return FONT_CACHE[publicPath];

  const cacheKey = `cropcare_font_${publicPath.replace(/\//g, '_')}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { FONT_CACHE[publicPath] = cached; return cached; }
  } catch (_) {}

  const response = await fetch(publicPath);
  const buffer   = await response.arrayBuffer();
  const bytes    = new Uint8Array(buffer);

  // Chunk-based btoa to avoid call-stack overflow on large files
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);

  FONT_CACHE[publicPath] = base64;
  try { sessionStorage.setItem(cacheKey, base64); } catch (_) {}
  return base64;
}

// â”€â”€ Register native fonts and return the jsPDF font family name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function setupScriptFont(doc, lang) {
  try {
    if (lang === 'hi' || lang === 'mr') {
      const [reg, bold] = await Promise.all([
        fetchFontBase64('/fonts/NotoSansDevanagari-Regular.ttf'),
        fetchFontBase64('/fonts/NotoSansDevanagari-Bold.ttf'),
      ]);
      doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', reg);
      doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoDevanagari', 'normal');
      doc.addFileToVFS('NotoSansDevanagari-Bold.ttf', bold);
      doc.addFont('NotoSansDevanagari-Bold.ttf', 'NotoDevanagari', 'bold');
      return 'NotoDevanagari';
    }
    if (lang === 'bn') {
      const [reg, bold] = await Promise.all([
        fetchFontBase64('/fonts/NotoSansBengali-Regular.ttf'),
        fetchFontBase64('/fonts/NotoSansBengali-Bold.ttf'),
      ]);
      doc.addFileToVFS('NotoSansBengali-Regular.ttf', reg);
      doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
      doc.addFileToVFS('NotoSansBengali-Bold.ttf', bold);
      doc.addFont('NotoSansBengali-Bold.ttf', 'NotoSansBengali', 'bold');
      return 'NotoSansBengali';
    }
  } catch (err) {
    console.warn('[pdfReport] Native font load failed, falling back to helvetica:', err);
  }
  return 'helvetica'; // English fallback â€” no extra font needed
}

// â”€â”€ Convert Arabic digits â†’ native script digits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toNativeNumeral(num, lang) {
  const deva = ['à¥¦','à¥§','à¥¨','à¥©','à¥ª','à¥«','à¥¬','à¥­','à¥®','à¥¯'];
  const beng = ['à§¦','à§§','à§¨','à§©','à§ª','à§«','à§¬','à§­','à§®','à§¯'];
  const map  = (lang === 'hi' || lang === 'mr') ? deva : lang === 'bn' ? beng : null;
  if (!map) return String(num);
  return String(num).replace(/\d/g, d => map[parseInt(d)]);
}

// â”€â”€ Translate severity (backend returns English "High"/"Medium"/"Low") â”€â”€â”€â”€â”€â”€â”€
function translateSeverity(severity, t) {
  const map = { High: t('pdf_severityHigh'), Medium: t('pdf_severityMedium'), Low: t('pdf_severityLow') };
  return map[severity] ?? severity ?? 'N/A';
}

// â”€â”€ Clean disease name from model format (snake_case / double__underscore) â”€â”€
function formatDiseaseName(name) {
  if (!name) return 'N/A';
  return name.replace(/__/g, ' - ').replace(/_/g, ' ');
}

// â”€â”€ Layout Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function addHeader(doc, title, sf) {
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 18, 'F');

  // Brand name â€” always Latin/Helvetica
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('CropCareAI', 14, 12);

  // Report title â€” in native script font
  doc.setFontSize(10);
  doc.setFont(sf, 'normal');
  doc.text(title, 196, 12, { align: 'right' });

  return 26;
}

function addSectionTitle(doc, text, y, sf) {
  doc.setFillColor(240, 255, 248);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');
  doc.setTextColor(10, 100, 60);
  doc.setFontSize(10);
  doc.setFont(sf, 'bold');
  doc.text(text, 18, y + 5.5);
  return y + 14;
}

/**
 * Renders a labelâ€“value row.
 * - label uses the native script font (sf)
 * - value uses helvetica (English/numeric), or sf if valueSf is passed
 */
function addRow(doc, label, value, y, shade, sf, valueSf = 'helvetica') {
  if (shade) {
    doc.setFillColor(248, 252, 250);
    doc.rect(14, y - 4, 182, 8, 'F');
  }
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont(sf, 'bold');
  doc.text(label, 18, y);
  doc.setFont(valueSf, 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(String(value ?? 'N/A'), 80, y);
  return y + 9;
}

/** Multi-line text field (Cause / Symptoms / Treatment). Label in sf, value in valueSf (defaults to helvetica for English backend data). */
function addMultiField(doc, label, value, y, shade, sf, valueSf = 'helvetica') {
  if (!value) return y;
  y = checkPage(doc, y);
  if (shade) {
    doc.setFillColor(248, 252, 250);
    doc.rect(14, y - 4, 182, 8, 'F');
  }
  doc.setFont(sf, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`${label}:`, 18, y);
  // Set the value font BEFORE splitTextToSize so width calculation matches rendering font
  doc.setFont(valueSf, 'normal');
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(String(value), 115);
  doc.text(lines, 80, y);
  return y + lines.length * 5 + 3;
}

function addDivider(doc, y) {
  doc.setDrawColor(200, 230, 210);
  doc.line(14, y, 196, y);
  return y + 5;
}

function checkPage(doc, y, margin = 270) {
  if (y > margin) { doc.addPage(); return 20; }
  return y;
}

/**
 * Renders a footer line with mixed fonts:
 *   [scriptFont] footerLabel  |  [scriptFont] pageLabel nativePageNum [scriptFont] ofLabel nativeTotalNum
 * The "|" pipe is rendered in helvetica so it always shows.
 */
function addFooters(doc, pageCount, footerLabel, pageLabel, ofLabel, sf, lang) {
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);

    if (sf === 'helvetica') {
      doc.setFont('helvetica', 'normal');
      doc.text(`${footerLabel}  |  ${pageLabel} ${p} ${ofLabel} ${pageCount}`, 14, 290);
    } else {
      // Footer text in native font
      doc.setFont(sf, 'normal');
      const part1 = `${footerLabel}  `;
      const w1 = doc.getTextWidth(part1);
      doc.text(part1, 14, 290);

      // Pipe separator in helvetica (always in charset)
      doc.setFont('helvetica', 'normal');
      const part2 = '|  ';
      const w2 = doc.getTextWidth(part2);
      doc.text(part2, 14 + w1, 290);

      // Page info in native script, with native numerals
      doc.setFont(sf, 'normal');
      const pageNum  = toNativeNumeral(p, lang);
      const totalNum = toNativeNumeral(pageCount, lang);
      doc.text(`${pageLabel} ${pageNum} ${ofLabel} ${totalNum}`, 14 + w1 + w2, 290);
    }
  }
}

/** Record heading: native label word, then "#N â€” date" in helvetica. */
function addRecordHeading(doc, recordLabel, index, dateStr, y, sf, lang) {
  doc.setFillColor(230, 248, 240);
  doc.roundedRect(14, y - 3, 182, 7, 1, 1, 'F');
  doc.setTextColor(16, 100, 60);
  doc.setFontSize(9.5);

  if (sf === 'helvetica') {
    doc.setFont('helvetica', 'bold');
    doc.text(`${recordLabel} #${index + 1}  â€”  ${dateStr}`, 18, y + 1.5);
  } else {
    // recordLabel in native, number and date in helvetica
    doc.setFont(sf, 'bold');
    const word = `${recordLabel} `;
    const wordW = doc.getTextWidth(word);
    doc.text(word, 18, y + 1.5);

    doc.setFont('helvetica', 'bold');
    const num = toNativeNumeral(index + 1, lang);
    // Render native numeral via script font, then date in helvetica
    doc.setFont(sf, 'bold');
    const numStr = `#${num}  `;
    const numW = doc.getTextWidth(numStr);
    doc.text(numStr, 18 + wordW, y + 1.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`â€”  ${dateStr}`, 18 + wordW + numW, y + 1.5);
  }
  return y + 10;
}

// â”€â”€ Helper: fetch image as base64 dataURL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchImageAsDataURL(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Disease Detection Report
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export async function downloadDiseaseReport({ user, predictions }) {
  const t    = getTForPDF();
  const lang = localStorage.getItem('cropcare_language') || 'en';
  const doc  = new jsPDF();
  const now  = new Date();

  const sf = await setupScriptFont(doc, lang);

  let y = addHeader(doc, t('pdf_diseaseReportTitle'), sf);

  // â”€â”€ Section 1: Farmer Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_farmerInfo'), y, sf);
  y = addRow(doc, t('pdf_farmerName'),  user?.name  || 'N/A', y, true,  sf);
  y = addRow(doc, t('pdf_email'),       user?.email || 'N/A', y, false, sf);
  y = addRow(doc, t('pdf_dateAndTime'), now.toLocaleString('en-IN'), y, true, sf);
  y = addDivider(doc, y);

  // â”€â”€ Section 2: Disease Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_diseaseRecords'), y, sf);

  if (!predictions || predictions.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont(sf, 'normal');
    doc.text(t('pdf_noDisease'), 18, y);
    y += 10;
  } else {
    for (let i = 0; i < predictions.length; i++) {
      const pred    = predictions[i];
      const dateStr = pred.date ? new Date(pred.date).toLocaleDateString('en-IN') : '';

      y = checkPage(doc, y);
      y = addRecordHeading(doc, t('pdf_record'), i, dateStr, y, sf, lang);

      y = addRow(doc, t('pdf_disease'),    formatDiseaseName(pred.disease), y, false, sf);
      y = addRow(
        doc, t('pdf_confidence'),
        pred.confidence != null ? `${(pred.confidence * 100).toFixed(2)}%` : 'N/A',
        y, true, sf
      );

      // Severity: translated value â€” use native font for both label and value
      const severityVal = translateSeverity(pred.severity, t);
      y = addRow(doc, t('pdf_severity'), severityVal, y, false, sf, sf);

      y = addMultiField(doc, t('pdf_cause'),     pred.cause,     y, true,  sf);
      y = addMultiField(doc, t('pdf_symptoms'),  pred.symptoms,  y, false, sf);
      y = addMultiField(doc, t('pdf_treatment'), pred.treatment, y, true,  sf);

      // Leaf image
      if (pred.image_url) {
        y = checkPage(doc, y, 200);
        const imgData = await fetchImageAsDataURL(pred.image_url);
        if (imgData) {
          try {
            doc.setFont(sf, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(t('pdf_leafImage'), 18, y);
            y += 4;
            doc.addImage(imgData, 'JPEG', 18, y, 80, 60);
            y += 66;
          } catch (_) { /* skip unsupported image formats */ }
        }
      }

      y = addDivider(doc, y);
    }
  }

  addFooters(doc, doc.getNumberOfPages(), t('pdf_footerDisease'), t('pdf_page'), t('pdf_of'), sf, lang);
  doc.save(`CropCareAI_Disease_Report_${now.toISOString().slice(0, 10)}.pdf`);
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Soil Analysis Report
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export async function downloadSoilReport({ user, soilData, cropRecHistory = [] }) {
  const t    = getTForPDF();
  const lang = localStorage.getItem('cropcare_language') || 'en';
  const doc  = new jsPDF();
  const now  = new Date();

  const sf = await setupScriptFont(doc, lang);

  let y = addHeader(doc, t('pdf_soilReportTitle'), sf);

  // â”€â”€ Section 1: Farmer Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_farmerInfo'), y, sf);
  y = addRow(doc, t('pdf_farmerName'), user?.name  || 'N/A', y, true,  sf);
  y = addRow(doc, t('pdf_email'),      user?.email || 'N/A', y, false, sf);
  y = addRow(doc, t('pdf_reportDate'), now.toLocaleString('en-IN'), y, true, sf);
  y = addDivider(doc, y);

  // â”€â”€ Section 2: Soil Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_soilRecords'), y, sf);

  if (!soilData || soilData.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont(sf, 'normal');
    doc.text(t('pdf_noSoil'), 18, y);
    y += 10;
  } else {
    for (let i = 0; i < soilData.length; i++) {
      const item    = soilData[i];
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-IN') : '';

      y = checkPage(doc, y);
      y = addRecordHeading(doc, t('pdf_record'), i, dateStr, y, sf, lang);

      y = addRow(doc, t('pdf_pHLevel'),    item.pH        || 'N/A',                          y, true,  sf);
      y = addRow(doc, t('pdf_nitrogen'),   item.Nitrogen  ? `${item.Nitrogen} kg/ha`  : 'N/A', y, false, sf);
      y = addRow(doc, t('pdf_phosphorus'), item.Phosphorus ? `${item.Phosphorus} kg/ha` : 'N/A', y, true,  sf);
      y = addRow(doc, t('pdf_potassium'),  item.Potassium  ? `${item.Potassium} kg/ha`  : 'N/A', y, false, sf);

      y = addDivider(doc, y);
    }
  }

  // â”€â”€ Section 3: Crop Recommendation Records (from sessionStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (cropRecHistory && cropRecHistory.length > 0) {
    y = checkPage(doc, y);
    y = addSectionTitle(doc, t('pdf_cropRecRecords'), y, sf);

    for (let i = 0; i < cropRecHistory.length; i++) {
      const entry   = cropRecHistory[i];
      const dateStr = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-IN') : '';

      y = checkPage(doc, y);
      y = addRecordHeading(doc, t('pdf_record'), i, dateStr, y, sf, lang);

      // Farm name
      if (entry.farmName) {
        y = addRow(doc, 'Farm', entry.farmName, y, true, sf);
      }

      // SHC Soil data
      y = addRow(doc, t('pdf_pHLevel'),    entry.soilData?.pH         || 'N/A',                                        y, false, sf);
      y = addRow(doc, t('pdf_nitrogen'),   entry.soilData?.Nitrogen   ? `${entry.soilData.Nitrogen} kg/ha`   : 'N/A',  y, true,  sf);
      y = addRow(doc, t('pdf_phosphorus'), entry.soilData?.Phosphorus ? `${entry.soilData.Phosphorus} kg/ha` : 'N/A',  y, false, sf);
      y = addRow(doc, t('pdf_potassium'),  entry.soilData?.Potassium  ? `${entry.soilData.Potassium} kg/ha`  : 'N/A',  y, true,  sf);

      // Season + Predicted Weather
      y = addRow(doc, t('pdf_season'),      entry.season ?? 'N/A',  y, false, sf);
      const w = entry.weather || {};
      y = addRow(doc, t('pdf_temperature'), w.temperature != null ? `${Number(w.temperature).toFixed(1)} Â°C` : 'N/A', y, true,  sf);
      y = addRow(doc, t('pdf_humidity'),    w.humidity    != null ? `${Number(w.humidity).toFixed(1)} %`    : 'N/A', y, false, sf);
      y = addRow(doc, t('pdf_rainfall'),    w.rainfall    != null ? `${Number(w.rainfall).toFixed(1)} mm`   : 'N/A', y, true,  sf);

      // Top 3 crops
      const recs = Array.isArray(entry.recommendations) ? entry.recommendations : [];
      recs.forEach((rec, ri) => {
        y = checkPage(doc, y);
        doc.setFillColor(230, 248, 240);
        doc.roundedRect(14, y - 3, 182, 7, 1, 1, 'F');
        doc.setTextColor(16, 100, 60);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${ri + 1}  ${rec.crop || 'Unknown'}`, 18, y + 1.5);
        y += 10;
        y = addRow(doc, t('pdf_confidence'),      rec.confidence     != null ? `${Number(rec.confidence).toFixed(1)}%`   : 'N/A', y, false, sf);
        y = addRow(doc, t('pdf_confidenceLevel'), rec.confidence_level || 'N/A', y, true, sf);
        y = addMultiField(doc, t('pdf_reason'), rec.reason, y, false, sf);
      });

      y = addDivider(doc, y);
    }
  }

  addFooters(doc, doc.getNumberOfPages(), t('pdf_footerSoil'), t('pdf_page'), t('pdf_of'), sf, lang);
  doc.save(`CropCareAI_Soil_Report_${now.toISOString().slice(0, 10)}.pdf`);
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Crop Recommendation Report  (all entries from sessionStorage)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export async function downloadCropReport({ user, cropRecHistory = [] }) {
  const t    = getTForPDF();
  const lang = localStorage.getItem('cropcare_language') || 'en';
  const doc  = new jsPDF();
  const now  = new Date();

  const sf = await setupScriptFont(doc, lang);

  let y = addHeader(doc, t('pdf_cropReportTitle'), sf);

  // â”€â”€ Section 1: Farmer Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_farmerInfo'), y, sf);
  y = addRow(doc, t('pdf_farmerName'),  user?.name  || 'N/A', y, true,  sf);
  y = addRow(doc, t('pdf_email'),       user?.email || 'N/A', y, false, sf);
  y = addRow(doc, t('pdf_dateAndTime'), now.toLocaleString('en-IN'), y, true, sf);
  y = addDivider(doc, y);

  // â”€â”€ Section 2: All Crop Recommendation Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_cropRecRecords'), y, sf);

  if (!cropRecHistory || cropRecHistory.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont(sf, 'normal');
    doc.text(t('pdf_noCropRec'), 18, y);
    y += 10;
  } else {
    for (let i = 0; i < cropRecHistory.length; i++) {
      const entry   = cropRecHistory[i];
      const dateStr = entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-IN') : '';

      y = checkPage(doc, y);
      y = addRecordHeading(doc, t('pdf_record'), i, dateStr, y, sf, lang);

      // Farm & City
      if (entry.farmName) {
        y = addRow(doc, 'Farm',  entry.farmName,        y, true,  sf);
      }
      if (entry.city) {
        y = addRow(doc, 'City',  entry.city,            y, false, sf);
      }

      // Soil Data
      y = addRow(doc, t('pdf_pHLevel'),    entry.soilData?.pH         || 'N/A',                                        y, true,  sf);
      y = addRow(doc, t('pdf_nitrogen'),   entry.soilData?.Nitrogen   ? `${entry.soilData.Nitrogen} kg/ha`   : 'N/A',  y, false, sf);
      y = addRow(doc, t('pdf_phosphorus'), entry.soilData?.Phosphorus ? `${entry.soilData.Phosphorus} kg/ha` : 'N/A',  y, true,  sf);
      y = addRow(doc, t('pdf_potassium'),  entry.soilData?.Potassium  ? `${entry.soilData.Potassium} kg/ha`  : 'N/A',  y, false, sf);

      // Season + Predicted Weather
      y = addRow(doc, t('pdf_season'),      entry.season ?? 'N/A',  y, true, sf);
      const w = entry.weather || {};
      y = addRow(doc, t('pdf_temperature'), w.temperature != null ? `${Number(w.temperature).toFixed(1)} Â°C` : 'N/A', y, false, sf);
      y = addRow(doc, t('pdf_humidity'),    w.humidity    != null ? `${Number(w.humidity).toFixed(1)} %`    : 'N/A', y, true,  sf);
      y = addRow(doc, t('pdf_rainfall'),    w.rainfall    != null ? `${Number(w.rainfall).toFixed(1)} mm`   : 'N/A', y, false, sf);

      // Top 3 Recommendations sub-heading
      y = checkPage(doc, y);
      doc.setFontSize(9);
      doc.setFont(sf, 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(t('pdf_topCropsSection'), 18, y + 2);
      y += 10;

      const recs = Array.isArray(entry.recommendations) ? entry.recommendations : [];
      if (recs.length === 0) {
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(9);
        doc.setFont(sf, 'normal');
        doc.text(t('pdf_noRec'), 18, y);
        y += 8;
      } else {
        recs.forEach((rec, ri) => {
          y = checkPage(doc, y);
          doc.setFillColor(230, 248, 240);
          doc.roundedRect(14, y - 3, 182, 7, 1, 1, 'F');
          doc.setTextColor(16, 100, 60);
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.text(`#${ri + 1}  ${rec.crop || 'Unknown'}`, 18, y + 1.5);
          y += 10;
          y = addRow(doc, t('pdf_confidence'),      rec.confidence      != null ? `${Number(rec.confidence).toFixed(1)}%` : 'N/A', y, false, sf);
          y = addRow(doc, t('pdf_confidenceLevel'), rec.confidence_level || 'N/A', y, true, sf);
          y = addMultiField(doc, t('pdf_reason'), rec.reason, y, false, sf);
        });
      }

      y = addDivider(doc, y);
    }
  }

  addFooters(doc, doc.getNumberOfPages(), t('pdf_footerCrop'), t('pdf_page'), t('pdf_of'), sf, lang);
  doc.save(`CropCareAI_Crop_Report_${now.toISOString().slice(0, 10)}.pdf`);
}



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Fertilizer Recommendation Report  (all history entries â€” one combined PDF)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export async function downloadFertilizerReport({ user, fertilizerHistory = [] }) {
  const lang = localStorage.getItem('cropcare_language') || 'en';
  const t    = getTForPDF();          // â† respects selected language
  const doc  = new jsPDF();
  const now  = new Date();

  const sf = await setupScriptFont(doc, lang);

  // â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let y = addHeader(doc, t('pdf_fertilizerReportTitle'), sf);

  // â”€â”€ Farmer Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_farmerInfo'), y, sf);
  y = addRow(doc, t('pdf_farmerName'), user?.name  || 'N/A', y, true,  sf);
  y = addRow(doc, t('pdf_email'),      user?.email || 'N/A', y, false, sf);
  y = addRow(doc, t('pdf_dateAndTime'), now.toLocaleString('en-IN'), y, true, sf);
  y = addDivider(doc, y);

  // â”€â”€ All Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  y = addSectionTitle(doc, t('pdf_fertilizerRecords'), y, sf);

  if (!fertilizerHistory || fertilizerHistory.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont(sf, 'normal');
    doc.text(t('pdf_noFertilizer'), 18, y);
    y += 10;
  } else {
    for (let i = 0; i < fertilizerHistory.length; i++) {
      const rec     = fertilizerHistory[i];
      const dateStr = rec.created_at ? new Date(rec.created_at).toLocaleDateString('en-IN') : '';

      /*
       * /fertilizer-history: { id, crop, farming_type, â€¦, result: {...}, created_at }
       * POST /recommend-fertilizer (flat): { id, crop, farming_type, soil_analysis, summary, â€¦ }
       * Normalise: prefer rec.result, fall back to rec.
       */
      const result = rec.result ?? rec;

      const soil_analysis          = result.soil_analysis;
      const summary                = result.summary;
      const primary_recommendation = result.primary_recommendation;
      const ph_correction          = result.ph_correction;

      y = checkPage(doc, y);
      y = addRecordHeading(doc, t('pdf_record'), i, dateStr, y, sf, lang);

      // Basic meta
      y = addRow(doc, t('pdf_crop'),        rec.crop         || 'N/A', y, false, sf);
      y = addRow(doc, t('pdf_farmingType'), rec.farming_type || 'N/A', y, true,  sf);
      y = addRow(doc, t('pdf_date'),        dateStr          || 'N/A', y, false, sf);

      // â”€â”€ Soil Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (soil_analysis) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(t('pdf_soilAnalysis') + ':', 18, y + 2);
        y += 10;

        const soilFields = [
          { key: 'nitrogen',    label: t('pdf_nitrogen'),    unit: 'kg/ha' },
          { key: 'phosphorous', label: t('pdf_phosphorous'), unit: 'kg/ha' },
          { key: 'potassium',   label: t('pdf_potassium'),   unit: 'kg/ha' },
          { key: 'ph',          label: t('pdf_pHLevel'),     unit: '' },
        ];

        soilFields.forEach((f, fi) => {
          const entry = soil_analysis[f.key];
          if (entry === undefined || entry === null) return;

          const val    = (typeof entry === 'object') ? (entry.value  ?? 'N/A') : entry;
          const status = (typeof entry === 'object') ? (entry.status ?? '')    : '';
          const ideal  = (typeof entry === 'object') ? (entry.ideal_range ?? entry.ideal ?? '') : '';

          const valStr = [
            `${val}${f.unit ? ' ' + f.unit : ''}`,
            status ? `[${status}]` : '',
            ideal  ? `Ideal: ${ideal}` : '',
          ].filter(Boolean).join('  ');

          y = addRow(doc, `  ${f.label}`, valStr, y, fi % 2 === 0, sf);
        });
      }

      // â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (summary) {
        y = checkPage(doc, y);
        y = addMultiField(doc, t('pdf_summary'), summary, y, false, sf);
      }

      // â”€â”€ Primary Recommendation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const pr = primary_recommendation;
      if (pr) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(t('pdf_primaryRecommendation') + ':', 18, y + 2);
        y += 10;

        if (pr.name)        y = addRow(doc,       `  ${t('pdf_name')}`,  pr.name,        y, false, sf);
        if (pr.npk)         y = addRow(doc,       '  NPK',               pr.npk,         y, true,  sf);
        if (pr.description) y = addMultiField(doc,'  Description',        pr.description, y, false, sf);
        if (pr.dosage)      y = addRow(doc,       `  ${t('pdf_dosage')}`, pr.dosage,     y, true,  sf);
        if (pr.preparation) y = addMultiField(doc, '  Preparation Method', pr.preparation, y, false, sf);
        if (pr.benefit)     y = addMultiField(doc, `  ${t('pdf_benefit')}`, pr.benefit,  y, true,  sf);
      }

      // â”€â”€ pH Correction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const phc = ph_correction;
      if (phc) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(t('pdf_phCorrection') + ':', 18, y + 2);
        y += 10;

        if (typeof phc === 'string') {
          y = addMultiField(doc, `  ${t('pdf_note')}`, phc, y, false, sf);
        } else {
          if (phc.action)   y = addRow(doc,       `  ${t('pdf_action')}`,   phc.action,   y, false, sf);
          if (phc.material) y = addRow(doc,       `  ${t('pdf_material')}`, phc.material, y, true,  sf);
          if (phc.dosage)   y = addRow(doc,       `  ${t('pdf_dosage')}`,   phc.dosage,   y, false, sf);
          if (phc.note)     y = addMultiField(doc, `  ${t('pdf_note')}`,    phc.note,     y, true,  sf);
          Object.entries(phc)
            .filter(([k]) => !['action', 'material', 'dosage', 'note'].includes(k))
            .forEach(([k, v], ki) => {
              y = addRow(doc, `  ${k}`, String(v), y, ki % 2 === 0, sf);
            });
        }
      }

      y = addDivider(doc, y);
    }
  }

  addFooters(
    doc,
    doc.getNumberOfPages(),
    t('pdf_footerFertilizer'),
    t('pdf_page'),
    t('pdf_of'),
    sf,
    lang
  );
  doc.save(`CropCareAI_Fertilizer_Report_${now.toISOString().slice(0, 10)}.pdf`);
}


// ══════════════════════════════════════════════════════════════════════════════
// Crop Yield Report  (all yield history entries — one combined PDF)
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadYieldReport({ user, yieldHistory = [] }) {
  const lang = localStorage.getItem('cropcare_language') || 'en';
  const t    = getTForPDF();
  const doc  = new jsPDF();
  const now  = new Date();

  const sf = await setupScriptFont(doc, lang);

  // ── Header ──────────────────────────────────────────────────────────────────
  let y = addHeader(doc, 'Crop Yield Prediction Report', sf);

  // ── Farmer Info ─────────────────────────────────────────────────────────────
  y = addSectionTitle(doc, t('pdf_farmerInfo'), y, sf);
  y = addRow(doc, t('pdf_farmerName'), user?.name  || 'N/A', y, true,  sf);
  y = addRow(doc, t('pdf_email'),      user?.email || 'N/A', y, false, sf);
  y = addRow(doc, t('pdf_dateAndTime'), now.toLocaleString('en-IN'), y, true, sf);
  y = addDivider(doc, y);

  // ── All Records ─────────────────────────────────────────────────────────────
  y = addSectionTitle(doc, 'Yield Prediction Records', y, sf);

  if (!yieldHistory || yieldHistory.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(9);
    doc.setFont(sf, 'normal');
    doc.text('No yield prediction records found.', 18, y);
    y += 10;
  } else {
    for (let i = 0; i < yieldHistory.length; i++) {
      const rec     = yieldHistory[i];
      const dateStr = rec.created_at ? new Date(rec.created_at).toLocaleDateString('en-IN') : '';

      // result is stored as a nested object in history records
      const result = rec.result ?? rec;

      y = checkPage(doc, y);
      y = addRecordHeading(doc, t('pdf_record'), i, dateStr, y, sf, lang);

      // Basic meta
      const cropName = (rec.crop || result.crop || 'N/A').charAt(0).toUpperCase() +
                       (rec.crop || result.crop || 'N/A').slice(1);
      y = addRow(doc, t('pdf_crop'),        cropName,                      y, false, sf);
      y = addRow(doc, t('pdf_season'),      rec.season    || 'N/A',        y, true,  sf);
      y = addRow(doc, t('pdf_farmingType'), rec.farming_type || 'N/A',     y, false, sf);
      y = addRow(doc, 'Irrigation Type',   result.irrigation_type || rec.irrigation_type || 'N/A', y, true, sf);

      // ── Yield Range ─────────────────────────────────────────────────────────
      if (result.yield_range) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('Yield Forecast (quintals/acre):', 18, y + 2);
        y += 10;

        const yr = result.yield_range;
        y = addRow(doc, '  Low Estimate',  yr.low  != null ? `${yr.low} qtl/acre`  : 'N/A', y, false, sf);
        y = addRow(doc, '  Expected',      yr.mid  != null ? `${yr.mid} qtl/acre`  : 'N/A', y, true,  sf);
        y = addRow(doc, '  High Estimate', yr.high != null ? `${yr.high} qtl/acre` : 'N/A', y, false, sf);
      }

      // ── Total Production (if farm area was resolved) ─────────────────────────
      if (result.total_production) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('Total Production:', 18, y + 2);
        y += 10;

        const tp = result.total_production;
        y = addRow(doc, '  Farm Area', tp.area_acres != null ? `${tp.area_acres} acres` : 'N/A', y, false, sf);
        y = addRow(doc, '  Low',       tp.low_quintals  != null ? `${tp.low_quintals} qtl`  : 'N/A', y, true,  sf);
        y = addRow(doc, '  Expected',  tp.mid_quintals  != null ? `${tp.mid_quintals} qtl`  : 'N/A', y, false, sf);
        y = addRow(doc, '  High',      tp.high_quintals != null ? `${tp.high_quintals} qtl` : 'N/A', y, true,  sf);
      }

      // ── Farming Method Comparison ────────────────────────────────────────────
      if (result.comparison) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('Method Comparison:', 18, y + 2);
        y += 10;

        const cmp = result.comparison;
        y = addRow(doc, '  Chemical Yield',  cmp.conventional_qtl_acre != null ? `${cmp.conventional_qtl_acre} qtl/acre` : 'N/A', y, false, sf);
        y = addRow(doc, '  Organic Yield',   cmp.organic_qtl_acre      != null ? `${cmp.organic_qtl_acre} qtl/acre`      : 'N/A', y, true,  sf);
        y = addRow(doc, '  Yield Gap',       cmp.yield_gap_qtl_acre    != null ? `${cmp.yield_gap_qtl_acre} qtl/acre`    : 'N/A', y, false, sf);
      }

      // ── Limiting Factors ─────────────────────────────────────────────────────
      if (result.limiting_factors && result.limiting_factors.length > 0) {
        y = checkPage(doc, y);
        doc.setFontSize(9);
        doc.setFont(sf, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('Limiting Factors & Tips:', 18, y + 2);
        y += 10;

        result.limiting_factors.forEach((factor, fi) => {
          y = checkPage(doc, y);
          y = addMultiField(doc, `  ${fi + 1}`, factor, y, fi % 2 === 0, sf);
        });
      }

      y = addDivider(doc, y);
    }
  }

  addFooters(
    doc,
    doc.getNumberOfPages(),
    'CropCareAI – Yield Report',
    t('pdf_page'),
    t('pdf_of'),
    sf,
    lang
  );
  doc.save(`CropCareAI_Yield_Report_${now.toISOString().slice(0, 10)}.pdf`);
}
