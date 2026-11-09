'use strict';
// Screens a site's words against directory/blocked-terms.json. A match only ever HOLDS a
// site for a person to review; it never deletes anything, because word lists catch some
// innocent words too ("Maine Coon cat").
const fs = require('fs');
const path = require('path');

const { categories } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'directory', 'blocked-terms.json'), 'utf8'));

// lower case, no accents, common letter swaps undone, long runs of one letter shortened
function normalize(text) {
  return String(text || '').normalize('NFKD').replace(/[̀-ͯ​-‍﻿]/g, '').toLowerCase()
    .replace(/[0134578@$!|]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' }[c]))
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/[^a-z0-9\s'-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rules = [];
for (const [category, terms] of Object.entries(categories)) {
  for (const term of terms) {
    // the term as typed (digits kept, e.g. "1488") and with the same letter swaps as the text
    const forms = [...new Set([term.toLowerCase(), normalize(term).trim()])];
    const pattern = forms.map(f => escape(f).replace(/ /g, '[\\s-]+')).join('|');
    rules.push({ category, term, re: new RegExp('(^|[^a-z0-9])(' + pattern + ')(e?s)?(?=$|[^a-z0-9])', 'i') });
  }
}

// What in this text breaks the rules: [{ category, term }], at most one per term.
function screen(...texts) {
  const raw = texts.join(' \n ').toLowerCase();
  const text = normalize(raw);
  return rules.filter(r => r.re.test(text) || r.re.test(raw)).map(({ category, term }) => ({ category, term }));
}

// A short reason a person can read, naming categories, never quoting the words.
const describe = (hits) => [...new Set(hits.map(h => h.category))].join(', ');

module.exports = { screen, describe, normalize };
