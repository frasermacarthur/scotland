# Scotland Gas Demand Scenario Explorer

Interactive scenario tool modelling how demand on the Scotland gas distribution network evolves from 2025 to 2050 as decarbonisation technologies deploy. Built around a ~45 TWh/yr baseline with six adjustable levers and preset pathways calibrated to the NESO Future Energy Scenarios 2025 narratives (Holistic Transition, Electric Engagement, Hydrogen Evolution, Falling Behind).

## Features

- **Animated timeline** — play/pause/scrub from 2025 to 2050 at 0.5×/1×/2× speed; KPIs and charts follow the playhead live
- **Six levers across four horizons** — heat pumps, heat networks and energy efficiency erode throughput; biomethane, hydrogen blending and hydrogen for I&C green the residual molecule. Deployment is set as a percentage of each lever's technical potential at today/2030/2040/2050 and interpolated annually between anchors
- **Three views** — stacked trajectory (2025–50), build-up columns rising toward each lever's potential ceiling, and a treemap "mix map" of the constant 45 TWh canvas with a live legend
- **Derived outputs** — residual throughput, unabated natural gas, green gas share, and cumulative heat pump installations with implied annual run-rate (1 TWh displaced ≈ 74,000 home conversions at 13,500 kWh/yr per average Scottish gas-heated home)
- **Documented assumptions** — an expandable model-basis panel covers the baseline scope, lever potentials and their overlaps, the supply allocation hierarchy (H₂ for I&C served first as enduring industrial conversion, then biomethane, then transitional blending), scenario calibration, mechanics, and deliberate limitations

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically http://localhost:5173).

Production build:

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages — easiest path (no build needed)

This repo includes a pre-built copy of the app in `docs/`. To deploy:

1. Push the repo to GitHub
2. Go to **Settings → Pages**, set **Source** to **Deploy from a branch**, choose **main** and the **/docs** folder, save
3. The site appears at `https://<username>.github.io/<repo-name>/` within a minute or two

Important: GitHub Pages serves static files only — it cannot build the app. Pointing Pages at the repo root serves the raw source `index.html`, whose `/src/main.jsx` module cannot run in a browser, giving a blank page with no 404s. Always point Pages at `docs/` (or use the Actions workflow below). If you change `src/App.jsx`, refresh the built copy with `npm run build && rm -rf docs && cp -r dist docs` and commit.

## Deploy via GitHub Actions (auto-build on push)

A workflow is included at `.github/workflows/deploy.yml`. After pushing to GitHub:

1. In the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**
2. Push to `main` (or run the workflow manually from the Actions tab)
3. The site publishes to `https://<username>.github.io/<repo-name>/`

The Vite config uses `base: "./"` (relative paths), so the build also works on Netlify, Vercel, or served from any subfolder. Note: opening `dist/index.html` directly from the file system will not work in most browsers — module scripts require a server; use `npm run preview` to test a build locally.

## Stack

React 18 + Vite + Recharts. Single component in `src/App.jsx`; no backend, no state persistence — all scenario state lives in memory.

## Caveats

This is an illustrative strategic planning tool, not an engineering model. Scenario shapes are calibrated to published FES 2025 pathway narratives, not extracts from NESO regional workbooks. The model is annual-energy only (no 1-in-20 peak dimension), treats demand-side levers as additive below the baseline cap, and applies no feasibility constraint to implied installation run-rates. See the in-app "Model basis" panel for the full assumptions narrative.
