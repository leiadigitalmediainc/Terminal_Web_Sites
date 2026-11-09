# Running the Terminal Directory (for the owner)

Everything happens in this repository's **Issues** on GitHub (the website or the GitHub
phone app). Only you, and anyone you give write access, can use the labels below.

## Your labels

| Label | What happens |
|---|---|
| `approve` | The site is listed (or let back in if it was held). Words it has now are accepted; only new ones will hold it again. |
| `hold` | The site is hidden from the directory right away, until you approve it. |
| `delist` | The site is removed and blocked from being added again. |

Add a label to the site's issue, and the robot does the rest within a minute or two and
replies on the issue.

## What lands in your Issues

- **"Add a site"** issues: the robot answers each one. Most are added straight away and closed.
- Issues labelled **`held`**: the sign-up check or the daily check found words that may break
  the rules. Open the site, read it, then add `approve` or `delist`. Word lists catch some
  innocent words ("Maine Coon cat"), so do look before deciding.
- Issues labelled **`report`**: someone reported a site. Look at it; add `hold` while you
  decide, then `approve` or `delist`.

To see what needs you: Issues, then filter by the label `held` or `report` (open issues only).

## Messaging a site's owner

Comment on their issue. GitHub emails them, and their reply comes back to you the same way.
Add `hold` first if the site should be hidden while you talk.

## Sexual content involving minors

Do not open, copy or save it. Add `delist` at once, then report the address to
Cybertip.ca (Canada) or report.cybertip.org (NCMEC, USA).

## Changing the word list

`directory/blocked-terms.json` holds the words, by category. Add or remove words there.
Our own sites carry `"trusted": true` in `directory/sites.json`, so the daily check never
hides them (T-News reports real news, which sometimes quotes these words).
