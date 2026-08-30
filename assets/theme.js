/* Indigo Forge — theme switcher for the Classical content pages.
   Dark is the default; a visitor's explicit choice is kept in localStorage.
   Loaded WITHOUT defer in <head> so the stored choice lands on <html>
   before first paint — no flash of the wrong theme. */

(function () {
  "use strict";

  var KEY = "if-theme";
  var root = document.documentElement;

  var stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (e) {
    /* Storage can be blocked (private mode, strict settings); dark default stands. */
  }
  if (stored === "light") root.setAttribute("data-theme", "light");

  function toggle() {
    var toLight = root.getAttribute("data-theme") !== "light";
    if (toLight) root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem(KEY, toLight ? "light" : "dark");
    } catch (e) {}
  }

  function bind() {
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", toggle);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
