'use strict';
// T-News: headlines that link to the original story. Stories themselves stay with their
// publishers, so this site only carries each feed's headline and link.
const { banners, Page, headlines, stamp } = require('./lib');

const CBC = 'https://www.cbc.ca/webfeed/rss/rss-';
const SECTIONS = [
  { id: 'world', name: 'World', sources: [['BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml'], ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'], ['CBC News', CBC + 'world']] },
  { id: 'canada', name: 'Canada', sources: [['CBC News', CBC + 'canada']] },
  { id: 'usa', name: 'USA', sources: [['NPR', 'https://feeds.npr.org/1001/rss.xml']] },
  { id: 'uk', name: 'UK', sources: [['BBC News', 'https://feeds.bbci.co.uk/news/uk/rss.xml']] }
];
const LOCAL = [
  ['British Columbia', 'britishcolumbia'], ['Kamloops', 'kamloops'], ['Calgary', 'calgary'], ['Edmonton', 'edmonton'],
  ['Saskatchewan', 'saskatchewan'], ['Saskatoon', 'saskatoon'], ['Manitoba', 'manitoba'], ['Thunder Bay', 'thunderbay'],
  ['Sudbury', 'sudbury'], ['Windsor', 'windsor'], ['London', 'london'], ['Kitchener-Waterloo', 'kitchenerwaterloo'],
  ['Hamilton', 'hamiltonnews'], ['Toronto', 'toronto'], ['Ottawa', 'ottawa'], ['Montreal', 'montreal'],
  ['New Brunswick', 'newbrunswick'], ['Prince Edward Island', 'pei'], ['Nova Scotia', 'novascotia'],
  ['Newfoundland', 'newfoundland'], ['The North', 'north']
];

function nav(page) {
  const r = page.root + 'news/';
  page.text(...banners.news);
  page.bar([{ label: 'News', href: r + 'index.html' }]
    .concat(SECTIONS.map(s => ({ label: s.name, href: r + s.id + '.html' })))
    .concat([{ label: 'Local', href: r + 'local.html' }, { label: 'Sports', href: page.root + 'sports/index.html' }, { label: 'Home', href: page.root + 'index.html' }]));
  page.rule('═').blank();
}
const footer = (page, sources) => page.blank().rule().text('Headlines from ' + sources + '.', 'Choose a story to read it at the source. Updated ' + stamp() + '.');
function list(page, name, stories) {
  page.text(name.toUpperCase()).rule();
  if (stories && stories.length) stories.forEach(n => page.link(n.title, n.url));
  else page.text('Headlines are being updated. Please check back soon.');
  page.blank();
}

async function buildNews(outDir) {
  const loaded = await Promise.all(SECTIONS.map(async s => ({
    section: s,
    feeds: await Promise.all(s.sources.map(async ([name, url]) => ({ name, stories: await headlines(url, 15) })))
  })));
  for (const { section, feeds } of loaded) {
    const p = new Page('news/' + section.id + '.html', 'T-News ' + section.name);
    nav(p);
    feeds.forEach(f => list(p, section.name + ' - ' + f.name, f.stories));
    footer(p, section.sources.map(s => s[0]).join(', '));
    p.write(outDir);
  }

  const local = await Promise.all(LOCAL.map(async ([name, slug]) => ({ name, slug, stories: await headlines(CBC + 'canada-' + slug, 15) })));
  const picker = new Page('news/local.html', 'T-News Local');
  nav(picker);
  picker.text('LOCAL NEWS', 'Choose your area.', '');
  const ready = local.filter(l => l.stories && l.stories.length);
  ready.forEach(l => picker.link(l.name, 'local-' + l.slug + '.html'));
  footer(picker, 'CBC News');
  picker.write(outDir);
  for (const l of ready) {
    const p = new Page('news/local-' + l.slug + '.html', 'T-News ' + l.name);
    nav(p);
    p.link('Choose another area', 'local.html').blank();
    list(p, l.name, l.stories);
    footer(p, 'CBC News');
    p.write(outDir);
  }

  const front = new Page('news/index.html', 'T-News');
  nav(front);
  const world = loaded[0].feeds[0].stories, canada = loaded[1].feeds[0].stories;
  list(front, 'World', world && world.slice(0, 7));
  list(front, 'National - Canada', canada && canada.slice(0, 7));
  front.text('LOCAL').rule().link('Choose your area', 'local.html');
  footer(front, 'BBC News and CBC News');
  front.write(outDir);
  return { world, canada, pages: SECTIONS.length + ready.length + 2, localAreas: ready.length };
}

module.exports = { buildNews };
