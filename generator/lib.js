'use strict';
// Writes pages in the Terminal Web page format: one <pre> grid plus the generator tag that
// tells Terminal Web to show it exactly as laid out. Readers get one colour, chosen by them.
const fs = require('fs');
const path = require('path');

const COLS = 76;
const banners = require('./banners.json');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Text from outside sources: decode entities, keep it on one line, drop anything that would
// not fit the character grid (emoji, control and private-use characters).
function clean(s) {
  return String(s == null ? '' : s)
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/<[^>]*>/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Cc}\p{Cf}\p{Co}️]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}
const cut = (s, n) => { const a = Array.from(s); return a.length > n ? a.slice(0, n - 1).join('').trimEnd() + '…' : s; };
const isSafeHref = (h) => /^(https?:\/\/\S+|(\.\.?\/)*[a-z0-9-]+(\/[a-z0-9-]+)*\.html)$/i.test(h);

class Page {
  // `file` is the path inside the site, like "sports/nhl/index.html"
  constructor(file, title) { this.file = file; this.title = title; this.rows = []; this.pictures = []; }
  get root() { return '../'.repeat(this.file.split('/').length - 1) || './'; }
  text(...lines) { lines.forEach(l => this.rows.push([String(l)])); return this; }
  rule(ch = '─') { return this.text(ch.repeat(COLS)); }
  blank() { return this.text(''); }
  // one row of parts: plain strings and {label, href} links
  row(...parts) { this.rows.push(parts); return this; }
  link(label, href) { return this.row({ label: cut(clean(label), 68), href }); }
  // several links on one row, with a gap between them
  bar(items, gap = 2) {
    const parts = [];
    items.forEach((it, i) => { if (i) parts.push(' '.repeat(gap)); parts.push(it); });
    return this.row(...parts);
  }
  html() {
    let n = 0;
    const body = this.rows.map(parts => {
      let col = 0;
      const add = (s) => { col += Array.from(s).length; return esc(s); };
      // the width of the parts after index i, up to the next column jump, numbering links from n
      const span = (i) => {
        let w = 0, k = n;
        for (const p of parts.slice(i + 1)) {
          if (typeof p === 'string') w += Array.from(p).length;
          else if (p.to || p.at !== undefined || p.center) break;
          else if (p.bold !== undefined) w += Array.from(p.bold).length;
          else if (!isSafeHref(p.href)) w += Array.from(p.label).length;
          else w += Array.from(p.label + '[' + (++k) + ']').length;
        }
        return w;
      };
      return parts.map((p, i) => {
        if (typeof p === 'string') return add(p);
        if (p.center) return add(' '.repeat(Math.max(0, Math.floor((p.center - span(i)) / 2))));   // centre what follows in this many columns
        if (p.to) return add(' '.repeat(Math.max(2, p.to - col)));   // jump to a column
        if (p.at !== undefined) return add(' '.repeat(Math.max(0, p.at - col)));   // same, no minimum gap
        if (p.bold !== undefined) { col += Array.from(p.bold).length; return '<b>' + esc(p.bold) + '</b>'; }
        if (!isSafeHref(p.href)) return add(p.label);
        n++;
        const words = p.label + '[' + n + ']';
        col += Array.from(words).length;
        const label = '<u>' + esc(words) + '</u>';
        return '<a href="' + esc(p.href) + '">' + (p.strong ? '<b>' + label + '</b>' : label) + '</a>';
      }).join('').replace(/\s+$/, '');
    }).join('\n');
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<meta name="generator" content="Terminal Web Builder">\n' +
      this.pictures.map(p => '<meta name="twb-picture" content="' + [p.row, p.col, p.rows, p.cols, p.w, p.h, p.data].join(',') + '">\n').join('') +
      (this.description ? '<meta name="description" content="' + esc(this.description) + '">\n' : '') +
      '<title>' + esc(this.title) + '</title>\n' +
      '<style>\nbody{background:#000;color:#c68039;margin:0;padding:16px}\na{color:#5c9cc7}\n' +
      'pre{font-family:Consolas,"Courier New",monospace;font-size:16px;line-height:1.15;margin:0;overflow-x:auto}\n' +
      '</style>\n</head>\n<body>\n<pre>' + body + '</pre>\n</body>\n</html>\n';
  }
  write(outDir) {
    const file = path.join(outDir, this.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.html());
  }
}

// Network helpers. Every failure is noted, and the caller shows a short message on that page
// rather than stopping the whole site.
const problems = [];
let attempts = 0;
async function fetchText(url) {
  attempts++;
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'TerminalWebSites/1.0' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) { last = e; }
  }
  problems.push(url + ': ' + last.message);
  return null;
}
async function fetchJson(url) {
  const text = await fetchText(url);
  if (text == null) return null;
  try { return JSON.parse(text); } catch (e) { problems.push(url + ': bad JSON'); return null; }
}
const tag = (item, name) => {
  const m = new RegExp('<' + name + '(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</' + name + '>').exec(item);
  return m ? m[1] : '';
};
// The picture a feed offers for a story, if any. BBC thumbnails come in larger sizes too.
function imageOf(item) {
  const m = /<media:thumbnail[^>]*url="([^"]+)/.exec(item) || /<media:content[^>]*url="([^"]+)/.exec(item) ||
    /<enclosure[^>]*url="([^"]+)/.exec(item) || /<img[^>]*src=['"]([^'"]+)/.exec(item);
  return m ? m[1].replace(/&amp;/g, '&').replace('/ace/standard/240/', '/ace/standard/640/') : '';
}
async function headlines(url, limit = 15) {
  const xml = await fetchText(url);
  if (xml == null) return null;
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  if (!items.length) problems.push(url + ': no stories');
  return items.map(i => ({ title: clean(tag(i, 'title')), url: clean(tag(i, 'link')), summary: clean(tag(i, 'description')), image: imageOf(i),
    author: clean(tag(i, 'dc:creator') || tag(i, 'author')).replace(/^[^s@]+@[^s@]+s*((.*))$/, '$1'), date: clean(tag(i, 'pubDate')) }))
    .filter(n => n.title && /^https?:\/\//.test(n.url)).slice(0, limit);
}
const stamp = () => new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

module.exports = { COLS, banners, Page, clean, cut, fetchJson, headlines, stamp, problems, attemptCount: () => attempts };
