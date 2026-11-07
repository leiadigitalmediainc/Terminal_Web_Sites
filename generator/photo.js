'use strict';
// Turns a story's picture into a small poster: the photo is smoothed into flat shapes and cut
// down to three tones, then drawn with half blocks (two dots per character) and one shade.
// Bold shapes read better in a single colour than fine detail, and match the team logos.
// Only the text is published, never the picture.
//
// Set ENABLED to false to take every picture off the site on the next update.
const ENABLED = true;
const WIDTH = 44;
const ROWS = 12;
const SMOOTH = 7;                 // how strongly detail is melted into flat shapes
const SHARE = [0.42, 0.74];       // how much of a picture is dark, and how much is dark or mid
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* pages simply carry no pictures */ }

// A picture that cannot be fetched or read is left out: stories never depend on one.
async function photo(url) {
  if (!ENABLED || !sharp || !url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TerminalWebSites/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const dotsHigh = ROWS * 2;
    const flat = await sharp(Buffer.from(await res.arrayBuffer()))
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
    return lines;
  } catch (e) { return null; }
}

module.exports = { photo };
