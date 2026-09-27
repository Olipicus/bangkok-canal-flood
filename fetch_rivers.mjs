// Fetch the main rivers (Chao Phraya, Tha Chin, Bang Pakong) from Overpass and
// merge into data/raw_river.json so the build gets real outflow destinations for
// the west (Tha Chin) and east (Bang Pakong) canal networks, not just the Chao Phraya.
// Usage: node fetch_rivers.mjs
import fs from 'fs';

const BBOX = '13.20,99.80,14.45,101.40'; // S,W,N,E — covers all three rivers down to their mouths
const QUERY = `[out:json][timeout:120];
way["waterway"="river"]["name"~"แม่น้ำเจ้าพระยา|แม่น้ำท่าจีน|แม่น้ำนครชัยศรี|แม่น้ำบางปะกง"](${BBOX});
out geom;`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

let fresh = null;
for (const url of ENDPOINTS) {
  try {
    console.log('fetching rivers from', url, '…');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(QUERY),
      signal: AbortSignal.timeout(150000),
    });
    if (!res.ok) { console.log('  HTTP', res.status, '— trying next endpoint'); continue; }
    fresh = await res.json();
    break;
  } catch (e) {
    console.log('  failed:', e.message, '— trying next endpoint');
  }
}
if (!fresh) { console.error('all Overpass endpoints failed — keeping existing raw_river.json'); process.exit(1); }

const path = 'data/raw_river.json';
let merged = { elements: [] };
if (fs.existsSync(path)) {
  try { merged = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { /* start over */ }
}
const byId = new Map(merged.elements.map(e => [e.id, e]));
let added = 0, updated = 0;
for (const el of fresh.elements) {
  if (!byId.has(el.id)) { added++; byId.set(el.id, el); }
  else { byId.set(el.id, el); updated++; }
}
merged.elements = [...byId.values()];
fs.writeFileSync(path, JSON.stringify(merged));
const names = {};
for (const e of merged.elements) {
  if (e.type !== 'way') continue;
  const n = e.tags?.name || '(unnamed)';
  names[n] = (names[n] || 0) + 1;
}
console.log('added', added, 'ways, refreshed', updated, '— raw_river.json now:');
for (const [n, c] of Object.entries(names)) console.log(' ', n, '×', c);
