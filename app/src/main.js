import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-700.css";
import "./kit/base.css";
import "./style.css";
import { fetchPack, fileToPack, normalizePack } from "./pack.js";
import { startGame } from "./game.js";

const app = document.getElementById("app");
const qs = new URLSearchParams(location.search);
// Word Master copy: index.html carries <meta name="mrj-host" content="word-master"> (session words only, WM reports).
const wm = !!document.querySelector('meta[name="mrj-host"][content="word-master"]');
const maker = qs.get("mode") === "maker" || qs.get("maker") === "1";
const embedStudent = (() => { try { return decodeURIComponent(qs.get("student") || "").trim(); } catch (e) { return (qs.get("student") || "").trim(); } })();
const resolve = (n) => (/^(https?:|data:|blob:)/i.test(n) ? n : new URL(n.replace(/^\/+/, ""), new URL("./", location.href)).href);

async function loadPack() {
  const n = qs.get("pack") || "";
  if (wm) {
    // only the words Word Master handed over: no fallback pack, no picker
    const raw = n === "session" ? sessionStorage.getItem("mrj.wm.gamepack") : null;
    if (!raw) throw new Error("Open Leap Frog from Word Master to get your words.");
    return normalizePack(JSON.parse(raw));
  }
  if (n === "session") { try { const raw = sessionStorage.getItem("mrj.wm.gamepack"); if (raw) return normalizePack(JSON.parse(raw)); } catch (e) {} }
  if (n && n !== "session") { try { return await fetchPack(resolve(n)); } catch (e) {} }
  const meta = document.querySelector('meta[name="lf-default-pack"]'); // standalone index.html names its default pack
  if (!meta) throw new Error("Open Leap Frog from Word Master to get your words.");
  return fetchPack(meta.content);
}
async function boot() {
  const pack = await loadPack();
  const q = qs.get("q");
  const game = await startGame(app, { pack, wm, maker, studentId: wm ? embedStudent : "", quality: q === "low" || q === "high" ? q : undefined });
  if (wm || !maker) return;
  const input = document.getElementById("lf-file"), drop = input && input.closest("label");
  const take = async (f) => { try { game.loadPack(await fileToPack(f)); } catch (err) { document.getElementById("lf-goal").textContent = "Could not read that pack: " + err.message; } };
  input.addEventListener("change", () => input.files[0] && take(input.files[0]));
  drop.addEventListener("dragover", (ev) => { ev.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (ev) => { ev.preventDefault(); drop.classList.remove("over"); ev.dataTransfer.files[0] && take(ev.dataTransfer.files[0]); });
}
boot().catch((err) => { app.innerHTML = `<div class="fatal"><h2>Leap Frog</h2><p></p></div>`; app.querySelector(".fatal p").textContent = err.message; });
