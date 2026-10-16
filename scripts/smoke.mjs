// Headless smoke: real Chromium, stubbed sign-in (zz_test ids only), score posts intercepted (never sent).
// node scripts/smoke.mjs [outDir] [wmGameDir]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(process.argv[2] || "/workspace/leap-frog-shots");
const wmDir = process.argv[3] ? path.resolve(process.argv[3]) : null;
fs.mkdirSync(out, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".png": "image/png" };
const serve = (dir, extra = {}) => new Promise((res) => { const s = http.createServer((req, rsp) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (extra[u]) { rsp.writeHead(200, { "content-type": "text/html" }); return rsp.end(extra[u]); }
  const f = path.join(dir, u.endsWith("/") ? u + "index.html" : u);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end("nf"); }
  rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(rsp); }).listen(0, () => res(s)); });
const STUDENT = "zz_test_leapfrog";
const AUTH_STUB = `window.MRJ_AUTH={student:function(){return ${JSON.stringify(STUDENT)}},loadProgressForApp:function(){return Promise.resolve({ok:true,progress:[]})},noteScore:function(){}};
setTimeout(function(){window.dispatchEvent(new CustomEvent("mrj-auth-ready",{detail:{id:${JSON.stringify(STUDENT)},progress:[]}}))},300);`;
const fails = []; const check = (ok, m) => { console.log((ok ? "PASS " : "FAIL ") + m); if (!ok) fails.push(m); };
const PILOT = (mode) => { clearInterval(window.__p); window.__p = setInterval(() => { const s = window.MRJLeapFrog && window.MRJLeapFrog.getState(); if (!s || s.view !== "play" || s.correct_lane == null) return;
  const lane = mode === "wrong" ? (s.correct_lane + 1) % 3 : s.correct_lane; window.dispatchEvent(new KeyboardEvent("keydown", { key: String(lane + 1) })); }, 250); };
