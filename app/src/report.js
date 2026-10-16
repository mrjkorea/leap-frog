// MRJ score + progress hooks — same rows as the old engine (cloud only, nothing saved on the device).
//   per item  -> program "leap-frog", itemId "<pack_id>:<item_id>", itemType "word", 1/1 or 0/1
//   per round -> itemId "round:<pack_id>", itemType "round", correct / answered, metadata {round,lives,dead,corrects,target}
// Uses window.MRJ_LF_PROGRESS (mrj-leap-frog-progress.js) when present, with the old inline fallbacks.
export const PROGRAM = "leap-frog";
const student = () => { try { return (window.MRJ_AUTH && window.MRJ_AUTH.student && window.MRJ_AUTH.student()) || ""; } catch (e) { return ""; } };

export function mrjPost(pack, item, correct) {
  try {
    const s = student();
    if (!s || !window.MRJ_SCORES || typeof window.MRJ_SCORES.post != "function" || !item || !item.item_id) return;
    const api = window.MRJ_LF_PROGRESS;
    const opts = api && api.buildWordPostOpts ? api.buildWordPostOpts(pack, item, correct) : {
      program: PROGRAM, itemId: (pack.pack_id || "pack") + ":" + item.item_id, scoreValue: correct ? 1 : 0, scoreMax: 1,
      appName: "MRJ Leap Frog", bookTitle: pack.title || pack.pack_id, itemType: "word", correctness: correct ? "correct" : "incorrect" };
    window.MRJ_SCORES.post(Object.assign({ student: String(s).trim() }, opts));
  } catch (e) {}
}
export function mrjPostRound(pack, c, dead, target) {
  try {
    const rk = "__mrj_round_posted_" + c.round;
    if (c.roundDone[rk]) return;
    c.roundDone[rk] = true;
    const s = student();
    if (!s || !window.MRJ_SCORES || typeof window.MRJ_SCORES.post != "function") return;
    const meta = { round: c.round, lives: c.lives, dead: !!dead, corrects: c.corrects, target };
    const api = window.MRJ_LF_PROGRESS;
    const opts = api && api.buildRoundPostOpts ? api.buildRoundPostOpts(pack, c.records, meta) : {
      program: PROGRAM, itemId: "round:" + (pack.pack_id || "pack"), scoreValue: c.records.filter((r) => r.correct).length,
      scoreMax: c.records.length || 1, appName: "MRJ Leap Frog", bookTitle: pack.title || pack.pack_id, itemType: "round", metadata: meta };
    window.MRJ_SCORES.post(Object.assign({ student: String(s).trim() }, opts));
  } catch (e) {}
}
export function passedMap(pack, progress) {
  const api = window.MRJ_LF_PROGRESS;
  if (api && typeof api.passedMapFromRows === "function") return api.passedMapFromRows(progress, api.PROGRAM || PROGRAM, pack.pack_id);
  const latest = {};
  for (const row0 of Array.isArray(progress) ? progress : []) {
    const row = row0 || {};
    if (String(row.program || row.curriculum_program || "").trim() !== PROGRAM) continue;
    const ri = String(row.itemId || row.item_id || row.item || "").trim();
    let item = "";
    if (ri && ri.indexOf("round:") !== 0) { const k = ri.indexOf(":"); if (k < 0) item = ri; else { const cur = String(pack.pack_id || "").trim(); item = !cur || ri.slice(0, k) === cur ? ri.slice(k + 1) : ""; } }
    if (!item) continue;
    const raw = row.scoreValue != null ? row.scoreValue : row.score != null ? row.score : row.scorePct;
    const num = typeof raw === "number" ? raw : parseFloat(String(raw == null ? "" : raw).split("/")[0]);
    const max = row.scoreMax != null ? Number(row.scoreMax) : NaN, pct = row.scorePct != null ? Number(row.scorePct) : NaN;
    const pass = Number.isFinite(pct) ? pct >= 100 : Number.isFinite(max) && max > 0 && Number.isFinite(num) ? num >= max : Number.isFinite(num) && num > 0;
    if (pass) latest[item] = true; else if (latest[item] !== true) latest[item] = false;
  }
  return latest;
}
// Word Master parent frame: every word right -> same message as the old build.
export function wmDone(c, pack) {
  let n = 0;
  try { n = Object.keys(c.roundDone).filter((k) => c.roundDone[k] && k.indexOf("__mrj") !== 0).length; } catch (e) {}
  const need = (pack.items && pack.items.length) || 0; // wm:all-items
  if (need && n >= need) try { parent.postMessage({ type: "mrj-wm-game-done", game: "leapfrog", items: n, correct: c.corrects | 0, finished: true }, "*"); } catch (e) {}
}
