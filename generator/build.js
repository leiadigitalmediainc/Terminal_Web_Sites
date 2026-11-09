'use strict';
// Builds the paper into public/. Run by GitHub on a schedule.
const fs = require('fs');
const path = require('path');
const { problems, attemptCount, Page, COLS } = require('./lib');
const { buildSports } = require('./sports');
const { buildNews } = require('./news');
const { buildDirectory } = require('./directory');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const sports = await buildSports(OUT, DATA);
  const news = await buildNews(OUT, sports);
  // the directory never stops the paper: its own failures only leave it out of date
  let directory = { sites: 0 };
  try { directory = await buildDirectory(OUT, DATA); } catch (e) { console.error('Directory:', e.message); }

  fs.writeFileSync(path.join(OUT, 'status.txt'), 'Updated ' + new Date().toISOString() + '\n' + attemptCount() + ' sources tried, ' + problems.length + ' problems\n' + problems.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  // GitHub shows 404.html for any address that has no page; its links are full addresses
  // because it can appear at any depth
  const lost = new Page('404.html', 'Page not found - T-News');
  const big = ['██  ██  ██████  ██  ██', '██  ██  ██  ██  ██  ██', '██████  ██  ██  ██████', '    ██  ██  ██      ██', '    ██  ██████      ██'];
  lost.blank().text(...big.map(l => ' '.repeat(Math.floor((COLS - l.length) / 2)) + l)).blank();
  lost.text(' '.repeat(Math.floor((COLS - 14) / 2)) + 'PAGE NOT FOUND').blank();
  lost.text('There is no page at this address. Stories move as the paper updates through', 'the day, so it may have been replaced by a newer one.').blank();
  lost.bar([{ label: 'T-News front page', href: 'https://leiadigitalmediainc.github.io/Terminal_Web_Sites/' }, { label: 'Sports', href: 'https://leiadigitalmediainc.github.io/Terminal_Web_Sites/sports/index.html' }]);
  lost.write(OUT);
  console.log((sports.pages + news.pages) + ' pages, ' + news.localAreas + ' local areas, ' + directory.sites + ' directory sites, ' + attemptCount() + ' sources, ' + problems.length + ' problems');
  problems.forEach(p => console.log('  ' + p));
  // If most sources failed, stop here: the last good site stays up instead of an empty one.
  if (problems.length > attemptCount() / 2) { console.error('Too many sources failed; keeping the published site.'); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
