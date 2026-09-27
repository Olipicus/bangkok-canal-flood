// Build clean canal GeoJSON + JS bundle from raw Overpass data.
// Usage: node build_data.mjs
import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('data/raw_overpass.json', 'utf8'));
const rawStruct = JSON.parse(fs.readFileSync('data/raw_structures.json', 'utf8'));

// ---------- helpers ----------
const THAI = /[\u0E00-\u0E7F]/;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]); // degrees (lon,lat)

function lineLength(coords) {
  const R = 6371000;
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1], [lon2, lat2] = coords[i];
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    sum += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return sum;
}

// Douglas-Peucker simplification
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const [x1, y1] = points[s], [x2, y2] = points[e];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - x1, py - y1);
      else d = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.sqrt(len2);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = true; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

// ---------- curated flood-risk table ----------
// risk: 3=high 2=medium 1=low ; type: flash | riverine | tidal | mixed
// Optional 6th element: a [latMin, latMax, lonMin, lonMax] box the canal's
// centroid must fall inside — guards against the substring matching the wrong
// canal (several khlong names repeat across provinces).
const CURATED = [
  // [name match, risk, type, note EN, note TH, [box]?]
  ['saen saep', 2, 'flash', 'Main east–west drainage artery (72 km) with no fixed flow direction: water exits two ways — west through the city-end gate near Phan Fa Lilat into the old-town moats and the Chao Phraya, and east onward via Khlong Bang Khanak to the Bang Pakong River. Flash floods hit Phetchaburi Rd when rain outpaces pumping; in 2011 the canal took the northern push (the Sam Wa gate episode), and in Sept 2026 floodwater was drawn to Phra Khanong pumping station for discharge.',
    'เส้นทางระบายน้ำหลักในแนวตะวันออก–ตะวันตก (72 กม.) ไม่มีทิศไหลตายตัว — น้ำออกได้สองทาง: ตะวันตกผ่านประตูต้นคลองฝั่งเมืองแถวพันฟ้าลีลาดลงคูเมืองเมืองเก่าและเจ้าพระยา ตะวันออกไหลต่อผ่านคลองบางขนากลงแม่น้ำบางปะกง ท่วมฉับพลันแนวเพชรบุรีเมื่อฝนเกินกำลังสูบ ปี 2554 รับแรงกดน้ำเหนือ (เหตุการณ์ประตูคลองสามวา) ส่วน ก.ย. 2569 มวลน้ำถูกดึงไประบายที่สถานีสูบน้ำพระโขนง'],
  ['phadung krung kasem', 2, 'mixed', 'Historic ring canal around Rattanakosin Island, gated at both ends and backed by pumps to protect the old city. Streetside flooding in 2011 as northern runoff pushed south.',
    'คลองวงแหวนประวัติศาสตร์รอบเกาะรัตนโกสินทร์ มีประตูน้ำปิดทั้งสองปลายและมีปั๊มช่วยระบายเพื่อปกป้องเมืองเก่า ปี 2554 น้ำท่วมผิวถนนเมื่อน้ำจากภาคเหนือกดลงมาทางใต้'],
  ['bang sue', 3, 'riverine', 'Northern drainage line from the Chao Phraya (Khek Khai) past the raw-water canal to join Khlong Lat Phrao. The river end is the Bang Sue pumping station + drainage tunnel (Ø5 m, ~6.4 km, designed 60 m³/s): in monsoon peaks gates open and pumps lift water into the river, while surplus continues south to Lat Phrao.',
    'เส้นระบายน้ำฝั่งเหนือ จากเจ้าพระยา (เกียกกาย) ตัดคลองประปาจนบรรจบคลองลาดพร้าว ปลายแม่น้ำมีสถานีสูบน้ำบางซื่อ + อุโมงค์ระบายใต้คลอง (Ø5 ม. ยาว ~6.4 กม. ออกแบบ 60 ลบ.ม./วินาที) — ช่วงฝนหนักเปิดประตู/เดินปั๊มระบายลงเจ้าพระยา ส่วนที่เหลือไหลต่อลงลาดพร้าว'],
  ['prapa', 3, 'riverine', 'Metropolitan Waterworks raw-water canal from Ayutthaya. Critical in 2011: massive sandbagging along Vibhavadi kept floodwater out of the tapwater supply.',
    'คลองส่งน้ำดิบของการประปานครหลวงจากอยุธยา จุดวิกฤตปี 2554: การกอดกระสอบทรายตลอดถนนวิภาวดีช่วยกันน้ำท่วมไม่ให้เข้าสู่ระบบประปา',
    [13.79, 14.06, 100.50, 100.60]], // east side only — the name also matches the western raw-water canal
  ['prapa tawan tok', 2, 'riverine', 'Western raw-water canal carrying river water across the Tha Chin lowlands on the Nakhon Pathom / Samut Sakhon side; its gates matter for the western supply when the north floods.',
    'คลองส่งน้ำดิบฝั่งตะวันตก ลำเลียงน้ำจากแม่น้ำข้ามที่ลุ่มท่าจีนฝั่งนครปฐม–สมุทรสาคร ประตูน้ำที่นี่สำคัญต่อประปาฝั่งตะวันตกเวลาน้ำหลากจากเหนือ'],
  ['bang bua', 3, 'riverine', 'Drains Bang Khen / Lak Si lowlands past Kasetsart University. Heavily affected in 2011; widened with retention areas afterwards.',
    'ระบายน้ำจากที่ลุ่มบางเขน / หลักสี่ ผ่านมหาวิทยาลัยเกษตรศาสตร์ ได้รับผลกระทบหนักปี 2554 ต่อมาขุดขยายคู่กับพื้นที่กักเก็บน้ำ',
    [13.82, 13.88, 100.55, 100.62]], // not Bang Bua Thong (Nonthaburi)
  ['prem prachakon', 2, 'riverine', 'Rama V-era canal running 50.8 km from the old-city ring canal up to the Chao Phraya at Bang Pa-in — the north–south spine of the eastern bank. In flood seasons northern water pushes down it toward Bangkok; city rain drains southward into the Bang Sue / Lat Phrao network and on to Saen Saep.',
    'คลองสมัยรัชกาลที่ 5 ยาว 50.8 กม. จากคลองผดุงกรุงเกษมขึ้นไปออกเจ้าพระยาที่บางปะอิน เป็นแกนเหนือ–ใต้ของฝั่งตะวันออก ฤดูน้ำหลากน้ำเหนือกดลงใต้เข้าสู่กรุงเทพฯ ตามแนวนี้ ส่วนน้ำฝนของเมืองระบายลงใต้เข้าสายบางซื่อ/ลาดพร้าว ต่อไปแสนแสบและปั๊ม'],
  ['lat phrao', 2, 'flash', 'Urban drainage canal behind Lat Phrao Rd. Rain from 8 northern districts flows south into Khlong Saen Saep, then through the Rama IX drainage tunnel ("the city\'s navel") to Phra Khanong pumping station. A model BMA "Kaem Ling" canal — water is held in the channel at high tide and released at low tide; surrounding streets flood chronically when the canal hits capacity.',
    'คลองระบายน้ำเมืองหลังถนนลาดพร้าว น้ำฝน 8 เขตฝั่งเหนือไหลลงใต้เข้าคลองแสนแสบ ต่อผ่านอุโมงค์ระบายน้ำราม 9 ("สะดือระบายน้ำของกรุงเทพฯ") สู่สถานีสูบน้ำพระโขนง เป็นคลองแก้มลิงต้นแบบของ กทม. — กักน้ำช่วงน้ำขึ้น ระบายช่วงน้ำลง ถนนโดยรอบท่วมเรื้อรังเมื่อคลองเต็มกำลัง'],
  ['hua mak', 3, 'flash', "Bang Kapi's chronic flash-flood corridor; short intense storms overwhelm drainage here almost every rainy season.",
    'ทางเดินน้ำท่วมฉับพลันเรื้อรังของบางกะปิ พายุฝนตกหนักช่วงสั้น ๆ ท่วมระบบระบายน้ำที่นี่เกือบทุกฤดูฝน'],
  ['phra khanong', 3, 'mixed', 'Main Sukhumvit-side drainage — the collection sump of the eastern drainage cone. Water flows toward the mouth, where the Lat Pho 8-gate barrage and Phra Khanong pumping station (173 m³/s, the city\'s largest) decide the outflow: gates shut against high tide while pumps lift water into the river. The far end continues as Khlong Prawet Burirom toward the Bang Pakong River.',
    'ทางระบายน้ำหลักฝั่งสุขุมวิท — "ปลายท่อรวม" ของกรวยระบายฝั่งตะวันออก น้ำไหลเข้าหาปากคลองซึ่งคุมด้วยประตูระบายน้ำคลองลัดโพธิ์ 8 ประตู และสถานีสูบน้ำพระโขนง (173 ลบ.ม./วินาที ใหญ่สุดใน กทม.) — ช่วงน้ำทะเลหนุนปิดประตูแล้วปั๊มสูบออกแม่น้ำ ปลายตะวันออกไหลต่อเป็นคลองประเวศบุรีรมย์สู่บางปะกง'],
  ['chong nonsi', 3, 'flash', 'Sathorn / Silom business-district drainage; Narathiwas and Chan roads flood in heavy rain despite pumping upgrades.',
    'ทางระบายน้ำย่านธุรกิจสาทร / สีลม ถนนนราธิวาสและถนนจันทน์ท่วมเวลาฝนหนักแม้ปรับปรุงปั๊มแล้ว'],
  ['sathon', 3, 'tidal', 'Runs between the Sathon roads to the river. Sandbagged during 2011; affected by high-tide backflow — mouth gates plus pumps.',
    'ไหลระหว่างถนนสาทรลงสู่แม่น้ำ ปี 2554 กอดกระสอบทรายกันไว้ ได้รับผลจากน้ำทะเลหนุนย้อน — ใช้ประตูปากคลองร่วมกับปั๊ม'],
  ['bangkok yai', 3, 'tidal', 'This is the old Chao Phraya itself — a former river arm open at both ends, from the Wat Arun mouth to the Khlong Mon four-way junction. Real river water flows in and out both ways with the tide; no dedicated gates are documented on the main line. The district flooded from the river in 2011.',
    'นี่คือแม่น้ำเจ้าพระยาตัวเก่า — แขนน้ำเดิมที่ปากเปิดสองปลาย จากปากวัดอรุณฯ ถึงสี่แยกคลองมอญ น้ำแม่น้ำไหลเข้าออกสองทิศตามน้ำขึ้นน้ำลง ไม่พบประตูน้ำเฉพาะบนตัวคลองหลัก เขตนี้ถูกน้ำแม่น้ำท่วมปี 2554'],
  ['bangkok noi', 2, 'tidal', 'Curving river arm on the Thonburi side with tidal exchange; riverside communities flooded in 2011.',
    'ลำคลองโค้งอ้อมฝั่งธนบุรี รับน้ำขึ้นน้ำลงจากแม่น้ำ ชุมชนริมน้ำถูกท่วมปี 2554'],
  ['mon', 2, 'tidal', 'Mon-community canal network in Bangkok Noi; tidal flooding at high water and 2011 seepage.',
    'เครือข่ายคลองชุมชนมอญในบางกอกน้อย น้ำท่วมตามน้ำขึ้นและน้ำซึมผ่านในปี 2554',
    [13.72, 13.78, 100.44, 100.50]], // "Mon" also appears in Ratchamontri / Phra Phimon etc.
  ['phasi charoen', 3, 'mixed', 'Long Thonburi waterway linking Khlong Bangkok Yai (Chao Phraya side) with the Tha Chin River at Krathum Baen, Samut Sakhon. The flow direction is not fixed — the outer/inner Phasi Charoen gates at the two ends plus the tide decide whether water drains west to the Tha Chin or east to the Chao Phraya. The district flooded badly in 2011.',
    'ทางน้ำธนบุรีสายยาว เชื่อมคลองบางกอกใหญ่ (ฝั่งเจ้าพระยา) กับแม่น้ำท่าจีนที่กระทุ่มแบน สมุทรสาคร ทิศไหลไม่ตายตัว — ประตูน้ำภาษีเจริญตอนนอก/ตอนในที่สองปลายคลองกับจังหวะน้ำขึ้นน้ำลงเป็นตัวตัดสินว่าระบายตะวันตกออกท่าจีนหรือตะวันออกออกเจ้าพระยา เขตนี้ท่วมหนักปี 2554'],
  // The named feature in OSM is the Samut Sakhon canal (สนามชัย สาคร), not the
  // short Thonburi canal; the box keeps the note off the wrong canal until the
  // real one is in the fetched network.
  ['sanam chai', 3, 'mixed', 'Ayutthaya-era waterway continuing from Khlong Dan (the Bangkok Yai line) south to the Tha Chin River at Mahachai — an old shortcut past the Chao Phraya mouth. The net flow runs both ways with the tide of two rivers: south out to the Tha Chin, north up via Khlong Dan to Bangkok Yai and the Chao Phraya.',
    'คลองโบราณสมัยอยุธยา ต่อจากคลองด่าน (สายบางกอกใหญ่) ลงใต้ออกแม่น้ำท่าจีนที่มหาชัย — เส้นลัดเลี่ยงปากเจ้าพระยาเดิม ทิศสุทธิสองทิศตามน้ำขึ้นน้ำลงของสองแม่น้ำ: ใต้ออกท่าจีน เหนือผ่านคลองด่านขึ้นบางกอกใหญ่สู่เจ้าพระยา',
    [13.71, 13.76, 100.45, 100.50]],
  ['chak phra', 3, 'riverine', 'Middle reach of the old Chao Phraya arm on the Thonburi side: it branches off Khlong Bangkok Noi at Wat Suwannakhiri and ends at the Khlong Mon × Bangkok Yai four-way junction — no direct river mouth of its own. River water moves two ways with the tide; in 2011 it backed deep into Taling Chan communities.',
    'ช่วงกลางของแขนน้ำเจ้าพระยาเก่าฝั่งธนบุรี แยกจากคลองบางกอกน้อยที่วัดสุวรรณคีรี ไปจบที่สี่แยกคลองมอญ×บางกอกใหญ่ — ไม่มีปากตรงสู่แม่น้ำของตัวเอง น้ำแม่น้ำไหลสองทิศตามน้ำขึ้นน้ำลง ปี 2554 น้ำย้อนลึกเข้าชุมชนตลิ่งชัน'],
  ['bang ramat', 3, 'riverine', 'Taling Chan; flooded from the river in 2011; gate and pump defenses added since.',
    'อยู่ที่ตลิ่งชัน ท่วมจากแม่น้ำปี 2554 ต่อมาเพิ่มประตูน้ำและปั๊มเป็นแนวป้องกัน'],
  ['bang chueak nang', 3, 'mixed', 'Cross-canal linking the Thonburi systems; flooded in 2011.',
    'คลองเชื่อมขวางเชื่อมระบบคลองฝั่งธนบุรีเข้าด้วยกัน ท่วมปี 2554'],
  ['thawi watthana', 3, 'riverine', 'Western floodway and BMA "Kaem Ling" retention basin: gates hold floodwater and release it at low tide — key to defending inner Thonburi since 2011. Originally dug in 1878 "to draw Tha Chin water flowing south" to feed the Thonburi canals; today the flow direction follows the BMA\'s gate commands.',
    'ทางน้ำฝั่งตะวันตกและแก้มลิงของ กทม. — ประตูกักน้ำท่วมไว้แล้วระบายเวลาน้ำลง เป็นกุญแจปกป้องธนบุรีด้านในตั้งแต่ปี 2554 เดิมขุด พ.ศ. 2421 เพื่อ "ชักน้ำจากแม่น้ำท่าจีนให้ไหลลงทิศใต้" เลี้ยงคลองฝั่งธนบุรี ปัจจุบันทิศไหลตามคำสั่งเปิด-ปิดประตูของ กทม.'],
  ['lam phak chi', 3, 'riverine', 'Low-lying Lat Krabang farmland canal in the eastern flood-retention zone used in 2011; still floods in heavy monsoon.',
    'คลองที่ลุ่มเกษตรกรรมลาดกระบังในเขตกักเก็บน้ำฝั่งตะวันออกที่ใช้งานปี 2554 ยังท่วมเวลามรสุมตกหนัก'],
  ['khi suea yai', 3, 'riverine', 'Nong Chok agricultural lowland. Eastern Bangkok is deliberately used as flood detention in extreme years such as 2011.',
    'พื้นที่เกษตรที่ลุ่มหนองจอก กรุงเทพฯ ฝั่งตะวันออกถูกใช้เป็นพื้นที่รับน้ำท่วมอย่างตั้งใจในปีที่รุนแรงอย่าง 2554'],
  ['lam pla thio', 3, 'riverine', 'Lat Krabang lowland canal; part of the eastern flood-retention landscape.',
    'คลองที่ลุ่มลาดกระบัง เป็นส่วนหนึ่งของผังรับน้ำท่วมฝั่งตะวันออก'],
  ['khu bon', 2, 'flash', 'Bang Kapi side drainage; local flash floods in intense monsoon rain.',
    'ทางระบายน้ำฝั่งบางกะปิ เกิดน้ำท่วมฉับพลันเฉพาะพื้นที่เวลามรสุมตกหนัก'],
  ['huai khwang', 2, 'flash', 'Dense inner-district drainage; streets around Ratchadaphisek flood in monsoon peaks.',
    'ทางระบายน้ำย่านชุมชนหนาแน่นด้านใน ถนนแถวรัชดาภิเษกท่วมช่วงมรสุมพีค'],
  ['rop krung', 2, 'flash', 'Old-city moat ring; the Bang Lamphu corner has flash-flood history. Levels managed by gates.',
    'คูเมืองวงแหวนเมืองเก่า มุมบางลำพูมีประวัติน้ำท่วมฉับพลัน ระดับน้ำควบคุมด้วยประตูน้ำ'],
  ['khu mueang doem', 1, 'flash', 'Inner moat around the Grand Palace area; fully managed, low risk. Since 2018 a royal-initiative project has diverted Chao Phraya water into the moat to keep it circulating.',
    'คูเมืองชั้นในรอบพระบรมมหาราชวัง ควบคุมได้เต็มที่ ความเสี่ยงต่ำ ตั้งแต่ปี 2561 มีโครงการอันเนื่องจากพระราชดำริ "ผันน้ำจากแม่น้ำเจ้าพระยาเข้าคลอง" เพื่อหมุนเวียนน้ำ'],
  ['chuat bang chak', 2, 'flash', 'Short cut-canal on the Rama III / Phra Khanong side; drains a dense inner catchment toward Khlong Phra Khanong — a chronic flash-flood spot in monsoon peaks.',
    'คลองลัดสั้น ๆ ฝั่งพระราม 3 / พระโขนง ระบายน้ำย่านชุมชนแน่นลงสู่คลองพระโขนง จุดท่วมฉับพลันเรื้อรังช่วงมรสุมพีค'],
  ['bang phut', 2, 'tidal', 'Pak Kret-side canal (Nonthaburi fringe); tidal influence from the river.',
    'คลองฝั่งปากเกร็ด (ชายเขตนนทบุรี) รับอิทธิพลน้ำขึ้นน้ำลงจากแม่น้ำ',
    [13.88, 13.93, 100.53, 100.58]], // not the Rangsit-area Khlong Bang Phut 1
  ['maha sawat', 2, 'mixed', 'Historic Rama V irrigation canal linking the Tha Chin lowlands to the western Bangkok network. Irrigation gates at both heads — Chimpli on the Chao Phraya side, Maha Sawat on the Tha Chin side — manage the exchange between the two rivers as part of the flood-relief landscape on the city\'s western approach.',
    'คลองชลประทานสมัยรัชกาลที่ 5 เชื่อมที่ลุ่มท่าจีนเข้ากับเครือข่ายคลองฝั่งตะวันตกของกรุงเทพฯ หัวคลองสองปลายมีประตูน้ำฉิมพลี (ฝั่งเจ้าพระยา) และประตูน้ำมหาสวัสดิ์ (ฝั่งท่าจีน) ที่การชลประทานบริหาร — ทิศไหลระหว่างสองแม่น้ำตามการทำงานชลประทาน เป็นส่วนหนึ่งของระบบบรรเทาน้ำท่วมทางเข้าเมืองฝั่งตะวันตก'],
  ['om non', 2, 'tidal', 'Nonthaburi-side canal along the river; tidal exchange dominates, with riverside flooding history in high-water years.',
    'คลองขนานแม่น้ำฝั่งนนทบุรี พึ่งการแลกเปลี่ยนน้ำขึ้นน้ำลงเป็นหลัก มีประวัติชุมชนริมน้ำถูกท่วมในปีน้ำท่าสูง'],
  ['bang kapi', 2, 'flash', 'Surviving stub of the old Bang Kapi canal: it branches off Khlong Saen Saep and runs north to join Khlong Sam Sen, exchanging water with Saen Saep at the junction (the BMA canal register documents the northward flow). The dense Phetchaburi-side streets still flash-flood when storms outpace pumping.',
    'คลองบางกะปิเดิมที่เหลือช่วงแถวประตูน้ำ แยกจากคลองแสนแสบไหลขึ้นเหนือบรรจบคลองสามเสน — รับ-จ่ายน้ำกับแสนแสบ แต่ทิศไหลตามทำเนียบคลอง กทม. คือขึ้นเหนือ ย่านเพชรบุรีที่อาคารแน่นยังท่วมฉับพลันเมื่อฝนจัดเกินกำลังสูบ'],
];

