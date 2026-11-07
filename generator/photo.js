'use strict';
// Turns a story's picture into text art. Each character is chosen by its shape: every 8x16
// patch of the picture is compared with what each character looks like in the page's font
// (glyphs.json), so a "/" lands on a slanted edge and a "_" on a bottom edge. That keeps far
// more detail than shading, which is what lets pictures stay small. Only the text is
// published, never the picture.
//
// Set ENABLED to false to take every picture off the site on the next update.
const ENABLED = true;
const WIDTH = 44;
const ROWS = 12;
const CELL_W = 8, CELL_H = 16;
const glyphs = require('./glyphs.json');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* pages simply carry no pictures */ }

// Evens out the tones, so a night sky or a bright rink still shows its shapes, and scales
// them to the range characters can reach: even "@" only covers about half of its cell.
function evenTones(pixels) {
  const counts = new Array(256).fill(0);
  pixels.forEach(v => counts[v]++);
  const cdf = [];
  let sum = 0;
  for (let i = 0; i < 256; i++) { sum += counts[i]; cdf[i] = sum / pixels.length; }
  return pixels.map(v => 200 * (0.65 * cdf[v] + 0.35 * v / 255));
}

function nearestCharacter(cell) {
  let best = ' ', lowest = Infinity;
  for (const g of glyphs) {
    let difference = 0;
    for (let i = 0; i < cell.length; i++) { const e = cell[i] - g.mask[i]; difference += e * e; }
    if (difference < lowest) { lowest = difference; best = g.ch; }
  }
  return best;
}

// A picture that cannot be fetched or read is left out: stories never depend on one.
async function photo(url) {
  if (!ENABLED || !sharp || !url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TerminalWebSites/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(WIDTH * CELL_W, ROWS * CELL_H, { fit: 'cover', position: sharp.strategy.attention, kernel: 'lanczos3' })
      .flatten({ background: '#000' }).grayscale().normalise({ lower: 1, upper: 99 }).sharpen({ sigma: 1 })
      .raw().toBuffer({ resolveWithObject: true });
    const gray = [];
    for (let i = 0; i < info.width * info.height; i++) gray.push(data[i * info.channels]);
    const tones = evenTones(gray);
    const lines = [];
    for (let r = 0; r < ROWS; r++) {
      let s = '';
      for (let c = 0; c < WIDTH; c++) {
        const cell = [];
        for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) cell.push(tones[(r * CELL_H + y) * info.width + c * CELL_W + x]);
        s += nearestCharacter(cell);
      }
      lines.push(s);
    }
    return lines;
  } catch (e) { return null; }
}

module.exports = { photo, WIDTH };
