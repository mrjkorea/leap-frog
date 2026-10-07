/**
 * Load full leap-frog progress after MRJ sign-in (old server + auth 1.4).
 */
(function () {
  "use strict";

  var PROGRAM = "leap-frog";
  var RETRY_MS = 12000;
  var state = { rows: [], retryScheduled: false, kicked: false };

  function auth() {
    return window.MRJ_AUTH || null;
  }

  function progressApi() {
    return window.MRJ_LF_PROGRESS || null;
  }

  function progressError() {
    try {
      var a = auth();
      if (a && typeof a.progressError === "function") {
        return String(a.progressError() || "").trim();
      }
    } catch (e) {}
    return "";
  }

  function mergeIncoming(added) {
    var api = progressApi();
    if (!api || typeof api.mergeProgressRows !== "function") return;
    state.rows = api.mergeProgressRows(state.rows, added || []);
    window.__MRJ_LF_PROGRESS_ROWS = state.rows;
    notify();
  }

  function notify() {
    if (typeof window.__mrjLeapFrogOnProgress === "function") {
      try {
        window.__mrjLeapFrogOnProgress(state.rows);
      } catch (e) {}
    }
  }

  function loadFull() {
    var a = auth();
    if (!a || typeof a.loadProgressForApp !== "function") {
      return Promise.resolve({ ok: false, skipped: true });
    }
    return Promise.resolve()
      .then(function () {
        return a.loadProgressForApp(PROGRAM);
      })
      .then(function (res) {
        if (res && res.ok && res.progress) {
          mergeIncoming(res.progress);
        }
        return res;
      });
  }

  function scheduleRetry() {
    if (state.retryScheduled) return;
    state.retryScheduled = true;
    setTimeout(function () {
      state.retryScheduled = false;
      if (progressError()) return;
      loadFull().catch(function () {});
    }, RETRY_MS);
  }

  function onAuthReady(detail) {
    detail = detail || {};
    if (progressError()) {
      scheduleRetry();
      return;
    }
    if (detail.progress) {
      mergeIncoming(detail.progress);
    }
    loadFull()
      .then(function (res) {
        if (!res || (!res.ok && !res.skipped)) scheduleRetry();
      })
      .catch(function () {
        scheduleRetry();
      });
  }

  window.addEventListener("mrj-auth-ready", function (evt) {
    onAuthReady(evt && evt.detail);
  });

  window.__MRJ_LF_PROGRESS_ROWS = state.rows;

  function kickIfSignedIn() {
    if (state.kicked) return;
    try {
      var a = auth();
      if (!a || typeof a.student !== "function" || !a.student()) return;
      state.kicked = true;
      onAuthReady({ progress: [] });
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kickIfSignedIn);
  } else {
    kickIfSignedIn();
  }
})();
