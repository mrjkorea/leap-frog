"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const lf = require("../mrj-leap-frog-progress.js");

const PROGRAM = "leap-frog";

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
