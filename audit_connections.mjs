// Audit: dump the connectivity graph for key corridors and the exact BFS
// drainage chain the app displays, so links can be checked against real
// geography. Flags each link as "endpoint junction" or "mid-line crossing"
// (crossings are the risky ones: geometric links that may not be real water
// connections). Usage: node audit_connections.mjs
import fs from 'fs';

global.window = {};
eval(fs.readFileSync('data/canals_data.js', 'utf8'));
const canals = window.CANALS_DATA.features;
const graph = window.CANAL_GRAPH;
const adj = graph.adj;
const linkPts = graph.linkPts;
const byKey = new Map(canals.map(f => [f.properties.key, f]));
const nameOf = k => byKey.get(k)?.properties.name || k;

// endpoint lookup: closest distance from a point to any canal line endpoint
function endpointDist(key, pt) {
  const f = byKey.get(key);
  let best = Infinity;
  for (const line of f.geometry.coordinates)
    for (const [lon, lat] of [line[0], line[line.length - 1]])
      best = Math.min(best, Math.hypot(lon - pt[0], lat - pt[1]));
  return best; // degrees
}
const DEG_M = 111320;
const m = d => Math.round(d * DEG_M);

function linkType(a, b) {
  const pt = linkPts[a < b ? a + '|' + b : b + '|' + a];
  if (!pt) return { pt: null, note: '?' };
  const da = endpointDist(a, pt), db = endpointDist(b, pt);
  const note = da < 30 / DEG_M && db < 30 / DEG_M ? 'junction'
    : da < 30 / DEG_M || db < 30 / DEG_M ? 'T-junction' : 'CROSSING(mid)';
  return { pt, da, db, note };
}

// mirror of app.js computeTrace: Dijkstra over (canal, junction) states,
// costed in along-canal km (replaces the old hop-count BFS replica)
const havKm = (a, b) => {
  const rad = Math.PI / 180;
  const q = Math.sin((b[1] - a[1]) * rad / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(q));
};
const canalGeom = new Map();
for (const f of canals) {
  const key = f.properties.key || f.properties.name;
  canalGeom.set(key, f.geometry.coordinates.map(line => {
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + havKm(line[i - 1], line[i]));
    return { pts: line, cum };
  }));
}
const canalJuncs = new Map();
for (const [pk, pt] of Object.entries(linkPts)) {
  const [a, b] = pk.split('|');
  if (!canalGeom.has(a) || !canalGeom.has(b)) continue;
  if (!canalJuncs.has(a)) canalJuncs.set(a, []);
  if (!canalJuncs.has(b)) canalJuncs.set(b, []);
  canalJuncs.get(a).push({ pt, other: b });
  canalJuncs.get(b).push({ pt, other: a });
}
function nearestCum(key, pt) {
  return canalGeom.get(key).map(l => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < l.pts.length; i++) {
      const d = Math.hypot(l.pts[i][0] - pt[0], l.pts[i][1] - pt[1]);
      if (d < bd) { bd = d; bi = i; }
    }
    return { d: bd, cum: l.cum[bi] };
  });
}
const alongMemo = new Map();
function alongKm(key, p, q) {
  const kk = key + '|' + p.join(',') + '|' + q.join(',');
  if (alongMemo.has(kk)) return alongMemo.get(kk);
  const cp = nearestCum(key, p), cq = nearestCum(key, q);
  let best = Infinity;
  for (let i = 0; i < cp.length; i++)
    if (cp[i].d < 0.004 && cq[i].d < 0.004) best = Math.min(best, Math.abs(cp[i].cum - cq[i].cum));
  if (!isFinite(best)) best = havKm(p, q);
  alongMemo.set(kk, best);
  return best;
}
function riverEndpoint(key) { // same rule as app.js: endpoint nearest the river centreline
  const f = byKey.get(key);
  let rp = null, bd = Infinity;
  for (const line of window.RIVER_LINES || [])
    for (const [x, y] of line)
      for (const ln of f.geometry.coordinates)
        for (const pt of [ln[0], ln[ln.length - 1]]) {
          const d = Math.hypot(x - pt[0], y - pt[1]);
          if (d < bd) { bd = d; rp = pt; }
        }
  return rp;
}

