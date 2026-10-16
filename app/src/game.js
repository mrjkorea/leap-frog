// Leap Frog — learning loop identical to the old engine:
//   question + 3 lily pads (L/C/R), one correct. 15s timer (pack.seconds) sinks the home pad.
//   right: +100 + time bonus, hop; wrong / timeout: -1 life (3 lives), splash or CHOMP (when land is near).
//   standalone: 5 right hops reach land. Word Master: every word right (wm:all-items).
import { createStage } from "./kit/stage.js";
import { createFx, ease, lerp, clamp } from "./kit/fx.js";
import { createInput } from "./kit/input.js";
import { el, esc, muteButton } from "./kit/ui.js";
import { createAudio } from "./kit/audio.js";
import { shuffle } from "./pack.js";
import { mrjPost, mrjPostRound, passedMap, wmDone } from "./report.js";
import { drawWater, drawReeds, drawShore, drawPad, drawFrog, drawPiranha, drawFly } from "./art.js";

const LIVES = 3, TARGET = 5, ROUNDS = 1;
const rec = (o) => ({ student_id: "", session_id: "", module_id: "leap_frog", activity_id: "lily_jump", item_id: "", skill_tags: [], response: "", correct: false, latency_ms: 0, accuracy: 0, points: 0, errors: 0, started_at: new Date().toISOString(), ended_at: new Date().toISOString(), ui_locale: "en", ...o });
const cleanId = (d) => { if (!d || d.id == null) return ""; const e = String(d.id).trim(), l = e.toLowerCase(); return !e || l === "student" || l === "guest" ? "" : e; };

let authCb = null, authSeen = false, authDetail = null;
window.addEventListener("mrj-auth-ready", (n) => { authSeen = true; authDetail = (n && n.detail) || {}; authCb && authCb(authDetail); });

