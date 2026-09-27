// Audit: compare the app's BFS drainage trace (app.js computeTrace) against a
// geographically optimal route (Dijkstra with along-canal distances) for every
// canal. Flags canals whose water is routed out the wrong way.
// Usage: node audit_trace.mjs
import fs from 'fs';

global.window = {};
eval(fs.readFileSync('data/canals_data.js', 'utf8'));
const canals = window.CANALS_DATA.features;
const graph = window.CANAL_GRAPH || { adj: {}, river: [], linkPts: {} };
const riverSet = new Set(graph.river);
const keyToFeature = new Map();
for (const f of canals) keyToFeature.set(f.properties.key || f.properties.name, f);
const adj = graph.adj;
const linkPts = graph.linkPts || {};

// ---- app.js replicas ----
function riverDistV(lat, lon) { // vertex-based, exactly as app.js
  let best = Infinity;
  for (const line of window.RIVER_LINES || [])
    for (const [x, y] of line) best = Math.min(best, Math.hypot(x - lon, y - lat));
  return best;
}
const hav = (a, b) => {
  const rad = Math.PI / 180;
  const q = Math.sin((b[1] - a[1]) * rad / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(q));
};
const linkPt = (a, b) => linkPts[a < b ? a + '|' + b : b + '|' + a] || null;

function appRiverPt(key) { // app.js computeTrace river endpoint choice
  const f = keyToFeature.get(key);
  let riverPt = null, bestD = Infinity;
  for (const line of f.geometry.coordinates)
    for (const pt of [line[0], line[line.length - 1]]) {
      const d = riverDistV(pt[1], pt[0]);
      if (d < bestD) { bestD = d; riverPt = [pt[1], pt[0]]; }
    }
  return riverPt;
}

function computeTraceApp(startKey) { // mirror of app.js computeTrace (Dijkstra by along-canal km)
  if (riverSet.has(startKey)) {
    return { pathKeys: [startKey], exit: startKey, riverPt: appRiverPt(startKey) };
  }
  const opt = computeTraceOpt(startKey);
  return opt ? { pathKeys: opt.pathKeys, exit: opt.exit, riverPt: opt.riverPt } : null;
}

// ---- along-canal distance machinery ----
// per canal: lines with cumulative vertex distance; junctions with nearest-vertex cum per line
const canalGeom = new Map();
for (const f of canals) {
  const key = f.properties.key || f.properties.name;
  const lines = f.geometry.coordinates.map(line => {
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + hav(line[i - 1], line[i]));
    return { pts: line, cum };
  });
  canalGeom.set(key, { lines });
}
// junctions per canal: [{pt, other}]
const canalJunctions = new Map();
function juncs(key) {
  if (!canalJunctions.has(key)) canalJunctions.set(key, []);
  return canalJunctions.get(key);
}
for (const [pk] of Object.entries(linkPts)) {
  const [a, b] = pk.split('|');
  if (!keyToFeature.has(a) || !keyToFeature.has(b)) continue;
  const pt = linkPts[pk];
  juncs(a).push({ pt, other: b });
  juncs(b).push({ pt, other: a });
}

function nearestCum(key, pt) { // per line: nearest vertex cum distance
  const g = canalGeom.get(key);
  return g.lines.map(l => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < l.pts.length; i++) {
      const d = Math.hypot(l.pts[i][0] - pt[0], l.pts[i][1] - pt[1]);
      if (d < bd) { bd = d; bi = i; }
    }
    return { d: bd, cum: l.cum[bi] };
  });
}
const alongMemo = new Map();
function alongDist(key, p, q) { // approx along-canal km between two junction points
  const kk = key + '|' + p.join(',') + '|' + q.join(',');
  if (alongMemo.has(kk)) return alongMemo.get(kk);
  const cp = nearestCum(key, p), cq = nearestCum(key, q);
  let best = Infinity;
  for (let i = 0; i < cp.length; i++) {
    if (cp[i].d < 0.004 && cq[i].d < 0.004) best = Math.min(best, Math.abs(cp[i].cum - cq[i].cum));
  }
  if (!isFinite(best)) best = hav(p, q); // different lines: straight-line fallback
  alongMemo.set(kk, best);
  return best;
}