async function newPage(browser, opts, posts) {
  const ctx = await browser.newContext(opts);
  await ctx.route("https://mrjkorea.github.io/mrj-signin/**", (r) => r.fulfill({ contentType: "text/plain", body: "" }));
  await ctx.route("https://mrjkorea.github.io/mrj-signin/mrj-auth.js", (r) => r.fulfill({ contentType: "text/javascript", body: AUTH_STUB }));
  await ctx.route("https://script.google.com/**", (r) => { try { const b = JSON.parse(r.request().postData()); for (const ev of b.events || []) posts.push({ student: b.student_name, program: ev.curriculum_program, itemId: ev.item_id, itemType: ev.item_type, scoreValue: ev.score_value, scoreMax: ev.score_max, metadata: JSON.parse(ev.metadata_json || "{}") }); } catch (e) {} r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"status":"ok"}' }); });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  return { ctx, page };
}
const st = (page) => page.evaluate(() => window.MRJLeapFrog.getState());
const waitView = (page, v, ms = 90000) => page.waitForFunction((v) => window.MRJLeapFrog && window.MRJLeapFrog.getState().view === v, v, { timeout: ms });
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const server = await serve(root); const B = `http://localhost:${server.address().port}`;
try {
  const posts = [];
  const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } }, posts);
  await page.goto(`${B}/index.html`);
  await page.waitForFunction(() => { const b = document.querySelector("#lf-start .go"); return b && !b.disabled; }, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/01-start-desktop.png` });
  await page.click("#lf-start .go");
  await waitView(page, "play");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/02-question-pads.png` });
  await page.evaluate(PILOT, "right");
  await page.waitForFunction(() => window.MRJLeapFrog.getState().streak >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/03-combo.png` });
  await page.waitForFunction(() => window.MRJLeapFrog.getState().land, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/04-land-near.png` });
  await page.waitForFunction(() => window.MRJLeapFrog.getState().view === "snack", null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/05-win-confetti.png` });
  await waitView(page, "end");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/06-end-win.png` });
  let s = await st(page);
  check(s.corrects === 5 && s.lives === 3, `standalone win: 5 right, 3 lives (${s.corrects}, ${s.lives})`);
  await page.waitForTimeout(500);
  const words = posts.filter((p) => p.itemType === "word"), rounds = posts.filter((p) => p.itemType === "round");
  check(words.length === 5 && words.every((p) => p.program === "leap-frog" && p.student === STUDENT && /^one-plus-words-v1:plus\d\d$/.test(p.itemId) && p.scoreValue === 1 && p.scoreMax === 1), `5 word rows leap-frog / pack:item (${words.length})`);
  check(rounds.length === 1 && rounds[0].itemId === "round:one-plus-words-v1" && rounds[0].scoreValue === 5 && rounds[0].scoreMax === 5 && rounds[0].metadata && rounds[0].metadata.target === 5, "1 round row 5/5 target 5");
  const ls = await page.evaluate(() => Object.keys(localStorage).filter((k) => /leap|lf/i.test(k)));
  check(ls.length === 0, "nothing saved to localStorage " + JSON.stringify(ls));
  await ctx.close();

  // wrong answers until game over (also timeout path once)
  const posts2 = [];
  const p2 = await newPage(browser, { viewport: { width: 1280, height: 800 } }, posts2);
  await p2.page.goto(`${B}/index.html?q=low`);
  await p2.page.waitForFunction(() => { const b = document.querySelector("#lf-start .go"); return b && !b.disabled; }, null, { timeout: 15000 });
  await p2.page.click("#lf-start .go"); await waitView(p2.page, "play");
  await p2.page.evaluate(PILOT, "wrong");
  await p2.page.waitForFunction(() => window.MRJLeapFrog.getState().lives === 2, null, { timeout: 20000 });
  await p2.page.waitForTimeout(150); await p2.page.screenshot({ path: `${out}/07-splash-miss.png` });
  await waitView(p2.page, "end", 40000); await p2.page.waitForTimeout(600);
  await p2.page.screenshot({ path: `${out}/08-end-sank.png` });
  s = await st(p2.page);
  check(s.lives === 0 && s.errors === 3 && s.low_quality, "3 wrong hops = game over (low quality forced)");
  check(posts2.filter((p) => p.itemType === "word" && p.scoreValue === 0).length === 3 && posts2.some((p) => p.itemType === "round" && p.metadata.dead), "3 incorrect rows + dead round row");
  await p2.ctx.close();

  // phone-size layout (layout check only)
  const p3 = await newPage(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }, []);
  await p3.page.goto(`${B}/index.html`);
  await p3.page.waitForFunction(() => { const b = document.querySelector("#lf-start .go"); return b && !b.disabled; }, null, { timeout: 15000 });
  await p3.page.click("#lf-start .go"); await waitView(p3.page, "play"); await p3.page.waitForTimeout(900);
  await p3.page.screenshot({ path: `${out}/09-phone-layout.png` });
  const ov = await p3.page.evaluate(() => [...document.querySelectorAll(".pad-word")].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  check(ov, "phone: pad words inside the screen");
  await p3.ctx.close();

  if (wmDir) {
    const items = ["apple", "banana", "cherry", "grape"].map((w, i, a) => ({ item_id: w, question: "Meaning of " + w, correct: w, wrong: a.filter((x) => x !== w).slice(0, 2), word: w }));
    const pack = { pack_id: "zz_test_pack", title: "zz test", module_id: "leapfrog", activity_id: "leapfrog", seconds: 15, items };
    const ws = await serve(wmDir, { "/host.html": `<!doctype html><body style="margin:0"><iframe id=f style="width:1000px;height:700px;border:0"></iframe><script>
      window.msgs=[];addEventListener("message",e=>msgs.push(e.data));sessionStorage.setItem("mrj.wm.gamepack",${JSON.stringify(JSON.stringify(pack))});
      document.getElementById("f").src="index.html?pack=session&student=zz_test_wm";</script>` });
    const wp = await newPage(browser, { viewport: { width: 1000, height: 700 } }, []);
    const signin = []; wp.page.on("request", (r) => { if (/mrj-signin|script\.google/.test(r.url())) signin.push(r.url()); });
    await wp.page.goto(`http://localhost:${ws.address().port}/host.html`);
    const f = await (await wp.page.waitForSelector("#f")).contentFrame();
    await f.waitForFunction(() => { const b = document.querySelector("#lf-start .go"); return b && !b.disabled; }, null, { timeout: 15000 });
    await f.click("#lf-start .go");
    await f.waitForFunction(() => window.MRJLeapFrog.getState().view === "play");
    await f.waitForTimeout(800); await wp.page.screenshot({ path: `${out}/10-wordmaster-play.png` });
    await f.evaluate(PILOT, "right");
    await f.waitForFunction(() => window.MRJLeapFrog.getState().view === "end", null, { timeout: 60000 });
    await f.waitForTimeout(600); await wp.page.screenshot({ path: `${out}/11-wordmaster-end.png` });
    const msgs = await wp.page.evaluate(() => window.msgs);
    const done = msgs.find((m) => m && m.type === "mrj-wm-game-done");
    check(done && done.game === "leapfrog" && done.items === 4 && done.correct === 4 && done.finished === true, "WM: all 4 words -> mrj-wm-game-done " + JSON.stringify(done));
    check(signin.length === 0, "WM copy loads no sign-in / score scripts");
    await wp.ctx.close(); ws.close();
  }
} catch (err) { fails.push("exception: " + err.message); console.log(err); }
await browser.close(); server.close();
console.log(fails.length ? `SMOKE FAIL (${fails.length})\n` + fails.join("\n") : "SMOKE OK"); process.exit(fails.length ? 1 : 0);
