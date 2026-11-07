'use strict';
// The paper's news sections. Stories stay with their publishers: a page carries the feed's
// headline, short summary and picture, and a link to read the whole story at the source.
const { Page, headlines, stamp } = require('./lib');
const { masthead, sectionBar, lead, columns, box } = require('./paper');
const { photo } = require('./photo');
const { scoreBox } = require('./sports');

const BBC = 'https://feeds.bbci.co.uk/news/';
const CBC = 'https://www.cbc.ca/webfeed/rss/rss-';
const SECTIONS = [
  { id: 'world', name: 'World', sources: [['BBC News', BBC + 'world/rss.xml'], ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'], ['CBC News', CBC + 'world']] },
  { id: 'canada', name: 'Canada', sources: [['CBC News', CBC + 'canada']] },
  { id: 'usa', name: 'USA', sources: [['NPR', 'https://feeds.npr.org/1001/rss.xml']] },
  { id: 'uk', name: 'UK', sources: [['BBC News', BBC + 'uk/rss.xml']] },
  { id: 'business', name: 'Business', sources: [['CBC News', CBC + 'business'], ['BBC News', BBC + 'business/rss.xml']] },
  { id: 'tech', name: 'Tech', sources: [['BBC News', BBC + 'technology/rss.xml'], ['CBC News', CBC + 'technology']] },
  { id: 'science', name: 'Science', sources: [['BBC News', BBC + 'science_and_environment/rss.xml']] },
  { id: 'arts', name: 'Arts', sources: [['CBC News', CBC + 'arts'], ['BBC News', BBC + 'entertainment_and_arts/rss.xml']] }
];
const LOCAL = [
  ['British Columbia', 'britishcolumbia'], ['Kamloops', 'kamloops'], ['Calgary', 'calgary'], ['Edmonton', 'edmonton'],
  ['Saskatchewan', 'saskatchewan'], ['Saskatoon', 'saskatoon'], ['Manitoba', 'manitoba'], ['Thunder Bay', 'thunderbay'],
  ['Sudbury', 'sudbury'], ['Windsor', 'windsor'], ['London', 'london'], ['Kitchener-Waterloo', 'kitchenerwaterloo'],
  ['Hamilton', 'hamiltonnews'], ['Toronto', 'toronto'], ['Ottawa', 'ottawa'], ['Montreal', 'montreal'],
  ['New Brunswick', 'newbrunswick'], ['Prince Edward Island', 'pei'], ['Nova Scotia', 'novascotia'],
  ['Newfoundland', 'newfoundland'], ['The North', 'north']
];

const footer = (page) => page.blank().rule().text('Headlines, summaries and pictures belong to their publishers.', 'Updated ' + stamp() + '. Requests: TerminalWeb@protonmail.com');
const waiting = (page) => page.text('Stories are being updated. Please check back soon.', '');

// The feeds of one section, taking turns so no single publisher fills the page.
function merge(feeds) {
  const seen = new Set(), out = [];
  const longest = Math.max(0, ...feeds.map(f => (f.stories || []).length));
  for (let i = 0; i < longest; i++) {
    for (const f of feeds) {
      const s = (f.stories || [])[i];
      if (s && !seen.has(s.title)) { seen.add(s.title); out.push({ ...s, source: f.name }); }
    }
  }
  return out;
}
const pictureFirst = (stories) => {
  const i = stories.findIndex(s => s.image);
  return i > 0 ? [stories[i], ...stories.slice(0, i), ...stories.slice(i + 1)] : stories;
};

async function storyPage(file, title, section, stories, before) {
  const p = new Page(file, title);
  masthead(p, section);
  p.blank();
  if (before) before(p);
  const list = pictureFirst(stories);
  if (!list.length) waiting(p);
  else {
    lead(p, list[0], await photo(list[0].image));
    if (list.length > 1) { sectionBar(p, 'MORE STORIES'); columns(p, list.slice(1, 10)); }
    if (list.length > 10) {
      sectionBar(p, 'ALSO IN ' + section.toUpperCase());
      list.slice(10, 20).forEach(s => p.link(s.title, s.url));
    }
  }
  footer(p);
  return p;
}

async function buildNews(outDir, sports) {
  const loaded = await Promise.all(SECTIONS.map(async s => ({
    section: s,
    stories: merge(await Promise.all(s.sources.map(async ([name, url]) => ({ name, stories: await headlines(url, 20) }))))
  })));
  for (const { section, stories } of loaded) {
    (await storyPage('news/' + section.id + '.html', 'T-News ' + section.name, section.name, stories)).write(outDir);
  }

  const local = await Promise.all(LOCAL.map(async ([name, slug]) => {
    const stories = await headlines(CBC + 'canada-' + slug, 20);
    return { name, slug, stories: (stories || []).map(s => ({ ...s, source: 'CBC News' })) };
  }));
  const ready = local.filter(l => l.stories.length);
  const picker = new Page('news/local.html', 'T-News Local');
  masthead(picker, 'Local');
  picker.blank();
  sectionBar(picker, 'CHOOSE YOUR AREA');
  for (let i = 0; i < ready.length; i += 2) {
    const left = { label: ready[i].name, href: 'local-' + ready[i].slug + '.html' };
    const right = ready[i + 1] && { label: ready[i + 1].name, href: 'local-' + ready[i + 1].slug + '.html' };
    picker.row(left, ...(right ? [{ to: 38 }, right] : []));
  }
  footer(picker);
  picker.write(outDir);
  for (const l of ready) {
    const before = (p) => p.link('Choose another area', 'local.html').blank();
    (await storyPage('news/local-' + l.slug + '.html', 'T-News ' + l.name, l.name, l.stories, before)).write(outDir);
  }

  // Front page: the biggest story, then a little of every section.
  const front = new Page('index.html', 'T-News');
  masthead(front, 'Front Page');
  front.blank();
  const stories = (id) => loaded.find(l => l.section.id === id).stories;
  const world = pictureFirst(stories('world'));
  if (world.length) lead(front, world[0], await photo(world[0].image));
  else waiting(front);
  sectionBar(front, 'WORLD');
  columns(front, world.slice(1, 4));
  sectionBar(front, 'CANADA');
  columns(front, stories('canada').slice(0, 3));
  sectionBar(front, 'SPORTS');
  columns(front, (sports.top || []).slice(0, 3));
  sports.results.filter(r => (r.games || []).length).slice(0, 3).forEach(r => scoreBox(front, r, 'sports/' + r.league.id + '/index.html', 3));
  front.blank();
  sectionBar(front, 'BUSINESS');
  columns(front, stories('business').slice(0, 3));
  sectionBar(front, 'TECH');
  columns(front, stories('tech').slice(0, 3));
  box(front, 'LOCAL NEWS', [[{ label: 'Choose your area', href: 'news/local.html' }]]);
  footer(front);
  front.write(outDir);
  return { pages: SECTIONS.length + ready.length + 2, localAreas: ready.length };
}

module.exports = { buildNews };
