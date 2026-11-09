'use strict';
// Run by GitHub when someone opens an issue with the "Add a site" or "Report a site" form,
// or when the directory's owner puts a label on an issue:
//   approve  list the site (or let a held site back in)
//   hold     hide the site until it is approved
//   delist   remove the site and block it from being added again
// Only people with write access to the repository can add labels, so labels are the admin
// controls. Changes go to directory/sites.json; the answer for the issue goes to reply.md.
// The issue text arrives in ISSUE_BODY and is only ever read, never run.
const fs = require('fs');
const { siteAddress, sameSite, isBuilderPage, getPage, crawl, siteHits, RULES_URL, LIST_FILE } = require('./directory');
const { describe } = require('./screen');

const MAX_SITES = 1000;
const body = String(process.env.ISSUE_BODY || '').slice(0, 5000);
const action = process.env.ACTION;
const label = process.env.LABEL;
const today = () => new Date().toISOString().slice(0, 10);

const output = (key, value) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, key + '=' + value + '\n'); };
// close: close the issue; tag: a label to add (e.g. "held" so it shows in the review list)
const reply = (text, { changed = false, close = true, tag = '' } = {}) => {
  fs.writeFileSync('reply.md', text + '\n');
  output('changed', String(changed));
  output('close', String(close));
  output('tag', tag);
  output('reply', 'true');
  console.log(text);
};
// the address typed into a form: the first word after the form's heading
const field = (heading) => {
  const m = new RegExp('###\\s*' + heading + '\\s*\\n+\\s*(\\S+)', 'i').exec(body);
  return m ? m[1] : '';
};
const issueSite = () => siteAddress(field('Site address') || field('Site to report'));

(async () => {
  const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  const save = () => fs.writeFileSync(LIST_FILE, JSON.stringify(list, null, 2) + '\n');
  const listed = (url) => list.sites.find(s => sameSite(s.url, url));

  // ───────── the owner's labels ─────────
  if (action === 'labeled') {
    const url = issueSite();
    if (!url) return reply('No site address found in this issue, so nothing was changed.', { close: false });
    const site = listed(url);

    if (label === 'delist') {
      list.sites = list.sites.filter(s => !sameSite(s.url, url));
      if (!list.removed.some(r => sameSite(r, url))) list.removed.push(url);
      save();
      return reply(url + ' has been removed from the Terminal Directory for breaking its rules (' + RULES_URL + '), and it cannot be added again.', { changed: true });
    }

    if (label === 'hold') {
      if (!site) return reply(url + ' is not in the directory, so there is nothing to hold.', { close: false });
      site.held = { reason: 'held by the Terminal Directory team', since: today(), by: 'owner' };
      save();
      return reply(url + ' is hidden from the Terminal Directory while it is reviewed against the rules (' + RULES_URL + '). We will reply here.', { changed: true, close: false, tag: 'held' });
    }

    if (label === 'approve') {
      if (list.removed.some(r => sameSite(r, url))) return reply(url + ' was removed and blocked. Take it off the blocked list in directory/sites.json first if you want it back.', { close: false });
      // words the site has now are accepted; only new ones will hold it again
      const pages = await crawl(url);
      if (!pages.length) return reply('Could not read ' + url + ' as a Terminal Web Builder site right now, so it was not approved. Try again later.', { close: false });
      const approvedTerms = [...new Set(siteHits(pages).map(h => h.term))];
      if (site) { delete site.held; site.approvedTerms = approvedTerms; }
      else list.sites.push({ url, added: today(), approvedTerms });
      save();
      return reply(url + ' is approved and listed in the Terminal Directory. It shows up in searches within the hour.', { changed: true });
    }
    return output('reply', '');
  }

  // ───────── reports ─────────
  if (/###\s*Site to report/i.test(body)) {
    return reply('Thanks for the report. A person will look at this site and remove it if it breaks the rules.', { close: false, tag: 'report' });
  }
  if (!/###\s*Site address/i.test(body)) return output('reply', '');   // some other issue: leave it alone

  // ───────── new sites ─────────
  const url = siteAddress(field('Site address'));
  if (!url) return reply('That address could not be used. It needs to be a full https:// address, like https://yourname.github.io/my-site/');
  if (list.removed.some(r => sameSite(r, url))) return reply('This site was removed from the directory and cannot be added again.');
  if (listed(url)) return reply(url + ' is already in the Terminal Directory.');
  if (list.sites.length >= MAX_SITES) return reply('The directory is full for now. Please try again later.', { close: false });
  const html = await getPage(url);
  if (!html) return reply('Could not open ' + url + '. Check the address works in a browser, then try again.');
  if (!isBuilderPage(html)) return reply('Only sites made with Terminal Web Builder can be added, and ' + url + ' is not one. Make your site in Terminal Web Builder, publish it, then add it here.');

  // read the whole site and check it against the rules before it is listed
  const hits = siteHits(await crawl(url));
  if (hits.length) {
    list.sites.push({ url, added: today(), held: { reason: describe(hits), since: today(), by: 'sign-up check' } });
    save();
    return reply('Thanks! Before ' + url + ' is listed, a person needs to look at it: the automatic check found words that may break the directory rules (' + describe(hits) + '). ' +
      'You will get an answer here. The rules: ' + RULES_URL, { changed: true, close: false, tag: 'held' });
  }
  list.sites.push({ url, added: today() });
  save();
  reply('Added ' + url + ' to the Terminal Directory. It shows up in searches within the hour. Please keep it within the directory rules: ' + RULES_URL, { changed: true });
})().catch(e => { reply('Something went wrong checking this site: ' + e.message, { close: false }); });
