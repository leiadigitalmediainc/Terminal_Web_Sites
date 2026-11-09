'use strict';
// After the build: for every site the daily check just hid (new-holds.json), open an issue so
// the directory's owner hears about it. The issue uses the report form's layout, so the
// approve / delist labels work on it. Runs gh directly, never through a shell.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const file = path.join(__dirname, '..', 'new-holds.json');
if (!fs.existsSync(file)) process.exit(0);
const holds = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const { url, reason } of holds) {
  const body = '### Site to report\n\n' + url + '\n\n### What is wrong with it?\n\n' +
    'The daily check found words that may break the directory rules (' + reason + '), so the site is hidden for now.\n\n' +
    'To decide: add the label **approve** to list it again, or **delist** to remove and block it. ' +
    'Comment here to message the owner first if you like.';
  execFileSync('gh', ['issue', 'create', '--repo', process.env.GITHUB_REPOSITORY, '--title', 'Held automatically: ' + url, '--body', body, '--label', 'held'], { stdio: 'inherit' });
}
fs.unlinkSync(file);
