// Fetch live canal water-level readings from BMA's telemetry network
// (สำนักการระบายน้ำ กทม. — weather.bangkok.go.th/water) and map every station
// onto the canal network in data/canals.geojson. Writes data/live_status.js,
// a snapshot the site reads to show each canal's current status and the
// "updated at" timestamps.
//
// Stations are synthesized from three feeds, keyed by water_code:
//   1. BMA's Summary page (/water/Summary) — the primary source: ~304 stations
//      with clean levels, warning/critical + outfall thresholds, bank levels,
//      daily maxima, RTU device health and BMA's own flood status. It has no
//      low-water fields and no pump/gate activity.
//   2. the flood69 mirror (flood69.peoplesparty.or.th) — overlay for what the
//      Summary page lacks: dry_in/checkdry/dry_out01 (low water) and
//      water_pump_last/water_gate_last, plus a full fallback for the handful of
//      stations the Summary page doesn't carry (since 2026-10 its live reading
//      sits in a nested water_level_last object — see readingOf).
//   3. BMA's map endpoint (POST /water/PageMap/GoogleMap) — the old source, now
//      a last resort for station codes absent from both feeds above.
//
// Statuses follow flood69's KlongMap algorithm: broken telemetry (breaker /
// rtu_door tripped, or no level at all), BMA's own "out of order" marker, or
// a reading older than a day (dead telemetry — the last value must not be
// presented as a live status) → faulty; level < dry_in (with checkdry) → dry;
// ≥ critical → critical; ≥ warning → warning; else normal.
// Each station also carries status_agrees — whether the computed status matches
// BMA's reported water_status_flood (1=normal 2=warning 3=critical) — computed
// status stays authoritative when they differ.
//
// The endpoints have no CORS headers, so the browser cannot call them directly
// — the site ships this snapshot instead. Re-run to refresh:
//
//   node fetch_live.mjs
import fs from 'fs';

const BASE = 'https://weather.bangkok.go.th';
const PAGE = BASE + '/water';
const SUMMARY = PAGE + '/Summary';
const API = BASE + '/water/PageMap/GoogleMap';
const F69 = 'https://flood69.peoplesparty.or.th';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const GEO = JSON.parse(fs.readFileSync('data/canals.geojson', 'utf8'));

const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- fetch (the WAF 403s without a browser UA and often on the first
// hit; a page session + retries calm it down) ----------
// The WAF answers 429 when polled too hard (e.g. a refresh loop running every
// few minutes) — once tripped, skip this host's remaining endpoints instead of
// compounding the limit; the flood69 mirror carries the same stations anyway
let bmaRateLimited = false;

async function pageSession() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(PAGE, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    console.error(`page attempt ${attempt}: HTTP ${res.status}`);
    if (res.status === 429) { bmaRateLimited = true; return ''; }
    await wait(1500);
  }
  return ''; // sometimes the WAF lets a cookie-less request through anyway
}

async function getHtml(url, jar) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (bmaRateLimited) return null;
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Cookie': jar, 'Referer': PAGE } });
    if (res.ok) return res.text();
    console.error(`attempt ${attempt}: ${url} -> HTTP ${res.status}`);
    if (res.status === 429) { bmaRateLimited = true; return null; }
    await wait(1500);
  }
  return null;
}

// the Summary page embeds its data as `const waterSummaryList = [...];` inside
// a large <script> that keeps going afterwards (districtList, …), so a
// lazy .*?<\/script> regex overruns — bracket-match the array instead
function extractEmbeddedArray(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('[', at);
  let depth = 0, inStr = false, esc = false;
  for (let p = start; p < html.length; p++) {
    const c = html[p];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return JSON.parse(html.slice(start, p + 1));
  }
  return null;
}

// BMA Summary page: levels, thresholds, banks, device health, flood status —
// plus the districtList lookup (district_id -> Thai/English name)
async function fetchSummary(jar) {
  const html = await getHtml(SUMMARY, jar);
  if (!html) return null;
  const list = extractEmbeddedArray(html, 'const waterSummaryList');
  if (!list) return null;
  const districts = new Map((extractEmbeddedArray(html, 'const districtList') || [])
    .filter(d => d.district_id).map(d => [d.district_id, d]));
  return { list, districts };
}

