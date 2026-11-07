# Terminal Web Sites

T-News, a newspaper for [Terminal Web](https://github.com/leiadigitalmediainc/TeminalWeb), built
and published automatically. GitHub runs `generator/build.js` on a schedule and publishes the
result with GitHub Pages. Nobody needs to touch it.

- **Sections**: Front Page, World, Canada, USA, UK, Local, Business, Tech, Science, Arts, Sports.
- **Sports**: scores, standings and teams for the NHL, NBA, MLB, NFL, MLS, Premier League and WNBA.
- **Layout** (`generator/paper.js`): masthead, section menu, lead story, framed boxes, and
  stories that flow from one column into the next.
- **Pictures** (`generator/photo.js`): each section's lead picture becomes text in five shades.
  Only the text is published. Set `ENABLED` to `false` there to remove every picture.

`status.txt` on the published site shows the last update and any source that failed. If most
sources fail, the last good site stays up. A picture that fails is simply left out.

## Adding a league

Add one entry to `LEAGUES` in `generator/sports.js`. Team logos live in `data/logos` as text.

## Content notice

Team logos are text interpretations used to identify teams. This project is not affiliated
with any team or league. Headlines, summaries and pictures belong to their publishers and link
to the original stories. To ask for anything to be removed, contact TerminalWeb@protonmail.com.
