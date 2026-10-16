# leap-frog

MRJ kid English game. Live: https://mrjkorea.github.io/leap-frog/

v3 rebuild: clean source in `app/src` (Vite + Canvas 2D, no framework).

- `app/src/kit/` shared, platform-neutral pieces (audio with tap unlock, responsive canvas + auto low quality, particles/shake/floating text, pointer+keyboard input). Nothing desktop-only, so the same code can be wrapped by Capacitor (Android/iOS) or Tauri (Mac/Windows).
- `app/src/game.js` learning loop (unchanged rules), `art.js` vector art, `pack.js` pack formats, `report.js` MRJ score/progress hooks.
- `npm run build` builds and publishes to the repo root (Pages). `node scripts/publish.mjs --wm <word-master>/games/leap-frog` writes the Word Master copy.
- `npm test`, `npm run smoke [shotsDir] [wmDir]` (headless Chromium, zz_test ids, score posts intercepted).
- `?q=low` forces low quality; `?mode=maker` shows the pack drop zone. Default pack `packs/starter-en.json`, or `?pack=`.