// ---------- build canals ----------
const groups = new Map();
for (const w of raw.elements) {
  if (w.type !== 'way' || !w.geometry || w.geometry.length < 2) continue;
  const t = w.tags || {};
  // strip invisible chars (zero-width, BOM) + trim — OSM names sometimes carry them
  const norm = s => s ? s.replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : null;
  const en0 = t['name:en'] || (t.name && !THAI.test(t.name) ? t.name : null);
  const th0 = THAI.test(t.name || '') ? t.name : (t['name:th'] || null);
  const nameEn = norm(en0);
  const nameTh = norm(th0);
  if (!nameEn && !nameTh) continue; // drop unnamed noise
  const key = nameEn || nameTh;
  if (!groups.has(key)) groups.set(key, []);
  const coords = w.geometry.map(g => [g.lon, g.lat]);
  groups.get(key).push({ coords, nameEn, nameTh, waterway: t.waterway || 'canal', len: lineLength(coords) });
}

// Cluster a name group's lines into spatially contiguous components. Khlong
// names repeat across provinces (e.g. two different "Khlong Bang Toei" in
// Bangkok and Pathum Thani); merging them into one feature let a river touch
// in one province claim the whole feature, so traces could exit tens of km
// away from the canal the user clicked.
function clusterLines(lineData) {
  const EPS = 0.00027; // ~30 m endpoint gap keeps parts in one component
  const parent = lineData.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const eps = lineData.map(l => [l.pts[0], l.pts[l.pts.length - 1]]);
  for (let i = 0; i < lineData.length; i++)
    for (let j = i + 1; j < lineData.length; j++)
      for (const a of eps[i]) for (const b of eps[j])
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPS) parent[find(i)] = find(j);
  const comps = new Map();
  lineData.forEach((l, i) => {
    const r = find(i);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(l);
  });
  // largest component keeps the plain key; the rest get " #2", " #3", …
  return [...comps.values()].sort((a, b) =>
    b.reduce((s, l) => s + l.len, 0) - a.reduce((s, l) => s + l.len, 0));
}

