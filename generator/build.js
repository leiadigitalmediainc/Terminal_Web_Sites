'use strict';
// Builds the paper into public/. Run by GitHub on a schedule.
const fs = require('fs');
const path = require('path');
const { problems, attemptCount } = require('./lib');
const { buildSports } = require('./sports');
const { buildNews } = require('./news');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const sports = await buildSports(OUT, DATA);
  const news = await buildNews(OUT, sports);

  fs.writeFileSync(path.join(OUT, 'status.txt'), 'Updated ' + new Date().toISOString() + '\n' + attemptCount() + ' sources tried, ' + problems.length + ' problems\n' + problems.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log((sports.pages + news.pages) + ' pages, ' + news.localAreas + ' local areas, ' + attemptCount() + ' sources, ' + problems.length + ' problems');
  problems.forEach(p => console.log('  ' + p));
  // If most sources failed, stop here: the last good site stays up instead of an empty one.
  if (problems.length > attemptCount() / 2) { console.error('Too many sources failed; keeping the published site.'); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
