// Fetch live canal water-level readings from BMA's telemetry network
// (สำนักการระบายน้ำ กทม. — weather.bangkok.go.th/water) and map every station
// onto the canal network in data/canals.geojson. Writes data/live_status.js,
// a snapshot the site reads to show each canal's current status and the
// "updated at" timestamps.
//
// Statuses follow flood69.peoplesparty.or.th (the People's Party KlongMap
// mirror): วิกฤต critical / เตือนภัย warning / ปกติ normal / น้ำต่ำ dry,
// computed from each reading against BMA's own thresholds. BMA's map endpoint
// lacks the low-water threshold, so the dry_in/checkdry fields are merged in
// from the flood69 mirror by station code; stations without mirror data fall
// back to BMA's reported status.
//
// The endpoints have no CORS headers, so the browser cannot call them directly
// — the site ships this snapshot instead. Re-run to refresh:
//
//   node fetch_live.mjs
import fs from 'fs';

const PAGE = 'https://weather.bangkok.go.th/water';
const API = 'https://weather.bangkok.go.th/water/PageMap/GoogleMap';
const F69 = 'https://flood69.peoplesparty.or.th';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const GEO = JSON.parse(fs.readFileSync('data/canals.geojson', 'utf8'));

// ---------- fetch (the endpoint 403s without a page session + browser UA) ----------
async function fetchStations() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await fetch(PAGE, { headers: { 'User-Agent': UA } });
    const jar = page.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Cookie': jar,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': PAGE,
        'Origin': 'https://weather.bangkok.go.th',
      },
      body: 'payload=TEST_DATA_GOES_HERE',
    });
    if (res.ok) return res.json();
    console.error(`attempt ${attempt}: HTTP ${res.status}`);
  }
  throw new Error('could not fetch BMA station data');
}

// flood69 mirror of BMA's KlongMap — the only feed carrying the low-water
// threshold (dry_in + checkdry); live proxy first, static snapshot fallback
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
const epoch = d => { // "/Date(1790490000000)/" -> ms
  const m = /\/Date\((\d+)\)\//.exec(d || '');
  return m ? +m[1] : null;
};
// the feed marks missing levels/thresholds with -99 and occasionally 50 —
// real bank levels live within a couple of metres of the MSD datum
const clean = v => (v == null || v === -99 || Math.abs(v) > 10) ? null : v;
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

// ---------- map stations -> canals ----------
// status ranking, flood69's four levels + BMA's station-fault marker:
// critical (above the critical bank level) > warning > dry (below the
// low-water threshold) > normal; faulty carries no level info
const RANK = { critical: 4, warning: 3, dry: 2, normal: 1, faulty: 0 };
// flood69's algorithm (KlongMap): low water first, then bank thresholds —
// level < dry_in (with checkdry) → dry, ≥ critical → critical,
// ≥ warning → warning, else normal
const statusOf = (r, f69) => {
  const level = clean(r.wl_in);
  if (f69 && level != null) {
    const dry = clean(f69.dry_in), crit = clean(f69.critical), warn = clean(f69.warning);
    if (Number(f69.checkdry) === 1 && dry !== null && level < dry) return 'dry';
    if (crit !== null && level >= crit) return 'critical';
    if (warn !== null && level >= warn) return 'warning';
    if (crit !== null || warn !== null) return 'normal';
  }
  const s = (r.txtStatus_en || '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'alert') return 'warning'; // BMA's เตือนภัย
  if (s === 'normal') return 'normal';
  return 'faulty'; // "out of order" / anything unexpected
};
const NEAR_M = 200; // spatial attach tolerance

function mapStations(raw, f69ByCode) {
  const stations = [], byCanal = new Map();
  for (const r of raw) {
    const lat = r.latitude, lon = r.longitude;
    if (!lat || !lon) continue;
    const f69 = f69ByCode.get(r.water_code) || null;
    const status = statusOf(r, f69);
    const ts = epoch(r.site_timestamp);
    const st = {
      code: r.water_code || '',
      name: r.water_name || r.water_shortname || r.water_code,
      name_en: r.water_name_en || r.water_shortname_en || null,
      district: r.district_name || null,
      district_en: r.district_name_en || null,
      status, level: clean(r.wl_in ?? r.wl_out01),
      warning: clean(f69?.warning ?? r.warning), critical: clean(f69?.critical ?? r.critical),
      dry: clean(f69?.dry_in),
      ts, lat, lon,
    };
    // 1–2) name match (river_name, then the English station name before the comma)
    let keys = lookupName(r.river_name);
    let match = keys ? 'name' : null;
    if (!keys && (r.water_name_en || '').includes(',')) keys = lookupName(r.water_name_en.split(',')[0]);
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
      station: rep?.code ?? null,
      ts: latest,
      stations: sts.map(s => s.code),
    };
  }
  return out;
}

// ---------- main ----------
const raw = await fetchStations();
const f69 = await fetchFlood69();
const f69ByCode = new Map((f69 || [])
  .filter(s => s.water_station_info?.water_code)
  .map(s => [s.water_station_info.water_code, s.water_station_info]));
if (f69 == null) console.error('flood69 mirror unavailable — dry status falls back to BMA-reported statuses');
const { stations, byCanal } = mapStations(raw, f69ByCode);
const byCanalAgg = aggregate(byCanal);

const counts = { critical: 0, warning: 0, normal: 0, dry: 0, faulty: 0 };
for (const s of stations) counts[s.status]++;
const latestReading = stations.reduce((a, s) => Math.max(a, s.ts || 0), 0);
const nameHits = stations.filter(s => s.match === 'name').length;
const nearHits = stations.filter(s => s.match === 'near').length;

const out = {
  fetched_at: Date.now(),
  latest_reading: latestReading,
  source: 'BMA Drainage and Sewerage Department telemetry · สำนักการระบายน้ำ กรุงเทพมหานคร (weather.bangkok.go.th/water)',
  counts, stations_total: stations.length,
  canals: byCanalAgg,
  stations: stations.map(s => ({ ...s, canal: s.canal || null, match: s.match || null })),
};
fs.writeFileSync('data/live_status.js',
  '// generated by fetch_live.mjs — do not edit; refresh with `node fetch_live.mjs`\n' +
  'window.LIVE_STATUS = ' + JSON.stringify(out) + ';\n');

console.log(`stations: ${stations.length} (name-matched ${nameHits}, spatial≤${NEAR_M}m ${nearHits}, unmapped ${stations.length - nameHits - nearHits})`);
console.log(`canals with live data: ${Object.keys(byCanalAgg).length}`);
console.log(`status: วิกฤต ${counts.critical} · เตือนภัย ${counts.warning} · ปกติ ${counts.normal} · น้ำต่ำ ${counts.dry} · ขัดข้อง ${counts.faulty}`);
console.log(`latest station reading: ${new Date(latestReading).toISOString()}`);
console.log(`wrote data/live_status.js (${Math.round(fs.statSync('data/live_status.js').size / 1024)} KB)`);
