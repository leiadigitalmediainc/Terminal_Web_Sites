'use strict';
// Turns a story's picture into a small poster: the photo is smoothed into flat shapes and cut
// down to three tones, then drawn with half blocks (two dots per character) and one shade.
// That text is the fallback. Terminal Web shows `pixels` over it instead: the same picture as
// 128 x 72 pixel art in four shades, drawn in the reader's own colour. Neither ever publishes
// the picture itself.
//
// Set ENABLED to false to take every picture off the site on the next update.
const ENABLED = true;
const WIDTH = 42;   // leaves 32 characters beside it: room for "Would you like to know more?[nn]"
const ROWS = 12;
const SMOOTH = 7;                 // how strongly detail is melted into flat shapes
const SHARE = [0.42, 0.74];       // how much of a picture is dark, and how much is dark or mid
const PIXELS_W = 128, PIXELS_H = 72, LEVELS = 4;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* pages simply carry no pictures */ }

async function pixels(source) {
  const flat = await sharp(source).resize(PIXELS_W * 3, PIXELS_H * 3, { fit: 'cover', position: sharp.strategy.attention })
    .flatten({ background: '#000' }).grayscale().normalise({ lower: 1, upper: 99 }).median(3).png().toBuffer();
  const { data, info } = await sharp(flat).resize(PIXELS_W, PIXELS_H, { kernel: 'cubic' }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const values = [];
  for (let i = 0; i < PIXELS_W * PIXELS_H; i++) values.push(data[i * info.channels]);
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = (v) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; } return lo / sorted.length; };
  const bytes = Buffer.alloc(PIXELS_W * PIXELS_H / 4);
  values.forEach((v, i) => {
    const x = i % PIXELS_W, y = Math.floor(i / PIXELS_W);
    const q = (0.5 * rank(v) + 0.5 * v / 255) * (LEVELS - 1), base = Math.floor(q);
    const tone = Math.min(LEVELS - 1, base + (q - base > (BAYER[y % 4][x % 4] + 0.5) / 16 ? 1 : 0));
    bytes[i >> 2] |= tone << ((i & 3) * 2);
  });
  return { w: PIXELS_W, h: PIXELS_H, data: bytes.toString('base64') };
}

// A picture that cannot be fetched or read is left out: stories never depend on one.
async function photo(url) {
  if (!ENABLED || !sharp || !url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TerminalWebSites/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const dotsHigh = ROWS * 2;
    const source = Buffer.from(await res.arrayBuffer());
    const flat = await sharp(source)
      .resize(WIDTH * 6, dotsHigh * 6, { fit: 'cover', position: sharp.strategy.attention })
      .flatten({ background: '#000' }).grayscale().normalise({ lower: 1, upper: 99 }).median(SMOOTH)
      .png().toBuffer();
    const { data, info } = await sharp(flat).resize(WIDTH, dotsHigh, { kernel: 'cubic' }).grayscale().raw().toBuffer({ resolveWithObject: true });
    const values = [];
    for (let i = 0; i < WIDTH * dotsHigh; i++) values.push(data[i * info.channels]);
    // Tones are shared out by rank, so a dark room or a bright rink still shows its shapes.
    const sorted = values.slice().sort((a, b) => a - b);
    const limits = SHARE.map(q => sorted[Math.floor(q * (sorted.length - 1))]);
    const tone = (x, y) => limits.filter(t => values[y * WIDTH + x] > t).length;
    const lines = [];
    for (let r = 0; r < ROWS; r++) {
      let s = '';
      for (let x = 0; x < WIDTH; x++) {
        const top = tone(x, r * 2), bottom = tone(x, r * 2 + 1);
        if (top === 2 && bottom === 2) s += '█';
        else if (top === 2) s += '▀';
        else if (bottom === 2) s += '▄';
        else if (top === 1 && bottom === 1) s += '░';
        else s += ' ';
      }
      lines.push(s);
    }
    lines.pixels = await pixels(source);
    return lines;
  } catch (e) { return null; }
}

module.exports = { photo };