const features = [];
const curatedHit = new Set();
for (const [key, segs] of groups) {
  const lineData = segs.map(s => ({ pts: simplify(s.coords, 0.00018), len: s.len }))
    .filter(l => l.pts.length >= 2);
  if (!lineData.length) continue;
  const comps = clusterLines(lineData);

  for (const [ci, lines] of comps.entries()) {
    const lenKm = lines.reduce((a, l) => a + l.len, 0) / 1000;
    const first = segs[0];
    const nameEn = first.nameEn || key;
    const nameTh = first.nameTh || null;
    const featKey = comps.length > 1 && ci > 0 ? `${key} #${ci + 1}` : key;

    // centroid decides default risk and guards curated matches
    const flat = lines.flatMap(l => l.pts);
    const centroid = flat.reduce((a, c) => [a[0] + c[0] / flat.length, a[1] + c[1] / flat.length], [0, 0]);

    // risk from curated table, else default by geography / waterway type
    let risk = null, riskType = null, note = null, noteTh = null, hitIdx = -1;
    const k = key.toLowerCase();
    for (const [rowIdx, [match, r, ty, nt, ntTh, box]] of CURATED.entries()) {
      if (!k.includes(match)) continue;
      if (box && !(centroid[1] >= box[0] && centroid[1] <= box[1] &&
                   centroid[0] >= box[2] && centroid[0] <= box[3])) continue;
      risk = r; riskType = ty; note = nt; noteTh = ntTh; hitIdx = rowIdx; break;
    }
    if (hitIdx >= 0) curatedHit.add(hitIdx);
    if (risk === null) {
      const lon = centroid[0], lat = centroid[1];
      // Main rivers (Chao Phraya, Tha Chin, …) are map context rather than
      // at-risk assets — keep them low. Every other river-TAGGED waterway is
      // just a khlong OSM happens to call `waterway=river` (old river arms,
      // eastern floodplain channels); giving them the regional default like
      // any canal — the old "tagged river → low risk" rule painted genuinely
      // flooding khlongs green.
      const mainRiver = first.waterway === 'river' &&
        (/\briver\b/i.test(nameEn) || (nameTh || '').includes('แม่น้ำ'));
      if (mainRiver) { risk = 1; riskType = 'riverine'; }
      else if (lat > 13.95) { risk = 2; riskType = 'riverine'; } // Pathum Thani / Ayutthaya side
      else if (lon > 100.62) { risk = 2; riskType = 'riverine'; }
      else if (lon < 100.47) { risk = 2; riskType = 'tidal'; }
      else { risk = 2; riskType = 'flash'; }
      note = null;
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: lines.map(l => l.pts) },
      properties: {
        key: featKey,
        name: nameEn, name_th: nameTh, waterway: first.waterway,
        length_km: Math.round(lenKm * 10) / 10,
        risk, risk_type: riskType, note, note_th: noteTh,
        curated: note !== null,
      },
    });
  }
}

