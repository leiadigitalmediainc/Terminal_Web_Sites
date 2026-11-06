# Terminal Web Sites

Text sites for [Terminal Web](https://github.com/leiadigitalmediainc/TeminalWeb), built and
published automatically. GitHub runs `generator/build.js` every 15 minutes and publishes the
result with GitHub Pages. Nobody needs to touch it.

- **T-Sports**: scores, standings, teams and headlines for the NHL, NBA, MLB, NFL, MLS,
  Premier League and WNBA.
- **T-News**: world, national and local headlines that link to the original stories.

`public/status.txt` on the published site shows the last update and any source that failed.
If most sources fail, the last good site stays up.

## Adding a league

Add one entry to `LEAGUES` in `generator/sports.js`. Team logos live in `data/logos` as text.

## Content notice

Team logos are text interpretations used to identify teams. This project is not affiliated
with any team or league. News items are headlines linking to their publishers. To ask for
anything to be removed, contact TerminalWeb@protonmail.com.
