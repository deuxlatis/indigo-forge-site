/* Parses a cTrader .optres export into the compact shape the viewer uses.
 *
 * A .optres file is JSON. The parts we care about:
 *   backtestingSettings  starting capital, commission, spread, data source
 *   testingPeriod        start/end epoch millis
 *   criteria.standard    the optimization objectives
 *   parameters[]         every cBot parameter; only those with optimize:true were swept
 *   results.passes[]     one record per evaluated parameter set
 *
 * Two kinds of row get flagged rather than dropped, so the viewer can offer them
 * as toggles:
 *   so   the pass stopped out — equity drawdown reached 100% and the account died
 *   dup  the pass reproduces an earlier pass's exact metrics, which a genetic
 *        search does whenever it re-evaluates a parameter set it has already seen
 */
(function (global) {
  "use strict";

  function iso(ms) {
    if (!ms && ms !== 0) return null;
    var d = new Date(ms);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }

  function money(v) {
    return typeof v === "number" ? v : null;
  }

  function describeData(s) {
    var d = (s && s.data) || {};
    var map = {
      M1BarsFromServer: "M1 bars from server",
      TickDataFromServer: "tick data from server",
      M1BarsFromCustom: "M1 bars from file",
      TickDataFromCustom: "tick data from file"
    };
    return map[d.type] || d.type || "unknown data source";
  }

  function describeSpread(s) {
    var sp = (s && s.spread) || {};
    if (sp.type === "Fixed") return "fixed spread, " + (sp.value / 10) + " pips";
    if (sp.type) return String(sp.type).toLowerCase() + " spread";
    return null;
  }

  function describeCommission(s) {
    var c = (s && s.commissions) || {};
    if (c.type === "UsdPerMillionUsdVolume") return "$" + c.value + " per $1M volume";
    if (c.value != null) return c.value + " (" + (c.type || "commission") + ")";
    return null;
  }

  function parse(raw, fileName) {
    var doc = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!doc || !doc.results || !Array.isArray(doc.results.passes)) {
      throw new Error("This does not look like a cTrader .optres file — no results.passes array.");
    }

    var settings = doc.backtestingSettings || {};
    var period = doc.testingPeriod || {};

    var sorted = doc.results.passes.slice().sort(function (a, b) {
      return (a.passId || 0) - (b.passId || 0);
    });

    var seen = Object.create(null);
    var passes = sorted.map(function (x) {
      var trades = x.trades || 0;
      var sig = [
        Math.round((x.equity || 0) * 1e6) / 1e6,
        trades,
        x.profitFactor,
        Math.round((x.maxEquityDrawdownAbsolute || 0) * 1e6) / 1e6
      ].join("|");
      var isDup = Object.prototype.hasOwnProperty.call(seen, sig);
      if (!isDup) seen[sig] = x.passId;

      return {
        id: x.passId,
        ddp: +((x.maxEquityDrawdownPercent || 0) * 100).toFixed(4),
        ddu: +(x.maxEquityDrawdownAbsolute || 0).toFixed(2),
        pf: +(x.profitFactor || 0).toFixed(3),
        eq: +(x.equity || 0).toFixed(2),
        npf: +(x.netProfit || 0).toFixed(2),
        tr: trades,
        wr: trades ? +((100 * (x.winningTrades || 0)) / trades).toFixed(2) : 0,
        at: +(x.averageTrade || 0).toFixed(2),
        so: x.status === "StoppedWithStopOut" ? 1 : 0,
        dup: isDup ? 1 : 0,
        dupof: isDup ? seen[sig] : 0
      };
    });

    var ids = passes.map(function (p) { return p.id; });
    var lo = Math.min.apply(null, ids), hi = Math.max.apply(null, ids);
    var contiguous = ids.length === hi - lo + 1 &&
      ids.every(function (v, i) { return i === 0 || v === ids[i - 1] + 1; });

    var swept = (doc.parameters || []).filter(function (p) { return p.optimize; })
      .map(function (p) {
        var md = p.metadata || {};
        return {
          name: md.friendlyName || p.name,
          group: md.groupName || null,
          min: p.min, max: p.max, step: p.step,
          values: p.values || null
        };
      });

    var meta = {
      name: (fileName || "Optimization run").replace(/\.optres$/i, ""),
      method: doc.optimizationMethod || null,
      cores: doc.cpuCores || null,
      elapsed: doc.results.elapsedTime ? +doc.results.elapsedTime.toFixed(1) : null,
      capital: money(settings.startingCapital),
      commission: describeCommission(settings),
      spread: describeSpread(settings),
      bars: describeData(settings),
      start: iso(period.startDate),
      end: iso(period.endDate),
      criteria: ((doc.criteria || {}).standard || []).map(function (c) {
        return c.criterion + " (" + c.extremum + ")";
      }),
      params: swept,
      total: passes.length,
      stopouts: passes.reduce(function (a, p) { return a + p.so; }, 0),
      dups: passes.reduce(function (a, p) { return a + p.dup; }, 0),
      idmin: lo,
      idmax: hi,
      contiguous: contiguous
    };

    return { meta: meta, passes: passes };
  }

  global.OptRes = { parse: parse };
})(window);