export function startGame(host, { pack, wm = false, maker = false, studentId = "", quality } = {}) {
  let e = pack;
  host.innerHTML = "";
  const stage = createStage(host, { quality });
  const fx = createFx(stage);
  const audio = createAudio({
    sfx: { croak: "./audio/frog-ribbit.mp3", splash: "./audio/splash-heavy.mp3", dunk: "./audio/splash-dunk.mp3", hop: "./audio/sfx/hop.mp3", pop: "./audio/sfx/pop.mp3", chime: "./audio/sfx/chime.mp3", sparkle: "./audio/sfx/sparkle.mp3", buzz: "./audio/sfx/buzz.mp3", fanfare: "./audio/sfx/fanfare.mp3", lose: "./audio/sfx/lose.mp3", whoosh: "./audio/sfx/whoosh.mp3", chomp: "./audio/sfx/thud.mp3" },
    music: "./audio/music-happy-adventure.mp3", musicVol: 0.22,
  });
  const target = () => (wm ? (e.items && e.items.length) || 0 : TARGET);
  const hud = el(`<div class="hud">
    <div class="topbar"><div class="pill" id="lf-name">Frog</div><div class="pill" id="lf-lives">♥♥♥</div><div class="pill" id="lf-score">0 pts</div><div class="pill" id="lf-left">0/${target()} right</div></div>
    <div class="question hidden" id="lf-q"><p id="lf-qp">?</p><div class="timer"><i id="lf-timer"></i></div></div>
    <div class="combo" id="lf-combo"></div>
    <div class="words hidden" id="lf-words">${[0, 1, 2].map((i) => `<button class="pad-word" data-lane="${i}" type="button"></button>`).join("")}</div>
    <div class="help hidden" id="lf-help">Tap a lily pad · keys 1 2 3 / ← ↑ →</div>
    <div class="card" id="lf-start"><div class="logo">🐸</div><h1>Leap Frog</h1>
      <p class="lead">Read the question. Hop to the lily pad with the right answer!</p>
      <p class="lead small" id="lf-goal">${wm ? "Get every word right to reach land." : `Get ${TARGET} right to reach land.`} 3 lives.</p>
      <button class="go" type="button" disabled>Sign in to play</button>
      <label class="drop${maker && !wm ? "" : " hidden"}" id="lf-drop">Drop Excel / CSV / JSON pack here<input id="lf-file" type="file" accept=".xlsx,.xls,.csv,.json" hidden /></label>
      ${wm ? "" : `<p class="how"><a href="./HOW-TO-PLAY.html">How to play</a></p>`}</div>
    <div class="card hidden" id="lf-end"></div>
    <div class="fade" id="lf-fade"></div>
  </div>`);
  host.appendChild(hud);
  hud.appendChild(muteButton(audio));
  const $ = (s) => hud.querySelector(s);
  const words = [...hud.querySelectorAll(".pad-word")];
  const goBtn = $("#lf-start .go");

  const c = { pack: e, studentId: "", sessionId: `lf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, view: "start", points: 0, errors: 0, round: 1, roundDone: {}, queue: [], trial: null, jumping: false, pickLockUntil: 0, lives: LIVES, corrects: 0, records: [], startedAt: null, streak: 0, best: 0 };
  const remaining = () => Math.max(0, target() - c.corrects);
  const landNear = () => remaining() <= 2;

  // ---------- world (screen-space layout recomputed on resize) ----------
  const W = { lanes: [0, 0, 0], padY: 0, homeY: 0, r: 40, frogSize: 60, shoreY: -200, shoreTarget: -200, scroll: 0 };
  const pads = [0, 1, 2].map((i) => ({ lane: i, x: 0, y: 0, r: 40, scale: 0, sink: 0, alive: true, glow: 0, hue: (i - 1) * 8, bob: Math.random() * 6 }));
  const home = { x: 0, y: 0, r: 46, scale: 1, sink: 0, alive: true, hue: -4 };
  const frog = { x: 0, y: 0, z: 0, size: 60, sx: 1, sy: 1, rot: 0, blink: 0, tongue: 0, visible: true, under: 0 };
  const fish = { on: false, t: 0, x: 0, y: 0, flip: false };
  const flies = [0, 1, 2].map((i) => ({ a: i * 2, r: 60 + i * 20 }));
  const ripples = [];
  const decor = [[0.07, 0.4, 0.05, 20, true], [0.93, 0.33, 0.04, -10, false], [0.12, 0.93, 0.06, 5, false], [0.9, 0.88, 0.05, 25, true], [0.85, 0.62, 0.03, 0, false]].map(([x, y, r, h, f]) => ({ x, y, r, h, f }));
  function layout() {
    const w = stage.w, h = stage.h;
    const gap = Math.min(w * 0.31, 300, h * 0.42);
    W.r = clamp(Math.min(gap * 0.42, h * 0.12), 34, 110);
    W.frogSize = W.r * 1.15;
    W.padY = h * 0.5; W.homeY = h * 0.86;
    W.lanes = [w / 2 - gap, w / 2, w / 2 + gap];
    pads.forEach((p, i) => { p.x = W.lanes[i]; p.y = W.padY; p.r = W.r; });
    home.x = w / 2; home.y = W.homeY; home.r = W.r * 1.1;
    W.shoreTarget = landNear() && c.view !== "start" ? h * 0.27 : -40;
    if (!frog.busy) placeFrogHome();
  }
  stage.onResize = layout;
  function placeFrogHome() { frog.x = home.x; frog.y = home.y - home.r * 0.1; frog.z = 0; frog.rot = 0; frog.sx = frog.sy = 1; frog.size = W.frogSize; frog.visible = true; frog.under = 0; }

  // ---------- tweens ----------
  const tweens = [];
  const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function hop(toX, toY, { height = 1, flip = false, dur = 0.62 } = {}) {
    return new Promise((res) => {
      frog.busy = true; c.jumping = true;
      const fx0 = frog.x, fy0 = frog.y, H = W.r * 2.2 * height;
      audio.play("hop", { vol: 0.5, rate: 0.9 + Math.random() * 0.2 });
      // anticipation squash
      tween(0.09, (k) => { frog.sx = 1 + 0.25 * k; frog.sy = 1 - 0.25 * k; }, () => {
        tween(dur, (k) => {
          frog.x = lerp(fx0, toX, ease.inOut(k)); frog.y = lerp(fy0, toY, ease.inOut(k)); frog.z = Math.sin(k * Math.PI) * H;
          const st = Math.sin(k * Math.PI); frog.sx = 1 - 0.18 * st; frog.sy = 1 + 0.28 * st; frog.rot = flip ? k * Math.PI * 2 : (toX - fx0) * 0.0015 * st;
          if (!stage.low && Math.random() < 0.3) fx.burst(frog.x, frog.y - frog.z + frog.size * 0.3, { n: 1, color: "#d8fff0", speed: 30, size: 3, life: 0.4, grav: 0 });
        }, () => {
          frog.z = 0; frog.rot = 0;
          ripples.push({ x: toX, y: toY + W.r * 0.2, t: 0 });
          tween(0.18, (k) => { const s = Math.sin(k * Math.PI); frog.sx = 1 + 0.3 * s; frog.sy = 1 - 0.3 * s; }, () => { frog.sx = frog.sy = 1; frog.busy = false; c.jumping = false; res(); });
        });
      });
    });
  }

  // ---------- HUD ----------
  let lastShown = {};
  function bump(id, v) { const n = $(id); if (lastShown[id] !== v) { n.textContent = v; if (lastShown[id] != null) { n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); } lastShown[id] = v; } }
  function hudUpdate() {
    bump("#lf-name", c.studentId || "Frog");
    bump("#lf-lives", "♥".repeat(Math.max(0, c.lives)) + "♡".repeat(Math.max(0, LIVES - c.lives)));
    bump("#lf-score", `${c.points} pts`);
    bump("#lf-left", `${c.corrects}/${target()} right`);
    if (c.trial) $("#lf-timer").style.transform = `scaleX(${Math.max(0, c.trial.deadline - performance.now()) / (e.seconds * 1000)})`;
    const cb = $("#lf-combo"); if (c.streak >= 2) { cb.textContent = `🔥 ${c.streak} in a row!`; cb.classList.add("on"); } else cb.classList.remove("on");
  }
  function placeWords() {
    words.forEach((b, i) => { const p = pads[i]; b.style.left = p.x + "px"; b.style.top = p.y + p.r * 0.75 * p.scale + "px"; b.style.opacity = p.alive && p.scale > 0.5 ? String(Math.min(1, p.scale)) : "0"; b.style.transform = `translate(-50%,0) scale(${0.6 + 0.4 * Math.min(1, p.scale)})`; });
  }
  function showPlay(on) { $("#lf-words").classList.toggle("hidden", !on); $("#lf-q").classList.toggle("hidden", !on); $("#lf-help").classList.toggle("hidden", !on || c.corrects > 0); }

  // ---------- loop logic (same as old engine) ----------
  function refill() { c.queue = shuffle(e.items.filter((L) => !c.roundDone[L.item_id])); }
  function nextTrial() {
    if (!c.queue.length) refill();
    if (!c.queue.length) return roundDone();
    const L = c.queue.shift();
    const Z = shuffle([L.correct, ...L.wrong.slice(0, 2)]);
    while (Z.length < 3) Z.push("");
    const ok = Z.indexOf(L.correct);
    Z.forEach((K, i) => { words[i].textContent = K || "—"; words[i].dataset.answer = K || ""; words[i].setAttribute("aria-label", K || `pad ${i + 1}`); });
    const q = $("#lf-qp"); q.textContent = L.question; $("#lf-q").classList.remove("pop"); void q.offsetWidth; $("#lf-q").classList.add("pop");
    showPlay(true);
    home.sink = 0; home.alive = true;
    W.shoreTarget = landNear() ? stage.h * 0.27 : -40;
    pads.forEach((p, i) => { p.alive = true; p.sink = 0; p.scale = 0; p.glow = 0; tween(0.45 + i * 0.06, (k) => { p.scale = ease.outBack(k); }); });
    audio.play("pop", { vol: 0.4, rate: 1.1 });
    c.trial = { item: L, choices: Z, correctLane: ok, startedAt: new Date().toISOString(), t0: performance.now(), deadline: performance.now() + e.seconds * 1000, locked: false };
    hudUpdate();
    audio.speak([`./audio/q/${/^[a-zA-Z0-9_-]+$/.test(L.item_id) ? L.item_id : "_"}.mp3`]);
  }
  function record(item, resp, correct, latency, timeout) {
    if (!c.studentId) return null;
    const r = rec({ student_id: c.studentId, session_id: c.sessionId, module_id: e.module_id, activity_id: e.activity_id, item_id: item.item_id, skill_tags: item.skill_tags || e.skill_tags, response: timeout ? "timeout" : resp, correct, latency_ms: Math.round(latency), points: c.points, errors: c.errors, started_at: c.trial.startedAt, ended_at: new Date().toISOString(), ui_locale: e.ui_locale, round: c.round });
    const all = c.records.concat(r); r.accuracy = all.filter((B) => B.correct).length / all.length; c.records.push(r);
    if (!wm) mrjPost(e, item, !!correct);
    return r;
  }
  async function chomp() {
    toast(c.lives <= 0 ? "GAME OVER" : "CHOMP!", "bad");
    audio.play("buzz", { vol: 0.6 });
    fish.on = true; fish.t = 0; fish.x = frog.x; fish.y = frog.y; fish.flip = frog.x > stage.w / 2;
    await wait(420); audio.play("chomp", { vol: 0.9 }); fx.shake(16); fx.flash("#ff4060", 0.35); frog.visible = false;
    fx.burst(frog.x, frog.y, { n: 26, color: ["#aef", "#fff", "#7cf"], speed: 300, size: 6 });
    await wait(900); fish.on = false; await afterMiss();
  }
  async function splash(x, y) {
    toast(c.lives <= 0 ? "GAME OVER" : "SPLASH!", "bad");
    audio.play("splash", { vol: 0.9 }); audio.play("dunk", { vol: 0.6, delay: 0.08 });
    fx.shake(10); fx.burst(x, y, { n: 34, color: ["#cff6ff", "#fff", "#8fe3ff"], speed: 360, size: 6, life: 0.9, grav: 700 });
    ripples.push({ x, y, t: 0 }, { x, y, t: -0.2 });
    frog.busy = true; tween(0.5, (k) => { frog.under = k; });
    await wait(1350); await afterMiss();
  }
  async function afterMiss() {
    if (c.lives <= 0) return end({ dead: true });
    home.alive = true; home.sink = 0; placeFrogHome(); frog.busy = false;
    frog.sy = 0; tween(0.4, (k) => { frog.sy = frog.sx = ease.outBack(k); });
    nextTrial();
  }
  async function pick(lane, timeout) {
    const t = c.trial;
    if (!t || t.locked || c.jumping || c.view !== "play") return;
    t.locked = true;
    const lat = performance.now() - t.t0;
    const ok = !timeout && lane === t.correctLane;
    const resp = Number.isInteger(lane) ? t.choices[lane] : "";
    if (ok) {
      c.roundDone[t.item.item_id] = true; c.corrects += 1;
      const gain = 100 + Math.round(Math.max(0, e.seconds * 1000 - lat) / 12);
      c.points += gain; c.streak += 1; c.best = Math.max(c.best, c.streak);
      audio.play("croak", { vol: 0.9 }); audio.combo(c.streak);
      const p = pads[lane]; p.glow = 1;
      words.forEach((b, i) => { if (i !== lane) b.style.opacity = "0.25"; });
      const last = remaining() === 0;
      await wait(180);
      await hop(p.x, p.y - p.r * 0.1, { flip: true, height: 1.15 });
      fx.burst(p.x, p.y - W.r * 0.4, { n: 22, color: ["#fff59e", "#ffd23f", "#9effa0", "#fff"], speed: 260, size: 5, life: 0.8, grav: 200 });
      fx.float(p.x, p.y - W.r * 1.6, `+${gain}`, { color: "#fff59e", size: 34 });
      if (c.streak >= 3) fx.float(p.x, p.y - W.r * 2.3, c.streak >= 5 ? "AMAZING!" : "GREAT!", { color: "#ff9fd0", size: 28 });
      audio.play("sparkle", { vol: 0.5 });
      record(t.item, resp, true, lat, false); hudUpdate();
      c.trial = null; showPlay(false);
      if (last) {
        W.shoreTarget = stage.h * 0.27;
        await wait(300);
        await hop(stage.w / 2, stage.h * 0.27 - 50, { height: 1.4, dur: 0.8 });
        return winSnack();
      }
      await scrollForward(lane);
      nextTrial();
    } else if (timeout) {
      c.errors += 1; c.lives -= 1; c.streak = 0;
      record(t.item, resp, false, lat, true); hudUpdate(); showPlay(false);
      landNear() ? chomp() : splash(frog.x, frog.y);
    } else {
      c.errors += 1; c.lives -= 1; c.streak = 0;
      const p = pads[lane];
      await hop(p.x, p.y - p.r * 0.1, {});
      record(t.item, resp, false, lat, false); hudUpdate();
      tween(0.5, (k) => { p.sink = k; }, () => { p.alive = false; });
      words[lane].style.opacity = "0"; showPlay(false);
      landNear() ? chomp() : splash(p.x, p.y);
    }
  }
  // camera "moves forward": the chosen pad slides down to become the new home pad
  function scrollForward(lane) {
    return new Promise((res) => {
      const p = pads[lane], fy0 = frog.y, px0 = p.x, py0 = p.y;
      audio.play("whoosh", { vol: 0.25 });
      const oldHomeY = home.y;
      tween(0.55, (k) => {
        const q = ease.inOut(k);
        W.scroll = q * (W.homeY - W.padY);
        p.x = lerp(px0, stage.w / 2, q); p.y = lerp(py0, W.homeY, q);
        frog.x = p.x; frog.y = lerp(fy0, W.homeY - home.r * 0.1, q);
        home.y = oldHomeY + q * stage.h * 0.4;
        pads.forEach((o) => { if (o !== p) o.scale = Math.max(0, 1 - q * 1.6); });
      }, () => {
        W.scroll = 0; home.y = W.homeY; home.x = stage.w / 2; home.sink = 0;
        layout(); res();
      });
    });
  }
  function roundDone() { c.trial = null; showPlay(false); toast(`Round ${c.round} done`, "ok"); return end(); }
  async function winSnack() {
    // frog catches a fly on shore, then celebrates
    c.view = "snack";
    frog.tongue = 0; tween(0.25, (k) => { frog.tongue = Math.sin(k * Math.PI); });
    audio.play("pop", { vol: 0.6, rate: 1.4 });
    await wait(300);
    fx.confetti(stage.w / 2, stage.h * 0.3, 90); fx.confetti(stage.w * 0.2, stage.h * 0.5, 40); fx.confetti(stage.w * 0.8, stage.h * 0.5, 40);
    for (let i = 0; i < 3; i++) { await hop(stage.w / 2, frog.y, { height: 0.5, dur: 0.35 }); }
    end();
  }
  function end({ dead = false } = {}) {
    if (!wm) mrjPostRound(e, c, dead, TARGET);
    else if (!dead) wmDone(c, e);
    c.view = "end"; c.trial = null; showPlay(false);
    if (dead) { audio.play("lose", { vol: 0.7 }); } else { audio.play("fanfare", { vol: 0.8 }); }
    const acc = c.records.length ? Math.round(c.records.filter((K) => K.correct).length / c.records.length * 100) : 0;
    const stars = dead ? 0 : c.lives >= 3 ? 3 : c.lives === 2 ? 2 : 1;
    const card = $("#lf-end");
    card.classList.remove("hidden");
    card.innerHTML = `<div class="logo">${dead ? "💦" : "🏆"}</div><h2>${dead ? "The frog sank!" : "Safe on shore!"}</h2>
      <div class="stars">${"★".repeat(stars)}<span class="dim">${"★".repeat(3 - stars)}</span></div>
      <p>${dead ? `${esc(c.studentId)} ran out of lives.` : `${esc(c.studentId)} got ${target()} right and reached land.`}</p>
      <p><b>${c.points}</b> points · ${acc}% accurate · ${c.errors} misses${c.best >= 2 ? ` · best streak ${c.best}` : ""}</p>
      <button class="go" id="lf-again" type="button">Play again</button>`;
    card.querySelector("#lf-again").onclick = () => { $("#lf-fade").classList.add("on"); setTimeout(() => location.reload(), 300); };
  }
  let toastT = 0;
  function toast(text, kind) { fx.float(stage.w / 2, stage.h * 0.42, text, { color: kind === "bad" ? "#ff8095" : "#9effa0", size: 54, life: 1.2 }); }

  // ---------- progress seeding (cloud rows only) ----------
  function seed() {
    const rows = window.__MRJ_LF_PROGRESS_ROWS && window.__MRJ_LF_PROGRESS_ROWS.length ? window.__MRJ_LF_PROGRESS_ROWS : authDetail && authDetail.progress;
    const latest = passedMap(e, rows); let n = 0;
    for (const it of e.items || []) if (it && latest[it.item_id]) { c.roundDone[it.item_id] = true; n++; }
    c.corrects = Math.min(TARGET, n);
  }
  window.__mrjLeapFrogOnProgress = (rows) => {
    if (wm || !rows || !rows.length) return;
    authDetail = authDetail || {}; authDetail.progress = rows;
    if (c.view === "play" || c.view === "start") { seed(); if (c.view === "play" && c.corrects >= TARGET && !c.jumping) end(); hudUpdate(); }
  };

  function begin() {
    if (!c.studentId || c.view !== "start") return;
    audio.unlock(); audio.startMusic();
    c.startedAt = new Date().toISOString(); c.view = "play"; c.pickLockUntil = performance.now() + 480;
    $("#lf-start").classList.add("hidden");
    if (!wm) seed();
    refill();
    layout(); placeFrogHome();
    frog.sy = 0; tween(0.5, (k) => { frog.sx = frog.sy = ease.outElastic(k); });
    if (!wm && c.corrects >= TARGET) return end();
    nextTrial(); hudUpdate();
  }
  function ready(id) { if (!id || c.studentId) return; c.studentId = id; goBtn.disabled = false; goBtn.textContent = "Start jumping"; hudUpdate(); }
  goBtn.addEventListener("click", begin);
  if (wm) ready(studentId);
  else { authCb = (d) => ready(cleanId(d)); if (authSeen) authCb(authDetail); }

  // ---------- input ----------
  $("#lf-words").addEventListener("click", (ev) => { const b = ev.target.closest(".pad-word"); if (b) { ev.stopPropagation(); audio.unlock(); pick(Number(b.dataset.lane), false); } });
  createInput(host, {
    keys: { "1": "l", ArrowLeft: "l", "2": "c", ArrowUp: "c", "3": "r", ArrowRight: "r", Enter: "go", " ": "go" },
    onKey: (a) => { if (a === "go") { if (c.view === "start" && !goBtn.disabled) begin(); return; } if (c.view === "play") pick({ l: 0, c: 1, r: 2 }[a], false); },
    onTap: (x, y) => {
      if (c.view !== "play" || c.jumping || performance.now() < c.pickLockUntil) return;
      let best = null, bd = 1e9;
      pads.forEach((p, i) => { const d = Math.hypot((x - p.x) / p.r, (y - p.y) / (p.r * 0.7)); if (d < 1.35 && d < bd) { bd = d; best = i; } });
      if (best != null) pick(best, false);
    },
  });

  // ---------- frame ----------
  let blinkT = 2;
  stage.run((dt, st) => {
    const { g, w, h, t } = st;
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); } }
    if (c.view === "play" && c.trial && !c.trial.locked) {
      const now = performance.now();
      if (now > c.trial.deadline) pick(null, true);
      else { home.sink = clamp(1 - (c.trial.deadline - now) / (e.seconds * 1000), 0, 1); if (home.sink > 0.75 && Math.random() < dt * 6) ripples.push({ x: home.x + (Math.random() - 0.5) * home.r, y: home.y, t: 0 }); }
    }
    W.shoreY = lerp(W.shoreY ?? -200, W.shoreTarget, Math.min(1, dt * 2.5));
    blinkT -= dt; if (blinkT < 0) { frog.blink = Math.min(1, frog.blink + dt * 14); if (frog.blink >= 1) blinkT = 2 + Math.random() * 3; } else frog.blink = Math.max(0, frog.blink - dt * 10);
    fx.update(dt);

    g.save(); fx.applyShake(g);
    drawWater(g, w, h, t, st.low);
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; if (r.t > 1.2) { ripples.splice(i, 1); continue; } if (r.t < 0) continue;
      g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r.t / 1.2)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(r.x, r.y, 10 + r.t * W.r * 1.4, (10 + r.t * W.r * 1.4) * 0.4, 0, 0, Math.PI * 2); g.stroke(); }
    if (W.shoreY > -30) drawShore(g, w, W.shoreY, t);
    decor.forEach((d) => drawPad(g, d.x * w, d.y * h, d.r * Math.min(w, h), { hue: d.h, t, flower: d.f }));
    drawReeds(g, w, h, t);
    if (!st.low) { const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,20,40,.35)"); g.fillStyle = vg; g.fillRect(0, 0, w, h); }
    // home pad (sinks with the timer)
    if (home.alive) drawPad(g, home.x, home.y + W.scroll * 0, home.r, { sink: home.sink, hue: home.hue, t, flower: true });
    pads.forEach((p, i) => { if (p.scale <= 0.01 || (!p.alive && p.sink >= 1)) return;
      const bob = Math.sin(t * 2 + p.bob) * 3; drawPad(g, p.x, p.y + bob, p.r * p.scale, { sink: p.sink, glow: p.glow, hue: p.hue, t }); });
    // fireflies / flies circling
    if (!st.low) flies.forEach((f, i) => { f.a += dt * (0.8 + i * 0.2); drawFly(g, w / 2 + Math.cos(f.a) * w * 0.35, h * 0.2 + Math.sin(f.a * 1.3) * h * 0.08 + Math.max(0, W.shoreY) * 0.3, t); });
    if (frog.visible) {
      if (frog.under > 0) { g.save(); g.globalAlpha = 1 - frog.under; drawFrog(g, { ...frog, y: frog.y + frog.under * 20, sy: frog.sy * (1 - frog.under * 0.6) }, t); g.restore(); }
      else drawFrog(g, frog, t);
    }
    if (fish.on) { fish.t += dt; const k = Math.min(1, fish.t / 0.9), arc = Math.sin(k * Math.PI);
      drawPiranha(g, fish.x + (fish.flip ? 1 : -1) * (1 - k * 2) * W.r * 1.6, fish.y - arc * W.r * 1.8, W.r / 50, Math.abs(Math.sin(fish.t * 10)), fish.flip);
      if (Math.random() < 0.5) fx.burst(fish.x, fish.y, { n: 2, color: "#cff6ff", speed: 120, size: 4, life: 0.5 }); }
    fx.draw(g);
    g.restore();
    fx.drawFlash(g, w, h);
    if (c.view === "play" || c.view === "snack") { hudUpdate(); placeWords(); }
  });
  layout(); hudUpdate();

  const api = {
    version: "3.0.0",
    getState() {
      return { student_id: c.studentId, session_id: c.sessionId, pack_id: e.pack_id, view: c.view, points: c.points, errors: c.errors, lives: c.lives, round: c.round, corrects: c.corrects, remaining: remaining(), total: target(), pack_items: e.items.length, current_item: c.trial ? c.trial.item.item_id : null, hops_left: remaining(), land: landNear(), win_corrects: target(), streak: c.streak, correct_lane: c.trial && !c.trial.locked && !c.jumping ? c.trial.correctLane : null, low_quality: stage.low };
    },
    getRecords: () => c.records.slice(),
    loadPack(L) { e = L; c.pack = L; c.roundDone = {}; refill(); $("#lf-goal").textContent = `Loaded ${L.title} · ${L.items.length} questions. Get ${target()} right to reach land.`; },
    begin,
  };
  window.MRJLeapFrog = api; window.LeapFrog = api;
  return api;
}
