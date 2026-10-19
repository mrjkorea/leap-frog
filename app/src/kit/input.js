// Input abstraction: pointer (mouse / touch / pen) + keyboard -> game actions. Same code on web, Capacitor, Tauri.
export function createInput(target, { keys = {}, onKey, onTap } = {}) {
  const down = new Set();
  const kd = (e) => {
    if (e.repeat && !keys[e.key]?.repeat) return;
    const act = keys[e.key];
    if (act) { e.preventDefault(); down.add(act.name || act); onKey && onKey(act.name || act, e); }
  };
  const ku = (e) => { const act = keys[e.key]; if (act) down.delete(act.name || act); };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  const pd = (e) => {
    if (e.target.closest && e.target.closest("button, input, label, a, .no-tap")) return;
    const r = target.getBoundingClientRect();
    onTap && onTap(e.clientX - r.left, e.clientY - r.top, e);
  };
  target.addEventListener("pointerdown", pd);
  return { isDown: (a) => down.has(a), destroy() { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); target.removeEventListener("pointerdown", pd); } };
}
