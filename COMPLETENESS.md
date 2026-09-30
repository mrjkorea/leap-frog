# Leap Frog completeness

Live site (GitHub Pages, source `main` `/`): https://mrjkorea.github.io/leap-frog/

This pass checked every file needed to **play** on phone, tablet, classroom PC, and laptop at that same URL. Engine + JSON pack kept. Word list not hardcoded.

## Checked

| Surface | Path | Live before this fix |
| --- | --- | --- |
| Shell | `index.html` | 200, relative `./assets/…` (Pages-safe) |
| Engine | `assets/index-CjZdu9-4.js` | 200 |
| CSS | `assets/index-CUDl5GZZ.css` | 200 |
| Default pack | `packs/starter-en.json` | 200 (11 addition-word items, not hardcoded) |
| Pack swap files | `packs/starter.csv`, `packs/starter.xlsx` | 200 |
| Baked audio | `audio/frog-ribbit`, `splash-heavy`, `splash-dunk` (wav) | 200 |
| Extra audio | `audio/frog-croak.wav` | 200, unused by engine |
| Piranha texture | `textures/piranha.png` | 200, loaded |
| Flip texture | `textures/piranha-flip.png` | 200, unused |
| HOW-TO-PLAY | `HOW-TO-PLAY.md` / `.html` | **404** |
| TTS | `/api/tts`, `speechSynthesis` | not present (good) |

Gameplay already in the bundle (kept):

- Three lily pads = left / center / right.
- Phone/tablet: tap pad or tap word label.
- Computer: keys `1 2 3` and `← ↑ →`.
- Pack drop (xlsx / csv / json) and `?pack=` URL.
- 15s timer, 3 lives, 5 correct hops to land.
- AudioContext unlocks on **Start jumping** (user gesture).

## Broken (before)

1. **Default pack 404.** Boot tried `./packs/animals.json` first (not in the repo), then fell back to `starter-en.json`. Extra failed fetch on every load.
2. **HOW-TO-PLAY missing.** No markdown/HTML page. In-game help (`#lf-help`) was forced `hidden` even during play.
3. **L/C/R corridor too tight.** Lane gap was pad diameter + `0.36`. Piranhas used a hardcoded `±3.6268` that sat on the pads instead of in the water between/outside L, C, and R.
4. **Audio format.** Engine fetched WAV only. User rule is baked local MP3/WAV, no TTS.
5. **Pack-swap copy.** After a drop, UI said “Get each right 3 times” but the engine still needs **5 unique correct hops**.
6. **Arrow keys.** Play keys did not `preventDefault` (classroom PC / laptop).

## Fixed

- Default pack is `./packs/starter-en.json` only. `?pack=` and the drop zone still swap packs without hardcoding words.
- Added `HOW-TO-PLAY.html` + `HOW-TO-PLAY.md`. Start card links to it. Help overlay shows during play (`L · C · R`).
- Lane spacing extra gap `0.36` → `1.02`. Piranha idle x uses lane midpoints and outside-lane water, not a hardcoded overlap.
- Baked `audio/*.mp3` from the existing local WAVs. Loader tries MP3 then WAV. Oscillator fallbacks remain if decode fails.
- Keyboard handler `preventDefault`s 1/2/3 and arrows while playing.
- Version pill `v2.1` so the live Pages build is identifiable.

## Remaining gaps

- `textures/piranha-flip.png` is not referenced (right-facing sheet is unused).
- `audio/frog-croak.*` is credited/baked but the hop SFX uses `frog-ribbit`.
- Pack field `mastery_correct: 3` is parsed and ignored; win is engine `Ta = 5` (same as the start-card copy). Changing that would change gameplay, so it was left.
- `starter.csv` / `starter.xlsx` are a different (grammar) list from `starter-en.json` (math words). That is useful for pack-swap tests, not a 404.
- No favicon (`/favicon.ico` 404). Does not block play.
- GitHub Pages still has to rebuild `main` after this branch is merged.
