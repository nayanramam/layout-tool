# Analog Layout Teaching Tool

Browser-based sky130 analog IC layout editor for teaching undergraduates layout fundamentals.

## Features

- **Layout editor** — pan/zoom canvas, layer palette, draw rectangles, place NMOS/PMOS PCells, contacts, and wires
- **Live DRC** — essential sky130 rules (width, spacing, n-well enclosure, implant coverage) update as you edit
- **LVS-lite panel** — compare layout against an uploaded SPICE/CDL netlist; filter by components, connections, or nets
- **Ratsnest guidance** — KiCad-style highlighting of same-net terminals while wiring
- **Teaching hints** — soft warnings for long poly traces, narrow W, long L, and missing n-well
- **GDSII export** — download layout for Cadence Virtuoso stream-in
- **GDSII import** — bring existing shapes into the editor

## Quick start

```bash
npm install
npm run dev
```

Open the local URL, click **Load example netlist**, place NMOS/PMOS devices, route with the Wire tool, and watch live DRC update.

## Cadence Virtuoso import

1. In the app, click **Export GDS**.
2. In Virtuoso: **File → Import → Stream**.
3. Map layers using sky130 conventions (64/20 nwell, 65/20 diff, 66/20 poly, 67/20 li, 68/20 m1).
4. Set DBU to 1000 if prompted (1 user unit = 1 nm).

## Netlist format

Upload SPICE/CDL subckt netlists with sky130 device models, e.g.:

```spice
.subckt inv VDD VSS IN OUT
XM1 OUT IN VDD VDD sky130_fd_pr__pfet_01v8 w=2 l=0.15
XM2 OUT IN VSS VSS sky130_fd_pr__nfet_01v8 w=1 l=0.15
.ends
```

## Optional signoff backend

For foundry-deck parity, a thin backend can shell out to KLayout:

```bash
cd server
npm install
npm start
```

See [server/README.md](server/README.md) for integration notes. The webapp works fully without it.

## Project structure

```
src/
  pdk/sky130/       Layer definitions and rule deck
  engine/
    drc/            Live + full DRC checks
    lvs/            LVS-lite comparison
    ratsnest/       Connection guidance
    hints/          Educational soft lints
    netlist/        SPICE parser
    gds/            GDSII import/export
    pcells/         MOS device generators
  editor/           React UI components
  store/            Zustand layout state
```

## Host on GitHub Pages (free)

Yes — **public repos on GitHub are free**, and **GitHub Pages** hosts static sites like this at no cost.

This repo includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds and deploys automatically on every push to `main`.

**One-time setup after pushing:**

1. On GitHub, open your repo → **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` (or re-run the workflow). Your app will be live at:

   `https://<your-github-username>.github.io/<repo-name>/`

Example: if your username is `nayan` and the repo is `layout-tool`, the URL is `https://nayan.github.io/layout-tool/`

Share that link with your club — no install required.

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: sky130 layout teaching tool"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/layout-tool.git
git push -u origin main
```

Create the empty repo on [github.com/new](https://github.com/new) first (name it `layout-tool`, public, no README).

## Keyboard / mouse

| Action | Control |
|--------|---------|
| Pan | Shift + drag or middle mouse |
| Zoom | Scroll wheel |
| Finish wire | Enter or double-click |
| Delete selection | Delete / Backspace |
| Cancel draft | Escape |

## License

Educational use. sky130 rule values derived from open PDK documentation and KLayout DRC decks (GPLv3).