// Main-river features (Chao Phraya, Tha Chin, …) are context only: they bridge
// the build-time component filter but are stripped from the graph written for
// the app, so water can never exit "through" a river node. River-tagged khlongs
// — old river arms like Bangkok Yai/Noi, Chak Phra — are real canals and stay
// full graph citizens with their own river-mouth exits.
const riverNodeKeys = new Set(features.filter(f =>
  f.properties.waterway === 'river' &&
  (/\briver\b/i.test(f.properties.name || '') || (f.properties.name_th || '').includes('แม่น้ำ'))
).map(f => f.properties.key));

features.sort((a, b) => b.properties.length_km - a.properties.length_km);
const fc = { type: 'FeatureCollection', features };
console.log(`canals: ${features.length}, total km: ${Math.round(features.reduce((a, f) => a + f.properties.length_km, 0))}`);

// ---------- structures ----------
const structs = [];
for (const n of rawStruct.elements) {
  if (!n.lat) continue;
  const t = n.tags || {};
  structs.push({
    name: t['name:en'] || t.name || 'Flood-control structure',
    name_th: THAI.test(t.name || '') ? t.name : null,
    kind: t.man_made === 'sluice_gate' ? 'gate' : (t.man_made === 'pumping_station' ? 'pump' : 'weir'),
    lat: n.lat, lon: n.lon, accuracy: 'exact (OSM)',
  });
}
// curated well-known points (approximate locations) — [en, th, kind, lat, lon, note EN, accuracy, note TH]
const CURATED_STRUCTS = [
  ['Khlong Saen Saep head gate', 'ประตูระบายน้ำคลองแสนแสบ (ต้นคลอง)', 'gate', 13.7520, 100.5024, 'Controls the canal head at Phan Fa Lilat, keeping canal water out of the old city moats; sandbagged in 2011.', 'approximate',
    'ควบคุมต้นคลองที่พันฟ้าลีลาด กันน้ำคลองเข้าสู่คูเมืองเก่า ปี 2554 เสริมด้วยกระสอบทราย'],
  ['Thewet gate (Khlong Phadung Krung Kasem)', 'ประตูระบายน้ำเทเวศร์', 'gate', 13.7817, 100.5073, 'North end of the old-city ring canal; pumps here lift northern runoff into the canal.', 'approximate',
    'ปลายเหนือของคลองวงแหวนเมืองเก่า ปั๊มที่นี่สูบน้ำจากภาคเหนือเข้าคลอง'],
  ['Khlong Phadung Krung Kasem river gate', 'ประตูระบายน้ำปากคลองผดุงกรุงเกษม', 'gate', 13.7256, 100.5115, 'South mouth into the Chao Phraya near Hua Lamphong; closed against high tide and river floods.', 'approximate',
    'ปากคลองฝั่งใต้ลงแม่น้ำเจ้าพระยาใกล้หัวลำโพง ปิดรับน้ำขึ้นสูงและน้ำท่วมจากแม่น้ำ'],
  ['Thawi Watthana Kaem Ling gates', 'ประตูคึ่งลม-แก้มลิงทวีวัฒนา', 'gate', 13.7830, 100.3765, 'Retention gates on the western floodway: hold floodwater, release at low tide.', 'approximate',
    'ประตูกักเก็บบนทางน้ำฝั่งตะวันตก กักน้ำท่วมไว้แล้วระบายเวลาน้ำลง'],
  ['Bang Khen raw-water pumping station', 'สถานีสูบน้ำคลองบางเขนฝั่งใต้', 'pump', null, null, 'Lifts raw water for the city supply — the line defended by sandbags in 2011.', 'from OSM',
    'สูบน้ำดิบเข้าระบบประปาของเมือง — แนวที่กอดกระสอบทรายกันไว้ปี 2554'],
  // sourced from wiki/canals/index.md "ทำเนียบประตูน้ำ" (OSM coords, 2026-09-27)
  ['Khlong Lat Pho barrage (8 gates)', 'ประตูระบายน้ำคลองลัดโพธิ์', 'gate', 13.6668, 100.5393, 'Eight gates at the Khlong Phra Khanong mouth — the main wall of the eastern drainage cone: closed against high tide and river floods while Phra Khanong pumping station (173 m³/s) lifts the water out.', 'exact (OSM)',
    '8 ประตูที่ปากคลองพระโขนง — กำแพงหลักของกรวยระบายฝั่งตะวันออก ปิดรับน้ำทะเลหนุน/น้ำท่วมจากแม่น้ำ ขณะที่สถานีสูบน้ำพระโขนง (173 ลบ.ม./วินาที) ยกน้ำออกแม่น้ำ'],
  ['Chimpli gate (Khlong Maha Sawat)', 'ประตูน้ำฉิมพลี', 'gate', 13.8024, 100.3930, 'Irrigation head gate on the Chao Phraya end of Khlong Maha Sawat. With the Maha Sawat gate on the Tha Chin side it manages the water exchange between the two rivers.', 'exact (OSM)',
    'ประตูหัวคลองมหาสวัสดิ์ฝั่งเจ้าพระยา ทำงานคู่กับประตูน้ำมหาสวัสดิ์ฝั่งท่าจีน — การชลประทานใช้บริหารทิศการแลกเปลี่ยนน้ำระหว่างสองแม่น้ำ'],
  ['Sapphawut sluice gate (Khlong Bang Sue)', 'ประตูระบายน้ำสรรพาวุธ', 'gate', 13.7977, 100.5321, 'Control gate on the lower Khlong Bang Sue line, upstream of the river mouth.', 'exact (OSM)',
    'ประตูควบคุมบนแนวคลองบางซื่อช่วงล่าง ก่อนถึงปากคลองฝั่งแม่น้ำ'],
  ['Pak Khlong Talat pumping station', 'สถานีสูบน้ำปากคลองตลาด', 'pump', 13.7422, 100.4946, 'Pump at the south mouth of the inner moat (Khlong Khu Mueang Doem) — part of the old-city circulation, including the 2018 river-water diversion project.', 'exact (OSM)',
    'ปั๊มที่ปากใต้คูเมืองเดิม (ปากคลองตลาด) ส่วนหนึ่งของวงจรหมุนเวียนน้ำเมืองเก่าและโครงการผันน้ำจากแม่น้ำปี 2561'],
  ['Krung Kasem pumping station', 'สถานีสูบน้ำกรุงเกษม', 'pump', 13.7304, 100.5141, 'Pump on the southern stretch of Khlong Phadung Krung Kasem that helps discharge the old ring canal into the Chao Phraya.', 'exact (OSM)',
    'ปั๊มช่วยระบายบนคลองผดุงกรุงเกษมช่วงใต้ ยกน้ำจากคลองวงแหวนเมืองเก่าลงเจ้าพระยา'],
  ['Klong Toey pumping station', 'สถานีสูบน้ำคลองเตย', 'pump', 13.7159, 100.5808, 'Pumping station in the Klong Toey port area on the Khlong Phra Khanong drainage line.', 'exact (OSM)',
    'สถานีสูบน้ำย่านท่าเรือคลองเตย บนแนวระบายคลองพระโขนง'],
  ['Sam Laew raw-water pumping station', 'สถานีสูบน้ำดิบสำแล', 'pump', 14.0407, 100.5564, 'Head works of the raw-water supply: pumps lift Chao Phraya water at Ayutthaya into the Prapa canal for its fixed southward run to Bangkok.', 'exact (OSM)',
    'จุดหัวของคลองส่งน้ำดิบ ปั๊มยกน้ำเจ้าพระยาที่อยุธยาเข้าคลองประปา เพื่อส่งลงใต้ตายตัวเข้ากรุงเทพฯ'],
];
for (const [en, th, kind, lat, lon, note, accuracy, noteTh] of CURATED_STRUCTS) {
  if (lat === null) continue;
  const dup = structs.some(s => Math.abs(s.lat - lat) < 0.002 && Math.abs(s.lon - lon) < 0.002);
  if (!dup) structs.push({ name: en, name_th: th, kind, lat, lon, note, accuracy, note_th: noteTh });
}
console.log('structures:', structs.length);

