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
  var APP_NAME = "MRJ Leap Frog";

  function rowProgram(row) {
    row = row || {};
    return String(row.program || row.curriculum_program || "").trim();
  }

  function rowItemId(row) {
    row = row || {};
    return String(row.itemId || row.item_id || row.item || "").trim();
  }

  /**
   * Map stored item_id to in-pack word id for the current pack.
   * packA:q01 -> q01 when packId is packA; other packs and round: rows ignored.
   * Bare legacy ids pass through unchanged.
   */
  function normalizeItemKey(itemRaw, packId) {
    var item = String(itemRaw == null ? "" : itemRaw).trim();
    if (!item) return "";
    if (item.indexOf("round:") === 0) return "";
    var colon = item.indexOf(":");
    if (colon < 0) return item;
    var pack = item.slice(0, colon);
    var rest = item.slice(colon + 1);
    packId = String(packId == null ? "" : packId).trim();
    if (!packId || pack === packId) return rest;
    return "";
  }

  function packIdFromPack(pack) {
    pack = pack || {};
    return String(pack.pack_id || pack.packId || "pack").trim() || "pack";
  }

  function buildWordPostOpts(pack, item, correct) {
    var pid = packIdFromPack(pack);
    var wordId = String((item && (item.item_id || item.itemId)) || "").trim();
    return {
      program: PROGRAM,
      appName: APP_NAME,
      bookTitle: String((pack && (pack.title || pack.pack_id)) || pid).trim(),
      itemId: pid + ":" + wordId,
      itemType: "word",
      scoreValue: correct ? 1 : 0,
      scoreMax: 1,
      correctness: correct ? "correct" : "incorrect",
    };
  }

  function buildRoundPostOpts(pack, records, meta) {
    var pid = packIdFromPack(pack);
    records = Array.isArray(records) ? records : [];
    meta = meta || {};
    var cor = 0;
    for (var i = 0; i < records.length; i++) {
      if (records[i] && records[i].correct) cor++;
    }
    var tot = records.length;
    return {
      program: PROGRAM,
      appName: APP_NAME,
      bookTitle: String((pack && (pack.title || pack.pack_id)) || pid).trim(),
      itemId: "round:" + pid,
      itemType: "round",
      scoreValue: cor,
      scoreMax: tot > 0 ? tot : 1,
      metadata: {
        round: meta.round,
        lives: meta.lives,
        dead: !!meta.dead,
        corrects: meta.corrects,
        target: meta.target,
      },
    };
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
   * When packId is set, pack-scoped item ids apply only to that pack.
   */
  function passedMapFromRows(rows, program, packId) {
    program = program || PROGRAM;
    var latest = {};
    rows = Array.isArray(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      if (rowProgram(row) !== program) continue;
      var rawItem = rowItemId(row);
      var item = normalizeItemKey(rawItem, packId);
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
    APP_NAME: APP_NAME,
    rowProgram: rowProgram,
    rowItemId: rowItemId,
    normalizeItemKey: normalizeItemKey,
    buildWordPostOpts: buildWordPostOpts,
    buildRoundPostOpts: buildRoundPostOpts,
    rowPasses: rowPasses,
    filterRowsForProgram: filterRowsForProgram,
    mergeProgressRows: mergeProgressRows,
    passedMapFromRows: passedMapFromRows,
    mergePassedMaps: mergePassedMaps,
  };
});
