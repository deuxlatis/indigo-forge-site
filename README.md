# Indigo Forge

A high-performance algorithmic trading system and quantitative cBot for cTrader, featuring empirical risk surface analysis, copy trading integration, and a sign-in-gated investor ledger.

- **Live Site:** [https://indigo.gzarruk.com](https://indigo.gzarruk.com)
- **4D Optimization Explorer:** [https://indigo.gzarruk.com/explorer/](https://indigo.gzarruk.com/explorer/)
- **Investor Portal:** [https://indigo.gzarruk.com/investors/](https://indigo.gzarruk.com/investors/)
- **GitHub Repository:** [https://github.com/gzarruk/indigo-forge](https://github.com/gzarruk/indigo-forge)

---

## Site Architecture

The project is structured into three integrated components:

1. **Public Landing Page (`/index.html`)**: Strategy overview, algorithmic architecture, and a balanced presentation of performance and risk (highlighting max equity drawdown and stop-out failure rates alongside compounded returns), plus cTrader copy-trading onboarding.
2. **4D Optimization Risk Explorer (`/explorer/`)**: A client-side 4D visualization tool for cTrader `.optres` exports. Visualizes multi-pass parameter sweeps in interactive 3D with a fourth metric mapped to a color ramp, level-of-detail convex cluster hulls, and in-browser IndexedDB storage.
3. **Sign-In-Gated Investor Portal (`/investors/`)**: A private participation dashboard backed by **Supabase** (PostgreSQL with Row-Level Security and Supabase Auth). Guarantees that private participation records and investor identities are never exposed in static bundles or accessible without database-level authorization.

```
IndigoForge/
├── CNAME                    # Custom domain (indigo.gzarruk.com)
├── Makefile                 # Development, build, and test automation
├── index.html               # Public Landing Page (strategy & risk/return)
├── explorer/
│   └── index.html           # 4D Optimization Risk Surface Explorer
├── investors/
│   └── index.html           # Supabase RLS-Gated Investor Dashboard
├── assets/
│   ├── app.css              # Shared dark-mode design system & typography
│   ├── app.js               # 4D Plotly risk surface engine & controls
│   ├── investors.js         # Supabase Auth client & private record queries
│   ├── optres.js            # .optres binary/text parser & hygiene filter
│   └── store.js             # Client-side IndexedDB report persistence
├── data/
│   ├── manifest.json        # Bundled reports manifest
│   └── sample-run.json      # Indigo Forge baseline multi-year optimization run
├── scripts/
│   └── dev.py               # Local development server with no-cache headers
├── supabase/
│   ├── schema.sql           # PostgreSQL tables & Row-Level Security (RLS) policies
│   └── README.md            # Supabase configuration & setup guide
└── build/
    └── build.py             # Single-file self-contained artifact builder
```

---

## Local Development

Start the development server using `make dev`:

```bash
make dev
# Launches local server at http://localhost:8000 with no-cache headers
```

### Makefile Commands

- `make dev` — Start the local development server (automatically disables browser caching for instant CSS/JS updates).
- `make build` — Package the 4D explorer into a standalone single-file distribution at `dist/artifact.html`.
- `make check` (or `make test`) — Validate JSON syntax and JavaScript files.
- `make clean` — Remove generated build artifacts (`dist/`).
- `make help` — List all available commands.

---

## The 4D Optimization Explorer

The explorer is designed to interpret cTrader `.optres` optimization runs:

- **Reads `.optres` Directly:** Parses local files in the browser without uploading any data.
- **Any Metric on Any Channel:** Assign X, Y, Z axes and color ramp to max equity drawdown %, max equity drawdown $, profit factor, final equity, trades, win rate, average trade, or recovery factor.
- **4D k-means Clustering:** Groups passes in 4D space across all active channels with automatic level of detail (cluster hulls when zoomed out, individual passes when zoomed in).
- **Data Hygiene:** Automatically identifies and filters stopped-out accounts (equity drawdown ≥ 100%) and duplicate parameter passes.

### Reading the Picture

On compounding strategy curves:
- **Drawdown % and Drawdown $ describe different moments:** Drawdown % is dominated by early small-account volatility; Drawdown $ reflects late large-account swings.
- **Equity Drawdown Includes Floating Loss:** Intra-trade mark-to-market dips are captured, reflecting true tail risk that closed-trade balance curves hide.
- **Recovery Factor (Net Profit ÷ Max Drawdown $):** Useful as a scale-free sorting metric inside a pre-allocated drawdown budget.

---

## Investor Portal & Supabase Setup

The investor portal enforces zero client-side data leaks:
- The static frontend contains **no private records or hardcoded investor data**.
- All data access is mediated through Supabase PostgreSQL Row-Level Security (RLS).
- See [`supabase/README.md`](supabase/README.md) and [`supabase/schema.sql`](supabase/schema.sql) for database deployment instructions.


MIT — see [LICENSE](LICENSE).
