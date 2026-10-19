// Copy the Vite build (dist/) into the Pages tree (repo root) or a Word Master games folder.
//   node scripts/publish.mjs              -> repo root (mrj-signin + scores + progress loaders)
//   node scripts/publish.mjs --wm <dir>   -> word-master/games/leap-frog (session words only; Word Master reports)
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist");
const args = process.argv.slice(2), wi = args.indexOf("--wm");
const wmDir = wi >= 0 ? path.resolve(args[wi + 1]) : null, outDir = wmDir || root;
const build = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).build;
const entry = JSON.parse(fs.readFileSync(path.join(dist, ".vite/manifest.json"), "utf8"))["index.html"];
const js = entry.file, css = (entry.css || [])[0];
const assetsOut = path.join(outDir, "assets"); fs.mkdirSync(assetsOut, { recursive: true });
const listFile = path.join(assetsOut, ".build-files.json");
if (fs.existsSync(listFile)) for (const f of JSON.parse(fs.readFileSync(listFile, "utf8"))) fs.rmSync(path.join(outDir, f), { force: true });
const copied = [];
for (const f of fs.readdirSync(path.join(dist, "assets"))) { fs.copyFileSync(path.join(dist, "assets", f), path.join(assetsOut, f)); copied.push("assets/" + f); }
fs.writeFileSync(listFile, JSON.stringify(copied, null, 1) + "\n");
const head = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#1683a8" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <meta name="mrj-build" content="${build}" />
    <title>Leap Frog — MRJ English</title>`;
const html = wmDir
  ? `${head}
    <meta name="mrj-host" content="word-master" />
    <script>
      /* Word Master public mode (news packs): this game saves nothing on the device. */
      (function () { try { var p = window.parent; if (p && p !== window && p.WM_PUBLIC_PACK && typeof p.WM_useMemoryStorage === "function") p.WM_useMemoryStorage(window); } catch (e) {} })();
    </script>
    <script type="module" crossorigin src="./${js}?v=${build}"></script>
    <link rel="stylesheet" crossorigin href="./${css}?v=${build}">
  </head>
  <body>
    <div id="app"></div>
    <script>
      /* Opened on its own (not inside Word Master): show the MRJ sign-in door. Embedded: Word Master reports. */
      (function () {
        var q = location.search || "";
        var embedded = window.parent !== window || /(?:^|[?&])pack=session(?:&|$)/.test(q);
        if (embedded) return;
        var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://mrjkorea.github.io/mrj-signin/mrj-auth.css"; document.head.appendChild(css);
        var auth = document.createElement("script"); auth.src = "https://mrjkorea.github.io/mrj-signin/mrj-auth.js";
        auth.onload = function () { var boot = document.createElement("script"); boot.src = "https://mrjkorea.github.io/mrj-signin/mrj-auth-boot.js"; boot.setAttribute("data-mrj-app", "leap-frog"); document.body.appendChild(boot); };
        document.body.appendChild(auth);
      })();
    </script>
  </body>
</html>
`
  : `${head}
    <meta name="lf-default-pack" content="./packs/starter-en.json" />
    <script type="module" crossorigin src="./${js}?v=${build}"></script>
    <link rel="stylesheet" crossorigin href="./${css}?v=${build}">
  </head>
  <body>
    <div id="app"></div>
    <link rel="stylesheet" href="https://mrjkorea.github.io/mrj-signin/mrj-auth.css">
    <script src="https://mrjkorea.github.io/mrj-signin/mrj-auth.js"></script>
    <script src="https://mrjkorea.github.io/mrj-signin/mrj-auth-boot.js" data-mrj-app="leap-frog"></script>
    <script src="./mrj-leap-frog-progress.js?v=${build}"></script>
    <script src="./mrj-auth-progress.js?v=${build}"></script>
    <script src="./mrj-scores.js?v=${build}"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html);
if (wmDir) {
  const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(wmDir, rel)), { recursive: true }); fs.copyFileSync(path.join(root, rel), path.join(wmDir, rel)); };
  for (const f of fs.readdirSync(path.join(root, "audio"))) if (/\.(mp3|txt)$/.test(f)) copy("audio/" + f);
  for (const f of fs.readdirSync(path.join(root, "audio/sfx"))) copy("audio/sfx/" + f);
  for (const d of ["models", "textures"]) for (const f of fs.readdirSync(path.join(root, d))) copy(d + "/" + f);
}
console.log(`published ${js} ${css} -> ${outDir} (build ${build})`);
