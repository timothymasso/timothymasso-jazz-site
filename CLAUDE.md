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
- Intro: the page loads black (`tm-boot` class in `<head>`), then `skyRef` plays the season curtain (`_curtain()`) over the sky and field only.
- Season switch: `pick()` → `_curtain(swap)` — black wipe behind the name, season swaps behind it, then it wipes down and fades.
- Card hover parts the grass: `_spin` collects each moving card's gap, `_partDraw` redraws only the gap's columns of the layer in front (WebGL shader in `_windGL`, `pc/pw/pk/pb/pt` uniforms). No parting in winter.
- Respect `prefers-reduced-motion` (`this._rm`) when adding animation.

## Notes
- History: built in Claude Design, then edited in a Claude artifact. The artifact is no longer the source of truth — this folder is.
- Spotify "now playing" needs the separate worker (not in this folder).
- Big images worth compressing before hosting: recital-*.png (~19 MB total), program.png, about-banner.png.
- Hosting idea: GitHub Pages or Cloudflare Pages/Netlify straight from this folder (`.nojekyll` is already here).