// ---------- connectivity: adjacency graph + river contact ----------
const riverRaw = JSON.parse(fs.readFileSync('data/raw_river.json', 'utf8'));
const riverSegs = [];
const riverLines = [];
for (const w of riverRaw.elements.filter(e => e.type === 'way' && e.geometry)) {
  const c = w.geometry.map(g => [g.lon, g.lat]);
  riverLines.push(simplify(c, 0.0005).filter(l => l.length >= 2));
  for (let i = 1; i < c.length; i++) riverSegs.push([c[i - 1], c[i]]);
}

// spatial grid of river segments for proximity queries
const RCELL = 0.002;
const segGrid = new Map();
for (const s of riverSegs) {
  const [[x1, y1], [x2, y2]] = s;
  for (let i = Math.floor(Math.min(x1, x2) / RCELL); i <= Math.floor(Math.max(x1, x2) / RCELL); i++)
    for (let j = Math.floor(Math.min(y1, y2) / RCELL); j <= Math.floor(Math.max(y1, y2) / RCELL); j++) {
      const k = i + ':' + j;
      if (!segGrid.has(k)) segGrid.set(k, []);
      segGrid.get(k).push(s);
    }
}
function ptSegDist(px, py, [a, b]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
function minRiverDist(lon, lat) {
  const cx = Math.floor(lon / RCELL), cy = Math.floor(lat / RCELL);
  let best = Infinity;
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
    const segs = segGrid.get(i + ':' + j);
    if (!segs) continue;
    for (const s of segs) best = Math.min(best, ptSegDist(lon, lat, s));
  }
  return best;
}

