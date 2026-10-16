// Tiny DOM helpers + shared mute button. Nothing is stored on the device (mute resets each visit).
export function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
export function muteButton(audio) {
  const b = el(`<button class="mute" type="button" aria-label="Mute sound" title="Sound on/off">🔊</button>`);
  b.addEventListener("click", (e) => { e.stopPropagation(); audio.unlock(); const m = audio.setMuted(!audio.isMuted()); b.textContent = m ? "🔇" : "🔊"; b.setAttribute("aria-pressed", m ? "true" : "false"); });
  return b;
}
export function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
