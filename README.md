# Optimization Risk Surface

An interactive 4D view of a cTrader optimization. Drop in a `.optres` file and the
409 (or however many) passes become a rotatable point cloud: three metrics on the
axes, a fourth on a colour ramp, k-means clusters drawn as hulls over the top.

Everything runs in the browser. There is no server, no upload, no account — your
optimization files are parsed locally and stay on your machine.

**Live:** https://USERNAME.github.io/optres-explorer/

---

## What it does

- **Reads `.optres` directly.** No conversion step. Drop the file cTrader exported.
- **Any metric on any channel.** X, Y, Z and colour can each be set to max equity
  drawdown %, max equity drawdown $, profit factor, final equity, trades, win rate,
  average trade, or recovery factor. Log axes and tick formatting follow the choice.
- **Clusters in 4D.** k-means runs over whichever four metrics are mapped, each
  standardized, so the grouping reflects everything on screen rather than position alone.
- **Level of detail.** Zoomed out you see cluster hulls and centroids; zoom past
  halfway and every pass renders individually. Or force either mode.
- **Data hygiene, made explicit.** Passes that stopped out (equity drawdown ≥ 100%)
  and passes that reproduce an earlier pass's exact metrics are flagged and
  droppable, with the counts shown. Non-contiguous pass IDs are called out, since
  those can mean results from an earlier optimization were left in the file.
- **Multiple reports.** Add as many as you like; they persist in this browser and
  you switch between them from the sidebar.

## Reading the picture

Three of cTrader's headline metrics are close to the same number wearing different
hats. On the bundled sample run, log final equity, log max drawdown $ and max
drawdown % correlate 0.98–1.00 with each other, and a PCA of the three puts 98.6%
of the variance on one component. Profit factor is the only channel carrying
independent information. That is why the cloud renders as a thin ribbon rather
than a blob — it genuinely is close to two-dimensional.

Two consequences worth knowing before you read too much into a number:

- **Max drawdown % and max drawdown $ are separate maxima.** On a curve that
  compounds hard they will not describe the same moment. The percentage figure is
  dominated by the earliest, smallest-account period; the dollar figure by the
  largest. Neither describes typical risk.
- **Recovery factor** (net profit ÷ max drawdown $) is the one scale-free metric
  in the set, which makes it useful for sorting — but it rewards timidity if you
  maximize it alone, and it is blind to how deep the drawdown actually went.

## Running it locally

It's static; any file server works.

```bash
git clone https://github.com/USERNAME/optres-explorer.git
cd optres-explorer
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` straight off disk mostly works, but the bundled sample is
fetched over HTTP and some browsers block that from `file://`. Either use a server
or drop your own `.optres` onto the page.

## Publishing to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**, source **Deploy from a branch**,
   branch `main`, folder `/ (root)`.
3. Wait a minute, then open `https://USERNAME.github.io/optres-explorer/`.
4. Update the `Live:` link above and `#repo-link` in `index.html`.

GitHub Pages requires a public repository on free accounts.

## Adding your own bundled report

Reports you drop on the page live in your browser only. To ship one with the site
so every visitor sees it:

1. Convert it once — open the page, drop the file, and it is parsed to the compact
   schema; or run the parser in Node:
   ```bash
   node -e '
     global.window={}; require("./assets/optres.js");
     const fs=require("fs");
     const out=window.OptRes.parse(fs.readFileSync(process.argv[1],"utf8"), "my-run.optres");
     out.meta.name="My run";
     fs.writeFileSync("data/my-run.json", JSON.stringify(out));
   ' /path/to/run.optres
   ```
2. Add it to `data/manifest.json`:
   ```json
   [{ "file": "sample-run.json", "name": "Sample optimization run" },
    { "file": "my-run.json",     "name": "My run" }]
   ```

Anything published this way is public. The bundled sample here is a real run with
its identity stripped — the numbers are genuine, the bot name, symbol and
timeframe are not included.

## Layout

```
index.html            markup and the Plotly loader
assets/app.css        all styling; dark-only by design
assets/optres.js      .optres → { meta, passes }, including the hygiene flags
assets/store.js       IndexedDB report library
assets/app.js         the viewer — metrics, clustering, level of detail, plotting
data/manifest.json    which bundled reports to offer
data/*.json           bundled reports
build/build.py        folds it all into dist/artifact.html, a single-file build
```

Plotly is loaded from cdnjs at runtime (with a jsDelivr fallback); nothing else is
vendored and there is no build step for the site itself.

## Notes and limits

- `.optres` files do not store per-pass parameter values, so passes are identified
  by ID. You cannot recover which parameter combination produced a given point.
- Equity drawdown includes floating loss on open positions, which is why it can be
  far worse than balance drawdown for a strategy that holds losers.
- Cluster hulls are mesh surfaces and WebGL hit-testing ignores their opacity, so
  they block hovering on points behind them. They are omitted in Points mode and
  there's a toggle for Cluster view.
- Tested on current Chrome, Firefox and Safari. Needs WebGL.

## Licence

MIT — see [LICENSE](LICENSE).