// endpoint index for canal-canal adjacency (~20 m tolerance)
const ECELL = 0.00018;
const epIndex = new Map();
const adj = new Map();      // group key -> Set of neighbor keys
const linkPts = new Map();  // 'a|b' (sorted) -> junction [lon,lat]
const touchesRiver = new Map();

// Rivers (incl. OSM's river-tagged old river arms like Bangkok Yai/Noi) stay in
// the features and act as bridges for the build-time component filter, but are
// stripped from the graph written for the app: water must exit at a canal mouth
// that actually touches the Chao Phraya, never "through" a river node.
for (const f of features) {
  const key = f.properties.key;
  const isRiver = riverNodeKeys.has(key);
  for (const line of f.geometry.coordinates) {
    for (const [lon, lat] of [line[0], line[line.length - 1]]) {
      if (!isRiver && minRiverDist(lon, lat) < 0.0008) touchesRiver.set(key, true); // ~80 m
      const k = Math.round(lon / ECELL) + ':' + Math.round(lat / ECELL);
      if (!epIndex.has(k)) epIndex.set(k, []);
      epIndex.get(k).push({ key, lon, lat });
    }
  }
}
for (const eps of epIndex.values()) {
  for (let i = 0; i < eps.length; i++) for (let j = i + 1; j < eps.length; j++) {
    const a = eps[i], b = eps[j];
    if (a.key === b.key) continue;
    if (Math.hypot(a.lon - b.lon, a.lat - b.lat) > ECELL * 1.5) continue;
    if (!adj.has(a.key)) adj.set(a.key, new Set());
    if (!adj.has(b.key)) adj.set(b.key, new Set());
    adj.get(a.key).add(b.key);
    adj.get(b.key).add(a.key);
    const pk = a.key < b.key ? a.key + '|' + b.key : b.key + '|' + a.key;
    if (!linkPts.has(pk)) linkPts.set(pk, [(a.lon + b.lon) / 2, (a.lat + b.lat) / 2]);
  }
}
// 3×3 neighbourhood scan (endpoints in adjacent cells within tolerance)
for (const [k, eps] of epIndex) {
  const [cx, cy] = k.split(':').map(Number);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (dx === 0 && dy === 0) continue;
    const other = epIndex.get((cx + dx) + ':' + (cy + dy));
    if (!other) continue;
    for (const a of eps) for (const b of other) {
      if (a.key === b.key) continue;
      if (Math.hypot(a.lon - b.lon, a.lat - b.lat) > ECELL * 1.5) continue;
      if (!adj.has(a.key)) adj.set(a.key, new Set());
      if (!adj.has(b.key)) adj.set(b.key, new Set());
      adj.get(a.key).add(b.key);
      adj.get(b.key).add(a.key);
      const pk = a.key < b.key ? a.key + '|' + b.key : b.key + '|' + a.key;
      if (!linkPts.has(pk)) linkPts.set(pk, [(a.lon + b.lon) / 2, (a.lat + b.lat) / 2]);
    }
  }
}

