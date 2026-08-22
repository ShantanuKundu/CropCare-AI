/**
 * download-fonts.js
 * Downloads Noto Sans Devanagari and Bengali TTF fonts from Google Fonts CDN.
 * Run with: node download-fonts.js
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const OUTPUT_DIR = path.join(__dirname, 'public', 'fonts');

// Use an old user-agent so Google Fonts CSS API returns TTF (not WOFF2)
const OLD_UA = 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)';

function get(url, ua = OLD_UA, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': ua } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return get(res.headers.location, ua, redirects + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function downloadFont(googleFamily, weight, outputFile) {
  // Step 1: get the CSS page to find the actual font URL
  const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(googleFamily)}:${weight}`;
  console.log(`  Getting CSS: ${cssUrl}`);
  const css = await get(cssUrl);
  const cssText = css.data.toString('utf8');

  // Extract the font URL — Google may use direct .ttf link OR obfuscated /l/font?kit=... link
  const match = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
  if (!match) {
    console.error(`  ✗ No TTF URL found. CSS snippet:\n${cssText.substring(0, 400)}`);
    return false;
  }

  const ttfUrl = match[1];
  console.log(`  Downloading: ${ttfUrl}`);
  const font = await get(ttfUrl);

  if (font.status !== 200) {
    console.error(`  ✗ HTTP ${font.status}`);
    return false;
  }

  const dest = path.join(OUTPUT_DIR, outputFile);
  fs.writeFileSync(dest, font.data);
  console.log(`  ✓ Saved ${outputFile} (${font.data.length} bytes)`);
  return true;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fonts = [
    ['Noto Sans Devanagari', '400', 'NotoSansDevanagari-Regular.ttf'],
    ['Noto Sans Devanagari', '700', 'NotoSansDevanagari-Bold.ttf'],
    ['Noto Sans Bengali',    '400', 'NotoSansBengali-Regular.ttf'],
    ['Noto Sans Bengali',    '700', 'NotoSansBengali-Bold.ttf'],
  ];

  for (const [family, weight, file] of fonts) {
    console.log(`\n${family} ${weight}:`);
    const ok = await downloadFont(family, weight, file);
    if (!ok) console.warn(`  SKIPPED — will need manual download`);
  }

  console.log('\nDone. Files:');
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.readdirSync(OUTPUT_DIR).forEach(f => {
      const size = fs.statSync(path.join(OUTPUT_DIR, f)).size;
      console.log(`  ${f}  (${Math.round(size / 1024)} KB)`);
    });
  }
}

main().catch(console.error);