// ---- Dijkstra over (canal, junction) states ----
function computeTraceOpt(startKey) {
  const jOf = key => juncs(key);
  const riverEnd = new Map(); // key -> riverPt (app replica)
  const riverEndOf = key => {
    if (!riverEnd.has(key)) riverEnd.set(key, appRiverPt(key));
    return riverEnd.get(key);
  };
  const dist = new Map(), prev = new Map();
  let exitKey = null;
  // tiny binary heap
  const heap = [];
  const push = (c, v) => { heap.push([c, v]); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let i = 0;
      for (;;) { let l = 2*i+1, r = l+1, m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top; };
  const sk = (key, ji) => key + '#' + ji;
  const sj = startKey;
  jOf(sj).forEach((j, ji) => { dist.set(sk(sj, ji), 0); prev.set(sk(sj, ji), null); push(0, sk(sj, ji)); });
  while (heap.length) {
    const [d, s] = pop();
    if (d > (dist.get(s) ?? Infinity)) continue;
    if (s === '__EXIT__') { // optimal total route popped: reconstruct
      const path = [];
      for (let cur = prev.get('__EXIT__'); cur; cur = prev.get(cur)) path.unshift(cur.split('#')[0]);
      return { pathKeys: [...new Set(path)], exit: exitKey, riverPt: riverEndOf(exitKey), cost: d };
    }
    const hash = s.lastIndexOf('#');
    const key = s.slice(0, hash), ji = +s.slice(hash + 1);
    if (riverSet.has(key)) { // candidate exit: add final-leg edge, keep searching
      const rp = riverEndOf(key);
      const total = d + alongDist(key, jOf(key)[ji].pt, [rp[1], rp[0]]);
      if (total < (dist.get('__EXIT__') ?? Infinity)) {
        dist.set('__EXIT__', total); prev.set('__EXIT__', s); exitKey = key; push(total, '__EXIT__');
      }
    }
    const here = jOf(key)[ji].pt;
    // cross into neighbor canals sharing this junction point (0 cost)
    for (const nb of adj[key] || []) {
      const nj = juncs(nb);
      for (let q = 0; q < nj.length; q++) {
        if (nj[q].other !== key) continue;
        if (Math.hypot(nj[q].pt[0] - here[0], nj[q].pt[1] - here[1]) > 0.00005) continue;
        const cs = sk(nb, q);
        if (d < (dist.get(cs) ?? Infinity)) { dist.set(cs, d); prev.set(cs, s); push(d, cs); }
      }
    }
    // travel within this canal to its other junctions
    for (let q = 0; q < jOf(key).length; q++) {
      if (q === ji) continue;
      const d2 = d + alongDist(key, here, jOf(key)[q].pt);
      const ns = sk(key, q);
      if (d2 < (dist.get(ns) ?? Infinity)) { dist.set(ns, d2); prev.set(ns, s); push(d2, ns); }
    }
  }
  return null;
}

// water-route km for a given pathKeys chain (same estimator for both)
function chainKm(pathKeys, riverPt) {
  let km = 0;
  for (let i = 1; i < pathKeys.length; i++) {
    const jp = linkPt(pathKeys[i - 1], pathKeys[i]);
    const jn = i + 1 < pathKeys.length ? linkPt(pathKeys[i], pathKeys[i + 1]) : [riverPt[1], riverPt[0]];
    if (!jp || !jn) return NaN;
    km += alongDist(pathKeys[i], jp, jn);
  }
  return km;
}

// river km to the Gulf for a contact point (app.js riverPathDown replica, cached)
const riverLines = (window.RIVER_LINES || []).filter(l => l.length >= 2);
const rvAdj = Array.from({ length: riverLines.length }, () => []);
for (let i = 0; i < riverLines.length; i++)
  for (let j = i + 1; j < riverLines.length; j++) {
    const a = [riverLines[i][0], riverLines[i][riverLines[i].length - 1]];
    const b = [riverLines[j][0], riverLines[j][riverLines[j].length - 1]];
    if (a.some(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.0008))) { rvAdj[i].push(j); rvAdj[j].push(i); }
  }
let mouthIdx = -1, mouthLat = Infinity, MOUTH = null;
riverLines.forEach((l, i) => { for (const p of l) if (p[1] < mouthLat) { mouthLat = p[1]; mouthIdx = i; MOUTH = p; } });
const seaKmCache = new Map();
function seaKm(riverPt) {
  const k = riverPt.map(v => v.toFixed(4)).join(',');
  if (seaKmCache.has(k)) return seaKmCache.get(k);
  let startIdx = -1, bestD = Infinity;
  riverLines.forEach((l, i) => { for (const p of l) {
    const d = Math.hypot(p[0] - riverPt[1], p[1] - riverPt[0]);
    if (d < bestD) { bestD = d; startIdx = i; } } });
  const prev = new Map([[startIdx, null]]); const q = [startIdx];
  while (q.length) { const cur = q.shift(); if (cur === mouthIdx) break;
    for (const nb of rvAdj[cur]) if (!prev.has(nb)) { prev.set(nb, cur); q.push(nb); } }
  let km = null;
  if (prev.has(mouthIdx)) {
    const chain = []; for (let cur = mouthIdx; cur !== null; cur = prev.get(cur)) chain.unshift(cur);
    const pts = [[riverPt[0], riverPt[1]]]; let last = [riverPt[1], riverPt[0]];
    for (const ci of chain) {
      const line = riverLines[ci];
      const head = Math.hypot(line[0][0] - last[0], line[0][1] - last[1]);
      const tail = Math.hypot(line[line.length - 1][0] - last[0], line[line.length - 1][1] - last[1]);
      const o = head < tail ? line : [...line].reverse();
      for (let m = pts.length === 1 ? 0 : 1; m < o.length; m++) pts.push([o[m][1], o[m][0]]);
      last = o[o.length - 1];
    }
    pts.push([MOUTH[1], MOUTH[0]]);
    km = 0; for (let i = 1; i < pts.length; i++) km += hav(pts[i - 1], pts[i]);
  }
  seaKmCache.set(k, km);
  return km;
}