const riverKeys = [...touchesRiver].filter(([, v]) => v).map(([k]) => k);
console.log('adjacency:', adj.size, 'canals linked; touching river:', riverKeys.length);

// --- crossing detection: link canals whose lines intersect or pass within ~15 m ---
const TOL = 0.00015;
const SCELL = 0.001;
const segIndex = new Map();
let pieceId = 0;
function addSeg(key, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / 0.004));
  for (let i = 0; i < n; i++) {
    const p = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n];
    const q = [a[0] + (b[0] - a[0]) * (i + 1) / n, a[1] + (b[1] - a[1]) * (i + 1) / n];
    const piece = { id: pieceId++, key, a: p, b: q,
      x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]),
      y0: Math.min(p[1], q[1]), y1: Math.max(p[1], q[1]) };
    for (let cx = Math.floor(piece.x0 / SCELL); cx <= Math.floor(piece.x1 / SCELL); cx++)
      for (let cy = Math.floor(piece.y0 / SCELL); cy <= Math.floor(piece.y1 / SCELL); cy++) {
        const k = cx + ':' + cy;
        if (!segIndex.has(k)) segIndex.set(k, []);
        segIndex.get(k).push(piece);
      }
  }
}
for (const f of features) for (const line of f.geometry.coordinates)
  for (let i = 1; i < line.length; i++) addSeg(f.properties.key, line[i - 1], line[i]);

