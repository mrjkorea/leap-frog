"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function loadScores(mocks) {
  const code = fs.readFileSync(path.join(__dirname, "..", "mrj-scores.js"), "utf8");
  const fetchCalls = [];
  const noteCalls = [];
  const sandbox = {
    fetch(url, init) {
      fetchCalls.push({ url, body: JSON.parse(init.body) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });
    },
    localStorage: {
      _data: {},
      getItem(k) {
        return this._data[k] || null;
      },
      setItem(k, v) {
        this._data[k] = v;
      },
    },
    addEventListener() {},
    MRJ_AUTH: {
      student: () => mocks.student || "",
      noteScore: (opts) => noteCalls.push(opts),
    },
    console,
    Date,
    Math,
    JSON,
    Promise,
    String,
    Number,
    parseInt,
    parseFloat,
    isNaN: Number.isNaN,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(code, sandbox);
  return { MRJ_SCORES: sandbox.MRJ_SCORES, fetchCalls, noteCalls };
}

test("post skips when no signed-in student", async () => {
  const { MRJ_SCORES, fetchCalls } = loadScores({ student: "" });
  const res = await MRJ_SCORES.post({ itemId: "x", scoreValue: 1, scoreMax: 1 });
  assert.equal(res.status, "skipped");
  assert.equal(fetchCalls.length, 0);
});

test("post uses id_key for non-email student and never unknown", async () => {
  const { MRJ_SCORES, fetchCalls, noteCalls } = loadScores({
    student: "zz_test_mrjmetrics",
  });
  await MRJ_SCORES.post({
    program: "leap-frog",
    itemId: "packA:q01",
    scoreValue: 1,
    scoreMax: 1,
  });
  assert.equal(fetchCalls.length, 1);
  const body = fetchCalls[0].body;
  assert.equal(body.student_email, "zz_test_mrjmetrics");
  assert.notEqual(body.student_email, "unknown");
  assert.match(body.session_id, /^leap-frog-zz_test_mrjmetrics-/);
  const ev = body.events[0];
  assert.equal(ev.identity_method, "mrj_signin");
  assert.equal(ev.identity_confidence, "high");
  assert.equal(ev.item_id, "packA:q01");
  assert.equal(noteCalls.length, 1);
  assert.equal(noteCalls[0].itemId, "packA:q01");
});

test("post does not call fetch when student missing even with opts.student empty", async () => {
  const { MRJ_SCORES, fetchCalls } = loadScores({ student: "  " });
  await MRJ_SCORES.post({ student: "  ", itemId: "a", scoreValue: 1, scoreMax: 1 });
  assert.equal(fetchCalls.length, 0);
});