// BMA's old map endpoint — last-resort station source (and the whole fallback
// should the Summary page ever go away)
async function fetchStations(jar) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (bmaRateLimited) return null;
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Cookie': jar,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': PAGE,
        'Origin': BASE,
      },
      body: 'payload=TEST_DATA_GOES_HERE',
    });
    if (res.ok) return res.json();
    console.error(`map endpoint attempt ${attempt}: HTTP ${res.status}`);
    if (res.status === 429) { bmaRateLimited = true; return null; }
    await wait(1500);
  }
  return null;
}

// flood69 mirror of BMA's KlongMap — the only feed carrying the low-water
// threshold (dry_in + checkdry) and pump/gate activity; live proxy first,
// static snapshot fallback
async function fetchFlood69() {
  for (const path of ['/api/klongmap', '/klong/klongmapdata.json']) {
    try {
      const res = await fetch(F69 + path, { headers: { 'User-Agent': UA } });
      if (res.ok) return (await res.json()).waterStation || [];
      console.error(`flood69 ${path}: HTTP ${res.status}`);
    } catch (e) {
      console.error(`flood69 ${path}: ${e.cause?.code || e.message}`);
    }
  }
  return null; // thresholds unavailable — statuses degrade to BMA's own
}

// ---------- helpers ----------
const norm = s => (s || '').replace(/[\u200B-\u200D\uFEFF\s]/g, '');
// Summary stamps naive Bangkok-local ISO ("2026-09-27T20:05:00") — anchor
// +07:00; the map endpoint and flood69 stamp "/Date(1790490000000)/"
// (negative = unset). Returns ms or null.
const tsOf = v => {
  if (v == null || v === '') return null;
  const m = /\/Date\((-?\d+)\)\//.exec(v);
  if (m) return +m[1] > 0 ? +m[1] : null;
  const t = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? v : v + '+07:00');
  return Number.isFinite(t) ? t : null;
};
// the mirror/map feeds mark missing levels/thresholds with -99 and occasionally
// 50 — real bank levels live within a couple of metres of the MSD datum
const clean = v => (v == null || v === -99 || Math.abs(v) > 10) ? null : v;
// Summary device-health booleans: false = fine, true = tripped; null = unknown
const tripped = v => v === true || v === 1 || v === '1' || v === 'true';
// pump/gate activity arrives as pump01..51 / watergate01..06 bags that are
// almost all null — keep only live entries so the snapshot stays small
const compactPumpGate = v => {
  if (!v || typeof v !== 'object') return null;
  const out = {};
  for (const [k, val] of Object.entries(v))
    if (val != null && /^(pump|watergate)\d+$/.test(k)) out[k] = val;
  return Object.keys(out).length ? out : null;
};
function ptSeg(px, py, [a, b]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
// spatial index of canal segments: key -> metres distance
const CELL = 0.004;
const grid = new Map();
for (const f of GEO.features) for (const line of f.geometry.coordinates)
  for (let i = 1; i < line.length; i++) {
    const seg = { key: f.properties.key, a: line[i - 1], b: line[i],
      x0: Math.min(line[i - 1][0], line[i][0]), x1: Math.max(line[i - 1][0], line[i][0]),
      y0: Math.min(line[i - 1][1], line[i][1]), y1: Math.max(line[i - 1][1], line[i][1]) };
    for (let cx = Math.floor(seg.x0 / CELL); cx <= Math.floor(seg.x1 / CELL); cx++)
      for (let cy = Math.floor(seg.y0 / CELL); cy <= Math.floor(seg.y1 / CELL); cy++) {
        const k = cx + ':' + cy;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(seg);
      }
  }
function nearestCanal(lon, lat) {
  const cx = Math.floor(lon / CELL), cy = Math.floor(lat / CELL);
  let best = Infinity, key = null;
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
    const segs = grid.get(i + ':' + j);
    if (!segs) continue;
    for (const s of segs) {
      const d = ptSeg(lon, lat, [s.a, s.b]);
      if (d < best) { best = d; key = s.key; }
    }
  }
  // degrees (lon) -> metres at the station's latitude
  return { m: best * 111320 * Math.cos(lat * Math.PI / 180), key };
}

