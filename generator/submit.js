'use strict';
// Run by GitHub when someone opens an issue with the "Add a site" form, or when a maintainer
// labels an issue "delist". Adds or removes the site in directory/sites.json and writes the
// answer to reply.md. The issue text arrives in ISSUE_BODY and is never run, only read.
const fs = require('fs');
const path = require('path');
const { siteAddress, sameSite, isBuilderPage, getPage } = require('./directory');

const LIST = path.join(__dirname, '..', 'directory', 'sites.json');
const MAX_SITES = 1000;
const body = String(process.env.ISSUE_BODY || '').slice(0, 5000);
const action = process.env.ACTION;

const output = (key, value) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, key + '=' + value + '\n'); };
const reply = (text, { changed = false, close = true } = {}) => {
  fs.writeFileSync('reply.md', text + '\n');
  output('changed', String(changed));
  output('close', String(close));
  output('reply', 'true');
  console.log(text);
};
// the address typed into the form: the first line after the form's heading
const field = (heading) => {
  const m = new RegExp('###\\s*' + heading + '\\s*\\n+\\s*(\\S+)', 'i').exec(body);
  return m ? m[1] : '';
};

(async () => {
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  const save = () => fs.writeFileSync(LIST, JSON.stringify(list, null, 2) + '\n');

  if (action === 'labeled') {
    const url = siteAddress(field('Site address') || field('Site to report'));
    if (!url) return reply('No site address found in this issue, so nothing was removed.', { close: false });
    const before = list.sites.length;
    list.sites = list.sites.filter(s => !sameSite(s.url, url));
    if (!list.removed.some(r => sameSite(r, url))) list.removed.push(url);
    save();
    return reply(list.sites.length < before ? 'Removed ' + url + ' from the Terminal Directory. It drops off the search within the hour.' : url + ' was not listed; it is now blocked from being added.', { changed: true });
  }

  if (/###\s*Site to report/i.test(body)) {
    return reply('Thanks for the report. A person will look at this site and remove it if it breaks the rules.', { close: false });
  }
  if (!/###\s*Site address/i.test(body)) return output('reply', '');   // some other issue: leave it alone

  const url = siteAddress(field('Site address'));
  if (!url) return reply('That address could not be used. It needs to be a full https:// address, like https://yourname.github.io/my-site/');
  if (list.removed.some(r => sameSite(r, url))) return reply('This site was removed from the directory and cannot be added again.');
  if (list.sites.some(s => sameSite(s.url, url))) return reply(url + ' is already in the Terminal Directory.');
  if (list.sites.length >= MAX_SITES) return reply('The directory is full for now. Please try again later.', { close: false });
  const html = await getPage(url);
  if (!html) return reply('Could not open ' + url + '. Check the address works in a browser, then try again.');
  if (!isBuilderPage(html)) return reply('Only sites made with Terminal Web Builder can be added, and ' + url + ' is not one. Make your site in Terminal Web Builder, publish it, then add it here.');
  list.sites.push({ url, added: new Date().toISOString().slice(0, 10) });
  save();
  reply('Added ' + url + ' to the Terminal Directory. It shows up in searches within the hour.', { changed: true });
})().catch(e => { reply('Something went wrong checking this site: ' + e.message, { close: false }); });