const orient = (ax, ay, bx, by, px, py) => Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
function segsIntersect(a, b, c, d) {
  const o1 = orient(a[0], a[1], b[0], b[1], c[0], c[1]), o2 = orient(a[0], a[1], b[0], b[1], d[0], d[1]),
        o3 = orient(c[0], c[1], d[0], d[1], a[0], a[1]), o4 = orient(c[0], c[1], d[0], d[1], b[0], b[1]);
  return o1 !== o2 && o3 !== o4;
}
function closestJoinPoint(a, b, c, d) {
  // midpoint of the closest approach between segments (approximate junction)
  let best = Infinity, bp = null;
  const consider = (p, u, v) => {
    const dd = ptSegDist(p[0], p[1], [u, v]);
    if (dd < best) {
      best = dd;
      const l2 = (v[0] - u[0]) ** 2 + (v[1] - u[1]) ** 2;
      let t = l2 ? ((p[0] - u[0]) * (v[0] - u[0]) + (p[1] - u[1]) * (v[1] - u[1])) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      bp = [[u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1])], p];
    }
  };
  consider(a, c, d); consider(b, c, d); consider(c, a, b); consider(d, a, b);
  if (!bp) return [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  return [(bp[0][0] + bp[1][0]) / 2, (bp[0][1] + bp[1][1]) / 2];
}
let crossings = 0;
for (const pieces of segIndex.values()) {
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const p = pieces[i], q = pieces[j];
    if (p.key === q.key) continue;
    if (p.x1 + TOL < q.x0 || q.x1 + TOL < p.x0 || p.y1 + TOL < q.y0 || q.y1 + TOL < p.y0) continue;
    const hit = segsIntersect(p.a, p.b, q.a, q.b) ||
      ptSegDist(p.a[0], p.a[1], [q.a, q.b]) < TOL || ptSegDist(p.b[0], p.b[1], [q.a, q.b]) < TOL ||
      ptSegDist(q.a[0], q.a[1], [p.a, p.b]) < TOL || ptSegDist(q.b[0], q.b[1], [p.a, p.b]) < TOL;
    if (!hit) continue;
    if (!adj.has(p.key)) adj.set(p.key, new Set());
    if (!adj.has(q.key)) adj.set(q.key, new Set());
    if (!adj.get(p.key).has(q.key)) crossings++;
    adj.get(p.key).add(q.key);
    adj.get(q.key).add(p.key);
    const pk = p.key < q.key ? p.key + '|' + q.key : q.key + '|' + p.key;
    if (!linkPts.has(pk)) linkPts.set(pk, closestJoinPoint(p.a, p.b, q.a, q.b));
  }
}
console.log('crossing links added:', crossings);
console.log('final adjacency:', adj.size, 'canals linked');

// ---------- keep only canals connected to the Bangkok network ----------
// The raw fetch now covers the provinces around Bangkok too; canals in the same
// connected component as a Bangkok canal are shown, the rest are dropped.
let bangkokKeys;
if (fs.existsSync('data/bangkok_keys.json')) {
  bangkokKeys = new Set(JSON.parse(fs.readFileSync('data/bangkok_keys.json', 'utf8')));
} else {
  const prev = JSON.parse(fs.readFileSync('data/canals.geojson', 'utf8'));
  bangkokKeys = new Set(prev.features.map(f => f.properties.key));
  fs.writeFileSync('data/bangkok_keys.json', JSON.stringify([...bangkokKeys]));
  console.log('bangkok key snapshot:', bangkokKeys.size);
}
const compId = new Map(); // key -> component root key
for (const seed of bangkokKeys) {
  if (compId.has(seed)) continue;
  compId.set(seed, seed);
  const q = [seed];
  while (q.length) {
    const cur = q.shift();
    for (const nb of adj.get(cur) || []) {
      if (!compId.has(nb)) { compId.set(nb, seed); q.push(nb); }
    }
  }
}
const connected = features.filter(f =>
  riverNodeKeys.has(f.properties.key) || compId.has(f.properties.key));
console.log('connected to Bangkok network:', connected.length, '/', features.length,
  '(dropped', features.length - connected.length, 'unlinked outer-province canals)');
features.length = 0;
features.push(...connected);
features.sort((a, b) => b.properties.length_km - a.properties.length_km);
const keptKeys = new Set(features.map(f => f.properties.key));
for (const k of [...adj.keys()]) if (!keptKeys.has(k) || riverNodeKeys.has(k)) adj.delete(k);
for (const [k, v] of adj) adj.set(k, new Set([...v].filter(nb => keptKeys.has(nb) && !riverNodeKeys.has(nb))));
for (const pk of [...linkPts.keys()]) {
  const [a, b] = pk.split('|');
  if (!keptKeys.has(a) || !keptKeys.has(b) || riverNodeKeys.has(a) || riverNodeKeys.has(b)) linkPts.delete(pk);
}
const riverKept = riverKeys.filter(k => keptKeys.has(k));
console.log('river-touching canals kept:', riverKept.length);

// ---------- write output ----------
fs.writeFileSync('data/canals.geojson', JSON.stringify(fc));
const graph = {
  adj: Object.fromEntries([...adj].map(([k, v]) => [k, [...v]])),
  river: riverKept,
  linkPts: Object.fromEntries(linkPts),
};
const jsOut = `// generated by build_data.mjs — do not edit\nwindow.CANALS_DATA = ${JSON.stringify(fc)};\nwindow.STRUCTURES_DATA = ${JSON.stringify(structs)};\nwindow.CANAL_GRAPH = ${JSON.stringify(graph)};\nwindow.RIVER_LINES = ${JSON.stringify(riverLines.filter(Boolean))};\n`;
fs.writeFileSync('data/canals_data.js', jsOut);
console.log('wrote data/canals.geojson (' + Math.round(fs.statSync('data/canals.geojson').size / 1024) + ' KB) and data/canals_data.js (' + Math.round(fs.statSync('data/canals_data.js').size / 1024) + ' KB)');

// quick curated-match audit (respects location guards)
console.log('curated matched:', curatedHit.size, '/', CURATED.length, ' unmatched:',
  [...CURATED.keys()].filter(i => !curatedHit.has(i)).map(i => CURATED[i][0]).join(', ') || 'none');