// ---------- name index: normalized canal names -> keys ----------
const nameIndex = new Map();
const addName = (name, key) => {
  const k = norm(name).toLowerCase();
  if (!k) return;
  if (!nameIndex.has(k)) nameIndex.set(k, []);
  if (!nameIndex.get(k).includes(key)) nameIndex.get(k).push(key);
};
for (const f of GEO.features) {
  addName(f.properties.name_th, f.properties.key);
  addName(f.properties.name, f.properties.key);
}
const lookupName = name => { // try as-is, then without the คลอง/Khlong prefix
  const k = norm(name).toLowerCase();
  return nameIndex.get(k) || nameIndex.get(k.replace(/^คลอง/, '')) ||
    nameIndex.get(k.replace(/^khlong/, '')) || null;
};

// ---------- synthesize one record per station (key = water_code) ----------
// tier 1 = Summary page (base: levels, thresholds, banks, device health)
// tier 2 = flood69 (overlay: dry fields + pump/gate; full record for stations
//          the Summary page lacks)
// tier 3 = map endpoint (last resort for codes nowhere else, and the whole
//          pipeline should the Summary page fail)
//
// status ranking, flood69's four levels + BMA's station-fault marker:
// critical (above the critical bank level) > warning > dry (below the
// low-water threshold) > normal; faulty carries no level info
const RANK = { critical: 4, warning: 3, dry: 2, normal: 1, faulty: 0 };
// a reading older than a day is dead telemetry, not a live status — the gauge
// froze on whatever it last reported, so that value must not be presented as
// the canal's current water level
const STALE_MS = 24 * 60 * 60 * 1000;
// flood69's algorithm (KlongMap): low water first, then bank thresholds —
// level < dry_in (with checkdry) → dry, ≥ critical → critical,
// ≥ warning → warning, else normal; broken telemetry or no level → faulty;
// without thresholds from either feed, fall back to BMA's reported status
const OFFICIAL = { 1: 'normal', 2: 'warning', 3: 'critical' };
const statusOf = st => {
  if (st.breaker || st.rtu_door || st.level == null) return 'faulty';
  // BMA's own ขัดข้อง marker (pagemap-tier records carry it) — previously it
  // lost to the threshold comparison below and a dead gauge showed as ปกติ
  if (/out of order/i.test(st.txtStatus_en || '')) return 'faulty';
  // frozen timestamp = the station stopped reporting; guard on ts != null so
  // records without a parseable stamp keep their threshold-based status
  if (st.ts != null && Date.now() - st.ts > STALE_MS) return 'faulty';
  if (Number(st.checkdry) === 1 && st.dry != null && st.level < st.dry) return 'dry';
  if (st.critical != null && st.level >= st.critical) return 'critical';
  if (st.warning != null && st.level >= st.warning) return 'warning';
  if (st.critical != null || st.warning != null) return 'normal';
  const s = (st.txtStatus_en || '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'alert') return 'warning'; // BMA's เตือนภัย
  if (s === 'normal') return 'normal';
  return OFFICIAL[st.water_status_flood] || 'faulty'; // "out of order" / anything unexpected
};

// the mirror (and BMA's KlongMap upstream) moved the live reading out of the
// station record into a nested water_level_last object (2026-10); older
// snapshots carried it flat on the station record — accept either
function readingOf(st) {
  if (!st) return null;
  const nested = st.water_level_last;
  if (nested && (nested.wl_in != null || nested.site_timestamp != null)) return nested;
  return (st.wl_in != null || st.site_timestamp != null) ? st : null;
}

function synthesize(summary, f69ByCode, mapByCode) {
  const { list, districts } = summary || { list: [], districts: new Map() };
  const districtOf = (id, th, en) => ({
    district: th ?? districts.get(id)?.name ?? null,
    district_en: en ?? districts.get(id)?.district_name_en ?? null,
  });
  const merged = new Map();
  // tier 1 — Summary page
  for (const r of list) {
    if (!r.water_code) continue;
    const f69 = f69ByCode.get(r.water_code) || null;
    merged.set(r.water_code, {
      source: 'summary',
      code: r.water_code,
      water_id: r.water_id ?? null,
      name: r.water_name || r.water_shortname || r.water_code,
      name_en: r.water_name_en || r.water_shortname_en || null,
      river_name: r.river_name || null,
      ...districtOf(r.district_id, null, null),
      lat: r.latitude, lon: r.longitude,
      ts: tsOf(r.site_timestamp),
      level: clean(r.wl_in),
      wl_out01: clean(r.wl_out01),
      warning: clean(r.warning), critical: clean(r.critical),
      warning_out01: clean(r.warning_out01), critical_out01: clean(r.critical_out01),
      left_bank: clean(r.left_bank), right_bank: clean(r.right_bank), bed_bank: clean(r.bed_bank),
      max_in_day: clean(r.max_in_day),
      power: tripped(r.power), battery: tripped(r.battery),
      rtu_door: tripped(r.rtu_door), breaker: tripped(r.breaker),
      station_status: r.station_status ?? null,
      water_status: r.water_status ?? null,
      water_status_flood: r.water_status_flood ?? null,
      // only the Summary page lacks these — overlay from flood69
      dry: clean(f69?.dry_in),
      checkdry: f69?.checkdry ?? null,
      dry_out01: clean(f69?.dry_out01),
      water_pump_last: compactPumpGate(f69?.water_pump_last),
      water_gate_last: compactPumpGate(f69?.water_gate_last),
    });
  }
  // tier 2 — flood69: full records for stations the Summary page lacks
  for (const [code, f] of f69ByCode) {
    if (merged.has(code)) continue;
    const read = readingOf(f);
    merged.set(code, {
      source: 'flood69',
      code,
      water_id: f.water_id ?? null,
      name: f.water_name || f.water_shortname || code,
      name_en: f.water_name_en || f.water_shortname_en || null,
      river_name: f.river_name || null,
      ...districtOf(f.district_id, f.district_name, null),
      lat: f.latitude, lon: f.longitude,
      ts: tsOf(read?.site_timestamp),
      level: clean(read?.wl_in),
      wl_out01: clean(read?.wl_out01),
      warning: clean(f.warning), critical: clean(f.critical),
      warning_out01: clean(f.warning_out01), critical_out01: clean(f.critical_out01),
      left_bank: clean(f.left_bank), right_bank: clean(f.right_bank), bed_bank: clean(f.bed_bank),
      max_in_day: clean(read?.max_in_day),
      power: null, battery: null, rtu_door: null, breaker: null,
      station_status: f.station_status ?? null,
      water_status: f.water_status ?? null,
      water_status_flood: null,
      dry: clean(f.dry_in),
      checkdry: f.checkdry ?? null,
      dry_out01: clean(f.dry_out01),
      water_pump_last: compactPumpGate(f.water_pump_last),
      water_gate_last: compactPumpGate(f.water_gate_last),
    });
  }
  // tier 3 — map endpoint: codes absent from both feeds above
  for (const [code, r] of mapByCode) {
    if (merged.has(code)) continue;
    merged.set(code, {
      source: 'pagemap',
      code,
      water_id: r.water_id ?? null,
      name: r.water_name || r.water_shortname || code,
      name_en: r.water_name_en || r.water_shortname_en || null,
      river_name: r.river_name || null,
      ...districtOf(r.district_id, r.district_name, r.district_name_en),
      lat: r.latitude, lon: r.longitude,
      ts: tsOf(r.site_timestamp),
      level: clean(r.wl_in ?? r.wl_out01),
      wl_out01: clean(r.wl_out01),
      warning: clean(r.warning), critical: clean(r.critical),
      warning_out01: clean(r.warning_out01), critical_out01: clean(r.critical_out01),
      left_bank: clean(r.left_bank), right_bank: clean(r.right_bank), bed_bank: clean(r.bed_bank),
      max_in_day: clean(r.max_in_day),
      power: null, battery: null, rtu_door: null, breaker: null,
      station_status: r.station_status ?? null,
      water_status: null,
      water_status_flood: null,
      dry: null,
      checkdry: null,
      dry_out01: null,
      water_pump_last: null,
      water_gate_last: null,
      txtStatus_en: r.txtStatus_en || null,
    });
  }
  for (const st of merged.values()) st.status = statusOf(st);
  return merged;
}
const NEAR_M = 200; // spatial attach tolerance

// does the computed status line up with BMA's own flood status? faulty/dry
// have no official category, and a missing report compares to nothing
const agreesWithOfficial = st =>
  (st.status === 'faulty' || st.status === 'dry' || st.water_status_flood == null ||
    !OFFICIAL[st.water_status_flood])
    ? null : OFFICIAL[st.water_status_flood] === st.status;

function mapStations(records) {
  const stations = [], byCanal = new Map();
  for (const r of records.values()) {
    const lat = r.lat, lon = r.lon;
    if (!lat || !lon) continue;
    const st = {
      code: r.code,
      name: r.name,
      name_en: r.name_en,
      district: r.district,
      district_en: r.district_en,
      status: r.status,
      level: r.level,
      warning: r.warning, critical: r.critical,
      dry: r.dry,
      ts: r.ts, lat, lon,
      water_id: r.water_id,
      wl_out01: r.wl_out01,
      warning_out01: r.warning_out01, critical_out01: r.critical_out01,
      left_bank: r.left_bank, right_bank: r.right_bank, bed_bank: r.bed_bank,
      max_in_day: r.max_in_day,
      power: r.power, battery: r.battery, rtu_door: r.rtu_door, breaker: r.breaker,
      station_status: r.station_status,
      water_status: r.water_status, water_status_flood: r.water_status_flood,
      txtStatus_en: r.txtStatus_en || null, // BMA's own fault marker, kept as evidence
      status_agrees: agreesWithOfficial(r),
      checkdry: r.checkdry, dry_out01: r.dry_out01,
      water_pump_last: r.water_pump_last, water_gate_last: r.water_gate_last,
      source: r.source,
    };
    // 1–2) name match (river_name, then the English station name before the comma)
    let keys = lookupName(r.river_name);
    let match = keys ? 'name' : null;
    if (!keys && (r.name_en || '').includes(',')) keys = lookupName(r.name_en.split(',')[0]);
    let bestKey = null;
    if (keys && keys.length) {
      bestKey = keys[0];
      if (keys.length > 1) { // same canal name split into components — take the nearest
        let bd = Infinity;
        for (const k of keys) {
          const f = GEO.features.find(f => f.properties.key === k);
          for (const line of f.geometry.coordinates)
            for (const [x, y] of line) {
              const d = Math.hypot(x - lon, y - lat);
              if (d < bd) { bd = d; bestKey = k; }
            }
        }
      }
    } else { // 3) spatial fallback
      const n = nearestCanal(lon, lat);
      if (n.key && n.m <= NEAR_M) { bestKey = n.key; match = 'near'; }
    }
    if (bestKey) { st.canal = bestKey; st.match = match; byCanal.get(bestKey) || byCanal.set(bestKey, []); byCanal.get(bestKey).push(st); }
    stations.push(st);
  }
  return { stations, byCanal };
}

// ---------- aggregate per canal ----------
// One voice per canal: the worst-status station speaks, and its level travels
// with its own thresholds — mixing one station's status with another's level
// made popups claim "critical" for a level below the printed threshold.
function aggregate(byCanal) {
  const out = {};
  for (const [key, sts] of byCanal) {
    const working = sts.filter(s => s.status !== 'faulty');
    const pool = working.length ? working : sts;
    let latest = 0, worstRank = -1;
    for (const s of pool) {
      if ((s.ts || 0) > latest) latest = s.ts || 0;
      if (RANK[s.status] > worstRank) worstRank = RANK[s.status];
    }
    const worstSts = pool.filter(s => RANK[s.status] === worstRank);
    const rep = worstSts.find(s => s.level != null) || worstSts[0];
    out[key] = {
      status: rep?.status ?? 'faulty',
      level: rep?.level ?? null, warning: rep?.warning ?? null, critical: rep?.critical ?? null,
      dry: rep?.dry ?? null,
      status_agrees: rep?.status_agrees ?? null,
      station: rep?.code ?? null,
      ts: latest,
      stations: sts.map(s => s.code),
    };
  }
  return out;
}

// ---------- main ----------
const jar = await pageSession();
const [summary, f69] = [await fetchSummary(jar), await fetchFlood69()];
const f69ByCode = new Map((f69 || [])
  .filter(s => s.water_station_info?.water_code)
  .map(s => [s.water_station_info.water_code, s.water_station_info]));
if (f69 == null) console.error('flood69 mirror unavailable — dry status falls back to BMA-reported statuses');
if (summary == null) console.error('BMA Summary page unavailable — falling back to the old map-endpoint pipeline');

// map endpoint as tier 3: a handful of stations (and one or two canals) exist
// only here, so the POST is always worth it — synthesize() only takes the codes
// the first two feeds don't have, and it doubles as the whole pipeline should
// the Summary page fail
const raw = await fetchStations(jar);
const mapByCode = new Map();
for (const s of raw || []) {
  const r = s?.water_station_info || s; // the map endpoint returns bare records
  if (r?.water_code && !f69ByCode.has(r.water_code)) mapByCode.set(r.water_code, r);
}

const records = synthesize(summary, f69ByCode, mapByCode);
const { stations, byCanal } = mapStations(records);
const byCanalAgg = aggregate(byCanal);

const counts = { critical: 0, warning: 0, normal: 0, dry: 0, faulty: 0 };
for (const s of stations) counts[s.status]++;
  // BMA occasionally stamps a reading minutes into the future (clock-skewed
  // RTU / pre-stamped telemetry slot) — cap the header stamp at fetch time so
  // "อ่านค่าล่าสุด" can't show a time that hasn't happened yet
  const fetchedAt = Date.now();
  const latestReading = stations.reduce((a, s) => (s.ts && s.ts <= fetchedAt) ? Math.max(a, s.ts) : a, 0);
const nameHits = stations.filter(s => s.match === 'name').length;
const nearHits = stations.filter(s => s.match === 'near').length;
const bySource = { summary: 0, flood69: 0, pagemap: 0 };
for (const s of stations) bySource[s.source]++;
const agreesDist = { true: 0, false: 0, null: 0 };
for (const s of stations) agreesDist[String(s.status_agrees)]++;

const out = {
  fetched_at: fetchedAt,
  latest_reading: latestReading,
  source: 'BMA Drainage and Sewerage Department telemetry · สำนักการระบายน้ำ กรุงเทพมหานคร (weather.bangkok.go.th/water)',
  counts, stations_total: stations.length,
  canals: byCanalAgg,
  stations: stations.map(s => ({ ...s, canal: s.canal || null, match: s.match || null })),
};
// a run that returns station records but not a single parseable reading means
// the feeds are degraded (WAF rate limit, another shape change) — not that
// every gauge in the city went dark at once; keep the previous snapshot so the
// site (and the refresh commit) never show an all-faulty map
function previousLatestReading() {
  try {
    const m = fs.readFileSync('data/live_status.js', 'utf8').match(/window\.LIVE_STATUS = (\{.*\});/s);
    return m ? JSON.parse(m[1]).latest_reading || 0 : 0;
  } catch { return 0; }
}
if (latestReading === 0 && previousLatestReading() > 0) {
  console.error('no valid station reading in this run — keeping the previous snapshot ' +
    `(${new Date(previousLatestReading()).toISOString()})`);
  process.exit(1);
}

fs.writeFileSync('data/live_status.js',
  '// generated by fetch_live.mjs — do not edit; refresh with `node fetch_live.mjs`\n' +
  'window.LIVE_STATUS = ' + JSON.stringify(out) + ';\n');

console.log(`stations: ${stations.length} (summary ${bySource.summary}, flood69-only ${bySource.flood69}, map-only ${bySource.pagemap})`);
console.log(`mapped: name ${nameHits}, spatial≤${NEAR_M}m ${nearHits}, unmapped ${stations.length - nameHits - nearHits}`);
console.log(`canals with live data: ${Object.keys(byCanalAgg).length}`);
console.log(`status: วิกฤต ${counts.critical} · เตือนภัย ${counts.warning} · ปกติ ${counts.normal} · น้ำต่ำ ${counts.dry} · ขัดข้อง ${counts.faulty}`);
console.log(`status_agrees vs BMA water_status_flood: true ${agreesDist.true} · false ${agreesDist.false} · n/a ${agreesDist.null}`);
console.log(`latest station reading: ${new Date(latestReading).toISOString()}`);
console.log(`wrote data/live_status.js (${Math.round(fs.statSync('data/live_status.js').size / 1024)} KB)`);
