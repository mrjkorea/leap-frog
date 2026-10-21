// Leap Frog — learning loop identical to the old engine:
//   question + 3 lily pads (L/C/R), one correct. 15s timer (pack.seconds) sinks the home pad.
//   right: +100 + time bonus, hop; wrong / timeout: -1 life (3 lives), splash or CHOMP (when land is near).
//   standalone: 5 right hops reach land. Word Master: every word right (wm:all-items).
// v3.1: the world is real 3D again (pond3d.js, three.js) — same layout as the original: frog on the home pad,
// three answer pads ahead, sunset pond, piranhas near the shore. Logic below is unchanged from v3.0.
import { createStage } from "./kit/stage.js";
import { createFx, ease, lerp, clamp } from "./kit/fx.js";
import { createInput } from "./kit/input.js";
import { el, esc, muteButton } from "./kit/ui.js";
import { createAudio } from "./kit/audio.js";
import { shuffle } from "./pack.js";
import { mrjPost, mrjPostRound, passedMap, wmDone } from "./report.js";
import { createPond3D } from "./pond3d.js";
import { THREE } from "./kit/three-stage.js";

const LIVES = 3, TARGET = 5, ROUNDS = 1;
const rec = (o) => ({ student_id: "", session_id: "", module_id: "leap_frog", activity_id: "lily_jump", item_id: "", skill_tags: [], response: "", correct: false, latency_ms: 0, accuracy: 0, points: 0, errors: 0, started_at: new Date().toISOString(), ended_at: new Date().toISOString(), ui_locale: "en", ...o });
const cleanId = (d) => { if (!d || d.id == null) return ""; const e = String(d.id).trim(), l = e.toLowerCase(); return !e || l === "student" || l === "guest" ? "" : e; };

let authCb = null, authSeen = false, authDetail = null;
window.addEventListener("mrj-auth-ready", (n) => { authSeen = true; authDetail = (n && n.detail) || {}; authCb && authCb(authDetail); });

