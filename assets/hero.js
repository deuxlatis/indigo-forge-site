/* Indigo Forge — hero figure: the 409-pass optimization surface.
   Vanilla canvas, no dependencies. Draws a slowly turning point cloud
   sampled from a synthetic parameter surface; the passes that landed on
   the robust ridge are picked out in the accent gold. Static frame when
   the visitor prefers reduced motion. */

(function () {
  "use strict";

  var canvas = document.querySelector("[data-hero-surface]");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  /* Ink and gold track the active theme; the fallbacks are the dark palette. */
  var INK = "233, 238, 242"; /* --color-text */
  var GOLD = "240, 165, 42"; /* --color-accent */

  function hexToRgb(raw) {
    var m = /^#([0-9a-f]{6})$/i.exec(raw.trim());
    if (!m) return null;
    return (
      parseInt(m[1].slice(0, 2), 16) + ", " +
      parseInt(m[1].slice(2, 4), 16) + ", " +
      parseInt(m[1].slice(4, 6), 16)
    );
  }

  function readThemeColors() {
    var styles = getComputedStyle(document.documentElement);
    INK = hexToRgb(styles.getPropertyValue("--color-text")) || INK;
    GOLD = hexToRgb(styles.getPropertyValue("--color-accent")) || GOLD;
  }

  var PASSES = 409; /* one point per optimization pass */
  var TILT = 0.55; /* camera pitch, radians */
  var CAM = 2.7; /* perspective distance */
  var SPEED = 0.09; /* yaw, radians per second */

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* A fixed seed keeps the figure identical on every visit. */
  var rand = mulberry32(20230101);

  function surface(x, y) {
    return (
      0.58 * Math.exp(-((x - 0.25) * (x - 0.25) + (y + 0.1) * (y + 0.1)) * 2.4) -
      0.42 * Math.exp(-((x + 0.55) * (x + 0.55) + (y - 0.45) * (y - 0.45)) * 3.2) +
      0.16 * Math.sin(2.3 * x) * Math.cos(1.7 * y)
    );
  }

  var points = [];
  for (var i = 0; i < PASSES; i++) {
    var x = rand() * 2 - 1;
    var y = rand() * 2 - 1;
    var z = surface(x, y) + (rand() - 0.5) * 0.1;
    var nearPeak = Math.hypot(x - 0.25, y + 0.1);
    points.push({ x: x, y: y, z: z, gold: nearPeak < 0.34 && z > 0.2 });
  }

  var RING = [];
  for (var a = 0; a <= 96; a++) {
    var th = (a / 96) * Math.PI * 2;
    RING.push({ x: 1.22 * Math.cos(th), y: 1.22 * Math.sin(th), z: -0.04 });
  }

  var width = 0;
  var height = 0;

  function fit() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(p, sinYaw, cosYaw, scale) {
    var gx = p.x * cosYaw - p.y * sinYaw;
    var gy = p.x * sinYaw + p.y * cosYaw;
    var up = p.z * Math.cos(TILT) + gy * Math.sin(TILT);
    var depth = gy * Math.cos(TILT) - p.z * Math.sin(TILT);
    var f = CAM / (CAM + depth);
    return {
      sx: width / 2 + gx * scale * f,
      sy: height / 2 - up * scale * f + height * 0.03,
      f: f,
    };
  }

  function draw(yaw) {
    var sinYaw = Math.sin(yaw);
    var cosYaw = Math.cos(yaw);
    var scale = Math.min(width, height) * 0.46;

    ctx.clearRect(0, 0, width, height);

    /* Hairline ground ring, echoing the seal. */
    ctx.beginPath();
    for (var r = 0; r < RING.length; r++) {
      var q = project(RING[r], sinYaw, cosYaw, scale);
      if (r === 0) ctx.moveTo(q.sx, q.sy);
      else ctx.lineTo(q.sx, q.sy);
    }
    ctx.strokeStyle = "rgba(" + GOLD + ", 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    /* Far points first so near ones read on top. */
    var drawn = points
      .map(function (p) {
        return { p: p, s: project(p, sinYaw, cosYaw, scale) };
      })
      .sort(function (a, b) {
        return a.s.f - b.s.f;
      });

    for (var i = 0; i < drawn.length; i++) {
      var p = drawn[i].p;
      var s = drawn[i].s;
      var near = Math.min(Math.max((s.f - 0.82) / 0.36, 0), 1);
      var radius = (p.gold ? 1.5 : 1.0) + near * 1.3;
      var alpha = p.gold ? 0.55 + near * 0.4 : 0.14 + near * 0.5;
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + (p.gold ? GOLD : INK) + ", " + alpha + ")";
      ctx.fill();
    }
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var yaw = -0.6;
  var last = null;
  var running = false;

  function frame(now) {
    if (last !== null) yaw += ((now - last) / 1000) * SPEED;
    last = now;
    draw(yaw);
    if (running) requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion.matches) return;
    running = true;
    last = null;
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
  }

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(function () {
      fit();
      draw(yaw);
    }).observe(canvas);
  } else {
    window.addEventListener("resize", function () {
      fit();
      draw(yaw);
    });
  }

  var onMotionPref = function () {
    if (reduceMotion.matches) {
      stop();
      draw(yaw);
    } else {
      start();
    }
  };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", onMotionPref);

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(function () {
      readThemeColors();
      draw(yaw);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  readThemeColors();
  fit();
  draw(yaw);
  start();
})();
