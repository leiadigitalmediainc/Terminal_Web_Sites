'use strict';
// The newspaper's layout: masthead, section menu, lead story, frames, and stories that flow
// from one column into the next. Every page of the paper is made from these.
const { COLS, banners, cut } = require('./lib');

const MENU = [
  [['Front Page', 'index.html'], ['World', 'news/world.html'], ['Canada', 'news/canada.html'], ['USA', 'news/usa.html'], ['UK', 'news/uk.html'], ['Local', 'news/local.html']],
  [['Business', 'news/business.html'], ['Tech', 'news/tech.html'], ['Science', 'news/science.html'], ['Arts', 'news/arts.html'], ['Sports', 'sports/index.html']]
];
const width = (s) => Array.from(s).length;
const centered = (s, w) => { const left = Math.max(0, Math.floor((w - width(s)) / 2)); return ' '.repeat(left) + s + ' '.repeat(Math.max(0, w - width(s) - left)); };

function wrap(text, w) {
  const lines = [];
  let line = '';
  for (let word of String(text).split(/\s+/).filter(Boolean)) {
    while (width(word) > w) {
      if (line) { lines.push(line); line = ''; }
      const a = Array.from(word);
      lines.push(a.slice(0, w).join(''));
      word = a.slice(w).join('');
    }
    if (width(line) + width(word) + (line ? 1 : 0) > w) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
}

// A feed's summary is short already; this only stops an unusually long one taking over.
function brief(text, limit = 220) {
  if (width(text) <= limit) return text;
  const cutAt = Array.from(text).slice(0, limit).join('').replace(/\s+\S*$/, '');
  return cutAt + '…';
}

function masthead(page, section) {
  const inner = COLS - 2;
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  page.text('╔' + '═'.repeat(inner) + '╗');
  banners.news.forEach(l => page.text('║' + centered(l, inner) + '║'));
  page.text('╟' + '─'.repeat(inner) + '╢');
  page.text('║ ' + date + ' '.repeat(Math.max(1, inner - 2 - width(date) - width(section))) + section + ' ║');
  page.text('╚' + '═'.repeat(inner) + '╝');
  MENU.forEach(row => page.bar(row.map(([label, file]) => ({ label, href: page.root + file }))));
  page.rule();
}

function sectionBar(page, name) {
  page.row({ bold: '═══ ' + name + ' ' + '═'.repeat(Math.max(0, COLS - width(name) - 5)) });
  page.blank();
}

const readLink = (s) => ({ label: 'Read at ' + (s.source || 'source'), href: s.url });

// The main story. With a picture, the words sit beside it like a real front page.
function lead(page, story, picture) {
  if (picture) {
    const x = Math.max(...picture.map(width)) + 2, w = COLS - x;
    const words = [
      ...wrap(story.title.toUpperCase(), w).map(l => ({ bold: l })), '',
      ...(story.summary ? wrap(brief(story.summary, 170), w) : []), '',
      readLink(story)
    ];
    const left = [...picture, cut('Picture: ' + (story.credit || story.source || 'source'), x - 2)];
    for (let i = 0; i < Math.max(left.length, words.length); i++) {
      const parts = [left[i] || ''];
      if (words[i]) parts.push({ at: x }, words[i]);
      page.row(...parts);
    }
    page.blank();
    return;
  }
  wrap(story.title.toUpperCase(), COLS).forEach(l => page.row({ bold: l }));
  page.blank();
  if (story.summary) page.text(...wrap(brief(story.summary), COLS), '');
  page.row(readLink(story));
  page.blank();
}

// Pours stories through columns like a newspaper: a story that runs out of room carries on
// at the top of the next column. A headline is never split, or left alone at a column's foot.
// Returns null if the stories do not fit at this height.
function pour(blocks, count, height) {
  const cols = [[]];
  for (const block of blocks) {
    for (let i = 0; i < block.length; i++) {
      let col = cols[cols.length - 1];
      const room = height - col.length;
      const headline = block.filter(l => l.bold !== undefined).length;
      if (room <= 0 || (i === 0 && room < Math.min(headline + 2, block.length - 1))) {
        if (block[i].href) return null;    // a story's link must not sit alone in a new column
        col = []; cols.push(col);
      }
      if (cols.length > count) return null;
      if (block[i] === '' && !col.length) continue;
      col.push(block[i]);
    }
  }
  return cols;
}

function columns(page, stories, count = 3, gap = 2) {
  const w = Math.floor((COLS - gap * (count - 1)) / count);
  const blocks = stories.map(s => [
    ...wrap(s.title, w).map(l => ({ bold: l })),
    ...(s.summary ? wrap(brief(s.summary, 160), w) : []),
    readLink(s), ''
  ]);
  const total = blocks.reduce((n, b) => n + b.length, 0);
  let height = Math.ceil(total / count), cols = pour(blocks, count, height);
  while (!cols) cols = pour(blocks, count, ++height);
  const rows = Math.max(...cols.map(c => c.length));
  for (let r = 0; r < rows; r++) {
    const parts = [];
    cols.forEach((c, i) => { if (c[r] !== undefined && c[r] !== '') parts.push({ at: i * (w + gap) }, c[r]); });
    page.row(...parts);
  }
  page.blank();
}

// A framed box. `rows` are lists of parts, so frames can hold links.
function box(page, title, rows) {
  page.text('┌─ ' + title + ' ' + '─'.repeat(Math.max(0, COLS - width(title) - 5)) + '┐');
  rows.forEach(parts => page.row('│ ', ...parts, { at: COLS - 1 }, '│'));
  page.text('└' + '─'.repeat(COLS - 2) + '┘');
}

module.exports = { masthead, sectionBar, lead, columns, box, wrap };
