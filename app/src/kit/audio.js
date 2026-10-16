// Baked local audio only (no TTS, no speechSynthesis). WebAudio, iOS/Android unlock on first tap.
// Platform-neutral: works in browsers and in Capacitor / Tauri webviews.
export function createAudio({ sfx = {}, music = null, musicVol = 0.3 } = {}) {
  let ctx = null, master, sfxBus, musicBus, voiceBus, musicSrc = null, musicBuf = null, loading = null, unlocked = false, muted = false, wantMusic = false;
  const bufs = {}, cache = new Map();
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(master);
    return ctx;
  }
  async function decode(url) {
    if (cache.has(url)) return cache.get(url);
    const p = (async () => {
      try {
        const r = await fetch(url); if (!r.ok) return null;
        const ab = await r.arrayBuffer();
        return await new Promise((res) => { const q = ctx.decodeAudioData(ab, res, () => res(null)); if (q && q.then) q.then(res, () => res(null)); });
      } catch (e) { return null; }
    })();
    cache.set(url, p); return p;
  }
  function load() {
    if (loading || !ensure()) return loading;
    loading = Promise.all(Object.entries(sfx).map(async ([k, u]) => { bufs[k] = await decode(u); }))
      .then(async () => { if (music) musicBuf = await decode(music); if (wantMusic) startMusic(); });
    return loading;
  }
  // Call inside a user gesture (tap / click / key): unlocks iOS Safari + Android Chrome.
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (!unlocked) { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); unlocked = true; }
    load();
  }
  function play(name, { vol = 1, rate = 1, delay = 0 } = {}) {
    if (!ctx || muted || !bufs[name]) return;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = bufs[name]; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g); g.connect(sfxBus); s.start(ctx.currentTime + delay);
  }
  function tone(freq, dur, { type = "triangle", vol = 0.2, at = 0, slide = 0 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  // Rising pentatonic chime with the combo streak.
  function combo(streak) {
    const base = 523.25 * Math.pow(2, STEPS[Math.min(STEPS.length - 1, Math.max(0, streak - 1))] / 12);
    tone(base, 0.16, { vol: 0.16 }); tone(base * 1.25, 0.16, { vol: 0.14, at: 0.07 }); tone(base * 1.5, 0.3, { vol: 0.16, at: 0.14 });
  }
  function startMusic() {
    wantMusic = true;
    if (!ctx || !musicBuf || musicSrc) return;
    musicSrc = ctx.createBufferSource(); musicSrc.buffer = musicBuf; musicSrc.loop = true; musicSrc.connect(musicBus); musicSrc.start();
    musicBus.gain.setTargetAtTime(muted ? 0 : musicVol, ctx.currentTime, 0.8);
  }
  function duck(on) { if (ctx && !muted) musicBus.gain.setTargetAtTime(on ? musicVol * 0.35 : musicVol, ctx.currentTime, 0.15); }
  // Word / question cue from baked mp3s (first URL that loads wins).
  async function speak(urls) {
    if (!ctx || muted) return false;
    for (const u of urls.filter(Boolean)) {
      const b = await decode(u);
      if (b) { const s = ctx.createBufferSource(); s.buffer = b; s.connect(voiceBus); duck(true); s.onended = () => duck(false); s.start(); return true; }
    }
    return false;
  }
  function setMuted(m) {
    muted = !!m;
    if (ctx) { master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); if (!muted && musicSrc) musicBus.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.3); }
    return muted;
  }
  // pause audio when app is backgrounded (tab hidden / mobile app paused)
  document.addEventListener("visibilitychange", () => { if (!ctx) return; document.hidden ? ctx.suspend().catch(() => {}) : unlocked && ctx.resume().catch(() => {}); });
  return { unlock, play, tone, combo, speak, startMusic, setMuted, isMuted: () => muted, ready: () => loading };
}
