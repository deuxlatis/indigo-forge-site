# Optimization Risk Surface
# Indigo Forge

An interactive 4D view of a cTrader optimization. Drop in a `.optres` file and the
409 (or however many) passes become a rotatable point cloud: three metrics on the
axes, a fourth on a colour ramp, k-means clusters drawn as hulls over the top.
A high-performance algorithmic trading system and quantitative cBot for cTrader, featuring empirical risk surface analysis, copy trading integration, and a sign-in-gated investor ledger.

Everything runs in the browser. There is no server, no upload, no account — your
optimization files are parsed locally and stay on your machine.
- **Live Site:** [https://indigo.gzarruk.com](https://indigo.gzarruk.com)
- **4D Optimization Explorer:** [https://indigo.gzarruk.com/explorer/](https://indigo.gzarruk.com/explorer/)
- **Investor Portal:** [https://indigo.gzarruk.com/investors/](https://indigo.gzarruk.com/investors/)
- **GitHub Repository:** [https://github.com/gzarruk/indigo-forge](https://github.com/gzarruk/indigo-forge)

**Live:** https://USERNAME.github.io/optres-explorer/

---

## What it does
## Site Architecture

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
The project is structured into three integrated components:

## Reading the picture
1. **Public Landing Page (`/index.html`)**: Strategy overview, algorithmic architecture, and a balanced presentation of performance and risk (highlighting max equity drawdown and stop-out failure rates alongside compounded returns), plus cTrader copy-trading onboarding.
2. **4D Optimization Risk Explorer (`/explorer/`)**: A client-side 4D visualization tool for cTrader `.optres` exports. Visualizes multi-pass parameter sweeps in interactive 3D with a fourth metric mapped to a color ramp, level-of-detail convex cluster hulls, and in-browser IndexedDB storage.
3. **Sign-In-Gated Investor Portal (`/investors/`)**: A private participation dashboard backed by **Supabase** (PostgreSQL with Row-Level Security and Supabase Auth). Guarantees that private participation records and investor identities are never exposed in static bundles or accessible without database-level authorization.

Three of cTrader's headline metrics are close to the same number wearing different
hats. On the bundled sample run, log final equity, log max drawdown $ and max
drawdown % correlate 0.98–1.00 with each other, and a PCA of the three puts 98.6%
of the variance on one component. Profit factor is the only channel carrying
independent information. That is why the cloud renders as a thin ribbon rather
than a blob — it genuinely is close to two-dimensional.
```
IndigoForge/
├── CNAME                    # Custom domain (indigo.gzarruk.com)
├── index.html               # Public Landing Page (strategy & risk/return)
├── explorer/
│   └── index.html           # 4D Optimization Risk Surface Explorer
├── investors/
│   └── index.html           # Supabase RLS-Gated Investor Dashboard
├── assets/
│   ├── app.css              # Shared dark-mode design system & typography
│   ├── app.js               # 4D Plotly risk surface engine & controls
│   ├── landing.js           # Interactive landing page metric comparison logic
│   ├── investors.js         # Supabase Auth client & private record queries
│   ├── optres.js            # .optres binary/text parser & hygiene filter
│   └── store.js             # Client-side IndexedDB report persistence
├── data/
│   ├── manifest.json        # Bundled reports manifest
│   └── sample-run.json      # Indigo Forge baseline multi-year optimization run
├── supabase/
│   ├── schema.sql           # PostgreSQL tables & Row-Level Security (RLS) policies
│   └── README.md            # Supabase configuration & setup guide
└── build/
    └── build.py             # Single-file self-contained artifact builder
```

Two consequences worth knowing before you read too much into a number:
---

- **Max drawdown % and max drawdown $ are separate maxima.** On a curve that
  compounds hard they will not describe the same moment. The percentage figure is
  dominated by the earliest, smallest-account period; the dollar figure by the
  largest. Neither describes typical risk.
- **Recovery factor** (net profit ÷ max drawdown $) is the one scale-free metric
  in the set, which makes it useful for sorting — but it rewards timidity if you
  maximize it alone, and it is blind to how deep the drawdown actually went.
## Running Locally

## Running it locally
The site runs on any standard static file server:

It's static; any file server works.

```bash
git clone https://github.com/USERNAME/optres-explorer.git
cd optres-explorer
git clone https://github.com/gzarruk/indigo-forge.git
cd indigo-forge
python3 -m http.server 8000
# open http://localhost:8000
# Open http://localhost:8000
```

Opening `index.html` straight off disk mostly works, but the bundled sample is
fetched over HTTP and some browsers block that from `file://`. Either use a server
or drop your own `.optres` onto the page.
---

## Publishing to GitHub Pages
## The 4D Optimization Explorer

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**, source **Deploy from a branch**,
   branch `main`, folder `/ (root)`.
3. Wait a minute, then open `https://USERNAME.github.io/optres-explorer/`.
4. Update the `Live:` link above and `#repo-link` in `index.html`.
The explorer is designed to interpret cTrader `.optres` optimization runs:

GitHub Pages requires a public repository on free accounts.
- **Reads `.optres` Directly:** Parses local files in the browser without uploading any data.
- **Any Metric on Any Channel:** Assign X, Y, Z axes and color ramp to max equity drawdown %, max equity drawdown $, profit factor, final equity, trades, win rate, average trade, or recovery factor.
- **4D k-means Clustering:** Groups passes in 4D space across all active channels with automatic level of detail (cluster hulls when zoomed out, individual passes when zoomed in).
- **Data Hygiene:** Automatically identifies and filters stopped-out accounts (equity drawdown ≥ 100%) and duplicate parameter passes.

## Adding your own bundled report
### Reading the Picture

Reports you drop on the page live in your browser only. To ship one with the site
so every visitor sees it:
On compounding strategy curves:
- **Drawdown % and Drawdown $ describe different moments:** Drawdown % is dominated by early small-account volatility; Drawdown $ reflects late large-account swings.
- **Equity Drawdown Includes Floating Loss:** Intra-trade mark-to-market dips are captured, reflecting true tail risk that closed-trade balance curves hide.
- **Recovery Factor (Net Profit ÷ Max Drawdown $):** Useful as a scale-free sorting metric inside a pre-allocated drawdown budget.

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
---

Anything published this way is public. The bundled sample here is a real run with
its identity stripped — the numbers are genuine, the bot name, symbol and
timeframe are not included.
## Investor Portal & Supabase Setup

## Layout
The investor portal enforces zero client-side data leaks:
- The static frontend contains **no private records or hardcoded investor data**.
- All data access is mediated through Supabase PostgreSQL Row-Level Security (RLS).
- See [`supabase/README.md`](supabase/README.md) and [`supabase/schema.sql`](supabase/schema.sql) for database deployment instructions.

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
---

Plotly is loaded from cdnjs at runtime (with a jsDelivr fallback); nothing else is
vendored and there is no build step for the site itself.
## Single-File Build

## Notes and limits
To generate a standalone, self-contained single-file HTML version of the 4D explorer:

- `.optres` files do not store per-pass parameter values, so passes are identified
  by ID. You cannot recover which parameter combination produced a given point.
- Equity drawdown includes floating loss on open positions, which is why it can be
  far worse than balance drawdown for a strategy that holds losers.
- Cluster hulls are mesh surfaces and WebGL hit-testing ignores their opacity, so
  they block hovering on points behind them. They are omitted in Points mode and
  there's a toggle for Cluster view.
- Tested on current Chrome, Firefox and Safari. Needs WebGL.
```bash
python3 build/build.py
# Generates dist/artifact.html
```

## Licence
---

## License

MIT — see [LICENSE](LICENSE).
