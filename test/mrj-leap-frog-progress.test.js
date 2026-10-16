"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lf = require("../mrj-leap-frog-progress.js");

const PROGRAM = "leap-frog";
const BUILD = "20261016-rebuild";

test("ignores rows from other programs", () => {
  const rows = [
    { program: "ski-jump", item_id: "a", scoreValue: 1, scoreMax: 1 },
    { curriculum_program: PROGRAM, item_id: "b", scoreValue: 1, scoreMax: 1 },
  ];
  const map = lf.passedMapFromRows(rows);
  assert.equal(map.a, undefined);
  assert.equal(map.b, true);
});

test("union keeps pass when later row fails (OR semantics)", () => {
  const rows = [
    { program: PROGRAM, item_id: "w1", scoreValue: 1, scoreMax: 1 },
    { program: PROGRAM, item_id: "w1", scoreValue: 0, scoreMax: 1 },
  ];
  const map = lf.passedMapFromRows(rows);
  assert.equal(map.w1, true);
});

test("mergeProgressRows combines lists for paging (>20 rows)", () => {
  const batch1 = [];
  const batch2 = [];
  for (let i = 0; i < 25; i++) {
    batch1.push({
      program: PROGRAM,
      item_id: "item-" + i,
      scoreValue: i % 2 === 0 ? 1 : 0,
      scoreMax: 1,
    });
  }
  for (let i = 25; i < 40; i++) {
    batch2.push({
      program: PROGRAM,
      item_id: "item-" + i,
      scoreValue: 1,
      scoreMax: 1,
    });
  }
  const merged = lf.mergeProgressRows(batch1, batch2);
  assert.equal(merged.length, 40);
  const map = lf.passedMapFromRows(merged);
  assert.equal(map["item-0"], true);
  assert.equal(map["item-1"], false);
  assert.equal(map["item-39"], true);
});

test("mergePassedMaps never un-completes", () => {
  const a = { x: true, y: false };
  const b = { x: false, z: true };
  const m = lf.mergePassedMaps(a, b);
  assert.equal(m.x, true);
  assert.equal(m.y, false);
  assert.equal(m.z, true);
});

test("filterRowsForProgram", () => {
  const rows = lf.filterRowsForProgram([
    { program: "day4-speak", item_id: "nope" },
    { program: PROGRAM, item_id: "yes", scoreValue: 1 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_id, "yes");
});

test("pack-scoped passed map ignores other packs and round rows", () => {
  const rows = [
    { program: PROGRAM, item: "packA:q01", score: "1/1" },
    { program: PROGRAM, item: "q02", score: "1/1" },
    { program: PROGRAM, item: "packB:q03", score: "1/1" },
    { program: PROGRAM, item: "round:packA", score: "4/5" },
  ];
  const map = lf.passedMapFromRows(rows, PROGRAM, "packA");
  assert.deepEqual(Object.keys(map).sort(), ["q01", "q02"]);
  assert.equal(map.q01, true);
  assert.equal(map.q02, true);
  assert.equal(map.q03, undefined);
});

test("buildWordPostOpts uses pack-prefixed itemId", () => {
  const opts = lf.buildWordPostOpts(
    { pack_id: "packA", title: "Pack A" },
    { item_id: "q01" },
    true
  );
  assert.equal(opts.itemId, "packA:q01");
  assert.equal(opts.program, PROGRAM);
  assert.equal(opts.scoreValue, 1);
  assert.equal(opts.scoreMax, 1);
  assert.equal(opts.itemType, "word");
  assert.equal(opts.appName, "MRJ Leap Frog");
});

test("buildRoundPostOpts sends round summary", () => {
  const opts = lf.buildRoundPostOpts(
    { pack_id: "packA" },
    [{ correct: true }, { correct: false }, { correct: true }, { correct: true }, { correct: false }],
    { round: 2, lives: 1, dead: false, corrects: 4, target: 5 }
  );
  assert.equal(opts.itemId, "round:packA");
  assert.equal(opts.scoreValue, 3);
  assert.equal(opts.scoreMax, 5);
  assert.equal(opts.itemType, "round");
});

test("index.html cache-bust stamps match mrj-build", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const m = html.match(/name="mrj-build"\s+content="([^"]+)"/);
  assert.ok(m, "mrj-build meta");
  const build = m[1];
  assert.ok(build.includes(BUILD), "build string includes savefix stamp");
  const vParams = [...html.matchAll(/\?v=([^"']+)/g)].map((x) => x[1]);
  assert.ok(vParams.length >= 4, "expected versioned script tags");
  for (const v of vParams) {
    assert.equal(v, BUILD, "each ?v= matches build stamp");
  }
});
