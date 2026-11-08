'use strict';
// The sports section: every league works the same way, so adding one is one entry in LEAGUES.
const fs = require('fs');
const path = require('path');
const { COLS, Page, clean, cut, fetchJson, stamp } = require('./lib');
const { masthead, sectionBar, lead, columns, box } = require('./paper');
const { photo } = require('./photo');

const API = 'https://site.api.espn.com/apis';
const NOTICE = 'Logos are text interpretations used to identify teams.';
const NOTICE2 = 'Not affiliated with any team or league. Contact: TerminalWeb@protonmail.com';

const WINS_TABLE = { cols: [['W', 'wins'], ['L', 'losses'], ['PCT', 'winPercent'], ['GB', 'gamesBehind']], sort: 'winPercent' };
const SOCCER_TABLE = { cols: [['GP', 'gamesPlayed'], ['W', 'wins'], ['D', 'ties'], ['L', 'losses'], ['PTS', 'points']], sort: 'points', noStreak: true };
const LEAGUES = [
  { id: 'nhl', name: 'NHL', sport: 'Hockey', api: 'hockey/nhl', table: { cols: [['GP', 'gamesPlayed'], ['W', 'wins'], ['L', 'losses'], ['OT', 'otLosses'], ['PTS', 'points']], sort: 'points' } },
  { id: 'nba', name: 'NBA', sport: 'Basketball', api: 'basketball/nba', table: WINS_TABLE },
  { id: 'mlb', name: 'MLB', sport: 'Baseball', api: 'baseball/mlb', table: WINS_TABLE },
  { id: 'nfl', name: 'NFL', sport: 'Football', api: 'football/nfl', table: { cols: [['W', 'wins'], ['L', 'losses'], ['T', 'ties'], ['PCT', 'winPercent']], sort: 'winPercent' } },
  { id: 'mls', name: 'MLS', sport: 'Soccer', api: 'soccer/usa.1', table: SOCCER_TABLE },
  { id: 'epl', name: 'EPL', sport: 'Premier League', api: 'soccer/eng.1', table: SOCCER_TABLE },
  { id: 'wnba', name: 'WNBA', sport: 'Women\'s Basketball', api: 'basketball/wnba', table: WINS_TABLE }
];

const stat = (entry, name) => { const s = entry.stats.find(x => x.name === name); return s ? s.displayValue : ''; };
const summary = (entry, name) => { const s = entry.stats.find(x => x.name === name); return s ? (s.summary || s.displayValue || '') : ''; };

function groups(node, label, out = []) {
  if (node.standings && node.standings.entries) out.push({ name: label, entries: node.standings.entries });
  (node.children || []).forEach(c => groups(c, c.name, out));
  return out;
}

function game(ev) {
  const c = ev.competitions[0], st = ev.status.type;
  const home = c.competitors.find(t => t.homeAway === 'home'), away = c.competitors.find(t => t.homeAway === 'away');
  const started = st.state !== 'pre';
  const when = new Date(ev.date).toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return {
    live: st.state === 'in',
    line: clean(away.team.abbreviation).padEnd(5) + (started ? String(away.score).padStart(3) + ' - ' + String(home.score).padEnd(3) : '   vs    ') + ' ' +
      clean(home.team.abbreviation).padEnd(5) + ' ' + (started ? clean(st.shortDetail) : when + ' ET')
  };
}

function nav(page, league) {
  const r = page.root + 'sports/';
  masthead(page, league ? 'SPORTS - ' + league.name : 'SPORTS');
  page.bar([{ label: 'All Sports', href: r + 'index.html' }].concat(LEAGUES.map(l => ({ label: l.name, href: r + l.id + '/index.html' }))), 1);
  if (league) page.bar([{ label: 'Scores', href: 'index.html' }, { label: 'Standings', href: 'standings.html' }, { label: 'Teams', href: 'teams.html' }]);
  page.rule().blank();
}
const footer = (page, logos) => {
  page.blank().rule().text('Scores and standings: ESPN. Updated ' + stamp() + '.');
  if (logos) page.text(NOTICE, NOTICE2);
};
const unavailable = (page, what) => page.text(what + ' are being updated. Please check back soon.');

