window.__initForge = function () {
  "use strict";

  // yellow (low) -> green (high); lightness falls monotonically so the ramp
  // still reads as an order, and every step clears 3:1 on the dark ground
  var RAMP = [
    [0.00, "#fdeb6b"], [0.17, "#e6e057"], [0.34, "#c2d64f"], [0.50, "#96c953"],
    [0.67, "#62b95c"], [0.84, "#2ba566"], [1.00, "#10996a"]
  ];
  // cluster hues deliberately avoid the ramp's yellow-green band
  var CCOL = ["#d55181", "#3987e5", "#d95926", "#9085e9", "#e66767", "#7f8b99"];
  var INK = "#e9eef2", INK2 = "#9aa4ac", INK3 = "#6e777e";
  var GRID = "#262b30", WALL = "#121517", ACCENT = "#f0a52a", CRIT = "#d03b3b";
  var MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  var COND = '"IBM Plex Sans Condensed", "IBM Plex Sans", sans-serif';

  var gd = document.getElementById("plot");

  if (!window.Plotly) {
    gd.innerHTML = '<p class="fail">The 3D plotting library did not load, so the surface can\'t be drawn. ' +
      'Reload the page; if it keeps failing, the CDN is unreachable from this network.</p>';
    return;
  }

  /* ---------------- helpers ---------------- */
  function usd(v) {
    var a = Math.abs(v), s = v < 0 ? "-$" : "$", n;
    if (a >= 1e6) { n = a / 1e6; return s + n.toFixed(n % 1 ? (n >= 10 ? 1 : 2) : 0) + "M"; }
    if (a >= 1e3) { n = a / 1e3; return s + (n >= 100 ? n.toFixed(0) : n.toFixed(n % 1 ? 1 : 0)) + "k"; }
    return s + a.toFixed(0);
  }
  function usdFull(v) {
    return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function pct(v) { return v.toFixed(1) + "%"; }
  function median(a) {
    if (!a.length) return 0;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  function L(v) { return Math.log10(Math.max(v, 1)); }

  /* ---------------- metric registry ---------------- */
  // every metric can sit on any axis or drive the colour ramp
  var METRICS = {
    ddp: { label: "Max equity drawdown %", axis: "MAX EQUITY DRAWDOWN %", log: false, suffix: "%",
           get: function (r) { return r.ddp; }, fmt: function (v) { return v.toFixed(1) + "%"; } },
    ddu: { label: "Max equity drawdown $", axis: "MAX EQUITY DRAWDOWN $", log: true,
           get: function (r) { return r.ddu; }, fmt: usd },
    pf:  { label: "Profit factor", axis: "PROFIT FACTOR", log: false,
           get: function (r) { return r.pf; }, fmt: function (v) { return v.toFixed(2); } },
    eq:  { label: "Final equity", axis: "FINAL EQUITY", log: true,
           get: function (r) { return r.eq; }, fmt: usd },
    tr:  { label: "Trades", axis: "TRADES", log: true,
           get: function (r) { return r.tr; },
           fmt: function (v) { return v >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v)); } },
    wr:  { label: "Win rate %", axis: "WIN RATE %", log: false, suffix: "%",
           get: function (r) { return r.wr; }, fmt: function (v) { return v.toFixed(1) + "%"; } },
    at:  { label: "Average trade $", axis: "AVERAGE TRADE $", log: false,
           get: function (r) { return r.at; }, fmt: usd },
    rf:  { label: "Recovery factor", axis: "RECOVERY FACTOR", log: false,
           get: function (r) { return r.npf / r.ddu; }, fmt: function (v) { return v.toFixed(2); } }
  };
  var ORDER = ["ddp", "ddu", "pf", "eq", "tr", "wr", "at", "rf"];
  function V(r, k) { var m = METRICS[k], v = m.get(r); return m.log ? L(v) : v; }
  function span(rs, k) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < rs.length; i++) {
      var v = V(rs[i], k);
      if (!isFinite(v)) continue;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
    return [lo, hi];
  }
  // 1-and-5-per-decade ticks for log metrics; null lets Plotly auto-tick linear ones
  function ticksFor(k, lo, hi, mults) {
    var m = METRICS[k];
    if (!m.log) return null;
    var out = { tickvals: [], ticktext: [] };
    for (var e = Math.floor(lo); e <= Math.ceil(hi); e++) {
      (mults || [1, 5]).forEach(function (mult) {
        var v = e + Math.log10(mult);
        if (v >= lo - 0.08 && v <= hi + 0.08) {
          out.tickvals.push(v);
          out.ticktext.push(m.fmt(mult * Math.pow(10, e)));
        }
      });
    }
    return out.tickvals.length >= 2 ? out : null;
  }

  /* ---------------- report + state ---------------- */
  var RUN = { meta: { total: 0 }, passes: [] };
  var LIM = { pfMin: 0, pfMax: 10, ddMin: 0, ddMax: 120, eqMin: 2, eqMax: 8 };

  var S = {
    exSo: true, exDup: true,
    pfMin: 1.5, ddMax: 112, eqMin: 3,
    k: 4, mode: "auto", lod: "clusters", hulls: true,
    pinned: null, focus: null,
    ax: { x: "ddp", y: "ddu", z: "pf", c: "eq" }
  };
  var CAM0 = { eye: { x: 1.59, y: 1.4, z: 0.98 }, center: { x: 0, y: 0, z: -0.14 }, up: { x: 0, y: 0, z: 1 } };
  var NORM0 = Math.sqrt(1.59 * 1.59 + 1.4 * 1.4 + 0.98 * 0.98);
  var cam = JSON.parse(JSON.stringify(CAM0));
  var rows = [], clusters = [];

  function apply() {
    rows = RUN.passes.filter(function (r) {
      if (S.exSo && r.so) return false;
      if (S.exDup && r.dup) return false;
      if (S.pfMin > LIM.pfMin + 1e-9 && r.pf < S.pfMin) return false;
      if (S.ddMax < LIM.ddMax - 1e-9 && r.ddp > S.ddMax) return false;
      if (S.eqMin > LIM.eqMin + 1e-9 && r.eq < Math.pow(10, S.eqMin)) return false;
      return true;
    });
  }

  /* ---------------- k-means over all four dimensions ---------------- */
  function seeded(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function features(rs) {
    var ch = [S.ax.x, S.ax.y, S.ax.z, S.ax.c];
    var X = rs.map(function (r) {
      return ch.map(function (k) { var v = V(r, k); return isFinite(v) ? v : 0; });
    });
    for (var d = 0; d < 4; d++) {
      var m = 0, i;
      for (i = 0; i < X.length; i++) m += X[i][d];
      m /= X.length || 1;
      var s = 0;
      for (i = 0; i < X.length; i++) s += (X[i][d] - m) * (X[i][d] - m);
      s = Math.sqrt(s / (X.length || 1)) || 1;
      for (i = 0; i < X.length; i++) X[i][d] = (X[i][d] - m) / s;
    }
    return X;
  }
  function d2(a, b) {
    var s = 0; for (var i = 0; i < 4; i++) { var t = a[i] - b[i]; s += t * t; } return s;
  }
  function kmeans(rs, k) {
    var n = rs.length;
    if (n < k * 3) k = Math.max(1, Math.floor(n / 3));
    if (n === 0) return [];
    var X = features(rs), rnd = seeded(20260829), C = [X[Math.floor(rnd() * n)].slice()], i, j;
    while (C.length < k) {                                   // k-means++ seeding
      var dd = X.map(function (x) {
        var best = Infinity;
        for (var c = 0; c < C.length; c++) best = Math.min(best, d2(x, C[c]));
        return best;
      });
      var tot = dd.reduce(function (a, b) { return a + b; }, 0), t = rnd() * tot, acc = 0, pick = n - 1;
      for (i = 0; i < n; i++) { acc += dd[i]; if (acc >= t) { pick = i; break; } }
      C.push(X[pick].slice());
    }
    var lab = new Array(n).fill(0);
    for (var it = 0; it < 80; it++) {
      var moved = false;
      for (i = 0; i < n; i++) {
        var b = 0, bd = Infinity;
        for (j = 0; j < C.length; j++) { var q = d2(X[i], C[j]); if (q < bd) { bd = q; b = j; } }
        if (lab[i] !== b) { lab[i] = b; moved = true; }
      }
      var sum = C.map(function () { return [0, 0, 0, 0, 0]; });
      for (i = 0; i < n; i++) {
        for (j = 0; j < 4; j++) sum[lab[i]][j] += X[i][j];
        sum[lab[i]][4]++;
      }
      for (j = 0; j < C.length; j++) if (sum[j][4]) for (i = 0; i < 4; i++) C[j][i] = sum[j][i] / sum[j][4];
      if (!moved && it > 2) break;
    }
    var groups = C.map(function (_, idx) { return { idx: idx, members: [] }; });
    for (i = 0; i < n; i++) groups[lab[i]].members.push(rs[i]);
    groups = groups.filter(function (g) { return g.members.length > 0; });
    // order clusters by median equity so colours stay meaningful as k changes
    groups.sort(function (a, b) {
      return median(a.members.map(function (r) { return r.eq; })) -
             median(b.members.map(function (r) { return r.eq; }));
    });
    return groups.map(function (g, i2) {
      var m = g.members;
      return {
        id: i2, name: "C" + (i2 + 1), color: CCOL[i2 % CCOL.length], members: m,
        medEq: median(m.map(function (r) { return r.eq; })),
        medPf: median(m.map(function (r) { return r.pf; })),
        medDdp: median(m.map(function (r) { return r.ddp; })),
        medDdu: median(m.map(function (r) { return r.ddu; })),
        cx: median(m.map(function (r) { return V(r, S.ax.x); })),
        cy: median(m.map(function (r) { return V(r, S.ax.y); })),
        cz: median(m.map(function (r) { return V(r, S.ax.z); }))
      };
    });
  }
  function clusterOf(id) {
    for (var i = 0; i < clusters.length; i++)
      for (var j = 0; j < clusters[i].members.length; j++)
        if (clusters[i].members[j].id === id) return clusters[i];
    return null;
  }

  /* ---------------- traces ---------------- */
  function tip(r) {
    var s = "PASS " + r.id + (r.so ? " — STOPPED OUT" : "") +
      "<br>" + usdFull(r.eq) + " · PF " + r.pf.toFixed(2) +
      "<br>DD " + pct(r.ddp) + " · " + usd(r.ddu) +
      "<br>" + r.tr.toLocaleString() + " trades";
    var extra = [S.ax.x, S.ax.y, S.ax.z, S.ax.c].filter(function (k) {
      return ["eq", "pf", "ddp", "ddu", "tr"].indexOf(k) < 0;
    });
    extra.forEach(function (k) {
      s += "<br>" + METRICS[k].label + ": " + METRICS[k].fmt(METRICS[k].get(r));
    });
    return s;
  }

  function ptTrace(rs, big, crange) {
    var pos = rs.filter(function (r) { return r.eq > 0; });
    var neg = rs.filter(function (r) { return r.eq <= 0; });
    var out = [];
    out.push({
      type: "scatter3d", mode: "markers", name: "pass",
      x: pos.map(function (r) { return V(r, S.ax.x); }),
      y: pos.map(function (r) { return V(r, S.ax.y); }),
      z: pos.map(function (r) { return V(r, S.ax.z); }),
      customdata: pos.map(function (r) { return r.id; }),
      marker: {
        size: big ? 6.5 : 3.2,
        opacity: big ? 0.95 : 0.42,
        color: pos.map(function (r) { return V(r, S.ax.c); }),
        colorscale: RAMP, cmin: crange[0], cmax: crange[1], showscale: false,
        line: { width: 0 }
      },
      hoverinfo: "text",
      text: pos.map(tip)
    });
    if (neg.length) {
      out.push({
        type: "scatter3d", mode: "markers", name: "stop-out",
        x: neg.map(function (r) { return V(r, S.ax.x); }),
        y: neg.map(function (r) { return V(r, S.ax.y); }),
        z: neg.map(function (r) { return V(r, S.ax.z); }),
        customdata: neg.map(function (r) { return r.id; }),
        marker: { size: big ? 5 : 2.6, opacity: big ? 0.9 : 0.5, color: CRIT, symbol: "x", line: { width: 0 } },
        hoverinfo: "text",
        text: neg.map(tip)
      });
    }
    return out;
  }

  function hullTraces(showHull, showMarks) {
    var out = [];
    clusters.forEach(function (c) {
      if (showHull > 0.01 && c.members.length >= 5) {
        out.push({
          type: "mesh3d", alphahull: 0, opacity: showHull, color: c.color,
          flatshading: true, hoverinfo: "skip", showscale: false,
          lighting: { ambient: 0.85, diffuse: 0.4, specular: 0.05 },
          x: c.members.map(function (r) { return V(r, S.ax.x); }),
          y: c.members.map(function (r) { return V(r, S.ax.y); }),
          z: c.members.map(function (r) { return V(r, S.ax.z); })
        });
      }
    });
    var vis = clusters.filter(function () { return showMarks; });
    if (vis.length) {
      out.push({
        type: "scatter3d", mode: "markers+text",
        x: vis.map(function (c) { return c.cx; }),
        y: vis.map(function (c) { return c.cy; }),
        z: vis.map(function (c) { return c.cz; }),
        text: vis.map(function (c) { return c.name; }),
        textposition: "top center",
        textfont: { family: COND, size: 12, color: INK },
        marker: {
          size: vis.map(function (c) { return 9 + 22 * Math.sqrt(c.members.length / rows.length); }),
          color: vis.map(function (c) { return c.color; }),
          opacity: 0.85, line: { width: 1.5, color: WALL }
        },
        hoverinfo: "text",
        hovertext: vis.map(function (c) {
          return c.name + " — " + c.members.length + " passes<br>median " + usd(c.medEq) +
            " · PF " + c.medPf.toFixed(2) + "<br>median DD " + pct(c.medDdp) + " · " + usd(c.medDdu);
        })
      });
    }
    return out;
  }

  function focusTrace() {
    var id = S.pinned;
    if (id == null) return [];
    var r = rows.filter(function (q) { return q.id === id; })[0];
    if (!r) return [];
    return [{
      type: "scatter3d", mode: "markers",
      x: [V(r, S.ax.x)], y: [V(r, S.ax.y)], z: [V(r, S.ax.z)],
      marker: { size: 15, color: "rgba(0,0,0,0)", line: { width: 2.5, color: INK } },
      hoverinfo: "skip"
    }];
  }

  function axis(key, lo, hi) {
    var m = METRICS[key];
    var a = {
      title: { text: m.axis, font: { family: COND, size: 11.5, color: INK2 } },
      tickfont: { family: MONO, size: 10, color: INK3 },
      gridcolor: GRID, zeroline: false, showbackground: true,
      backgroundcolor: WALL, showspikes: false,
      linecolor: GRID, tickcolor: GRID
    };
    var t = ticksFor(key, lo, hi);
    if (t) { a.tickvals = t.tickvals; a.ticktext = t.ticktext; }
    else if (m.suffix) a.ticksuffix = m.suffix;
    return a;
  }

  // the colour ramp legend redraws itself for whichever metric drives it
  function paintKey(lo, hi) {
    var m = METRICS[S.ax.c];
    document.getElementById("key-title").firstChild.nodeValue = m.label + " ";
    var host = document.getElementById("key-ticks");
    host.innerHTML = "";
    var t = ticksFor(S.ax.c, lo, hi, [1]);
    if (!t || t.tickvals.length < 3) t = ticksFor(S.ax.c, lo, hi);
    var vals, txts, i;
    if (t) { vals = t.tickvals.slice(); txts = t.ticktext.slice(); }
    else {
      vals = []; txts = [];
      for (i = 0; i <= 4; i++) {
        var v = lo + (hi - lo) * i / 4;
        vals.push(v); txts.push(m.fmt(v));
      }
    }
    while (vals.length > 6) {
      var kv = [], kt = [];
      for (i = 0; i < vals.length; i += 2) { kv.push(vals[i]); kt.push(txts[i]); }
      vals = kv; txts = kt;
    }
    vals.forEach(function (v, j) {
      var p = 100 * (v - lo) / Math.max(hi - lo, 1e-9);
      var el = document.createElement("span");
      el.style.bottom = Math.min(Math.max(p, 1.5), 96.5).toFixed(1) + "%";
      el.textContent = txts[j];
      host.appendChild(el);
    });
  }

  // stretch the plot box toward whichever way the stage is roomy, so the
  // cube fills the panel instead of floating in the middle of it
  function boxShape() {
    var w = gd.clientWidth || 1, h = gd.clientHeight || 1, ar = w / h;
    var rx = w < 700 ? 1 : Math.min(Math.max(ar, 1.2), 1.8);
    var rz = Math.min(Math.max(1.45 / ar, 0.95), 1.5);
    var m = Math.max(rx, rz) / 1.14;          // keep the box's apparent size constant
    return { x: rx / m, y: 1 / m, z: rz / m };
  }

  function draw() {
    var big = S.lod === "points";
    var hull = (big || !S.hulls) ? 0 : 0.17;   // a mesh occludes points in WebGL's pick pass, so none in points mode
    var sx = span(rows, S.ax.x), sy = span(rows, S.ax.y),
        sz = span(rows, S.ax.z), sc = span(rows, S.ax.c);
    paintKey(sc[0], sc[1]);
    var data = hullTraces(hull, !big).concat(ptTrace(rows, big, sc)).concat(focusTrace());
    var layout = {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 44, r: 24, t: 12, b: 28 },
      showlegend: false,
      hoverlabel: {
        bgcolor: "#1a1e22", bordercolor: GRID,
        font: { family: MONO, size: 11.5, color: INK }, align: "left"
      },
      scene: {
        camera: cam, aspectmode: "manual", aspectratio: boxShape(), dragmode: "orbit",
        xaxis: axis(S.ax.x, sx[0], sx[1]),
        yaxis: axis(S.ax.y, sy[0], sy[1]),
        zaxis: axis(S.ax.z, sz[0], sz[1])
      }
    };
    return Plotly.react(gd, data, layout, { displayModeBar: false, responsive: true, doubleClick: false });
  }

  /* ---------------- level of detail ---------------- */
  function setLod(next) {
    if (next === S.lod) return;
    S.lod = next;
    var el = document.getElementById("lod");
    el.classList.toggle("points", next === "points");
    document.getElementById("lod-txt").textContent =
      next === "points" ? "Individual passes" : "Cluster view";
    draw();
  }
  function lodFromCamera() {
    if (S.mode === "clusters") return setLod("clusters");
    if (S.mode === "points") return setLod("points");
    var e = cam.eye, n = Math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z) / NORM0;
    if (n < 0.62) setLod("points");
    else if (n > 0.74) setLod("clusters");
  }

  /* ---------------- readout ---------------- */
  function showPass(id) {
    var r = RUN.passes.filter(function (q) { return q.id === id; })[0];
    var box = document.getElementById("readout");
    if (!r) { clearPass(); return; }
    var c = clusterOf(id);
    box.innerHTML =
      '<div class="rh"><b>Pass ' + r.id + '</b><span>' + (c ? c.name : "unclustered") + '</span></div>' +
      '<dl class="kv">' +
      '<dt>Final equity</dt><dd>' + usdFull(r.eq) + '</dd>' +
      '<dt>Net profit</dt><dd>' + usdFull(r.npf) + '</dd>' +
      '<dt>Profit factor</dt><dd>' + r.pf.toFixed(2) + '</dd>' +
      '<dt>Max eq. drawdown</dt><dd>' + pct(r.ddp) + '</dd>' +
      '<dt>&nbsp;&nbsp;in dollars</dt><dd>' + usdFull(r.ddu) + '</dd>' +
      '<dt>Trades</dt><dd>' + r.tr.toLocaleString() + '</dd>' +
      '<dt>Win rate</dt><dd>' + r.wr.toFixed(1) + '%</dd>' +
      '<dt>Avg. trade</dt><dd>' + usdFull(r.at) + '</dd>' +
      '</dl>' +
      (r.so ? '<span class="badge">◆ Stopped out — account blew up</span>' : "") +
      (r.dup ? '<span class="badge">◆ Repeat of pass ' + r.dupof + '</span>' : "");
  }
  function clearPass() {
    document.getElementById("readout").innerHTML =
      '<div class="rh"><b>No pass selected</b><span>Readout</span></div>' +
      '<p class="empty">Hover a point for its numbers; click to pin it.</p>';
  }

  /* ---------------- rail + tiles ---------------- */
  function paintClusters() {
    var host = document.getElementById("clist");
    host.innerHTML = "";
    clusters.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "crow";
      b.setAttribute("aria-pressed", "false");
      b.innerHTML =
        '<span class="chip" style="background:' + c.color + '"></span>' +
        '<span class="nm">' + c.name + '<em>' + usd(c.medEq) + ' · PF ' + c.medPf.toFixed(2) +
        ' · DD ' + pct(c.medDdp) + '</em></span>' +
        '<span class="ct">' + c.members.length + '</span>';
      b.addEventListener("click", function () {
        var best = c.members.slice().sort(function (x, y) { return y.eq - x.eq; })[0];
        S.pinned = best.id;
        showPass(best.id);
        [].forEach.call(host.children, function (el) { el.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        draw();
      });
      host.appendChild(b);
    });
  }
  function paintTiles() {
    var n = rows.length;
    document.getElementById("t-n").innerHTML = n + ' <small>/ ' + RUN.meta.total + '</small>';
    document.getElementById("t-eq").textContent = n ? usd(Math.max.apply(null, rows.map(function (r) { return r.eq; }))) : "—";
    document.getElementById("t-dd").textContent = n ? pct(median(rows.map(function (r) { return r.ddp; }))) : "—";
    document.getElementById("t-pf").textContent = n ? Math.max.apply(null, rows.map(function (r) { return r.pf; })).toFixed(2) : "—";
    var dropped = RUN.meta.total - RUN.passes.filter(function (r) {
      return !(S.exSo && r.so) && !(S.exDup && r.dup);
    }).length;
    document.getElementById("hy-count").textContent = dropped + " dropped";
    document.getElementById("xkey").hidden = !rows.some(function (r) { return r.eq <= 0; });
  }
  var ready = false;
  function refresh() {
    if (!ready) return null;
    apply();
    clusters = kmeans(rows, S.k);
    paintClusters();
    paintTiles();
    if (S.pinned != null && !rows.some(function (r) { return r.id === S.pinned; })) {
      S.pinned = null; clearPass();
    }
    return draw();
  }

  /* ---------------- wiring ---------------- */
  function bindRange(id, out, fmt, set) {
    var el = document.getElementById(id), lab = out && document.getElementById(out);
    function upd() {
      var v = parseFloat(el.value);
      if (lab) lab.textContent = fmt(v);
      set(v);
    }
    el.addEventListener("input", upd);
    upd();
  }
  bindRange("f-pf", "v-pf",
    function (v) { return v <= LIM.pfMin + 1e-9 ? "any" : v.toFixed(2); },
    function (v) { S.pfMin = v; refresh(); });
  bindRange("f-dd", "v-dd",
    function (v) { return v >= LIM.ddMax - 1e-9 ? "any" : v.toFixed(0) + "%"; },
    function (v) { S.ddMax = v; refresh(); });
  bindRange("f-eq", "v-eq",
    function (v) { return v <= LIM.eqMin + 1e-9 ? "any" : usd(Math.pow(10, v)); },
    function (v) { S.eqMin = v; refresh(); });
  bindRange("f-k", "k-val", function (v) { return v; }, function (v) { S.k = v; refresh(); });

  var CH = { x: "ax-x", y: "ax-y", z: "ax-z", c: "ax-c" };
  function paintChannels() {
    Object.keys(CH).forEach(function (slot) {
      var sel = document.getElementById(CH[slot]);
      sel.value = S.ax[slot];
    });
  }
  Object.keys(CH).forEach(function (slot) {
    var sel = document.getElementById(CH[slot]);
    ORDER.forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = METRICS[k].label;
      sel.appendChild(o);
    });
    sel.value = S.ax[slot];
    sel.addEventListener("change", function () {
      var next = sel.value, prev = S.ax[slot];
      // a metric can only occupy one channel: whoever held it takes the old one
      Object.keys(CH).forEach(function (other) {
        if (other !== slot && S.ax[other] === next) S.ax[other] = prev;
      });
      S.ax[slot] = next;
      paintChannels();
      refresh();
    });
  });

  document.getElementById("hulls").addEventListener("change", function (e) {
    S.hulls = e.target.checked; draw();
  });

  document.getElementById("ex-so").addEventListener("change", function (e) { S.exSo = e.target.checked; refresh(); });
  document.getElementById("ex-dup").addEventListener("change", function (e) { S.exDup = e.target.checked; refresh(); });

  var modes = { "m-auto": "auto", "m-clu": "clusters", "m-pts": "points" };
  Object.keys(modes).forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () {
      S.mode = modes[id];
      Object.keys(modes).forEach(function (o) {
        document.getElementById(o).setAttribute("aria-pressed", String(o === id));
      });
      if (S.mode === "clusters") setLod("clusters");
      else if (S.mode === "points") setLod("points");
      else lodFromCamera();
    });
  });
  document.getElementById("reset").addEventListener("click", function () {
    cam = JSON.parse(JSON.stringify(CAM0));
    Plotly.relayout(gd, { "scene.camera": cam });
    lodFromCamera();
  });

  var rz = null;
  window.addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(draw, 220);
  });

  gd.addEventListener("mouseleave", function () {
    if (S.pinned != null) showPass(S.pinned); else clearPass();
  });

  /* ---------------- go ---------------- */
  var tick = null;
  function attach() {
    if (typeof gd.on !== "function") { setTimeout(attach, 60); return; }
    gd.on("plotly_hover", function (e) {
      var p = e.points && e.points[0];
      if (p && p.customdata != null) showPass(p.customdata);
    });
    gd.on("plotly_click", function (e) {
      var p = e.points && e.points[0];
      if (p && p.customdata != null) {
        S.pinned = (S.pinned === p.customdata) ? null : p.customdata;
        if (S.pinned == null) clearPass(); else showPass(S.pinned);
        draw();
      }
    });
    gd.on("plotly_relayout", function (e) {
      var c = e["scene.camera"] || (e.scene && e.scene.camera);
      if (!c || !c.eye) return;
      cam = c;
      if (tick) return;
      tick = requestAnimationFrame(function () { tick = null; lodFromCamera(); });
    });
  }
  /* ---------------- report library ---------------- */
  var attached = false;
  var current = null;        // { key, label, saved }

  function toast(msg, bad) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast" + (bad ? " bad" : "");
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, bad ? 7000 : 3500);
  }

  function nice(n) { return n.toLocaleString("en-US"); }

  function describe(meta) {
    var bits = [];
    if (meta.total) bits.push(nice(meta.total) + "-pass " + (meta.method || "").toLowerCase() + " optimization");
    if (meta.start && meta.end) bits.push("<b>" + meta.start + " → " + meta.end + "</b>");
    if (meta.capital != null) bits.push(usdFull(meta.capital) + " start");
    if (meta.bars) bits.push(meta.bars);
    return bits.join(" · ").replace(/\s+·/g, " ·");
  }

  // sliders and their "any" ends are re-derived for every report
  function fitControls() {
    var ps = RUN.passes;
    if (!ps.length) return;
    var pf = ps.map(function (r) { return r.pf; });
    var dd = ps.map(function (r) { return r.ddp; });
    var eq = ps.map(function (r) { return Math.max(r.eq, 1); });
    LIM.pfMin = Math.floor(Math.min.apply(null, pf) * 20) / 20;
    LIM.pfMax = Math.ceil(Math.max.apply(null, pf) * 20) / 20;
    LIM.ddMin = 0;
    LIM.ddMax = Math.ceil(Math.max.apply(null, dd)) + 1;
    LIM.eqMin = Math.floor(Math.log10(Math.min.apply(null, eq)) * 20) / 20;
    LIM.eqMax = Math.ceil(Math.log10(Math.max.apply(null, eq)) * 20) / 20;

    var set = function (id, min, max, val, step) {
      var el = document.getElementById(id);
      el.min = min; el.max = max; el.step = step; el.value = val;
      el.dispatchEvent(new Event("input"));
    };
    set("f-pf", LIM.pfMin, LIM.pfMax, LIM.pfMin, 0.05);
    set("f-dd", LIM.ddMin, LIM.ddMax, LIM.ddMax, 1);
    set("f-eq", LIM.eqMin, LIM.eqMax, LIM.eqMin, 0.05);

    var kmax = Math.max(2, Math.min(6, Math.floor(ps.length / 6)));
    var kel = document.getElementById("f-k");
    kel.max = kmax;
    if (+kel.value > kmax) { kel.value = kmax; kel.dispatchEvent(new Event("input")); }
  }

  function paintMeta() {
    var m = RUN.meta;
    document.title = m.name + " — Optimization Risk Surface";
    document.getElementById("run-title").textContent = m.name;
    document.getElementById("run-sub").innerHTML = describe(m);
    document.getElementById("so-note").textContent =
      m.stopouts + " pass" + (m.stopouts === 1 ? "" : "es") + " blew the account (equity drawdown ≥ 100%)";
    document.getElementById("dup-note").textContent =
      m.dups + " pass" + (m.dups === 1 ? "" : "es") + " reproduce an earlier pass's exact metrics";
    var swept = (m.params || []).map(function (p) {
      return p.name + (p.min != null ? " " + p.min + "–" + p.max : "");
    });
    document.getElementById("hy-note").innerHTML =
      (m.contiguous
        ? "Pass IDs run " + m.idmin + "–" + m.idmax + " with no gaps or repeats, so this export holds <b>one run only</b>."
        : "Pass IDs are <b>not contiguous</b> (" + m.idmin + "–" + m.idmax + " with gaps), which can mean results from an earlier optimization were left in this file.") +
      " Parameter values aren't stored in .optres files, so passes are identified by ID." +
      (swept.length ? " Swept: " + swept.join(", ") + "." : "");
  }

  function render() {
    fitControls();
    paintMeta();
    ready = true;
    var p = Promise.resolve(refresh());
    if (!attached) { attached = true; p = p.then(attach, attach); }
    return p;
  }

  function activate(report, entry) {
    RUN = { meta: report.meta, passes: report.passes };
    current = entry;
    S.pinned = null;
    clearPass();
    document.getElementById("rep-del").hidden = !entry.saved;
    document.getElementById("rep-count").textContent = nice(report.passes.length) + " passes";
    var sel = document.getElementById("rep-pick");
    if (sel.value !== entry.key) sel.value = entry.key;
    return render();
  }

  var bundled = [];

  function rebuildPicker(saved) {
    var sel = document.getElementById("rep-pick");
    sel.innerHTML = "";
    function group(label, items) {
      if (!items.length) return;
      var g = document.createElement("optgroup");
      g.label = label;
      items.forEach(function (it) {
        var o = document.createElement("option");
        o.value = it.key; o.textContent = it.label;
        g.appendChild(o);
      });
      sel.appendChild(g);
    }
    group("Bundled", bundled);
    group("Saved in this browser", saved);
    if (current) sel.value = current.key;
  }

  function refreshPicker() {
    return ReportStore.list().then(function (rows) {
      rebuildPicker(rows.map(function (r) {
        return { key: "saved:" + r.id, label: r.meta.name, saved: true, id: r.id };
      }));
      return rows;
    });
  }

  function loadBundled(entry) {
    if (entry.inline) return activate(entry.inline, entry);
    return fetch(entry.file).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (doc) { return activate(doc, entry); });
  }

  // the single-file build has no sibling files to fetch, so it inlines its reports
  function getBundled() {
    if (window.__BUNDLED) {
      return Promise.resolve(window.__BUNDLED.map(function (b, i) {
        return { key: "bundled:" + i, label: b.meta.name, inline: b, saved: false };
      }));
    }
    return fetch("data/manifest.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (list) {
        return (list || []).map(function (it) {
          return { key: "bundled:" + it.file, label: it.name, file: "data/" + it.file, saved: false };
        });
      });
  }

  function loadSaved(entry) {
    return ReportStore.get(entry.id).then(function (row) {
      if (!row) throw new Error("not found");
      return activate(row, entry);
    });
  }

  function selectKey(key) {
    var b = bundled.filter(function (e) { return e.key === key; })[0];
    if (b) return loadBundled(b);
    if (key.indexOf("saved:") === 0) return loadSaved({ key: key, id: key.slice(6), saved: true });
    return Promise.resolve();
  }

  function ingest(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var last = null, failed = 0;
    var chain = list.reduce(function (p, file) {
      return p.then(function () {
        return file.text().then(function (txt) {
          var parsed = OptRes.parse(txt, file.name);
          return ReportStore.put({ meta: parsed.meta, passes: parsed.passes })
            .then(function (saved) { last = saved; });
        }).catch(function (e) {
          failed++;
          console.error(file.name, e);
          toast(file.name + ": " + e.message, true);
        });
      });
    }, Promise.resolve());

    return chain.then(refreshPicker).then(function () {
      if (last) {
        var ok = list.length - failed;
        toast(ok + " report" + (ok === 1 ? "" : "s") + " added — " + nice(last.passes.length) + " passes");
        return activate(last, { key: "saved:" + last.id, label: last.meta.name, saved: true, id: last.id });
      }
    });
  }

  /* ---------------- report wiring ---------------- */
  document.getElementById("rep-pick").addEventListener("change", function (e) {
    selectKey(e.target.value).catch(function (err) { toast("Could not load that report: " + err.message, true); });
  });
  document.getElementById("rep-file").addEventListener("change", function (e) {
    ingest(e.target.files);
    e.target.value = "";
  });
  document.getElementById("rep-del").addEventListener("click", function () {
    if (!current || !current.saved) return;
    var id = current.id;
    ReportStore.remove(id).then(refreshPicker).then(function () {
      toast("Report removed from this browser");
      var sel = document.getElementById("rep-pick");
      if (sel.options.length) { sel.selectedIndex = 0; selectKey(sel.value); }
    });
  });

  var dropEl = document.getElementById("drop"), dragDepth = 0;
  window.addEventListener("dragenter", function (e) {
    if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") < 0) return;
    e.preventDefault(); dragDepth++; dropEl.hidden = false;
  });
  window.addEventListener("dragover", function (e) { if (!dropEl.hidden) e.preventDefault(); });
  window.addEventListener("dragleave", function () { if (--dragDepth <= 0) { dragDepth = 0; dropEl.hidden = true; } });
  window.addEventListener("drop", function (e) {
    if (dropEl.hidden) return;
    e.preventDefault(); dragDepth = 0; dropEl.hidden = true;
    ingest(e.dataTransfer.files);
  });

  /* ---------------- boot ---------------- */
  getBundled()
    .then(function (list) {
      bundled = list;
      return refreshPicker().then(function (saved) {
        var want = new URLSearchParams(location.search).get("r");
        var sel = document.getElementById("rep-pick");
        var key = (want && [].some.call(sel.options, function (o) { return o.value === want; }))
          ? want
          : (sel.options.length ? sel.options[0].value : null);
        if (!key) {
          document.getElementById("run-sub").textContent =
            "No report loaded — drop a .optres file anywhere on this page to begin.";
          return;
        }
        return selectKey(key);
      });
    })
    .catch(function (e) {
      toast("Could not start: " + e.message, true);
      console.error(e);
    });
};