export async function startGame(host, { pack, wm = false, maker = false, studentId = "", quality } = {}) {
  let e = pack;
  host.innerHTML = "";
  const pond = await createPond3D(host, { quality });
  const stage = createStage(host, { quality: "high" }); // transparent 2D overlay: floating text + flashes only
  stage.canvas.classList.add("overlay");
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
      <div class="mrj-h2p" id="mrj-h2p"><h2>HOW TO PLAY</h2><ul class="mrj-h2p-list"><li><span class="ic">📖</span>Read the question.</li><li><span class="ic">🪷</span>Hop to the lily pad with the right answer.</li><li><span class="ic">⏱️</span>Be quick! Your lily pad sinks.</li><li><span class="ic">❤️</span>3 lives. Reach the land to win!</li></ul><div class="mrj-h2p-ctl"><div class="ctl"><b>💻 Computer</b><span><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd> or <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> hop</span><span>🖱️ Click a lily pad</span></div><div class="ctl"><b>📱 Touch</b><span>👆 Tap a lily pad</span><span>👆 or tap a word button</span></div></div></div>
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

  // ---------- world (3D, world units) ----------
  const { frog, V, tw } = pond;
  const F = frog.userData;
  let home = pond.home; const pads = pond.pads;
  const padZ = () => V.homeZ - V.gap;
  const shoreZ = () => padZ() - 2.4;
  function placePads() { const L = pond.lanes(); pads.forEach((p, i) => { p.position.set(L[i], 0.1, padZ()); }); }
  function layout() { if (!F.busy && !c.jumping) { placePads(); placeFrogHome(); } }
  pond.onResize = layout;
  function legsPose(k) { F.legs.forEach((L) => { L.hip.rotation.x = -k * 0.9; L.knee.rotation.x = k * 1.6; }); }
  function placeFrogHome() { frog.visible = true; frog.position.set(home.position.x, home.position.y + 0.06, home.position.z); frog.rotation.set(0, Math.PI, 0); F.body.scale.set(1, 1, 1); F.body.rotation.set(0, 0, 0); F.body.position.y = 0; pond.frogBase = frog.position.y; legsPose(0); }

  // ---------- tweens ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tween = (dur, fn, done) => tw.add(dur, fn, { ease: (t) => t, done });
  function hop(toX, toZ, { toY = 0.16, height = 1, flip = false, dur = 0.62 } = {}) {
    return new Promise((res) => {
      F.busy = true; c.jumping = true;
      const x0 = frog.position.x, y0 = frog.position.y, z0 = frog.position.z, H = 1.05 * height;
      const r0 = frog.rotation.y, face = Math.abs(toX - x0) + Math.abs(toZ - z0) > 0.05 ? Math.atan2(toX - x0, toZ - z0) : r0;
      audio.play("hop", { vol: 0.5, rate: 0.9 + Math.random() * 0.2 });
      // anticipation: crouch + turn towards the target
      tween(0.11, (k) => { const q = ease.outCubic(k); F.body.scale.set(1 + 0.22 * q, 1 - 0.3 * q, 1 + 0.1 * q); frog.rotation.y = r0 + (face - r0) * q; }, () => {
        if (y0 < 0.4) pond.ripple(x0, z0, 0.55);
        tween(dur, (k) => {
          const q = ease.inOut(k), s = Math.sin(k * Math.PI);
          frog.position.set(lerp(x0, toX, q), lerp(y0, toY, q) + s * H, lerp(z0, toZ, q));
          F.body.scale.set(1 - 0.16 * s, 1 + 0.3 * s, 1 - 0.1 * s);
          F.body.rotation.x = flip ? k * Math.PI * 2 : 0.35 * Math.cos(k * Math.PI) * s;
          legsPose(Math.min(1, s * 1.8));
          pond.frogBase = lerp(y0, toY, q);
          if (Math.random() < 0.6) pond.trail(frog.position.x, frog.position.y + 0.3, frog.position.z);
        }, () => {
          frog.position.y = toY; F.body.rotation.x = 0; legsPose(0); pond.frogBase = toY;
          tween(0.2, (k) => { const s = Math.sin(k * Math.PI); F.body.scale.set(1 + 0.3 * s, 1 - 0.32 * s, 1 + 0.2 * s); }, () => { F.body.scale.set(1, 1, 1); F.busy = false; c.jumping = false; res(); });
        });
      });
    });
  }
  function padBounce(p) { const y0 = p.position.y; tween(0.5, (k) => { p.position.y = y0 - Math.sin(k * Math.PI) * 0.12 * (1 - k); p.rotation.z = Math.sin(k * Math.PI * 3) * 0.05 * (1 - k); }, () => { p.position.y = y0; p.rotation.z = 0; }); pond.ripple(p.position.x, p.position.z, 0.9); }
  function popIn(p, delay = 0) { p.visible = true; p.scale.setScalar(0.001); p.position.y = 0.1; setTimeout(() => tw.add(0.5, (k) => p.scale.setScalar(Math.max(0.001, k) * V.padScale), { ease: (t) => ease.outBack(t, 2.2) }), delay * 1000); setTimeout(() => pond.ripple(p.position.x, p.position.z, 0.7), delay * 1000); }
  function sinkPad(p, dur = 0.6) { const y0 = p.position.y; return new Promise((r) => tween(dur, (k) => { p.position.y = y0 - k * 0.6; p.rotation.x = k * 0.35; p.scale.setScalar(Math.max(0.001, 1 - k * 0.4) * V.padScale); }, () => { p.visible = false; p.rotation.x = 0; p.scale.setScalar(V.padScale); r(); })); }

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
  const fade = [1, 1, 1];
  function placeWords() { // labels sit on the 3D pads (projected), same as the original's pad signs
    words.forEach((b, i) => { const p = pads[i], s = p.visible ? p.scale.x : 0, q = pond.project(p.position.x, p.position.y + 0.25, p.position.z + 0.55);
      b.style.left = q.x + "px"; b.style.top = q.y + "px"; b.style.opacity = s > 0.5 ? String(Math.min(1, s) * fade[i]) : "0"; b.style.transform = `translate(-50%,-30%) scale(${0.6 + 0.4 * Math.min(1, s)})`; });
  }
  function showPlay(on) { $("#lf-words").classList.toggle("hidden", !on); $("#lf-q").classList.toggle("hidden", !on); $("#lf-help").classList.toggle("hidden", !on || c.corrects > 0); }
  const screenOf = (x, y, z) => pond.project(x, y, z);

  // ---------- loop logic (same as old engine) ----------
  function refill() { c.queue = shuffle(e.items.filter((L) => !c.roundDone[L.item_id])); }
  function nextTrial() {
    if (!c.queue.length) refill();
    if (!c.queue.length) return roundDone();
    const L = c.queue.shift();
    const Z = shuffle([L.correct, ...L.wrong.slice(0, 2)]);
    while (Z.length < 3) Z.push("");
    const ok = Z.indexOf(L.correct);
    Z.forEach((K, i) => { words[i].textContent = K || "—"; words[i].dataset.answer = K || ""; words[i].setAttribute("aria-label", K || `pad ${i + 1}`); fade[i] = 1; });
    const q = $("#lf-qp"); q.textContent = L.question; $("#lf-q").classList.remove("pop"); void q.offsetWidth; $("#lf-q").classList.add("pop");
    showPlay(true);
    home.visible = true; home.userData.sink = 0;
    setShore();
    placePads(); pads.forEach((p, i) => { p.userData.glowAmt = 0; popIn(p, i * 0.06); });
    audio.play("pop", { vol: 0.4, rate: 1.1 });
    c.trial = { item: L, choices: Z, correctLane: ok, startedAt: new Date().toISOString(), t0: performance.now(), deadline: performance.now() + e.seconds * 1000, locked: false };
    hudUpdate();
    audio.speak([`./audio/q/${/^[a-zA-Z0-9_-]+$/.test(L.item_id) ? L.item_id : "_"}.mp3`]);
  }
  function setShore() { const on = landNear() && c.view !== "start"; pond.danger = on; if (on && !pond.shore.visible) { pond.shore.visible = true; pond.shore.position.set(0, -1.2, shoreZ() - 4); } if (on) { const y0 = pond.shore.position.y, z0 = pond.shore.position.z, z1 = shoreZ(); tween(0.9, (k) => { const q = ease.outCubic(k); pond.shore.position.y = lerp(y0, 0, q); pond.shore.position.z = lerp(z0, z1, q); }); } }
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
    // piranha leaps out of the water from the side and snaps the frog
    const fish = pond.fish, J = fish.userData.jaw, fx0 = frog.position.x, fz = frog.position.z, side = fx0 > 0 ? 1 : -1, fy = frog.position.y;
    fish.visible = true; fish.scale.set(-side * 1.3, 1.3, 1.3);
    pond.splash(fx0 + side * 2.4, fz, false);
    await new Promise((r) => tween(0.42, (k) => { const q = ease.outCubic(k); fish.position.set(lerp(fx0 + side * 2.4, fx0, q), lerp(-0.6, fy + 0.6, q) + Math.sin(k * Math.PI) * 0.8, fz + 0.2); fish.rotation.z = side * (0.6 - k * 0.6); J.rotation.x = 0; J.rotation.z = -side * 0.5 * Math.sin(k * Math.PI * 0.5); fish.lookAt && fish.quaternion.copy(pond.camera.quaternion); }, r));
    audio.play("chomp", { vol: 0.9 }); fx.flash("#ff4060", 0.35); pond.shake(0.3); frog.visible = false;
    tween(0.15, (k) => { J.rotation.z = -side * 0.5 * (1 - k); });
    pond.splash(fx0, fz, true);
    await new Promise((r) => tween(0.6, (k) => { fish.position.set(fx0 - side * k * 2.2, fy + 0.6 - k * 2.2 + Math.sin(k * Math.PI) * 0.6, fz + 0.2); fish.rotation.z = -side * k * 0.8; }, r));
    fish.visible = false; pond.splash(fx0 - side * 2.2, fz, false);
    await wait(500); await afterMiss();
  }
  async function splash(x, z) {
    toast(c.lives <= 0 ? "GAME OVER" : "SPLASH!", "bad");
    audio.play("splash", { vol: 0.9 }); audio.play("dunk", { vol: 0.6, delay: 0.08 });
    pond.splash(x, z, true);
    F.busy = true; const y0 = frog.position.y;
    tween(0.55, (k) => { frog.position.y = y0 - k * 1.1; F.body.rotation.x = -k * 0.6; F.body.scale.setScalar(Math.max(0.01, 1 - k * 0.35)); }, () => { frog.visible = false; });
    setTimeout(() => pond.ripple(x, z, 0.8), 500);
    await wait(1350); await afterMiss();
  }
  async function afterMiss() {
    if (c.lives <= 0) return end({ dead: true });
    home.visible = true; home.position.y = 0.1; home.rotation.set(0, 0, 0); home.scale.setScalar(1.15 * V.padScale); placeFrogHome(); F.busy = false;
    F.body.scale.setScalar(0.01); tween(0.45, (k) => F.body.scale.setScalar(Math.max(0.01, ease.outBack(k))));
    pond.ripple(home.position.x, home.position.z, 0.8);
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
      const p = pads[lane]; p.userData.glowAmt = 1;
      fade.forEach((_, i) => { if (i !== lane) fade[i] = 0.25; });
      const last = remaining() === 0;
      await wait(180);
      await hop(p.position.x, p.position.z, { toY: p.position.y + 0.06, flip: true, height: 1.15 });
      padBounce(p);
      pond.sparkle(p.position.x, 0.8, p.position.z);
      const sp = screenOf(p.position.x, 1.4, p.position.z);
      fx.float(sp.x, sp.y, `+${gain}`, { color: "#fff59e", size: 34 });
      if (c.streak >= 3) fx.float(sp.x, sp.y - 46, c.streak >= 5 ? "AMAZING!" : "GREAT!", { color: "#ff9fd0", size: 28 });
      audio.play("sparkle", { vol: 0.5 });
      record(t.item, resp, true, lat, false); hudUpdate();
      c.trial = null; showPlay(false);
      if (last) {
        setShore();
        pads.forEach((o, i) => { if (i !== lane) sinkPad(o, 0.5); });
        await wait(500);
        V.homeZ = shoreZ() - 1.0; V.win = 1; // camera swoops low after the frog onto land
        await hop(0, shoreZ() - 1.2, { toY: 0.26, height: 1.4, dur: 0.8 });
        return winSnack();
      }
      await scrollForward(lane);
      nextTrial();
    } else if (timeout) {
      c.errors += 1; c.lives -= 1; c.streak = 0;
      record(t.item, resp, false, lat, true); hudUpdate(); showPlay(false);
      landNear() ? chomp() : splash(frog.position.x, frog.position.z);
    } else {
      c.errors += 1; c.lives -= 1; c.streak = 0;
      const p = pads[lane];
      await hop(p.position.x, p.position.z, { toY: p.position.y + 0.06 });
      record(t.item, resp, false, lat, false); hudUpdate();
      fade[lane] = 0; showPlay(false);
      sinkPad(p, 0.5);
      landNear() ? chomp() : splash(p.position.x, p.position.z);
    }
  }
  // camera dollies forward: the chosen pad drifts to the centre and becomes the new home pad
  function scrollForward(lane) {
    return new Promise((res) => {
      const p = pads[lane], old = home, px0 = p.position.x;
      audio.play("whoosh", { vol: 0.25 });
      pads.forEach((o) => { if (o !== p) sinkPad(o, 0.45); });
      sinkPad(old, 0.55);
      V.homeZ = p.position.z; // camera eases after it (pond3d)
      tween(0.6, (k) => { const q = ease.inOut(k); p.position.x = lerp(px0, 0, q); frog.position.x = p.position.x; frog.rotation.y = lerp(frog.rotation.y, Math.PI, q); }, () => {
        // swap roles: chosen pad = new home; the old home object is recycled as an answer pad
        pads[lane] = old; home = p; p.userData.glowAmt = 0; old.visible = false;
        frog.rotation.y = Math.PI; pond.frogBase = frog.position.y;
        res();
      });
    });
  }
  function roundDone() { c.trial = null; showPlay(false); toast(`Round ${c.round} done`, "ok"); return end(); }
  async function winSnack() {
    // frog catches a fly on shore with its tongue, then celebrates
    c.view = "snack";
    tween(0.3, (k) => { F.tongue.scale.set(1, Math.max(0.001, Math.sin(k * Math.PI) * 0.9), 1); });
    audio.play("pop", { vol: 0.6, rate: 1.4 });
    await wait(320);
    pond.confetti(0, 1.5, frog.position.z, 110); pond.confetti(-2.5, 1, frog.position.z + 1, 50); pond.confetti(2.5, 1, frog.position.z + 1, 50);
    for (let i = 0; i < 3; i++) { await hop(frog.position.x, frog.position.z, { toY: frog.position.y, height: 0.5, dur: 0.35 }); }
    end();
  }
  function end({ dead = false } = {}) {
    if (!wm) mrjPostRound(e, c, dead, TARGET);
    else if (!dead) wmDone(c, e);
    c.view = "end"; c.trial = null; showPlay(false);
    audio.stopMusic(); setTimeout(() => { if (c.view === "end") audio.stopAll(); }, 2500); // run end: music off, then AudioContext suspended
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
    F.body.scale.setScalar(0.01); tween(0.6, (k) => F.body.scale.setScalar(Math.max(0.01, ease.outElastic(k))));
    if (!wm && c.corrects >= TARGET) return end();
    nextTrial(); hudUpdate();
  }
  function ready(id) { if (!id || c.studentId) return; c.studentId = id; goBtn.disabled = false; goBtn.textContent = "Start jumping"; hudUpdate(); }
  goBtn.addEventListener("click", begin);
  if (wm) ready(studentId);
  else { authCb = (d) => ready(cleanId(d)); if (authSeen) authCb(authDetail); }

  // ---------- input (pointer + keyboard, same mapping as the original) ----------
  $("#lf-words").addEventListener("click", (ev) => { const b = ev.target.closest(".pad-word"); if (b) { ev.stopPropagation(); audio.unlock(); pick(Number(b.dataset.lane), false); } });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  createInput(host, {
    keys: { "1": "l", ArrowLeft: "l", "2": "c", ArrowUp: "c", "3": "r", ArrowRight: "r", Enter: "go", " ": "go" },
    onKey: (a) => { if (a === "go") { if (c.view === "start" && !goBtn.disabled) begin(); return; } if (c.view === "play") pick({ l: 0, c: 1, r: 2 }[a], false); },
    onTap: (x, y) => { // tap a 3D pad (raycast), or anywhere near it
      if (c.view !== "play" || c.jumping || performance.now() < c.pickLockUntil) return;
      ndc.set((x / stage.w) * 2 - 1, -(y / stage.h) * 2 + 1); ray.setFromCamera(ndc, pond.camera);
      let best = null;
      const hits = ray.intersectObjects(pads.filter((p) => p.visible), true); if (hits.length) { let o = hits[0].object; while (o && !pads.includes(o)) o = o.parent; if (o) best = pads.indexOf(o); }
      if (best == null) { let bd = 1e9; pads.forEach((p, i) => { const q = pond.project(p.position.x, p.position.y, p.position.z); const d = Math.hypot(x - q.x, y - q.y); if (d < Math.min(stage.w, stage.h) * 0.16 && d < bd) { bd = d; best = i; } }); }
      if (best != null) pick(best, false);
    },
  });

  // ---------- frame ----------
  pond.onFrame = (dt) => {
    if (c.view === "play" && c.trial && !c.trial.locked) {
      const now = performance.now();
      if (now > c.trial.deadline) pick(null, true);
      else { // home pad sinks with the timer
        const s = clamp(1 - (c.trial.deadline - now) / (e.seconds * 1000), 0, 1); home.userData.sink = s;
        home.position.y = 0.1 - s * 0.32; home.rotation.x = Math.sin(performance.now() / 300) * 0.04 * s;
        if (!F.busy) { frog.position.y = home.position.y + 0.06; pond.frogBase = frog.position.y; }
        if (s > 0.75 && Math.random() < dt * 6) pond.ripple(home.position.x + (Math.random() - 0.5) * 1.2, home.position.z + (Math.random() - 0.5) * 0.8, 0.5);
      }
    }
    fx.update(dt);
    const g = stage.g; g.clearRect(0, 0, stage.w, stage.h); fx.draw(g); fx.drawFlash(g, stage.w, stage.h);
    if (c.view === "play" || c.view === "snack") { hudUpdate(); placeWords(); }
  };
  stage.run(() => {}); // overlay clock only (drawing happens in pond.onFrame)
  pond.run();
  V.win = 0; placePads(); pads.forEach((p) => (p.visible = false)); home.position.set(0, 0.1, V.homeZ); home.scale.setScalar(1.15 * V.padScale); placeFrogHome(); hudUpdate();

  const api = {
    version: "3.1.0",
    getState() {
      return { student_id: c.studentId, session_id: c.sessionId, pack_id: e.pack_id, view: c.view, points: c.points, errors: c.errors, lives: c.lives, round: c.round, corrects: c.corrects, remaining: remaining(), total: target(), pack_items: e.items.length, current_item: c.trial ? c.trial.item.item_id : null, hops_left: remaining(), land: landNear(), win_corrects: target(), streak: c.streak, correct_lane: c.trial && !c.trial.locked && !c.jumping ? c.trial.correctLane : null, low_quality: pond.low, quality: pond.stage.quality, fps: Math.round(pond.stage.fps), frog: { x: frog.position.x, y: frog.position.y, z: frog.position.z }, rule: wm ? "wm:all-items" : "fixed-5", embed_student: wm ? "url-student" : "" };
    },
    getRecords: () => c.records.slice(),
    loadPack(L) { e = L; c.pack = L; c.roundDone = {}; refill(); $("#lf-goal").textContent = `Loaded ${L.title} · ${L.items.length} questions. Get ${target()} right to reach land.`; },
    padScreen: (i) => { const p = pads[i]; return pond.project(p.position.x, p.position.y, p.position.z - 0.35 * V.padScale); },
    begin,
  };
  // Word Master close / tab hidden / page unload: stop all sound
  const mrjHardStop = () => { audio.stopAll(); };
  window.addEventListener("message", (ev) => { const d = ev.data; if (d === "mrj-stop" || (d && d.type === "mrj-stop")) mrjHardStop(); });
  window.addEventListener("pagehide", mrjHardStop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) mrjHardStop(); else if (c.view === "play") { audio.unlock(); audio.startMusic(); } });
  window.MRJLeapFrog = api; window.LeapFrog = api;
  return api;
}
