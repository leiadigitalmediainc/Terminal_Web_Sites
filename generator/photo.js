'use strict';
// Turns a story's picture into text, in five shades of block, so it reads as a photograph
// in a single colour. Only this text is published, never the picture itself. It needs the
// full page width: narrower than that, faces stop being recognisable.
//
// Set ENABLED to false to take every picture off the site on the next update.
const ENABLED = true;
const WIDTH = 76;
const SHADES = ' ░▒▓█';
const SHARE = [0.3, 0.52, 0.72, 0.88];   // how much of a picture falls below each shade
const CELL = 0.478;     // a character's width divided by its height at 1.15 line spacing
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* pages simply carry no pictures */ }

// A picture that cannot be fetched or read is left out: stories never depend on one.
async function photo(url) {
  if (!ENABLED || !sharp || !url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TerminalWebSites/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const rows = Math.round(WIDTH * 9 / 16 * CELL);
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(WIDTH, rows, { fit: 'cover', position: sharp.strategy.attention, kernel: 'lanczos3' })
      .flatten({ background: '#000' }).grayscale().normalise({ lower: 2, upper: 98 }).sharpen({ sigma: 0.8 })
      .raw().toBuffer({ resolveWithObject: true });
    // Shade by rank, not brightness: each picture's own tones are shared out across the five
    // shades, so a bright rink or a dark room still shows its shapes instead of one solid block.
    const value = (x, y) => data[(y * info.width + x) * info.channels];
    const sorted = [];
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) sorted.push(value(x, y));
    sorted.sort((a, b) => a - b);
    const limits = SHARE.map(q => sorted[Math.floor(q * (sorted.length - 1))]);
    const lines = [];
    for (let y = 0; y < info.height; y++) {
      let s = '';
      for (let x = 0; x < info.width; x++) s += SHADES[limits.filter(t => value(x, y) > t).length];
      lines.push(s);
    }
    return lines;
  } catch (e) { return null; }
}

module.exports = { photo };
