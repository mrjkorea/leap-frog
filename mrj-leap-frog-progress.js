/**
 * Leap Frog — MRJ auth progress helpers (browser + Node tests).
 * Program key must match data-mrj-app / noteScore rows: leap-frog
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MRJ_LF_PROGRESS = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PROGRAM = "leap-frog";

  function rowProgram(row) {
    row = row || {};
    return String(row.program || row.curriculum_program || "").trim();
  }

  function rowItemId(row) {
    row = row || {};
    return String(row.itemId || row.item_id || row.item || "").trim();
  }

  function rowPasses(row) {
    var raw =
      row.scoreValue != null
        ? row.scoreValue
        : row.score != null
          ? row.score
          : row.scorePct;
    var num =
      typeof raw === "number"
        ? raw
        : parseFloat(String(raw == null ? "" : raw).split("/")[0]);
    var max = row.scoreMax != null ? Number(row.scoreMax) : NaN;
    var pct = row.scorePct != null ? Number(row.scorePct) : NaN;
    if (Number.isFinite(pct)) return pct >= 100;
    if (Number.isFinite(max) && max > 0 && Number.isFinite(num)) return num >= max;
    return Number.isFinite(num) && num > 0;
  }

  function filterRowsForProgram(rows, program) {
    program = program || PROGRAM;
    rows = Array.isArray(rows) ? rows : [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      var prog = rowProgram(row);
      if (prog !== program) continue;
      if (!rowItemId(row)) continue;
      out.push(row);
    }
    return out;
  }

  /** Union row lists (no dedupe); filter when applying to passed map. */
  function mergeProgressRows(a, b) {
    var left = Array.isArray(a) ? a : [];
    var right = Array.isArray(b) ? b : [];
    return left.concat(right);
  }

  /**
   * Per item: pass if any row passes (never downgrade a pass).
   * Rows from other programs are ignored.
   */
  function passedMapFromRows(rows, program) {
    program = program || PROGRAM;
    var latest = {};
    rows = Array.isArray(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      if (rowProgram(row) !== program) continue;
      var item = rowItemId(row);
      if (!item) continue;
      var pass = rowPasses(row);
      if (pass) latest[item] = true;
      else if (latest[item] !== true) latest[item] = false;
    }
    return latest;
  }

  function mergePassedMaps(a, b) {
    a = a || {};
    b = b || {};
    var out = {};
    var keys = Object.keys(a).concat(Object.keys(b));
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      out[k] = !!(a[k] || b[k]);
    }
    return out;
  }

  return {
    PROGRAM: PROGRAM,
    rowProgram: rowProgram,
    rowItemId: rowItemId,
    rowPasses: rowPasses,
    filterRowsForProgram: filterRowsForProgram,
    mergeProgressRows: mergeProgressRows,
    passedMapFromRows: passedMapFromRows,
    mergePassedMaps: mergePassedMaps,
  };
});
