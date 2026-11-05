# Timothy Masso — personal site

Static site, no build step. Open `index.html` through a local server (it fetches JSON, so `file://` won't work):

    python -m http.server 8000      # then visit http://localhost:8000

## Files
- `index.html` — the whole site (one page, hash routes like `#/music`, `#/photos`, `#/about`).
  Exported from Claude Design, so it uses the "dc" format:
  - markup inside `<x-dc>` with `{{ value }}` template bindings, `<sc-for>` / `<sc-if>`, `style-hover="..."`
  - one big logic class (DCLogic Component) whose `renderVals()` returns every bound value
  - React 18 + Babel load from unpkg; `support.js` is the runtime that wires it together
- `assets/` — images, photos (`photos/` + `photos/sm/`), gig PDFs, `scores/` (sheet music PDFs),
  `yt/<videoId>/` (local YouTube thumbnails), `shows.json`, `music-blocks.json`, `recordings-review.json`
- `fonts/` — self-hosted Fontshare fonts (Gambarino is the display face). Newsreader + Mrs Saint Delafield come from Google Fonts.

## Home page "field" (the seasonal grass/snow scene) — where things live in index.html
- `_seasonParams(k)` — per-season look: grass hue/height (`h`, `hm`), haze, `skyAll` (sky gradient, sun/moon), `snow`, breeze particle kind (`bz`).
- `drawRow` / `drawGroup` — canvas grass/snow rows; `_breeze` — falling snow, petals, butterflies, leaves, sparkles.
- Card hover springs are in the rAF tick (`_lift`, `_pull`, `_cs`); hover intent in `hover()`, `_chkLeave`.
- Sky: `skyRef` + `fit()` paints one page-level gradient behind the header, name and field.
- Sizing: field height is a CSS `clamp()` on the ring container (fits viewport height); `_ck` scales cards + grass for short windows; `_onRs` relayouts after resizing settles.
- Intro: black overlay fades out once the field is drawn (created in `skyRef`).
- Season switch: `pick()` — black wipe behind the name, squiggle stays on top.
- Respect `prefers-reduced-motion` (`this._rm`) when adding animation.

## Notes
- History: built in Claude Design, then edited in a Claude artifact. The artifact is no longer the source of truth — this folder is.
- Known open issue: the "Tavern Trek" link opens the 1899 gig.
- Spotify "now playing" needs the separate worker (not in this folder).
- Big images worth compressing before hosting: assets/profile.jpg (20 MB), recital-*.png (~19 MB total).
- Hosting idea: GitHub Pages or Cloudflare Pages/Netlify straight from this folder (`.nojekyll` is already here).
