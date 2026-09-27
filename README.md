# Bangkok Canals — Flood Situation Map

An interactive map of Bangkok's canal (*khlong*) network, colored by compiled
flood-risk assessment, to help understand how the city floods and where.

![screenshot](screenshot.png)

## Run it

```bash
python3 -m http.server 8420
# open http://localhost:8420
```

(Any static file server works. Opening `index.html` directly also works;
only the basemap tiles need internet.)

## What it shows

- **1,454 named canals** (6,146 km) — Bangkok plus the canal network of the
  surrounding provinces (Nonthaburi, Pathum Thani, Samut Prakan, Samut Sakhon,
  Nakhon Pathom, Chachoengsao). Only canals connected to the Bangkok network are
  shown; far unlinked channels are dropped at build time. Khlong names that
  repeat across provinces (e.g. two different *Khlong Bang Toei*) are split into
  separate features at build time, so a river contact in one province can no
  longer claim a same-named canal elsewhere.
- **Bilingual UI — Thai by default** — the whole interface (intro, filters,
  stats, canal list, search, trace banner, detail panel, map tooltips) is in
  Thai; the ไทย / EN toggle in the sidebar header switches to English instantly
  (canal names, reviewed notes, structure notes, and labels included), and the
  choice persists in `localStorage`. Canal names carry both languages
  (`name` / `name_th`) and reviewed canals have notes in both (`note` /
  `note_th`), so nothing is lost in either language.
- **Flood-risk coloring** — red = high, orange = medium, green = low, with
  the risk driver tagged: *flash flood* (monsoon rain), *riverine* (Chao Phraya
  flood from the north), *tidal* (sea blocking outflows), or *mixed*
- **30+ reviewed corridors** drawn bold, with notes on documented flood history
  (2011 river flood, chronic monsoon flash-flood spots, tidal backflow)
- **Live water levels** — a snapshot of BMA Drainage & Sewerage Department
  telemetry (300+ stations on Bangkok's canals, retention ponds and river),
  mapped onto the canal network. Canals with a station show their current status
  (above critical / above warning / normal / station fault), the reading in
  m (MSD) against the warning and critical bank thresholds, and the individual
  stations; the sidebar shows citywide station counts plus **when the data is
  from** — both the latest station reading and when the snapshot was fetched —
  and every detail panel repeats the reading time of that canal's stations.
  Refresh with `node fetch_live.mjs` (see *Rebuilding the data*).
- **Drainage-path tracing to the sea** — click any canal and the map highlights
  it, dims everything else, and draws an animated path (white dashes plus
  direction arrows pointing downstream) through every connected canal until it
  reaches the Chao Phraya,
  then continues along the river all the way to the river mouth on the **Gulf
  of Thailand**, ending at a pulsing sea marker. The popup lists the full chain
  (canal → … → 🌊 Chao Phraya → 🌊 Gulf of Thailand) and the river distance to
  the sea; the "🌊 to the sea" button on the trace banner flies to the mouth.
  The canal trace is built from a canal-connectivity graph (shared endpoints +
  line crossings, ~20 m tolerance) computed at build time, and the route to the
  river is chosen by **least along-canal distance** (Dijkstra), so water is
  routed out through the geographically nearest real mouth rather than the
  fewest hops; the river walk links
  the Chao Phraya's OSM ways into an ordered downstream chain whose southernmost
  vertex is the mouth on the coastline. Clicking a canal (or a gate/pump marker)
  opens a **detail panel on the right** with the full chain (canal → … →
  🌊 Chao Phraya → 🌊 Gulf of Thailand) and the river distance to the sea; the
  "🌊 to the sea" button on the trace banner flies to the mouth. ~93% of canals
  reach the river in the mapped network, the rest are reported as isolated.
  `audit_connections.mjs` dumps every key corridor's links + displayed chain and
  `audit_trace.mjs` cross-checks all 1,450+ routes network-wide.
- **Gates & pumping stations** — key flood-control structures
- **Location lookup ("which canals connect here?")** — enter coordinates (lat,lng
  or a pasted Google Maps link), press 📍 and click the map, or use the browser's
  own location: a pin is dropped and every canal within 500 m is highlighted
  (the rest dimmed). The panel lists each nearby canal with its direct junctions
  — every junction is clickable and opens the full drainage trace — plus any
  gates / pumping stations within reach.
- Searchable canal list, risk-level filters, base-map switcher

## Data & disclaimers

- Canal geometry: © [OpenStreetMap](https://www.openstreetmap.org) contributors,
  fetched via Overpass API — Bangkok admin boundary (TH-10) plus a ring over the
  surrounding provinces; the build keeps only canals in a connected component
  that contains a Bangkok canal (key snapshot in `data/bangkok_keys.json`).
  Chao Phraya centerline fetched the same way as the drainage sink.
- Live water levels: © Bangkok Metropolitan Administration, Drainage and
  Sewerage Department telemetry — <https://weather.bangkok.go.th/water>.
  Stations attach to canals by name (`river_name` → the canal's Thai/English
  name), with a nearest-canal fallback within 200 m for stations whose canal
  isn't named in OSM (shown as "nearby station" in the UI). ~290 of ~312
  stations map onto 150+ canals; retention ponds and ditches off the network
  only count toward the citywide totals.
- Risk ratings are a **static, compiled orientation aid** based on documented
  flood history — not a forecast. The live-status layer is **telemetry readings
  at the snapshot time**, not a warning service: "critical" means the water had
  passed the BMA's critical bank level for that canal when it was read. For
  live flood warnings use BMA / Thai Government official channels.
- The trace shows the **drainage route** toward the river and out to the Gulf;
  actual flow direction can pause or reverse with the tide, and gates control
  each connection.
- Some gate/pump marker positions are approximate (flagged in their popups).

## Rebuilding the data

```bash
node build_data.mjs   # OSM geometry → data/canals_data.js
node fetch_live.mjs   # BMA telemetry → data/live_status.js (the site's live layer + timestamps)
```

`build_data.mjs` merges OSM way segments into named canals, simplifies lines
(Douglas-Peucker), computes lengths, and attaches the curated risk table
(`CURATED` in the script). Edit the curated entries there to refine ratings.

`fetch_live.mjs` pulls every station from the BMA's own page endpoint
(`POST weather.bangkok.go.th/water/PageMap/GoogleMap` — it 403s without a
session cookie and a browser User-Agent, and sends no CORS headers, which is
why the site ships a generated snapshot instead of fetching live), maps the
stations onto the canal network, and writes `data/live_status.js`. Re-run it
whenever you want fresher readings — the sidebar always shows how old the
snapshot is.
