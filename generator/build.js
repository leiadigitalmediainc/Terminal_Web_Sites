'use strict';
// Builds every site into public/. Run by GitHub on a schedule; needs Node 20+ and no packages.
const fs = require('fs');
const path = require('path');
const { banners, Page, problems, attemptCount, stamp } = require('./lib');
const { buildSports } = require('./sports');
const { buildNews } = require('./news');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const [sports, news] = await Promise.all([buildSports(OUT, DATA), buildNews(OUT)]);

  const home = new Page('index.html', 'Terminal Web Sites');
  home.text(...banners.home);
  home.bar([{ label: 'T-Sports', href: 'sports/index.html' }, { label: 'T-News', href: 'news/index.html' }]);
  home.rule('═').blank().text('TOP NEWS').rule();
  (news.world || []).slice(0, 5).forEach(n => home.link(n.title, n.url));
  home.blank().text('TOP SPORTS').rule();
  (sports.top || []).slice(0, 5).forEach(n => home.link(n.title, n.url));
  home.blank().rule().text('Updated ' + stamp() + '. These pages update themselves.');
  home.write(OUT);

  fs.writeFileSync(path.join(OUT, 'status.txt'), 'Updated ' + new Date().toISOString() + '\n' + attemptCount() + ' sources tried, ' + problems.length + ' problems\n' + problems.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log((sports.pages + news.pages + 1) + ' pages, ' + news.localAreas + ' local areas, ' + attemptCount() + ' sources, ' + problems.length + ' problems');
  problems.forEach(p => console.log('  ' + p));
  // If most sources failed, stop here: the last good site stays up instead of an empty one.
  if (problems.length > attemptCount() / 2) { console.error('Too many sources failed; keeping the published site.'); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
