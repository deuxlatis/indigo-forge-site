/* Report library. Uploaded runs are parsed in the browser and kept in IndexedDB
 * on the visitor's own machine — nothing is uploaded anywhere, and this page has
 * no server to upload to. If IndexedDB is unavailable (private windows, blocked
 * site data) everything still works for the session; it just won't persist. */
(function (global) {
  "use strict";

  var DB = "optres-explorer", STORE = "reports", VERSION = 1;
  var memory = Object.create(null);
  var broken = false;

  function open() {
    return new Promise(function (resolve, reject) {
      if (broken || !global.indexedDB) return reject(new Error("no indexeddb"));
      var req;
      try { req = indexedDB.open(DB, VERSION); }
      catch (e) { broken = true; return reject(e); }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { broken = true; reject(req.error); };
    });
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode), s = t.objectStore(STORE), out;
        out = fn(s);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function uid() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var Store = {
    /* Returns [{id, name, addedAt, passes:n}] for every saved report, newest first. */
    list: function () {
      return tx("readonly", function (s) { return s.getAll(); })
        .then(function (rows) { return rows || []; })
        .catch(function () {
          return Object.keys(memory).map(function (k) { return memory[k]; });
        })
        .then(function (rows) {
          return rows.slice().sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
        });
    },

    get: function (id) {
      return tx("readonly", function (s) { return s.get(id); })
        .catch(function () { return memory[id]; });
    },

    put: function (report) {
      if (!report.id) report.id = uid();
      if (!report.addedAt) report.addedAt = Date.now();
      memory[report.id] = report;
      return tx("readwrite", function (s) { s.put(report); })
        .catch(function () { return null; })
        .then(function () { return report; });
    },

    remove: function (id) {
      delete memory[id];
      return tx("readwrite", function (s) { s.delete(id); }).catch(function () { return null; });
    }
  };

  global.ReportStore = Store;
})(window);