function appTrace(startKey) {
  const riverSet = new Set(graph.river);
  if (riverSet.has(startKey)) return [startKey];
  const EXIT = '__EXIT__';
  const dist = new Map(), prev = new Map();
  let exitKey = null;
  const heap = [];
  const push = (c, v) => { heap.push([c, v]); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top; };
  (canalJuncs.get(startKey) || []).forEach((j, ji) => {
    const s = startKey + '#' + ji; dist.set(s, 0); prev.set(s, null); push(0, s); });
  while (heap.length) {
    const [d, s] = pop();
    if (d > (dist.get(s) ?? Infinity)) continue;
    if (s === EXIT) break;
    const hash = s.lastIndexOf('#');
    const key = s.slice(0, hash), ji = +s.slice(hash + 1);
    const here = canalJuncs.get(key)[ji].pt;
    if (riverSet.has(key)) {
      const rp = riverEndpoint(key);
      const total = d + alongKm(key, here, rp);
      if (total < (dist.get(EXIT) ?? Infinity)) {
        dist.set(EXIT, total); prev.set(EXIT, s); exitKey = key; push(total, EXIT);
      }
    }
    for (const nb of adj[key] || []) {
      const nj = canalJuncs.get(nb) || [];
      for (let qi = 0; qi < nj.length; qi++) {
        if (nj[qi].other !== key) continue;
        if (Math.hypot(nj[qi].pt[0] - here[0], nj[qi].pt[1] - here[1]) > 0.00005) continue;
        const ns = nb + '#' + qi;
        if (d < (dist.get(ns) ?? Infinity)) { dist.set(ns, d); prev.set(ns, s); push(d, ns); }
      }
    }
    const kj = canalJuncs.get(key);
    for (let qi = 0; qi < kj.length; qi++) {
      if (qi === ji) continue;
      const d2 = d + alongKm(key, here, kj[qi].pt);
      const ns = key + '#' + qi;
      if (d2 < (dist.get(ns) ?? Infinity)) { dist.set(ns, d2); prev.set(ns, s); push(d2, ns); }
    }
  }
  if (exitKey === null) return null;
  const chain = [];
  for (let cur = prev.get(EXIT); cur; cur = prev.get(cur)) chain.unshift(cur.split('#')[0]);
  return [...new Set(chain)];
}

const EAST = ['Khlong Saen Saep', 'Khlong Maha Nak', 'Khlong Rop Krung',
  'Khlong Bang Lamphu Lang', 'Khlong Ong Ang', 'Khlong Phadung Krung Kasem',
  'Khlong Lat Phrao', 'Khlong Prem Prachakon', 'Khlong Bang Sue', 'Khlong Prapa',
  'Khlong Prapa Tawan Tok', 'Khlong Tan', 'Khlong Phra Khanong', 'Khlong Bang Kapi',
  'Khlong Chong Nonsi', 'Khlong Sathon', 'Khlong Bang Bua'];
const WEST = ['Khlong Phasi Charoen', 'Khlong Bangkok Yai', 'Khlong Bangkok Noi',
  'Khlong Mon', 'Khlong Chak Phra', 'Khlong Bang Ramat', 'Khlong Bang Chueak Nang',
  'Khlong Sanam Chai', 'Thawi Watthana Canal', 'Khlong Maha Sawat',
  'Khlong Chuat Bang Chak', 'Khlong Phra Phimon', 'Khlong Ratchamontri'];

const chainMark = { junction: '=', 'T-junction': '-T', 'CROSSING(mid)': '×X×', '?': '?' };

for (const side of [['=== EAST BANK ===', EAST], ['=== WEST (THONBURI) BANK ===', WEST]]) {
  console.log('\n' + side[0]);
  for (const key of side[1]) {
    if (!byKey.has(key)) { console.log(`\n# ${key}: NOT IN DATA`); continue; }
    const f = byKey.get(key);
    console.log(`\n# ${key} [${f.properties.length_km} km]  (${f.properties.name_th || '—'})`);
    const nbs = [...(adj[key] || [])].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    for (const nb of nbs) {
      const { pt, da, db, note } = linkType(key, nb);
      const j = pt ? `@ ${pt[1].toFixed(4)},${pt[0].toFixed(4)} (d ${m(da)}/${m(db)}m)` : '';
      console.log(`   ${chainMark[note]} ${nameOf(nb)}${byKey.has(nb) ? '' : ' [missing!]'}  ${j}  [${note}]`);
    }
    if (!nbs.length) console.log('   (no links)');
    const chain = appTrace(key);
    if (chain) console.log('   APP TRACE: ' + chain.map(k => nameOf(k)).join(' -> '));
    else console.log('   APP TRACE: isolated');
  }
}
