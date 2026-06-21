# Signoff backend (optional)

Thin Node.js service that runs real KLayout sky130 DRC/LVS decks against exported GDS.

## Prerequisites

- [KLayout](https://www.klayout.de/) installed and on PATH, or set `KLAYOUT_BIN`
- sky130 DRC/LVS deck files (from [efabless/mpw_precheck](https://github.com/efabless/mpw_precheck))

## Run

```bash
export KLAYOUT_BIN=/path/to/klayout
export SKY130_DRC_DECK=/path/to/sky130A_mr.drc
export SKY130_LVS_DECK=/path/to/lvs_sky130.lylvs
node index.mjs
```

## API

`POST /signoff`

```json
{
  "mode": "drc",
  "gdsBase64": "<base64-encoded gds file>"
}
```

For LVS, include `"netlist": "<spice source>"`.

`GET /health` — service status.

## Frontend integration

The webapp currently runs DRC/LVS client-side. To call this backend after export, POST the GDS bytes to `/signoff` and display the report in a modal. This is optional and not required for teaching use.
