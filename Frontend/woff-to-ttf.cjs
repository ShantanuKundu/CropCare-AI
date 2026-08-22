/**
 * woff-to-ttf.cjs
 * Converts WOFF1 font files → TTF using Node.js built-in zlib.
 * WOFF1 stores each sfnt table compressed (RFC-1950 zlib). We decompress
 * each table and reconstruct a valid TTF/OTF binary.
 */
const zlib   = require('zlib');
const { promisify } = require('util');
const fs     = require('fs');
const path   = require('path');

const inflate = promisify(zlib.inflate);

// ── Binary helpers ────────────────────────────────────────────────────────
function r32(buf, o) { return ((buf[o] << 24) | (buf[o+1] << 16) | (buf[o+2] << 8) | buf[o+3]) >>> 0; }
function r16(buf, o) { return ((buf[o] << 8) | buf[o+1]) >>> 0; }
function w32(buf, o, v) {
  buf[o]   = (v >>> 24) & 0xFF; buf[o+1] = (v >>> 16) & 0xFF;
  buf[o+2] = (v >>>  8) & 0xFF; buf[o+3] =  v         & 0xFF;
}
function w16(buf, o, v) { buf[o] = (v >>> 8) & 0xFF; buf[o+1] = v & 0xFF; }

// ── WOFF1 → TTF/OTF ──────────────────────────────────────────────────────
async function woff1ToTtf(woffBuf) {
  if (woffBuf[0] !== 0x77 || woffBuf[1] !== 0x4F ||
      woffBuf[2] !== 0x46 || woffBuf[3] !== 0x46) {
    throw new Error('Not a WOFF1 file (magic mismatch)');
  }

  const flavor    = r32(woffBuf, 4);   // sfnt version: 0x00010000 (TT) or 'OTTO' (CFF)
  const numTables = r16(woffBuf, 12);

  // Read WOFF table directory (44-byte WOFF header, then 20 bytes per table)
  const woffTables = [];
  for (let i = 0; i < numTables; i++) {
    const base = 44 + i * 20;
    const tag           = woffBuf.slice(base, base + 4).toString('binary');
    const offset        = r32(woffBuf, base + 4);
    const compLength    = r32(woffBuf, base + 8);
    const origLength    = r32(woffBuf, base + 12);
    const origChecksum  = r32(woffBuf, base + 16);
    woffTables.push({ tag, offset, compLength, origLength, origChecksum });
  }

  // Decompress each table
  const tables = [];
  for (const wt of woffTables) {
    const compData = woffBuf.slice(wt.offset, wt.offset + wt.compLength);
    let data;
    if (wt.compLength === wt.origLength) {
      data = compData;              // not compressed — stored as-is
    } else {
      data = await inflate(compData); // RFC-1950 (zlib header + deflate)
    }
    tables.push({ tag: wt.tag, data, checksum: wt.origChecksum });
  }

  // Build sfnt (TTF/OTF) output ─────────────────────────────────────────
  const SFNT_HEADER   = 12;
  const DIR_ENTRY     = 16;
  const dirSize       = numTables * DIR_ENTRY;

  // Assign table offsets (4-byte aligned)
  let curOffset = SFNT_HEADER + dirSize;
  const offsets = tables.map(t => {
    const off = curOffset;
    curOffset += Math.ceil(t.data.length / 4) * 4; // pad to 4 bytes
    return off;
  });

  const out = Buffer.alloc(curOffset, 0);

  // sfnt offset table (12 bytes)
  w32(out, 0, flavor);
  w16(out, 4, numTables);
  let pow2 = 1, exp = 0;
  while (pow2 * 2 <= numTables) { pow2 *= 2; exp++; }
  w16(out, 6, pow2 * 16);           // searchRange
  w16(out, 8, exp);                  // entrySelector
  w16(out, 10, numTables * 16 - pow2 * 16); // rangeShift

  // Table directory (16 bytes each)
  for (let i = 0; i < tables.length; i++) {
    const base = SFNT_HEADER + i * DIR_ENTRY;
    for (let c = 0; c < 4; c++) out[base + c] = tables[i].tag.charCodeAt(c);
    w32(out, base + 4,  tables[i].checksum);
    w32(out, base + 8,  offsets[i]);
    w32(out, base + 12, tables[i].data.length);
  }

  // Table data
  for (let i = 0; i < tables.length; i++) {
    tables[i].data.copy(out, offsets[i]);
  }

  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const fontsDir = path.join(__dirname, 'public', 'fonts');
  const ns       = 'node_modules/@fontsource';

  const pairs = [
    [
      `${ns}/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff`,
      path.join(fontsDir, 'NotoSansDevanagari-Regular.ttf'),
    ],
    [
      `${ns}/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff`,
      path.join(fontsDir, 'NotoSansDevanagari-Bold.ttf'),
    ],
    [
      `${ns}/noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff`,
      path.join(fontsDir, 'NotoSansBengali-Regular.ttf'),
    ],
    [
      `${ns}/noto-sans-bengali/files/noto-sans-bengali-bengali-700-normal.woff`,
      path.join(fontsDir, 'NotoSansBengali-Bold.ttf'),
    ],
  ];

  for (const [src, dest] of pairs) {
    const srcPath = path.join(__dirname, src);
    console.log(`Converting ${path.basename(srcPath)} ...`);
    try {
      const woff   = fs.readFileSync(srcPath);
      const ttf    = await woff1ToTtf(woff);
      fs.writeFileSync(dest, ttf);
      console.log(`  ✓ ${path.basename(dest)}  (${woff.length} → ${ttf.length} bytes)`);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
    }
  }
}

main().catch(console.error);
