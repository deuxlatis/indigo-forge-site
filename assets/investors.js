(function () {
  "use strict";

  // =========================================================================
  // Supabase Configuration
  // To connect your backend:
  // 1. Create a Supabase project (supabase.com) and run supabase/schema.sql
  // 2. Insert your Project URL & Public Anon Key below
  // =========================================================================
  var SUPABASE_CONFIG = {
    url: "https://xyzcompany.supabase.co", // Replace with your Supabase Project URL
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key" // Replace with your Supabase anon key
  };

  var isConfigured = SUPABASE_CONFIG.url && SUPABASE_CONFIG.url.indexOf("xyzcompany") < 0;
  var supabase = null;

  if (window.supabase && isConfigured) {
    try {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
      console.warn("Supabase init error:", e);
    }
  }

  // DOM Elements
  var unconfiguredBanner = document.getElementById("unconfigured-banner");
  var authView = document.getElementById("auth-view");
  var dashboardView = document.getElementById("dashboard-view");
  var loginForm = document.getElementById("login-form");
  var loginEmail = document.getElementById("login-email");
  var loginPassword = document.getElementById("login-password");
  var passwordGroup = document.getElementById("password-group");
  var btnSubmitAuth = document.getElementById("btn-submit-auth");
  var btnToggleMagic = document.getElementById("btn-toggle-magic");
  var modeText = document.getElementById("mode-text");
  var authStatus = document.getElementById("auth-status");
  var btnSignout = document.getElementById("btn-signout");

  // Dashboard DOM Elements
  var welcomeName = document.getElementById("welcome-name");
  var userEmailLabel = document.getElementById("user-email-label");
  var valEquity = document.getElementById("val-equity");
  var valShare = document.getElementById("val-share");
  var valUnits = document.getElementById("val-units");
  var valPoolUnits = document.getElementById("val-pool-units");
  var valInvested = document.getElementById("val-invested");
  var valRoi = document.getElementById("val-roi");
  var valPnl = document.getElementById("val-pnl");
  var valTotalNav = document.getElementById("val-total-nav");
  var valUnitPrice = document.getElementById("val-unit-price");
  var valHwm = document.getElementById("val-hwm");
  var snapshotRows = document.getElementById("snapshot-rows");
  var adminRosterSection = document.getElementById("admin-roster-section");
  var adminInvestorRows = document.getElementById("admin-investor-rows");

  var isMagicLinkMode = false;

  function fmtUsd(v) {
    return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtNum(v) {
    return Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  function fmtPct(v) {
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  }

  function showStatus(msg, isError) {
    authStatus.textContent = msg;
    authStatus.className = "toast" + (isError ? " bad" : "");
    authStatus.hidden = false;
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(function () { authStatus.hidden = true; }, isError ? 6000 : 4000);
  }

  // Toggle Magic Link vs Password login
  if (btnToggleMagic) {
    btnToggleMagic.addEventListener("click", function () {
      isMagicLinkMode = !isMagicLinkMode;
      if (isMagicLinkMode) {
        passwordGroup.style.display = "none";
        loginPassword.required = false;
        btnSubmitAuth.querySelector("span").textContent = "Send Magic Link";
        modeText.textContent = "Prefer password sign-in? ";
        btnToggleMagic.textContent = "Sign in with Password";
      } else {
        passwordGroup.style.display = "block";
        loginPassword.required = true;
        btnSubmitAuth.querySelector("span").textContent = "Sign In";
        modeText.textContent = "Prefer passwordless login? ";
        btnToggleMagic.textContent = "Send Magic Link";
      }
    });
  }

  // Sign In Handler
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = loginEmail.value.trim();

      if (!supabase) {
        showStatus("Supabase credentials not configured yet. See supabase/README.md for setup.", true);
        return;
      }

      btnSubmitAuth.disabled = true;
      btnSubmitAuth.querySelector("span").textContent = "Authenticating...";

      if (isMagicLinkMode) {
        supabase.auth.signInWithOtp({
          email: email,
          options: { emailRedirectTo: window.location.href }
        }).then(function (res) {
          btnSubmitAuth.disabled = false;
          btnSubmitAuth.querySelector("span").textContent = "Send Magic Link";
          if (res.error) {
            showStatus(res.error.message, true);
          } else {
            showStatus("Magic link sent! Check your inbox to sign in.", false);
          }
        });
      } else {
        var password = loginPassword.value;
        supabase.auth.signInWithPassword({
          email: email,
          password: password
        }).then(function (res) {
          btnSubmitAuth.disabled = false;
          btnSubmitAuth.querySelector("span").textContent = "Sign In";
          if (res.error) {
            showStatus(res.error.message, true);
          } else {
            loadDashboard(res.data.session);
          }
        });
      }
    });
  }

  // Sign Out Handler
  if (btnSignout) {
    btnSignout.addEventListener("click", function () {
      if (supabase) {
        supabase.auth.signOut().then(function () {
          resetView();
        });
      } else {
        resetView();
      }
    });
  }

  function resetView() {
    authView.style.display = "block";
    dashboardView.style.display = "none";
    loginForm.reset();
  }

  function loadDashboard(session) {
    if (!session || !session.user) return;
    var user = session.user;

    authView.style.display = "none";
    dashboardView.style.display = "block";
    userEmailLabel.textContent = user.email;

    // 1. Fetch user role
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(function (roleRes) {
        var role = (roleRes.data && roleRes.data.role) || "investor";
        if (role === "admin") {
          adminRosterSection.style.display = "block";
          loadAdminRoster();
        } else {
          adminRosterSection.style.display = "none";
        }
      });

    // 2. Fetch investor profile
    supabase
      .from("investors")
      .select("id, full_name, email")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(function (invRes) {
        var investor = invRes.data;
        if (investor && investor.full_name) {
          welcomeName.textContent = "Welcome, " + investor.full_name;
        }

        // 3. Fetch pool master
        return supabase.from("pools").select("*").limit(1).maybeSingle();
      })
      .then(function (poolRes) {
        var pool = poolRes ? poolRes.data : null;
        if (!pool) return;

        valTotalNav.textContent = fmtUsd(pool.total_nav || (pool.total_units * pool.unit_price));
        valUnitPrice.textContent = fmtUsd(pool.unit_price);
        valHwm.textContent = fmtUsd(pool.high_water_mark);
        valPoolUnits.textContent = fmtNum(pool.total_units);

        // 4. Fetch investor allocation (Row-Level Security guarantees only own record is returned)
        return supabase
          .from("investor_allocations")
          .select("*")
          .eq("pool_id", pool.id)
          .maybeSingle()
          .then(function (allocRes) {
            var alloc = allocRes ? allocRes.data : null;
            if (alloc) {
              var units = Number(alloc.units_held) || 0;
              var invested = Number(alloc.invested_capital) || 0;
              var unitPrice = Number(pool.unit_price) || 1.0;
              var totalUnits = Number(pool.total_units) || 1.0;
              var curVal = units * unitPrice;
              var pnl = curVal - invested;
              var roi = invested > 0 ? (pnl / invested) * 100 : 0;
              var sharePct = totalUnits > 0 ? (units / totalUnits) * 100 : 0;

              valUnits.textContent = fmtNum(units);
              valEquity.textContent = fmtUsd(curVal);
              valShare.textContent = sharePct.toFixed(2) + "%";
              valInvested.textContent = fmtUsd(invested);
              valRoi.textContent = fmtPct(roi);
              valRoi.className = "card-val " + (roi >= 0 ? "pos" : "neg");
              valPnl.textContent = fmtUsd(pnl);

              // 5. Fetch snapshots
              loadSnapshots(pool.id, units);
            } else {
              valUnits.textContent = "0";
              valEquity.textContent = "$0.00";
              valShare.textContent = "0.00%";
              valInvested.textContent = "$0.00";
              valRoi.textContent = "0.00%";
              valPnl.textContent = "$0.00";
            }
          });
      })
      .catch(function (err) {
        console.error("Dashboard load error:", err);
      });
  }

  function loadSnapshots(poolId, userUnits) {
    supabase
      .from("pool_snapshots")
      .select("*")
      .eq("pool_id", poolId)
      .order("snapshot_date", { ascending: false })
      .limit(12)
      .then(function (res) {
        if (!res.data || !res.data.length) return;
        snapshotRows.innerHTML = "";
        res.data.forEach(function (row) {
          var userPos = userUnits * Number(row.nav_per_unit);
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td><b>" + row.snapshot_date + "</b></td>" +
            "<td class='num'>" + fmtUsd(row.total_equity) + "</td>" +
            "<td class='num'>" + fmtUsd(row.nav_per_unit) + "</td>" +
            "<td class='num' style='color:" + (row.max_drawdown_pct > 20 ? "var(--critical)" : "inherit") + "'>" + row.max_drawdown_pct.toFixed(2) + "%</td>" +
            "<td class='num'><b>" + fmtUsd(userPos) + "</b></td>";
          snapshotRows.appendChild(tr);
        });
      });
  }

  function loadAdminRoster() {
    supabase
      .from("investor_allocations")
      .select("units_held, invested_capital, investors(full_name, email), pools(unit_price, total_units)")
      .then(function (res) {
        if (!res.data || !res.data.length) return;
        adminInvestorRows.innerHTML = "";
        res.data.forEach(function (row) {
          var inv = row.investors || {};
          var pool = row.pools || {};
          var units = Number(row.units_held) || 0;
          var unitPrice = Number(pool.unit_price) || 1.0;
          var totalUnits = Number(pool.total_units) || 1.0;
          var share = totalUnits > 0 ? (units / totalUnits) * 100 : 0;
          var curVal = units * unitPrice;

          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td><b>" + (inv.full_name || "Unknown") + "</b></td>" +
            "<td>" + (inv.email || "—") + "</td>" +
            "<td class='num'>" + fmtNum(units) + "</td>" +
            "<td class='num'>" + share.toFixed(2) + "%</td>" +
            "<td class='num'>" + fmtUsd(row.invested_capital || 0) + "</td>" +
            "<td class='num'><b>" + fmtUsd(curVal) + "</b></td>";
          adminInvestorRows.appendChild(tr);
        });
      });
  }

  // Initial Boot
  if (!isConfigured && unconfiguredBanner) {
    unconfiguredBanner.style.display = "block";
  }

  if (supabase) {
    supabase.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        loadDashboard(res.data.session);
      }
    });

    supabase.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" && session) {
        loadDashboard(session);
      } else if (event === "SIGNED_OUT") {
        resetView();
      }
    });
  }

})();