// ---- run the audit over every canal ----
const CURATED = ['saen saep','phadung krung kasem','bang sue','prapa','bang bua','prem prachakon',
  'lat phrao','hua mak','phra khanong','chong nonsi','sathon','bangkok yai','bangkok noi','mon',
  'phasi charoen','sanam chai','chak phra','bang ramat','bang chueak nang','thawi watthana',
  'lam phak chi','khi suea yai','lam pla thio','khu bon','huai khwang','rop krung','khu mueang doem',
  'chuat bang chak','bang phut','maha sawat','om non','bang kapi'];
const isCurated = key => CURATED.some(m => (keyToFeature.get(key)?.properties.name || '').toLowerCase().includes(m));

let reachable = 0, isolated = 0, sameExit = 0, diffExit = 0;
const wrong = [], curatedWrong = [];
let selfExit = 0;

for (const f of canals) {
  const key = f.properties.key || f.properties.name;
  const bfs = computeTraceApp(key); // app trace (Dijkstra mirror)
  if (!bfs) { isolated++; continue; }
  reachable++;
  if (bfs.pathKeys.length === 1) selfExit++;
  const opt = computeTraceOpt(key);
  if (!opt) { wrong.push({ key, why: 'opt-search failed' }); continue; }
  const kmBFS = chainKm(bfs.pathKeys, bfs.riverPt);
  const kmOpt = opt.cost;
  const seaBFS = seaKm(bfs.riverPt), seaOpt = seaKm(opt.riverPt);
  const extra = isFinite(kmBFS) && isFinite(kmOpt) ? kmBFS - kmOpt : NaN;
  if (bfs.exit === opt.exit) { sameExit++; continue; }
  diffExit++;
  const rec = { key, name: keyToFeature.get(key).properties.name, curated: isCurated(key),
    exitBFS: bfs.exit, exitOpt: opt.exit,
    kmBFS: +kmBFS.toFixed(1), kmOpt: +kmOpt.toFixed(1), extra: +extra.toFixed(1),
    seaBFS: seaBFS && +seaBFS.toFixed(0), seaOpt: seaOpt && +seaOpt.toFixed(0) };
  wrong.push(rec);
  if (rec.curated) curatedWrong.push(rec);
}

wrong.sort((a, b) => (b.extra || 0) - (a.extra || 0));
const big = wrong.filter(r => (r.extra || 0) > 2);

console.log('=== network-wide audit (app BFS vs geographically optimal exit) ===');
console.log('canals total:', canals.length, '| reachable:', reachable, '| isolated:', isolated);
console.log('exits own canal (river-touching start):', selfExit);
console.log('same exit canal chosen:', sameExit, '| different exit canal:', diffExit);
console.log('different exit AND >=2 km longer route:', big.length);
const sev = wrong.filter(r => (r.extra || 0) >= 10);
console.log('...and >=10 km longer route (severe):', sev.length);
console.log('curated corridors flagged >=2 km:', curatedWrong.filter(r => r.extra >= 2).length, '/', CURATED.length);
console.log();
console.log('=== curated (bold, reviewed) canals with a different/wrong exit ===');
for (const r of curatedWrong.sort((a,b)=>(b.extra||0)-(a.extra||0)))
  console.log(`${r.name}\n   app: ${r.exitBFS} (route ${r.kmBFS} km, sea ${r.seaBFS} km)\n   opt: ${r.exitOpt} (route ${r.kmOpt} km, sea ${r.seaOpt} km)  [+${r.extra} km]`);
console.log();
console.log('=== top 15 worst offenders (any canal, real routes only) ===');
for (const r of wrong.filter(x => x.name).slice(0, 15))
  console.log(`${r.extra} km extra | ${r.name}\n    app: ${r.exitBFS} (sea ${r.seaBFS} km)  ->  opt: ${r.exitOpt} (sea ${r.seaOpt} km)`);
