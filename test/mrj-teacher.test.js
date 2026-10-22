"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("bundled game imports server-backed isMrjTeacher helper", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/src/mrj-teacher.js"), "utf8");
  assert.match(src, /isTeacher\(\)/);
  assert.doesNotMatch(src, /localStorage/);
});
