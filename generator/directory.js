'use strict';
// The Terminal Directory: every site people have added (directory/sites.json), read once a
// day and turned into a search index that Terminal Web searches, plus an A-Z list page.
// Only Terminal Web Builder pages are read; any other page is skipped.
const fs = require('fs');
const path = require('path');
const { COLS, Page, clean, cut, stamp } = require('./lib');
const { screen, describe } = require('./screen');

const MAX_PAGES = 25;          // pages read from each site
const MAX_TEXT = 4000;         // characters of each page kept for searching
const RECRAWL_MS = 20 * 60 * 60 * 1000;
const SUBMIT_FORM = 'https://github.com/leiadigitalmediainc/Terminal_Web_Sites/issues/new?template=submit-site.yml';

const isBuilderPage = (html) => /<meta\s[^>]*name=["']generator["'][^>]*content=["']Terminal Web Builder|<meta\s[^>]*content=["']Terminal Web Builder["'][^>]*name=["']generator["']/i.test(html.slice(0, 5000)) && /<pre[\s>]/i.test(html);

// An address people can add: https, a real host name, no more than 300 characters.
function siteAddress(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname) || /^[\d.]+$/.test(u.hostname) || /(^|\.)(localhost|local|internal)$/i.test(u.hostname)) return null;
    u.hash = ''; u.search = '';
    const href = u.href;
    return href.length <= 300 ? href : null;
  } catch (e) { return null; }
}
const sameSite = (a, b) => siteAddress(a) && siteAddress(b) && siteAddress(a).toLowerCase().replace(/\/(index\.html)?$/, '') === siteAddress(b).toLowerCase().replace(/\/(index\.html)?$/, '');

async function getPage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TerminalWebSites/1.0', Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok || !/text\/html/i.test(res.headers.get('content-type') || 'text/html')) return null;
    const text = await res.text();
    return text.length > 2000000 ? null : text;
  } catch (e) { return null; }
}

// A Builder page's words, without frames, block letters, or link numbers.
function pageText(html) {
  // lines that are mostly drawing (frames, block letters) are left out, so only words are kept
  const pre = ((/<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html) || [])[1] || '').split('\n').filter(line => {
    const t = clean(line).replace(/\s/g, '');
    return t && (t.match(/[\p{L}\p{N}]/gu) || []).length >= t.length * 0.6;
  }).join('\n');
  return clean(pre.replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, (m, label) => label.replace(/\[\d+\]/g, '')))
    .replace(/[─-▟■-◿]/g, ' ').replace(/\s+/g, ' ').trim();
}
const titleOf = (html) => clean((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '');
const descriptionOf = (html) => clean((/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']*)/i.exec(html) || [])[1] || '');

// Reads up to MAX_PAGES Builder pages of one site, starting at its address and following its
// own links that stay inside it.
async function crawl(start) {
  const base = new URL(start);
  base.pathname = base.pathname.replace(/\/index\.html?$/i, '/');   // "site/" and "site/index.html" are one page
  const folder = base.href.replace(/[^/]*$/, '');
  const queue = [base.href], seen = new Set(queue), pages = [];
  while (queue.length && pages.length < MAX_PAGES) {
    const url = queue.shift();
    const html = await getPage(url);
    await new Promise(r => setTimeout(r, 250));
    if (!html || !isBuilderPage(html)) continue;
    pages.push({ url, title: titleOf(html) || url, text: pageText(html).slice(0, MAX_TEXT), about: descriptionOf(html) });
    for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)/gi)) {
      let next;
      try { next = new URL(m[1].replace(/&amp;/g, '&'), url); } catch (e) { continue; }
      next.hash = ''; next.search = '';
      next.pathname = next.pathname.replace(/\/index\.html?$/i, '/');
      if (next.origin === base.origin && next.href.startsWith(folder) && /(\/|\.html?)$/i.test(next.pathname) && !seen.has(next.href)) {
        seen.add(next.href); queue.push(next.href);
      }
    }
  }
  return pages;
}

const LIST_FILE = path.join(__dirname, '..', 'directory', 'sites.json');
const RULES_URL = 'https://leiadigitalmediainc.github.io/Terminal_Web_Sites/directory/rules.html';

// Everything a site says, checked against the rules.
const siteHits = (pages) => screen(...pages.map(p => p.title + '\n' + p.about + '\n' + p.text));