// ESPN's RSS feeds come back empty for GitHub's servers, so headlines use the same data
// service as the scores.
async function leagueNews(league) {
  const data = await fetchJson(`${API}/site/v2/sports/${league.api}/news?limit=10`);
  if (!data) return null;
  return (data.articles || []).map(a => {
    const image = (a.images || [])[0] || {};
    return { title: clean(a.headline), url: a.links && a.links.web && a.links.web.href, summary: clean(a.description), image: image.url || '', credit: clean(image.credit), source: 'ESPN', author: clean(a.byline), date: a.published || '' };
  })
    .filter(n => n.title && /^https?:\/\//.test(n.url || ''));
}

async function buildLeague(league, outDir, dataDir) {
  const [scoreboard, standings, news] = await Promise.all([
    fetchJson(`${API}/site/v2/sports/${league.api}/scoreboard`),
    fetchJson(`${API}/v2/sports/${league.api}/standings?level=3`),
    leagueNews(league)
  ]);
  const dir = 'sports/' + league.id + '/';
  const logoFile = path.join(dataDir, 'logos', league.id + '.json');
  const logos = fs.existsSync(logoFile) ? JSON.parse(fs.readFileSync(logoFile, 'utf8')) : {};
  const games = scoreboard ? (scoreboard.events || []).map(game) : null;

  const home = new Page(dir + 'index.html', 'T-Sports ' + league.name);
  nav(home, league);
  const stories = news || [];
  if (stories.length) lead(home, stories[0], await photo(stories[0].image));
  else unavailable(home, 'Headlines');
  sectionBar(home, 'LATEST GAMES');
  if (!games) unavailable(home, 'Scores');
  else if (!games.length) home.text('No games right now.');
  else home.text(...games.map(g => g.line));
  home.blank();
  if (stories.length > 1) { sectionBar(home, 'MORE ' + league.name + ' STORIES'); columns(home, stories.slice(1, 10)); }
  footer(home);
  home.write(outDir);

  const table = new Page(dir + 'standings.html', league.name + ' Standings');
  nav(table, league);
  const list = standings ? groups(standings, league.name) : [];
  const teams = new Map();
  const sortValue = (e) => parseFloat(stat(e, league.table.sort)) || 0;
  if (!list.length) unavailable(table, 'Standings');
  for (const g of list) {
    const heads = league.table.cols.map(([h]) => h.padStart(6)).join('') + (league.table.noStreak ? '' : '   STK');
    table.text(clean(g.name).toUpperCase(), (' #' + heads).padEnd(44) + 'TEAM').rule();
    g.entries.slice().sort((a, b) => sortValue(b) - sortValue(a)).forEach((e, i) => {
      const t = e.team;
      teams.set(String(t.id), { team: t, entry: e, group: clean(g.name), rank: i + 1 });
      const nums = league.table.cols.map(([, k]) => String(stat(e, k)).padStart(6)).join('') + (league.table.noStreak ? '' : '   ' + String(stat(e, 'streak')).padEnd(4));
      table.row((String(i + 1).padStart(2) + nums).padEnd(44), { label: cut(clean(t.displayName), 27), href: 'team-' + t.id + '.html' });
    });
    table.blank();
  }
  footer(table);
  table.write(outDir);

  const sorted = [...teams.values()].sort((a, b) => a.team.displayName.localeCompare(b.team.displayName));
  const index = new Page(dir + 'teams.html', league.name + ' Teams');
  nav(index, league);
  index.text('ALL ' + sorted.length + ' TEAMS', '');
  for (let i = 0; i < sorted.length; i += 2) {
    const left = { label: cut(clean(sorted[i].team.displayName), 30), href: 'team-' + sorted[i].team.id + '.html' };
    const right = sorted[i + 1] && { label: cut(clean(sorted[i + 1].team.displayName), 30), href: 'team-' + sorted[i + 1].team.id + '.html' };
    index.row(left, ...(right ? [{ to: 38 }, right] : []));
  }
  footer(index, true);
  index.write(outDir);

  for (const { team, entry, group, rank } of sorted) {
    const p = new Page(dir + 'team-' + team.id + '.html', clean(team.displayName));
    nav(p, league);
    const art = logos[team.id];
    const centered = (s) => ' '.repeat(Math.max(0, Math.floor((COLS - Array.from(s).length) / 2))) + s;
    if (art) p.text(...art.map(l => ' '.repeat(20) + l), '');
    p.text(centered(clean(team.displayName).toUpperCase()), centered(group + ', #' + rank), '').rule();
    const rows = [['RECORD', summary(entry, 'overall')], ['HOME', summary(entry, 'Home')], ['ROAD', summary(entry, 'Road')],
      ['LAST 10', summary(entry, 'Last Ten Games')], ['STREAK', stat(entry, 'streak')]];
    rows.filter(([, v]) => v).forEach(([k, v]) => p.text(k.padEnd(9) + clean(v)));
    footer(p, true);
    p.write(outDir);
  }
  return { league, games, news: news || [], pages: sorted.length + 3 };
}

// One league's latest games in a frame, used on the sports page and the front page.
function scoreBox(page, result, href, count) {
  const list = (result.games || []).slice().sort((a, b) => Number(b.live) - Number(a.live)).slice(0, count);
  box(page, result.league.sport.toUpperCase(), [[{ label: 'All ' + result.league.name + ' scores', href }]]
    .concat(list.length ? list.map(g => [g.line]) : [['No games right now.']]), { center: true });
}

async function buildSports(outDir, dataDir) {
  const results = await Promise.all(LEAGUES.map(l => buildLeague(l, outDir, dataDir)));
  // top headlines: the newest two from each league, taking turns
  const seen = new Set(), top = [];
  for (let i = 0; i < 2; i++) for (const r of results) {
    const n = r.news[i];
    if (n && !seen.has(n.url)) { seen.add(n.url); top.push(n); }
  }
  const hub = new Page('sports/index.html', 'T-News Sports');
  nav(hub);
  if (top.length) lead(hub, top[0], await photo(top[0].image));
  else unavailable(hub, 'Headlines');
  if (top.length > 1) { sectionBar(hub, 'TOP STORIES'); columns(hub, top.slice(1, 10)); }
  sectionBar(hub, 'SCOREBOARD');
  results.forEach(r => scoreBox(hub, r, r.league.id + '/index.html', 4));
  footer(hub);
  hub.write(outDir);
  return { top, results, pages: results.reduce((n, r) => n + r.pages, 1) };
}

module.exports = { buildSports, scoreBox };
