# How to play Leap Frog

Same URL on phone, tablet, classroom PC, and laptop.

## Goal

Hop the frog to the **correct lily pad**. Get **5 right answers** to reach land.

## Controls

| Device | Left pad | Center pad | Right pad |
| --- | --- | --- | --- |
| Phone / tablet | Tap left pad | Tap center pad | Tap right pad |
| Computer / classroom PC | `1` or `←` | `2` or `↑` | `3` or `→` |

You can also tap the word label on a pad.

## Rules

- Read the question above the pads.
- You have **15 seconds**. Waiting too long sinks the home pad.
- Right hop: the frog jumps and croaks.
- Wrong hop or timeout: splash / chomp, and you lose a life.
- Three lives. Reach land with 5 correct hops.

## Word packs

Words come from a JSON pack (`packs/starter-en.json`), not a hardcoded list.

- Drop an Excel / CSV / JSON pack on the start screen, or pick a file.
- Or open with `?pack=packs/starter.csv` (path is relative to this site).

Need `question`, `correct`, and at least one wrong answer.

## Audio

Baked local files only (`audio/*.mp3` with `.wav` fallback). No server TTS and no `speechSynthesis`. Sound unlocks when you tap **Start jumping**.

[Play Leap Frog](./)