// The rules (directory/rules.md) as a page Terminal Web shows like any other.
function writeRules(outDir) {
  const page = new Page('directory/rules.html', 'Terminal Directory rules');
  // paragraphs and list items are joined up, then wrapped to the page width
  const blocks = [];
  for (const raw of fs.readFileSync(path.join(__dirname, '..', 'directory', 'rules.md'), 'utf8').replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) { blocks.push(null); continue; }
    const last = blocks[blocks.length - 1];
    if (/^(#|\d+\.|- )/.test(line) || !last || last.heading) blocks.push({ heading: /^#/.test(line), text: line });
    else last.text += ' ' + line;
  }
  for (const b of blocks) {
    if (!b) { page.blank(); continue; }
    if (/^# /.test(b.text)) { page.text(b.text.slice(2).toUpperCase()).rule('═'); continue; }
    if (/^## /.test(b.text)) { page.text(b.text.slice(3).toUpperCase()).rule(); continue; }
    const item = /^(\d+\.|-) /.exec(b.text);
    const indent = item ? ' '.repeat(item[0].length) : '';
    const words = (item ? b.text.slice(item[0].length) : b.text).split(' ');
    let row = item ? (item[1] === '-' ? '• ' : item[0]) : '';
    for (const w of words) {
      if (row.trim() && Array.from(row + ' ' + w).length > COLS) { page.text(row); row = indent + w; }
      else row += (row && !/ $/.test(row) ? ' ' : '') + w;
    }
    if (row.trim()) page.text(row);
  }
  page.blank().bar([{ label: 'Back to the directory', href: 'index.html' }]);
  page.write(outDir);
}

async function buildDirectory(outDir, dataDir) {
  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  const cacheFile = path.join(dataDir, 'directory-index.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) { /* first run */ }
  const fresh = {};
  for (const s of list.sites) {
    const old = cache[s.url];
    if (old && Date.now() - old.checked < RECRAWL_MS) { fresh[s.url] = old; continue; }
    const pages = await crawl(s.url);
    // a site that is down today keeps yesterday's pages; one that is gone for a week drops out
    if (!pages.length && old && Date.now() - old.lastSeen < 7 * 24 * 60 * 60 * 1000) { fresh[s.url] = { ...old, checked: Date.now() }; continue; }
    fresh[s.url] = { checked: Date.now(), lastSeen: pages.length ? Date.now() : (old && old.lastSeen) || 0, pages };
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const before = JSON.stringify(cache), after = JSON.stringify(fresh);
  if (before !== after) fs.writeFileSync(cacheFile, after);

  // A listed site whose words now break the rules is hidden until a person looks. Words that
  // were there when the site was approved (approvedTerms) are not counted again.
  const newHolds = [];
  for (const s of list.sites) {
    if (s.held || s.trusted) continue;   // trusted: our own sites, e.g. T-News reports real news
    const pages = (fresh[s.url] || {}).pages || [];
    const hits = siteHits(pages).filter(h => !(s.approvedTerms || []).includes(h.term));
    if (!hits.length) continue;
    s.held = { reason: describe(hits), since: new Date().toISOString().slice(0, 10), by: 'daily check' };
    newHolds.push({ url: s.url, reason: s.held.reason });
  }
  if (newHolds.length) {
    fs.writeFileSync(LIST_FILE, JSON.stringify(list, null, 2) + '\n');
    fs.writeFileSync(path.join(__dirname, '..', 'new-holds.json'), JSON.stringify(newHolds));
  }

  writeRules(outDir);
  const sites = list.sites.filter(s => !s.held).map(s => {
    const pages = (fresh[s.url] || {}).pages || [];
    if (!pages.length) return null;
    const first = pages[0];
    return { url: s.url, title: cut(first.title, 70), about: cut(first.about || first.text, 200), added: s.added, pages: pages.map(p => ({ url: p.url, title: cut(p.title, 90), text: p.text })) };
  }).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));

  const dir = path.join(outDir, 'directory');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ updated: new Date().toISOString(), submit: SUBMIT_FORM, sites }));

  // the same list as a page, for any browser
  const page = new Page('directory/index.html', 'Terminal Directory');
  const name = 'T E R M I N A L   D I R E C T O R Y', pad = Math.floor((COLS - 2 - name.length) / 2);
  page.text('╔' + '═'.repeat(COLS - 2) + '╗', '║' + ' '.repeat(pad) + name + ' '.repeat(COLS - 2 - pad - name.length) + '║', '╚' + '═'.repeat(COLS - 2) + '╝', '');
  page.text('Sites made with Terminal Web Builder, from A to Z. ' + sites.length + (sites.length === 1 ? ' site.' : ' sites.'));
  page.text('In Terminal Web, type td and your words in the address bar to search them all.').blank();
  page.bar([{ label: 'Add your site', href: SUBMIT_FORM }, { label: 'Directory rules', href: 'rules.html' }]);
  page.rule().blank();
  let letter = '';
  for (const s of sites) {
    const first = /[a-z]/i.test(s.title[0]) ? s.title[0].toUpperCase() : '#';
    if (first !== letter) { letter = first; page.text('═══ ' + letter + ' ' + '═'.repeat(COLS - 6)).blank(); }
    page.row('• ', { label: s.title, href: s.url });
    if (s.about) page.text('  ' + cut(s.about, COLS - 2));
    page.text('  ' + new URL(s.url).hostname).blank();
  }
  if (!sites.length) page.text('No sites yet. Be the first to add one.').blank();
  page.rule().text('Updated ' + stamp() + '.');
  page.write(outDir);
  return { sites: sites.length };
}

module.exports = { buildDirectory, siteAddress, sameSite, isBuilderPage, getPage, crawl, siteHits, SUBMIT_FORM, RULES_URL, LIST_FILE };
