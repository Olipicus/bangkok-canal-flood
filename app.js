// Bangkok Canals — Flood Situation Map
// Data: window.CANALS_DATA (GeoJSON), window.STRUCTURES_DATA,
// window.CANAL_GRAPH {adj, river, linkPts}, window.RIVER_LINES — generated from OpenStreetMap
(function () {
  // ---------- i18n (Thai default, switchable to English) ----------
  const L10N = {
    en: {
      title: 'Bangkok Canals — Flood Situation Map',
      app_title: 'Bangkok Canals',
      intro_lead: `Bangkok's flood risk is driven by three things, and the 6,000+ km of canals (<em>khlong</em>) in and around the city are its main defence and its main weakness. The network continues into neighbouring provinces (Nonthaburi, Pathum Thani, Samut Prakan, Samut Sakhon, Nakhon Pathom, Chachoengsao) — water ignores the city boundary:`,
      intro_flash: '<span class="dot flash"></span><strong>Flash flood</strong> — intense monsoon rain overwhelms drainage faster than pumps can discharge.',
      intro_river: '<span class="dot riverine"></span><strong>River flood</strong> — runoff from the north pushes down the Chao Phraya (as in the great flood of 2011).',
      intro_tidal: '<span class="dot tidal"></span><strong>Tidal</strong> — high sea levels block canal outflows and push water back up the system.',
      intro_mixed: '<span class="dot mixed"></span><strong>Mixed</strong> — several drivers at once: e.g. a high tide backing up a canal already swollen by monsoon rain.',
      intro_hint: '👉 <strong>Click any canal</strong> to follow the water: through connected canals, into the Chao Phraya River, and out to the Gulf of Thailand.',
      help_title: 'About this map',
      help_btn_title: 'Help & background',
      help_close_title: 'Close',
      status_h: 'Canal water status',
      status_critical: 'Critical', status_warning: 'Warning', status_normal: 'Normal', status_dry: 'Low water',
      structs: 'Gates &amp; pumping stations',
      select_all: 'Select all canals',
      search_ph: 'Search canal… e.g. Saen Saep / แสนแสบ',
      footer: `Canal geometry © OpenStreetMap contributors. Water status (critical / warning / normal / low water) is computed from live BMA drainage-telemetry readings against BMA's own thresholds — the same levels shown on flood69.peoplesparty.or.th — at the snapshot time shown; canals without a station stay grey. For actual alerts, follow BMA / Thai Government channels.`,
      sel_count: '{n} canals selected',
      details: 'Details', detail_close_title: 'Clear selection and close',
      detail_collapse: 'Collapse panel', detail_expand: 'Expand panel',
      toggle_panel: 'Toggle panel',
      stats_canals: 'canals', stats_km: 'km total', stats_km_crit: 'km critical now', stats_structs: 'gates / pumps',
      now_prefix: 'Now: ',
      type_flash: 'Flash flood', type_riverine: 'River flood', type_tidal: 'Tidal', type_mixed: 'Mixed',
      reviewed: 'Reviewed canal',
      route_path: 'Drainage path',
      route_label: 'Water route · canal → river → sea',
      no_conn: 'No continuous connection to the {river} in the mapped network — likely an isolated or boundary channel.',
      km_note: 'From there the water runs ~{km} km down the river and out to the Gulf of Thailand. ',
      flow_note: 'White dashes and arrows show the flow direction — toward the river, then out to the sea. Actual flow can pause or reverse with the tide — gates control each connection.',
      river: 'Chao Phraya River',
      river_tip: 'Chao Phraya River · แม่น้ำเจ้าพระยา', sea_tip: '🌊 Gulf of Thailand · อ่าวไทย',
      dest_river: '🌊 Chao Phraya River', dest_sea: '🌊 Gulf of Thailand',
      layer_osm: 'Standard (OSM)', layer_esri: 'Light gray (Esri)',
      list_none: 'No canal matches that name.',
      kind_gate: 'Sluice gate', kind_pump: 'Pumping station', kind_weir: 'Weir',
      struct_note: 'Flood-control structure on the canal network.',
      loc: 'location', acc_exact: 'exact (OSM)', acc_approx: 'approximate', acc_osm: 'from OSM',
      loc_h: 'Find canals at a location',
      loc_input_ph: 'Coordinates lat,lng — or paste a Google Maps link',
      loc_btn: 'Show canals',
      loc_pick: '📍 Pick on map', loc_pick_active: 'Click the map…',
      loc_here: '🧭 My location',
      loc_result_title: 'Canals connected at this location',
      loc_radius: 'radius {r}',
      loc_radius_label: 'Search radius',
      loc_none: 'No canal within {r} of this point — the spot may lie outside the mapped network.',
      loc_conn: 'Connects to',
      loc_noconn: 'no junctions in the mapped network (isolated channel)',
      loc_river_note: 'main river — every river-contacting canal drains into it',
      loc_row_hint: 'Click a canal for its full drainage path to the sea.',
      loc_chip: 'Showing canals around the dropped pin — click empty map or press Esc to clear',
      loc_invalid: 'Could not read coordinates — try e.g. 13.7285, 100.5250',
      loc_outside: 'This point is outside the mapped canal network area.',
      loc_geo_err: 'Could not get your location (permission denied or unavailable).',
      loc_locating: 'Locating…',
      loc_structs_near: 'Gates &amp; pumping stations nearby',
      m_unit: 'm', km_unit: 'km',
      live_h: 'Live water levels',
      live_reading: 'Latest reading', live_fetched: 'Snapshot fetched',
      live_src: `Water-level readings from the BMA Drainage and Sewerage Department telemetry (<a href="https://weather.bangkok.go.th/water" target="_blank" rel="noopener">weather.bangkok.go.th/water</a>), mapped onto the canal network; statuses classified against BMA's thresholds exactly like <a href="https://flood69.peoplesparty.or.th" target="_blank" rel="noopener">flood69.peoplesparty.or.th</a>. A static snapshot — refresh with <code>node fetch_live.mjs</code>. Long canals with several gauges are drawn reach by reach, each in its own gauge's colour, when selected.`,
      live_cri: 'critical', live_war: 'warning', live_nor: 'normal', live_dry: 'low water', live_fau: 'faulty',
      live_st_critical: 'Above critical level', live_st_warning: 'Above warning level',
      live_st_normal: 'Normal level', live_st_dry: 'Below low-water threshold', live_st_faulty: 'Station fault — no reading',
      live_level: 'Level', live_crit: 'critical thr.', live_warn: 'warning thr.', live_low: 'low-water thr.', live_unit: 'm (MSD)',
      live_faulty_short: 'fault',
      live_near: 'nearby station',
      live_none: 'No BMA telemetry station on this canal.',
      live_more: '+{n} more stations',
      sec_h: 'Sections by gauge ({n})',
      list_dup_far: 'outside Bangkok',
      live_halo: 'Above bank threshold now (live)',
      tide_h: 'Tides today · Chao Phraya River',
      tide_high: 'High', tide_low: 'Low', tide_unit: 'm (MSD)',
      tide_src: `Tide prediction from the BMA Drainage and Sewerage Department, fetched via the People's Party flood portal (<a href="https://flood69.peoplesparty.or.th" target="_blank" rel="noopener">flood69.peoplesparty.or.th</a>).`,
      sidebar_close_title: 'Close panel',
    },
    th: {
      title: 'คลองกรุงเทพฯ — แผนที่สถานการณ์น้ำท่วม',
      app_title: 'คลองกรุงเทพฯ',
      intro_lead: 'ความเสี่ยงน้ำท่วมของกรุงเทพฯ มาจากสามปัจจัย โดยคลองกว่า 6,000 กม. ในและรอบเมืองเป็นทั้งแนวป้องกันหลักและจุดอ่อนสำคัญของเมือง เครือข่ายนี้ยังต่อเนื่องออกไปถึงจังหวัดโดยรอบ (นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร นครปฐม ฉะเชิงเทรา) — น้ำไม่สนใจเส้นเขตเมือง:',
      intro_flash: '<span class="dot flash"></span><strong>น้ำท่วมฉับพลัน</strong> — ฝนมรสุมตกหนักท่วมระบบระบายน้ำเร็วกว่าที่ปั๊มจะระบายทัน',
      intro_river: '<span class="dot riverine"></span><strong>น้ำท่วมจากแม่น้ำ</strong> — น้ำจากภาคเหนือกดลงมาตามแม่น้ำเจ้าพระยา (อย่างเช่นมหาอุทกภัยปี 2554)',
      intro_tidal: '<span class="dot tidal"></span><strong>น้ำทะเลหนุน</strong> — ระดับน้ำทะเลสูงอุดตันทางระบายของคลองและดันน้ำย้อนกลับเข้าสู่ระบบ',
      intro_mixed: '<span class="dot mixed"></span><strong>ผสม</strong> — หลายปัจจัยพร้อมกัน เช่น น้ำทะเลหนุนย้อนเข้าคลองที่ฝนมรสุมทำให้ฟุ้งขึ้นแล้ว',
      intro_hint: '👉 <strong>คลิกคลองใดก็ได้</strong> เพื่อไล่ดูเส้นทางน้ำ: ผ่านคลองที่เชื่อมถึงกัน ลงสู่แม่น้ำเจ้าพระยา และออกสู่อ่าวไทย',
      help_title: 'เกี่ยวกับแผนที่นี้',
      help_btn_title: 'วิธีใช้และข้อมูลเบื้องต้น',
      help_close_title: 'ปิด',
      status_h: 'สถานะน้ำในคลอง',
      status_critical: 'วิกฤต', status_warning: 'เตือนภัย', status_normal: 'ปกติ', status_dry: 'น้ำต่ำ',
      structs: 'ประตูน้ำ &amp; สถานีสูบน้ำ',
      select_all: 'เลือกคลองทั้งหมด',
      search_ph: 'ค้นหาคลอง… เช่น แสนแสบ / Saen Saep',
      footer: 'เรขาคณิตคลอง © OpenStreetMap contributors สถานะน้ำในคลอง (วิกฤต / เตือนภัย / ปกติ / น้ำต่ำ) คำนวณจากค่าระดับน้ำสดของสำนักการระบายน้ำ กทม. เทียบเกณฑ์ของ กทม. เอง — ระดับเดียวกับที่แสดงบน flood69.peoplesparty.or.th — ตามเวลา snapshot คลองที่ไม่มีสถานีแสดงเป็นสีเทา สำหรับการแจ้งเตือนจริง โปรดติดตามประกาศของ กทม. / หน่วยงานราชการ',
      sel_count: 'เลือกอยู่ {n} คลอง',
      details: 'รายละเอียด', detail_close_title: 'ล้างการเลือกและปิด',
      detail_collapse: 'หุบแผงข้อมูล', detail_expand: 'กางแผงข้อมูล',
      toggle_panel: 'สลับแผงข้อมูล',
      stats_canals: 'คลอง', stats_km: 'กม. รวม', stats_km_crit: 'กม. วิกฤตขณะนี้', stats_structs: 'ประตูน้ำ/ปั๊ม',
      now_prefix: 'ขณะนี้: ',
      type_flash: 'น้ำท่วมฉับพลัน', type_riverine: 'น้ำท่วมจากแม่น้ำ', type_tidal: 'น้ำทะเลหนุน', type_mixed: 'ผสม',
      reviewed: 'คลองที่ตรวจสอบข้อมูลแล้ว',
      route_path: 'เส้นทางระบายน้ำ',
      route_label: 'เส้นทางน้ำ · คลอง → แม่น้ำ → ทะเล',
      no_conn: 'ไม่มีเส้นทางเชื่อมต่อต่อเนื่องไปยัง{river}ในเครือข่ายที่แสดง — น่าจะเป็นคลองแยกหรือคลองชายเขต',
      km_note: 'จากจุดนี้น้ำจะไหลราว ~{km} กม. ลงตามแม่น้ำและออกสู่อ่าวไทย ',
      flow_note: 'เส้นประสีขาวและลูกศรแสดงทิศทางการไหล — มุ่งลงแม่น้ำแล้วออกสู่ทะเล การไหลจริงอาจหยุดหรือย้อนทิศตามน้ำขึ้น — ประตูน้ำเป็นตัวควบคุมการเชื่อมแต่ละจุด',
      river: 'แม่น้ำเจ้าพระยา',
      river_tip: 'แม่น้ำเจ้าพระยา · Chao Phraya River', sea_tip: '🌊 อ่าวไทย · Gulf of Thailand',
      dest_river: '🌊 แม่น้ำเจ้าพระยา', dest_sea: '🌊 อ่าวไทย',
      layer_osm: 'แผนที่ปกติ (OSM)', layer_esri: 'ขาวเทา (Esri)',
      list_none: 'ไม่พบคลองที่ตรงกับชื่อนี้',
      kind_gate: 'ประตูน้ำ', kind_pump: 'สถานีสูบน้ำ', kind_weir: 'ฝายกั้นน้ำ',
      struct_note: 'โครงสร้างควบคุมน้ำท่วมบนเครือข่ายคลอง',
      loc: 'ตำแหน่ง', acc_exact: 'แม่นยำ (OSM)', acc_approx: 'โดยประมาณ', acc_osm: 'จาก OSM',
      loc_h: 'ดูคลองตามตำแหน่ง',
      loc_input_ph: 'พิกัด lat,lng — หรือวางลิงก์ Google Maps',
      loc_btn: 'ดูคลอง',
      loc_pick: '📍 เลือกบนแผนที่', loc_pick_active: 'คลิกบนแผนที่…',
      loc_here: '🧭 ตำแหน่งของฉัน',
      loc_result_title: 'คลองที่เชื่อมต่อ ณ ตำแหน่งนี้',
      loc_radius: 'รัศมี {r}',
      loc_radius_label: 'รัศมีค้นหา',
      loc_none: 'ไม่พบคลองภายในรัศมี {r} จากจุดนี้ — จุดนี้อาจอยู่นอกเครือข่ายคลองที่มีข้อมูล',
      loc_conn: 'เชื่อมกับ',
      loc_noconn: 'ไม่มีจุดเชื่อมต่อในเครือข่ายที่แสดง (คลองแยก)',
      loc_river_note: 'แม่น้ำสายหลัก — คลองที่ติดแม่น้ำทุกสายระบายลงสู่จุดนี้',
      loc_row_hint: 'คลิกชื่อคลองเพื่อดูเส้นทางระบายน้ำสู่ทะเล',
      loc_chip: 'กำลังแสดงคลองรอบหมุดที่วาง — คลิกพื้นที่ว่างบนแผนที่หรือกด Esc เพื่อล้าง',
      loc_invalid: 'อ่านพิกัดไม่เข้าใจ — ลองเช่น 13.7285, 100.5250',
      loc_outside: 'ตำแหน่งนี้อยู่นอกพื้นที่เครือข่ายคลองที่มีข้อมูล',
      loc_geo_err: 'ไม่สามารถระบุตำแหน่งของคุณได้ (ถูกปฏิเสธสิทธิ์หรืออุปกรณ์ไม่รองรับ)',
      loc_locating: 'กำลังระบุตำแหน่ง…',
      loc_structs_near: 'ประตูน้ำ/สถานีสูบน้ำใกล้จุดนี้',
      m_unit: 'ม.', km_unit: 'กม.',
      live_h: 'สถานะน้ำปัจจุบัน',
      live_reading: 'อ่านค่าล่าสุด', live_fetched: 'ดึงข้อมูลเมื่อ',
      live_src: 'ข้อมูลจากสถานีตรวจวัดระดับน้ำของสำนักการระบายน้ำ กทม. (<a href="https://weather.bangkok.go.th/water" target="_blank" rel="noopener">weather.bangkok.go.th/water</a>) จับคู่เข้ากับเครือข่ายคลอง — จัดสถานะเทียบเกณฑ์ของ กทม. เช่นเดียวกับ <a href="https://flood69.peoplesparty.or.th" target="_blank" rel="noopener">flood69.peoplesparty.or.th</a> — เป็น snapshot รีเฟรชด้วย <code>node fetch_live.mjs</code> — คลองที่มีหลายจุดวัดจะแสดงเป็นช่วงตามจุดวัดเมื่อเลือก',
      live_cri: 'วิกฤต', live_war: 'เตือนภัย', live_nor: 'ปกติ', live_dry: 'น้ำต่ำ', live_fau: 'ขัดข้อง',
      live_st_critical: 'น้ำเกินเกณฑ์วิกฤต', live_st_warning: 'น้ำเกินเกณฑ์เตือนภัย',
      live_st_normal: 'ระดับน้ำปกติ', live_st_dry: 'น้ำต่ำกว่าเกณฑ์น้ำต่ำ', live_st_faulty: 'สถานีขัดข้อง — ไม่มีการอ่านค่า',
      live_level: 'ระดับน้ำ', live_crit: 'เกณฑ์วิกฤต', live_warn: 'เกณฑ์เตือนภัย', live_low: 'เกณฑ์น้ำต่ำ', live_unit: 'ม.รทก.',
      live_faulty_short: 'ขัดข้อง',
      live_near: 'สถานีใกล้คลอง',
      live_none: 'ไม่มีสถานีตรวจวัดของ กทม. บนคลองนี้',
      live_more: '+อีก {n} สถานี',
      sec_h: 'ช่วงตามจุดวัด ({n} ช่วง)',
      list_dup_far: 'ต่างจังหวัด',
      live_halo: 'น้ำเกินเกณฑ์ตอนนี้ (สด)',
      tide_h: 'น้ำขึ้น–น้ำลงวันนี้ · เจ้าพระยา',
      tide_high: 'น้ำขึ้น', tide_low: 'น้ำลง', tide_unit: 'ม.รทก.',
      tide_src: 'พยากรณ์น้ำขึ้น-น้ำลงจากสำนักการระบายน้ำ กทม. ดึงผ่านเว็บติดตามน้ำท่วมของพรรคประชาชน (<a href="https://flood69.peoplesparty.or.th" target="_blank" rel="noopener">flood69.peoplesparty.or.th</a>)',
      sidebar_close_title: 'ปิดแผงข้อมูล',
    },
  };
  let lang = 'th';
  try { lang = localStorage.getItem('klong_lang') === 'en' ? 'en' : 'th'; } catch (e) { /* storage unavailable */ }
  const t = k => (L10N[lang][k] ?? L10N.en[k] ?? k);
  // primary / secondary display name for the active language
  const displayName = p => (lang === 'th' ? (p.name_th || p.name) : (p.name || p.name_th)) || '';
  const subName = p => {
    const a = p.name, b = p.name_th;
    const other = lang === 'th' ? a : b;
    const primary = lang === 'th' ? b : a;
    return other && other !== primary ? other : null;
  };

  // ---------- live water-level snapshot (BMA telemetry, refreshed via fetch_live.mjs) ----------
  const LIVE = window.LIVE_STATUS || null;
  // ---------- tide prediction (BMA via flood69.peoplesparty.or.th, refreshed via fetch_flood69.mjs) ----------
  const TIDE = window.FLOOD69_STATUS || null;
  // flood69's four levels: วิกฤต / เตือนภัย / ปกติ / น้ำต่ำ
  const STATUS_KEYS = ['critical', 'warning', 'normal', 'dry'];
  const LIVE_COLOR = { critical: '#e53935', warning: '#fb8c00', normal: '#43a047', dry: '#4fc3f7', faulty: '#9e9e9e' };
  const stationByCode = new Map((LIVE ? LIVE.stations : []).map(s => [s.code, s]));
  const liveByCanal = LIVE ? LIVE.canals : {};
  // every canal carries its *current* status colour — selected or not — so the
  // line never changes colour when clicked; canals without a reporting station
  // (or whose stations are all faulty) stay a neutral grey
  const NO_DATA_COLOR = '#7a8a99';
  function displayColor(p) {
    const lv = liveByCanal[p.key];
    if (lv && lv.status !== 'faulty') return LIVE_COLOR[lv.status];
    return NO_DATA_COLOR;
  }
  const stationName = s => (lang === 'th' ? s.name : (s.name_en || s.name)) || s.code;
  function fmtBangkok(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
      timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  const fmtClock = ms => new Date(ms).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit',
  });

  // ---------- map ----------
  // phones: pinch/double-tap zooms, so skip the zoom buttons (they would
  // also collide with the floating drawer/help buttons)
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;
  const isPhoneNow = isPhone();
  const map = L.map('map', { zoomControl: !isPhoneNow }).setView([13.728, 100.525], 11);

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19,
  });
  const esriGray = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri', maxZoom: 19,
  });
  osm.addTo(map);
  let layerCtl = L.control.layers({ [t('layer_osm')]: osm, [t('layer_esri')]: esriGray }, null, { position: 'bottomright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

  // ---------- data ----------
  const canals = window.CANALS_DATA.features;
  const graph = window.CANAL_GRAPH || { adj: {}, river: [], linkPts: {} };
  const riverSet = new Set(graph.river);
  const keyToFeature = new Map();
  for (const f of canals) keyToFeature.set(f.properties.key || f.properties.name, f);
  const nameOf = key => (keyToFeature.get(key) || {}).properties || { name: key };

  // one layer per live status — the sidebar checkboxes toggle these — plus an
  // always-on base layer for canals no station reports
  const statusLayers = Object.fromEntries(STATUS_KEYS.map(s => [s, L.layerGroup()]));
  const baseLayer = L.layerGroup();
  const featureToLayer = new Map(); // feature -> its polylines (one per reach on multi-gauge canals)
  const traceLayer = L.layerGroup().addTo(map);
  // multi-select: every canal click adds to the selection, each canal keeps its
  // own computed drainage trace; Esc / empty-map click clears them all
  let selected = []; // ordered selected canal keys (most recent last)
  const traceCache = new Map(); // key -> { startKey, pathKeys, riverPt, ... }
  const locLayer = L.layerGroup().addTo(map);
  let loc = null; // location-lookup state: { latlng, items, structs, keys, nearestKey, outside }
  let LOC_RADIUS_M = 2000; // adjustable via the sidebar select, persisted in localStorage
  const LOC_RADII = [200, 500, 1000, 2000, 5000, 10000];
  const riverKey = canals.find(f => f.properties.waterway === 'river')?.properties.key || null;

  // ---------- geometry helpers ----------
  const toLatLngs = lines => lines.map(line => line.map(([lon, lat]) => [lat, lon]));
  function riverDist(lat, lon) {
    let best = Infinity;
    for (const line of window.RIVER_LINES || [])
      for (const [x, y] of line) best = Math.min(best, Math.hypot(x - lon, y - lat));
    return best;
  }

  // ---------- river chain: ordered downstream walk to the river mouth (the sea) ----------
  // The Chao Phraya's OSM ways form a chain; its southernmost vertex is the river
  // mouth on the Gulf of Thailand coastline.
  const riverLines = (window.RIVER_LINES || []).filter(l => l.length >= 2);
  const rvAdj = Array.from({ length: riverLines.length }, () => []);
  for (let i = 0; i < riverLines.length; i++) {
    for (let j = i + 1; j < riverLines.length; j++) {
      const a = [riverLines[i][0], riverLines[i][riverLines[i].length - 1]];
      const b = [riverLines[j][0], riverLines[j][riverLines[j].length - 1]];
      if (a.some(p => b.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.0008))) {
        rvAdj[i].push(j); rvAdj[j].push(i);
      }
    }
  }
  let mouthIdx = -1, mouthLat = Infinity, MOUTH = null;
  riverLines.forEach((l, i) => { for (const p of l) if (p[1] < mouthLat) { mouthLat = p[1]; mouthIdx = i; MOUTH = p; } });
  const MOUTH_LL = MOUTH ? [MOUTH[1], MOUTH[0]] : null; // [lat, lng]

  function riverPathDown(riverPt) {
    if (!riverPt || mouthIdx < 0) return null;
    let startIdx = -1, bestD = Infinity;
    riverLines.forEach((l, i) => { for (const p of l) {
      const d = Math.hypot(p[0] - riverPt[1], p[1] - riverPt[0]);
      if (d < bestD) { bestD = d; startIdx = i; }
    }});
    const prev = new Map([[startIdx, null]]);
    const q = [startIdx];
    while (q.length) {
      const cur = q.shift();
      if (cur === mouthIdx) break;
      for (const nb of rvAdj[cur]) if (!prev.has(nb)) { prev.set(nb, cur); q.push(nb); }
    }
    if (startIdx < 0 || !prev.has(mouthIdx)) return null;
    const chain = [];
    for (let cur = mouthIdx; cur !== null; cur = prev.get(cur)) chain.unshift(cur);
    const pts = [[riverPt[0], riverPt[1]]]; // [lat, lng]
    let last = [riverPt[1], riverPt[0]];    // [lon, lat] for comparing with river vertices
    for (let k = 0; k < chain.length; k++) {
      const line = riverLines[chain[k]];
      const head = Math.hypot(line[0][0] - last[0], line[0][1] - last[1]);
      const tail = Math.hypot(line[line.length - 1][0] - last[0], line[line.length - 1][1] - last[1]);
      const oriented = head < tail ? line : [...line].reverse();
      for (let m = k > 0 ? 1 : 0; m < oriented.length; m++) pts.push([oriented[m][1], oriented[m][0]]);
      last = oriented[oriented.length - 1];
    }
    pts.push(MOUTH_LL); // make sure the path terminates at the mouth
    return pts;
  }

  function pathKm(pts) {
    const rad = Math.PI / 180;
    let km = 0;
    for (let i = 1; i < pts.length; i++) {
      const [lat1, lng1] = pts[i - 1], [lat2, lng2] = pts[i];
      const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2;
      km += 12742 * Math.asin(Math.sqrt(a));
    }
    return km;
  }

  // ---------- trace computation (least-distance route to a river contact) ----------
  // Dijkstra over (canal, junction) states, costed in along-canal kilometres.
  // Replaces the old hop-count BFS, which could pick a river contact in the
  // wrong direction whenever two contacts were the same number of hops away
  // (e.g. Saen Saep routed out via Khlong Sam Sen instead of the Maha Nak
  // head). Mirrored in audit_trace.mjs / audit_connections.mjs.
  const hav = (a, b) => {
    const rad = Math.PI / 180;
    const q = Math.sin((b[1] - a[1]) * rad / 2) ** 2 +
      Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(q));
  };
  const canalGeom = new Map(); // key -> lines with cumulative vertex distance
  for (const f of canals) {
    const key = f.properties.key || f.properties.name;
    canalGeom.set(key, f.geometry.coordinates.map(line => {
      const cum = [0];
      for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + hav(line[i - 1], line[i]));
      return { pts: line, cum };
    }));
  }
  const canalJuncs = new Map(); // key -> [{pt, other}]
  for (const [pk, pt] of Object.entries(graph.linkPts || {})) {
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
    if (!isFinite(best)) best = hav(p, q); // different lines: straight-line fallback
    alongMemo.set(kk, best);
    return best;
  }

  // river contact point of a canal: its endpoint closest to the river centreline
  function riverEndpoint(key) {
    const f = keyToFeature.get(key);
    let riverPt = null, bestD = Infinity;
    for (const line of f.geometry.coordinates)
      for (const pt of [line[0], line[line.length - 1]]) {
        const d = riverDist(pt[1], pt[0]);
        if (d < bestD) { bestD = d; riverPt = [pt[1], pt[0]]; }
      }
    return riverPt;
  }

  // ---------- canal sections: split a multi-gauge canal into reaches ----------
  // A canal with several gauges (Saen Saep has 12) is a chain of reaches with
  // different levels. Everything is keyed by the unique feature key and only
  // stations attached to that very key are used, so same-named canals in other
  // provinces can never bleed into each other.
  const sectionsByCanal = new Map(); // key -> { total, list: [{stations, main, status, fromKm, toKm, line}] }
  const SEC_RANK = s => (s === 'critical' ? 0 : s === 'warning' ? 1 : s === 'normal' ? 2 : s === 'dry' ? 3 : 4);

  // stitch the feature's MultiLineString parts into one ordered vertex chain
  // (same trick riverPathDown uses for the river), or null when the parts
  // never form a single contiguous line
  function stitchChain(f) {
    const parts = f.geometry.coordinates.filter(l => l.length >= 2);
    if (!parts.length) return null;
    const TOL = 3.5e-4; // ~39 m in degrees — matches the build's 30 m clustering
    const touch = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < TOL;
    const chain = [...parts[0]];
    const pool = parts.slice(1);
    for (let progress = true; pool.length && progress;) {
      progress = false;
      for (let i = 0; i < pool.length; i++) {
        const line = pool[i], head = line[0], tail = line[line.length - 1];
        if (touch(chain[chain.length - 1], head)) chain.push(...line.slice(1));
        else if (touch(chain[chain.length - 1], tail)) chain.push(...line.slice(0, -1).reverse());
        else if (touch(chain[0], tail)) chain.unshift(...line.slice(0, -1));
        else if (touch(chain[0], head)) chain.unshift(...line.slice(1).reverse());
        else continue;
        pool.splice(i, 1);
        progress = true;
        break;
      }
    }
    return pool.length ? null : chain;
  }

  // along-chain position (km) of a [lat,lng] point — nearest segment + interpolation
  function chainageOf(chain, cum, lat, lng) {
    const KX = 111320 * Math.cos(lat * Math.PI / 180), KY = 110570;
    let best = Infinity, km = 0;
    for (let i = 1; i < chain.length; i++) {
      const ax = (chain[i - 1][0] - lng) * KX, ay = (chain[i - 1][1] - lat) * KY;
      const bx = (chain[i][0] - lng) * KX, by = (chain[i][1] - lat) * KY;
      const dx = bx - ax, dy = by - ay;
      const L2 = dx * dx + dy * dy;
      let s = L2 ? (-ax * dx - ay * dy) / L2 : 0;
      s = Math.max(0, Math.min(1, s));
      const d = Math.hypot(ax + dx * s, ay + dy * s);
      if (d < best) { best = d; km = cum[i - 1] + (cum[i] - cum[i - 1]) * s; }
    }
    return km;
  }

  // sub-chain ([lon,lat]) between two along-chain distances
  function sliceChain(chain, cum, fromKm, toKm) {
    const total = cum[cum.length - 1];
    const at = k => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < k) i++;
      const t = (k - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1e-9);
      const p = chain[i - 1], q = chain[i];
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    if (toKm - fromKm < 1e-9) return [];
    const out = [at(fromKm)];
    for (let i = 0; i < chain.length; i++)
      if (cum[i] > fromKm && cum[i] < toKm) out.push(chain[i]);
    out.push(at(toKm));
    return out;
  }

  function buildSections(key) {
    const f = keyToFeature.get(key);
    const lv = liveByCanal[key];
    if (!f || !lv || !lv.stations || lv.stations.length < 2) return;
    const chain = stitchChain(f);
    if (!chain || chain.length < 2) return;
    const cum = [0];
    for (let i = 1; i < chain.length; i++) cum.push(cum[i - 1] + hav(chain[i - 1], chain[i]));
    const total = cum[cum.length - 1];
    if (total < 0.5) return; // too short to be worth splitting
    const placed = lv.stations
      .map(c => stationByCode.get(c))
      .filter(s => s && s.lat != null && s.lon != null)
      .map(s => ({ s, km: chainageOf(chain, cum, s.lat, s.lon) }))
      .sort((a, b) => a.km - b.km);
    if (placed.length < 2) return;
    // group gauges sitting within ~300 m of each other into one section
    const groups = [];
    for (const p of placed) {
      const g = groups[groups.length - 1];
      if (g && p.km - g.km < 0.3) {
        g.km = (g.km * g.stations.length + p.km) / (g.stations.length + 1);
        g.stations.push(p.s);
        if (SEC_RANK(p.s.status) < SEC_RANK(g.status) ||
            (p.s.status === g.status && (p.s.level ?? -Infinity) > (g.main.level ?? -Infinity))) {
          g.status = p.s.status;
          g.main = p.s;
        }
      } else {
        groups.push({ km: p.km, stations: [p.s], status: p.s.status, main: p.s });
      }
    }
    if (groups.length < 2) return; // every gauge clusters at one spot
    const bounds = [0];
    for (let i = 1; i < groups.length; i++) bounds.push((groups[i - 1].km + groups[i].km) / 2);
    bounds.push(total);
    const list = [];
    for (let i = 0; i < groups.length; i++) {
      const line = sliceChain(chain, cum, bounds[i], bounds[i + 1]);
      if (line.length < 2) continue;
      list.push({ stations: groups[i].stations, main: groups[i].main, status: groups[i].status,
        fromKm: bounds[i], toKm: bounds[i + 1], line });
    }
    if (list.length >= 2) sectionsByCanal.set(key, { total, list });
  }
  // precompute once at load — only canals with 2+ gauges get split reaches
  for (const f of canals) {
    const key = f.properties.key || f.properties.name;
    if ((liveByCanal[key]?.stations?.length || 0) >= 2) buildSections(key);
  }

  function computeTrace(startKey) {
    if (riverSet.has(startKey)) {
      const riverPt = riverEndpoint(startKey);
      const riverPath = riverPathDown(riverPt);
      return { reachable: true, pathKeys: [startKey], riverPt, riverPath, riverKm: riverPath ? pathKm(riverPath) : null, mouth: MOUTH_LL };
    }

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

    const startJuncs = canalJuncs.get(startKey) || [];
    startJuncs.forEach((j, ji) => { const s = startKey + '#' + ji; dist.set(s, 0); prev.set(s, null); push(0, s); });
    while (heap.length) {
      const [d, s] = pop();
      if (d > (dist.get(s) ?? Infinity)) continue;
      if (s === EXIT) break; // optimal route popped
      const hash = s.lastIndexOf('#');
      const key = s.slice(0, hash), ji = +s.slice(hash + 1);
      const here = canalJuncs.get(key)[ji].pt;
      if (riverSet.has(key)) { // candidate exit: add the final leg, keep searching
        const rp = riverEndpoint(key);
        const total = d + alongKm(key, here, [rp[1], rp[0]]);
        if (total < (dist.get(EXIT) ?? Infinity)) {
          dist.set(EXIT, total); prev.set(EXIT, s); exitKey = key; push(total, EXIT);
        }
      }
      for (const nb of graph.adj[key] || []) { // cross into neighbours at this junction
        const nj = canalJuncs.get(nb) || [];
        for (let qi = 0; qi < nj.length; qi++) {
          if (nj[qi].other !== key) continue;
          if (Math.hypot(nj[qi].pt[0] - here[0], nj[qi].pt[1] - here[1]) > 0.00005) continue;
          const ns = nb + '#' + qi;
          if (d < (dist.get(ns) ?? Infinity)) { dist.set(ns, d); prev.set(ns, s); push(d, ns); }
        }
      }
      const kj = canalJuncs.get(key);
      for (let qi = 0; qi < kj.length; qi++) { // travel along this canal
        if (qi === ji) continue;
        const d2 = d + alongKm(key, here, kj[qi].pt);
        const ns = key + '#' + qi;
        if (d2 < (dist.get(ns) ?? Infinity)) { dist.set(ns, d2); prev.set(ns, s); push(d2, ns); }
      }
    }

    if (exitKey === null) return { reachable: false, pathKeys: [startKey], riverPt: null };
    const chain = [];
    for (let cur = prev.get(EXIT); cur; cur = prev.get(cur)) chain.unshift(cur.split('#')[0]);
    const pathKeys = [...new Set(chain)];
    const riverPt = riverEndpoint(exitKey);
    const riverPath = riverPathDown(riverPt);
    return { reachable: true, pathKeys, riverPt, riverPath, riverKm: riverPath ? pathKm(riverPath) : null, mouth: MOUTH_LL };
  }

  // orientation: reverse a line if its first point is the downstream (junction) end,
  // so dash animation flows toward the river. `junction` must be [lon, lat].
  function orientLine(line, junction) {
    if (!junction) return line;
    const first = Math.hypot(line[0][0] - junction[0], line[0][1] - junction[1]);
    const last = Math.hypot(line[line.length - 1][0] - junction[0], line[line.length - 1][1] - junction[1]);
    return first < last ? [...line].reverse() : line;
  }
  const linkPt = (a, b) => {
    const pk = a < b ? a + '|' + b : b + '|' + a;
    return (graph.linkPts || {})[pk] || null;
  };

  // ---------- flow-direction arrows ----------
  const bearingDeg = (a, b) => { // [lat,lng] -> degrees clockwise from north
    const dLat = b[0] - a[0];
    const dLng = (b[1] - a[1]) * Math.cos((a[0] + b[0]) * Math.PI / 360);
    return Math.atan2(dLng, dLat) * 180 / Math.PI;
  };
  function meters(a, b) {
    return Math.hypot((b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180), (b[0] - a[0]) * 110570);
  }
  function addFlowArrows(ll, spacing = 900) {
    let carry = 0, placed = 0, total = 0;
    for (let i = 1; i < ll.length; i++) total += meters(ll[i - 1], ll[i]);
    for (let i = 1; i < ll.length; i++) {
      const a = ll[i - 1], b = ll[i];
      const segM = meters(a, b);
      if (segM < 1) continue;
      const deg = bearingDeg(a, b);
      for (let t = (spacing - carry) / segM; t <= 1; t += spacing / segM) {
        const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        L.marker(p, {
          interactive: false,
          icon: L.divIcon({
            className: 'flow-arrow-icon',
            html: `<div class="flow-arrow" style="transform: rotate(${deg.toFixed(1)}deg)"></div>`,
            iconSize: [14, 14], iconAnchor: [7, 7],
          }),
        }).addTo(traceLayer);
        placed++;
      }
      carry = (carry + segM) % spacing;
    }
    if (!placed && total > 400) { // short channel: one arrow at its midpoint
      const half = total / 2;
      for (let i = 1; i < ll.length; i++) {
        const segM = meters(ll[i - 1], ll[i]);
        if (segM >= half) {
          const deg = bearingDeg(ll[i - 1], ll[i]);
          L.marker(ll[i], {
            interactive: false,
            icon: L.divIcon({
              className: 'flow-arrow-icon',
              html: `<div class="flow-arrow" style="transform: rotate(${deg.toFixed(1)}deg)"></div>`,
              iconSize: [14, 14], iconAnchor: [7, 7],
            }),
          }).addTo(traceLayer);
          break;
        }
      }
    }
  }

  // ---------- trace rendering ----------
  function drawTrace() {
    traceLayer.clearLayers();
    const routes = selected.map(k => traceCache.get(k)).filter(tr => tr && tr.reachable);
    if (!routes.length) return;

    // dim the river context, highlight the active outflow route
    for (const line of toLatLngs(window.RIVER_LINES || [])) {
      L.polyline(line, { color: '#3d7fd9', weight: 5, opacity: 0.3, interactive: false }).addTo(traceLayer);
    }

    for (const tr of routes) {
      const { pathKeys } = tr;
      for (let i = 0; i < pathKeys.length; i++) {
        const key = pathKeys[i];
        const f = keyToFeature.get(key);
        if (!f) continue;
        // downstream junction in [lon, lat] for orientLine (riverPt is stored [lat, lng])
        const downstream = i + 1 < pathKeys.length ? linkPt(pathKeys[i], pathKeys[i + 1])
          : (tr.riverPt ? [tr.riverPt[1], tr.riverPt[0]] : null);
        const isStart = i === 0;
        const color = displayColor(f.properties);
        const secs = sectionsByCanal.get(key);
        if (secs) { drawTraceSections(key, secs, downstream, isStart); continue; }
        for (const line of f.geometry.coordinates) {
          const oriented = orientLine(line, downstream);
          const ll = toLatLngs([oriented])[0];
          if (isStart) {
            L.polyline(ll, { color: '#ffffff', weight: 10, opacity: 0.95, interactive: false }).addTo(traceLayer);
            L.polyline(ll, { color, weight: 6, opacity: 1, interactive: false }).addTo(traceLayer);
          } else {
            L.polyline(ll, { color, weight: 4.5, opacity: 0.95, interactive: false }).addTo(traceLayer);
          }
          L.polyline(ll, { color: '#ffffff', weight: 2.2, opacity: 0.9, className: 'flow-dash', interactive: false }).addTo(traceLayer);
          addFlowArrows(ll);
        }
      }

      // outflow: continue the flow animation down the river to the Gulf
      if (tr.riverPath) {
        L.polyline(tr.riverPath, { color: '#3d7fd9', weight: 7, opacity: 1, lineCap: 'round', interactive: false }).addTo(traceLayer);
        L.polyline(tr.riverPath, { color: '#ffffff', weight: 2.4, opacity: 0.95, className: 'flow-dash', interactive: false }).addTo(traceLayer);
        addFlowArrows(tr.riverPath, 2600);
      }

      if (tr.riverPt) {
        L.circleMarker(tr.riverPt, {
          radius: 13, color: '#3d7fd9', weight: 2, fill: false, opacity: 0.8,
          className: 'mouth-pulse', interactive: false,
        }).addTo(traceLayer);
        L.circleMarker(tr.riverPt, {
          radius: 6, color: '#ffffff', weight: 2.5, fillColor: '#3d7fd9', fillOpacity: 1,
        }).addTo(traceLayer).bindTooltip(t('river_tip'), { className: 'canal-tip', direction: 'top' });
      }
    }

    // every route shares the same river mouth — draw the sea markers once
    if (routes[0].mouth) {
      L.circleMarker(routes[0].mouth, {
        radius: 16, color: '#26c6da', weight: 2, fill: false, opacity: 0.9,
        className: 'mouth-pulse sea', interactive: false,
      }).addTo(traceLayer);
      L.circleMarker(routes[0].mouth, {
        radius: 6, color: '#ffffff', weight: 2.5, fillColor: '#26c6da', fillOpacity: 1,
      }).addTo(traceLayer).bindTooltip(t('sea_tip'), { className: 'canal-tip sea-tip', direction: 'top', permanent: true, offset: [0, -10] });
    }
  }

  // a canal on the route carries several gauges: draw it reach by reach in
  // each gauge's colour; the start canal also gets a clickable dot per gauge
  function drawTraceSections(key, secs, downstream, isStart) {
    for (const sec of secs.list) {
      const ll = toLatLngs([orientLine(sec.line, downstream)])[0];
      if (isStart) {
        L.polyline(ll, { color: '#ffffff', weight: 10, opacity: 0.95, interactive: false }).addTo(traceLayer);
        L.polyline(ll, { color: LIVE_COLOR[sec.status] || NO_DATA_COLOR, weight: 6, opacity: 1, interactive: false }).addTo(traceLayer);
      } else {
        L.polyline(ll, { color: LIVE_COLOR[sec.status] || NO_DATA_COLOR, weight: 4.5, opacity: 0.95, interactive: false }).addTo(traceLayer);
      }
      L.polyline(ll, { color: '#ffffff', weight: 2.2, opacity: 0.9, className: 'flow-dash', interactive: false }).addTo(traceLayer);
      addFlowArrows(ll);
    }
    if (!isStart) return;
    secs.list.forEach((sec, si) => {
      for (const s of sec.stations) {
        if (s.lat == null || s.lon == null) continue;
        const lvl = s.level != null ? `${s.level.toFixed(2)} ${t('live_unit')}` : t('live_faulty_short');
        L.circleMarker([s.lat, s.lon], {
          radius: 4.5, color: '#ffffff', weight: 1.6,
          fillColor: LIVE_COLOR[s.status] || NO_DATA_COLOR, fillOpacity: 1,
          bubblingMouseEvents: false, // a gauge click must not clear the selection
        }).addTo(traceLayer)
          .bindTooltip(`${stationName(s)} — ${lvl}`, { className: 'canal-tip', direction: 'top' })
          .on('click', () => focusSection(key, si));
      }
    });
  }

  // zoom to one reach of the selected canal (from a panel row or a gauge dot)
  function focusSection(key, idx) {
    const secs = sectionsByCanal.get(key);
    if (!secs || !secs.list[idx]) return;
    const sec = secs.list[idx];
    const ll = toLatLngs([sec.line])[0];
    map.flyToBounds(L.latLngBounds(ll).pad(0.2), { maxZoom: 15, duration: 0.8 });
    const flash = L.polyline(ll, {
      color: '#ffffff', weight: 12, opacity: 0.85, className: 'sec-flash', interactive: false,
    }).addTo(traceLayer);
    setTimeout(() => traceLayer.removeLayer(flash), 1000);
    const row = panelBody.querySelector(`.sec-row[data-key="${CSS.escape(key)}"][data-sec="${idx}"]`);
    if (row) {
      panelBody.querySelectorAll('.sec-row.active').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ---------- location lookup: which canals connect at a chosen point ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const fmtDist = m => m >= 995
    ? (m / 1000).toFixed(1) + ' ' + t('km_unit')
    : Math.round(m) + ' ' + t('m_unit');
  const fmtRadius = m => m >= 1000
    ? (m / 1000).toLocaleString() + ' ' + t('km_unit')
    : m + ' ' + t('m_unit');

  // accepts "13.7285, 100.5250", "13.7285 100.525", hemisphere letters, and
  // Google Maps URLs (@lat,lng / !3d!4d / ?q= / ?ll=) — returns [lat, lng] or null
  function parseCoords(text) {
    text = (text || '').trim();
    if (!text) return null;
    const n = '-?\\d+(?:\\.\\d+)?';
    const reUrl = new RegExp(`!3d(${n})!4d(${n})|@(${n}),\\s*(${n})|[?&](?:q|ll|query|daddr|destination|center)=(${n}),\\s*(${n})`);
    const rePlain = new RegExp(`^(${n})\\s*([NSEWnsew]?)\\s*[,/ ]\\s*(${n})\\s*([NSEWnsew]?)$`);
    let lat, lng, m = text.match(reUrl);
    if (m) {
      const g = m.slice(1).filter(v => v !== undefined);
      lat = +g[0]; lng = +g[1];
    } else if ((m = text.match(rePlain))) {
      const a = +m[1], b = +m[3];
      const h1 = (m[2] || '').toUpperCase(), h2 = (m[4] || '').toUpperCase();
      if (h1 === 'N' || h1 === 'S') { lat = h1 === 'S' ? -a : a; lng = h2 === 'W' ? -b : b; }
      else if (h1 === 'E' || h1 === 'W') { lng = h1 === 'W' ? -a : a; lat = h2 === 'S' ? -b : b; }
      else { lat = a; lng = b; }
    } else return null;
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat]; // pasted lng-first
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [lat, lng];
  }

  // nearest point on a canal (GeoJSON lines, [lon,lat]) to the query, in metres
  function nearestOnCanal(f, lat, lng) {
    const KX = 111320 * Math.cos(lat * Math.PI / 180), KY = 110570;
    let best = Infinity, bestPt = null;
    for (const line of f.geometry.coordinates) {
      for (let i = 1; i < line.length; i++) {
        const ax = (line[i - 1][0] - lng) * KX, ay = (line[i - 1][1] - lat) * KY;
        const bx = (line[i][0] - lng) * KX, by = (line[i][1] - lat) * KY;
        const dx = bx - ax, dy = by - ay;
        const L2 = dx * dx + dy * dy;
        let s = L2 ? (-ax * dx - ay * dy) / L2 : 0; // query sits at the projected origin
        s = Math.max(0, Math.min(1, s));
        const ex = ax + dx * s, ey = ay + dy * s;
        const d = Math.hypot(ex, ey);
        if (d < best) { best = d; bestPt = [lat + ey / KY, lng + ex / KX]; }
      }
    }
    return { d: best, pt: bestPt };
  }

  let netBounds = null;
  function getNetBounds() {
    if (netBounds) return netBounds;
    let s = 90, n = -90, w = 180, e = -180;
    for (const f of canals) for (const line of f.geometry.coordinates) for (const [x, y] of line) {
      if (y < s) s = y; if (y > n) n = y; if (x < w) w = x; if (x > e) e = x;
    }
    return netBounds = { s, n, w, e };
  }

  function searchLocation(latlng) {
    chipMsg = null;
    selected = [];
    traceCache.clear();
    traceLayer.clearLayers();
    const lat = latlng.lat, lng = latlng.lng;
    const items = [];
    for (const f of canals) {
      const hit = nearestOnCanal(f, lat, lng);
      if (hit.d <= LOC_RADIUS_M) items.push({ f, d: hit.d, pt: hit.pt });
    }
    items.sort((a, b) => a.d - b.d);
    const structs = window.STRUCTURES_DATA
      .map(s => ({ s, d: meters([lat, lng], [s.lat, s.lon]) }))
      .filter(x => x.d <= LOC_RADIUS_M)
      .sort((a, b) => a.d - b.d);
    const b = getNetBounds(), pad = 0.02;
    const outside = lat < b.s - pad || lat > b.n + pad || lng < b.w - pad || lng > b.e + pad;
    loc = {
      latlng: [lat, lng], items, structs, outside,
      keys: new Set(items.map(it => it.f.properties.key || it.f.properties.name)),
      nearestKey: items.length ? items[0].f.properties.key || items[0].f.properties.name : null,
    };
    refreshCanalStyles();
    drawLoc();
    updateChip();
    showDetail(locHtml(), () => locHtml());
    closeDrawerOnMobile(); // let the map + bottom sheet take over
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.9 });
  }

  function drawLoc() {
    locLayer.clearLayers();
    if (!loc) return;
    L.circle(loc.latlng, {
      radius: LOC_RADIUS_M, color: '#4fc3f7', weight: 1.5, opacity: 0.8,
      dashArray: '4 6', fillColor: '#4fc3f7', fillOpacity: 0.06, interactive: false,
    }).addTo(locLayer);
    const nearest = loc.items[0];
    if (nearest) { // thread from the pin to the closest canal
      L.polyline([loc.latlng, nearest.pt], { color: '#4fc3f7', weight: 1.4, opacity: 0.8, dashArray: '2 5', interactive: false }).addTo(locLayer);
      L.circleMarker(nearest.pt, { radius: 4.5, color: '#ffffff', weight: 1.5, fillColor: '#4fc3f7', fillOpacity: 1, interactive: false }).addTo(locLayer);
    }
    L.marker(loc.latlng, {
      zIndexOffset: 1000, interactive: false,
      icon: L.divIcon({ className: '', html: '<div class="loc-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 17] }),
    }).addTo(locLayer);
  }

  function locHtml() {
    const meta = `${loc.latlng[0].toFixed(5)}, ${loc.latlng[1].toFixed(5)} · ${t('loc_radius').replace('{r}', fmtRadius(LOC_RADIUS_M))}`;
    let html = `<div class="pop-title">${t('loc_result_title')}</div><div class="pop-meta">${meta}</div>`;
    if (loc.outside) html += `<div class="pop-note" style="margin-top:8px">${t('loc_outside')}</div>`;
    if (!loc.items.length) return html + `<div class="loc-empty">${t('loc_none').replace('{r}', fmtRadius(LOC_RADIUS_M))}</div>`;

    const rows = loc.items.map(it => {
      const p = it.f.properties;
      const key = p.key || p.name;
      const sec = subName(p);
      const conns = graph.adj[key] || [];
      const riverChip = riverSet.has(key) && riverKey && p.waterway !== 'river'
        ? `<button class="conn-link river" data-key="${esc(riverKey)}">🌊 ${t('river')}</button>` : '';
      let connHtml;
      if (p.waterway === 'river') {
        connHtml = `<span class="conn-none">${t('loc_river_note')}</span>`;
      } else if (conns.length || riverChip) {
        const chips = conns.slice(0, 8).map(nb =>
          `<button class="conn-link" data-key="${esc(nb)}">${displayName(nameOf(nb))}</button>`).join('');
        connHtml = riverChip + chips +
          (conns.length > 8 ? ` <span class="conn-more">+${conns.length - 8}</span>` : '');
      } else {
        connHtml = `<span class="conn-none">${t('loc_noconn')}</span>`;
      }
      const lvHere = liveByCanal[key];
      const lvTitle = lvHere ? ` title="${t('live_st_' + lvHere.status)}"` : '';
      const hint = areaHint(p);
      const hintHtml = hint ? ` <span class="dup-hint">${hint.far ? t('list_dup_far') : esc(hint.district)}</span>` : '';
      return `<li class="loc-item" data-key="${esc(key)}">` +
        `<div class="row1"><span class="chip" style="background:${displayColor(p)}"${lvTitle}></span>` +
        `<span class="name">${displayName(p)}${sec ? ` <span class="thai">${sec}</span>` : ''}${hintHtml}</span>` +
        `<span class="dist">${fmtDist(it.d)}</span></div>` +
        `<div class="conns"><span class="conn-label">${t('loc_conn')}:</span> ${connHtml}</div></li>`;
    }).join('');

    const structRows = loc.structs.map(x => {
      const idx = window.STRUCTURES_DATA.indexOf(x.s);
      const kind = x.s.kind === 'gate' ? t('kind_gate') : x.s.kind === 'pump' ? t('kind_pump') : t('kind_weir');
      return `<button class="loc-struct" data-idx="${idx}"><b>${displayName(x.s)}</b>` +
        `<span class="meta">${kind} · ${fmtDist(x.d)}</span></button>`;
    }).join('');

    // the bulk "select all" toggle for the radius results lives on the map chip
    return html +
      `<ul class="loc-list">${rows}</ul>` +
      (loc.structs.length
        ? `<div class="pop-path"><div class="label">${t('loc_structs_near')}</div>${structRows}</div>` : '') +
      `<div class="loc-hint">👆 ${t('loc_row_hint')}</div>`;
  }

  // ---------- styling ----------
  function styleFor(p) {
    const routes = selected.map(k => traceCache.get(k)).filter(tr => tr && tr.reachable);
    if (routes.length) {
      if (routes.some(tr => tr.startKey === p.key))
        return { color: displayColor(p), weight: 7, opacity: 1, lineCap: 'round' };
      if (routes.some(tr => tr.pathKeys.includes(p.key)))
        return { color: displayColor(p), weight: 5, opacity: 0.95, lineCap: 'round' };
      return { color: '#7a8a99', weight: 1, opacity: 0.12, lineCap: 'round' };
    }
    if (loc) {
      if (loc.keys.has(p.key)) {
        const w = p.key === loc.nearestKey ? 7 : 5;
        return { color: displayColor(p), weight: w, opacity: 1, lineCap: 'round' };
      }
      return { color: '#7a8a99', weight: 1, opacity: 0.12, lineCap: 'round' };
    }
    if (p.curated) {
      const w = Math.min(6, 1.8 + Math.sqrt(p.length_km) * 0.8);
      return { color: displayColor(p), weight: w, opacity: 0.95, lineCap: 'round' };
    }
    const w = Math.min(2.5, 0.9 + Math.sqrt(p.length_km) * 0.3);
    return { color: displayColor(p), weight: w, opacity: 0.4, lineCap: 'round' };
  }
  // per-polyline style: multi-gauge canals show each reach's own colour
  // whenever the canal-level style would use the worst-status colour — i.e.
  // in the default view, on a loc hit, and under a trace — while dimmed or
  // filtered-out states stay uniform grey
  function layerStyle(f, i) {
    const p = f.properties;
    const st = styleFor(p);
    if (st.color !== displayColor(p)) return st;
    const secs = sectionsByCanal.get(p.key || p.name);
    if (!secs || !secs.list[i]) return st;
    return { ...st, color: LIVE_COLOR[secs.list[i].status] || NO_DATA_COLOR };
  }
  function refreshCanalStyles() {
    for (const [f, layers] of featureToLayer) layers.forEach((layer, i) => layer.setStyle(layerStyle(f, i)));
    // the situation glow competes with a trace/loc selection — fade it while one is active
    const pane = map.getPane('liveHalo');
    if (pane) pane.style.opacity = (selected.length || loc) ? 0.15 : '';
  }

  // ---------- detail panel content ----------
  function liveHtmlFor(p) {
    if (!LIVE) return '';
    const lv = liveByCanal[p.key];
    if (!lv) return `<div class="pop-live none">${t('live_none')}</div>`;
    const head =
      `<div class="live-head"><span class="live-dot" style="background:${LIVE_COLOR[lv.status]}"></span>${t('live_st_' + lv.status)}</div>` +
      (lv.level != null
        ? `<div class="live-levels">${t('live_level')}: <b>${lv.level.toFixed(2)}</b> ${t('live_unit')}` +
          (lv.warning != null ? ` · ${t('live_warn')} ${lv.warning}` : '') +
          (lv.critical != null ? ` · ${t('live_crit')} ${lv.critical}` : '') +
          (lv.dry != null ? ` · ${t('live_low')} ${lv.dry}` : '') + `</div>`
        : '');
    const secs = sectionsByCanal.get(p.key);
    if (secs) { // multi-gauge canal: one row per reach instead of a raw station dump
      const rows = secs.list.map((sec, i) => {
        const color = LIVE_COLOR[sec.status] || NO_DATA_COLOR;
        // a faulty station's level is a frozen last gasp — show the fault, not a stale number
        const lvl = sec.main.status !== 'faulty' && sec.main.level != null
          ? `${sec.main.level.toFixed(2)} ${t('live_unit')}` : t('live_faulty_short');
        const extra = sec.stations.length > 1
          ? ` <span class="sec-more" title="${esc(sec.stations.slice(1).map(stationName).join(' · '))}">+${sec.stations.length - 1}</span>` : '';
        return `<button class="sec-row" data-key="${esc(p.key)}" data-sec="${i}" title="${esc(t('live_st_' + sec.status))}">` +
          `<span class="live-dot" style="background:${color}"></span>` +
          `<span class="sec-km">${sec.fromKm.toFixed(1)}–${sec.toKm.toFixed(1)} ${t('km_unit')}</span>` +
          `<span class="sec-name">${esc(stationName(sec.main))}${extra}</span>` +
          `<span class="sec-lvl" style="color:${color}">${lvl}</span></button>`;
      }).join('');
      return `<div class="pop-live" style="border-left-color:${LIVE_COLOR[lv.status]}">` + head +
        `<div class="sec-list"><div class="sec-label">${t('sec_h').replace('{n}', secs.list.length)}</div>${rows}</div>` +
        `<div class="pop-meta">${t('live_reading')}: ${fmtBangkok(lv.ts)}</div></div>`;
    }
    const sts = lv.stations.map(c => stationByCode.get(c)).filter(Boolean);
    const shown = sts.slice(0, 4);
    const stationLine = s =>
      `${esc(stationName(s))} — ` +
      (s.level != null ? `${s.level.toFixed(2)} ${t('live_unit')}` : t('live_faulty_short')) +
      (s.match === 'near' ? ` <span class="st-near">(${t('live_near')})</span>` : '');
    return `<div class="pop-live" style="border-left-color:${LIVE_COLOR[lv.status]}">` + head +
      (shown.length
        ? `<div class="live-stations">${shown.map(stationLine).join('<br>')}` +
          (sts.length > shown.length ? `<br>${t('live_more').replace('{n}', sts.length - shown.length)}` : '') + `</div>`
        : '') +
      `<div class="pop-meta">${t('live_reading')}: ${fmtBangkok(lv.ts)}</div></div>`;
  }

  function detailHtml(p) {
    const badges = [];
    const lvNow = liveByCanal[p.key];
    if (lvNow && lvNow.status !== 'faulty')
      badges.push(`<span class="badge live-${lvNow.status}"><span class="live-dot" style="background:${LIVE_COLOR[lvNow.status]}"></span>${t('now_prefix')}${t('live_st_' + lvNow.status)}</span>`);
    if (p.risk_type) badges.push(`<span class="badge type">${t('type_' + p.risk_type)}</span>`);
    if (p.curated) badges.push(`<span class="badge type">${t('reviewed')}</span>`);

    const tr = traceCache.get(p.key);
    let routeHtml = '';
    if (tr && !tr.reachable) {
      routeHtml = `<div class="pop-path"><div class="label">${t('route_path')}</div>` +
        `<div class="chain">${t('no_conn').replace('{river}', t('river'))}</div></div>`;
    } else if (tr) {
      const chain = tr.pathKeys.map(k => displayName(nameOf(k))).join(' <span class="arrow">→</span> ');
      let dest = `<b>${t('dest_river')}</b>`;
      if (tr.mouth) dest += ` <span class="arrow">→</span> <b>${t('dest_sea')}</b>`;
      const kmNote = tr.riverKm != null
        ? t('km_note').replace('{km}', tr.riverKm.toFixed(0))
        : '';
      routeHtml = `<div class="pop-path"><div class="label">${t('route_label')}</div>` +
        `<div class="chain">${chain} <span class="arrow">→</span> ${dest}</div>` +
        `<div class="pop-note" style="margin-top:6px">${kmNote}${t('flow_note')}</div></div>`;
    }

    const primary = displayName(p), secondary = subName(p);
    const note = lang === 'th' ? (p.note_th || p.note) : p.note;
    return `<div class="pop-title">${primary}</div>` +
      (secondary ? `<div class="pop-thai">${secondary}</div>` : '') +
      `<div class="pop-badges">${badges.join('')}</div>` +
      liveHtmlFor(p) +
      routeHtml +
      (note ? `<div class="pop-note">${note}</div>` : '') +
      `<div class="pop-meta">${p.length_km} km · ${p.waterway} · © OpenStreetMap</div>`;
  }

  // the panel stacks every selected canal (newest first) so several can be
  // compared side by side while their routes stay on the map
  function selectionHtml() {
    if (!selected.length) return '';
    if (selected.length === 1) return detailHtml(keyToFeature.get(selected[0]).properties);
    return `<div class="pop-title">${t('sel_count').replace('{n}', selected.length)}</div>` +
      [...selected].reverse().map(k => detailHtml(keyToFeature.get(k).properties)).join('<hr class="sel-sep">');
  }

  // ---------- canal layers ----------
  // hover tooltip: canal name + the current water level from the live snapshot;
  // canals without a working gauge show nothing extra (never a frozen reading)
  function canalTipHtml(p) {
    const name = `<div class="tip-name">${displayName(p)}</div>`;
    const lv = liveByCanal[p.key || p.name];
    if (!lv || lv.status === 'faulty' || lv.level == null) return name;
    return name +
      `<div class="tip-live"><span class="live-dot" style="background:${LIVE_COLOR[lv.status]}"></span>` +
      `${t('live_st_' + lv.status)} · ${lv.level.toFixed(2)} ${t('live_unit')}</div>`;
  }
  // multi-gauge canals become one polyline per reach so their colours read
  // reach by reach even before anything is selected
  // every layer carrying a canal tooltip (hit + visible) — retranslated on language change
  const tipLayers = [];
  let hoverTimer = null;
  function applyHover(f, on) {
    (featureToLayer.get(f) || []).forEach((layer, i) => {
      const st = layerStyle(f, i);
      layer.setStyle(on ? { ...st, weight: st.weight + 2.5, opacity: 1 } : st);
    });
  }
  for (const f of canals) {
    const p = f.properties;
    const key = p.key || p.name;
    const secs = sectionsByCanal.get(key);
    // every geom is an array of [lon, lat] lines: one per reach, or all parts
    const geoms = secs ? secs.list.map(sec => [sec.line]) : [f.geometry.coordinates];
  // every layer carrying a canal tooltip (hit + visible) — retranslated on language change
  const tipLayers = [];
  const wireCanal = layer => {
    layer.bindTooltip(canalTipHtml(p), { sticky: true, className: 'canal-tip', direction: 'top' });
    tipLayers.push({ layer, p });
      layer.on('click', () => selectCanal(key));
      layer.on('mouseover', () => { clearTimeout(hoverTimer); applyHover(f, true); });
      // sliding across a reach boundary fires out+in — debounce so the
      // whole-canal highlight doesn't flicker at the seams
      layer.on('mouseout', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => applyHover(f, false), 60); });
    };
    // the drawn lines are 1–7px and nearly impossible to hit when dimmed, so
    // each one also gets an invisible fat stroke as its click target (opacity 0
    // still receives pointer events on the stroke). Hit lines are added under
    // their own visible line so the status draw order keeps deciding who wins
    // where canals overlap
    const hitLayers = geoms.map(geom => {
      const layer = L.polyline(toLatLngs(geom),
        { weight: 14, opacity: 0, pane: 'overlayPane', bubblingMouseEvents: false });
      wireCanal(layer);
      return layer;
    });
    const layers = geoms.map((geom, i) => {
      const layer = L.polyline(toLatLngs(geom),
        { ...layerStyle(f, i), pane: 'overlayPane', bubblingMouseEvents: false });
      wireCanal(layer);
      return layer;
    });
    const lv = liveByCanal[key];
    const home = lv && statusLayers[lv.status] ? statusLayers[lv.status] : baseLayer;
    for (const layer of [...hitLayers, ...layers]) layer.addTo(home);
    featureToLayer.set(f, layers);
  }
  baseLayer.addTo(map); // unmonitored canals — always on
  // draw severe statuses last so their lines sit on top where canals overlap
  for (const s of ['normal', 'dry', 'warning', 'critical']) statusLayers[s].addTo(map);

  // ---------- live-severity halo ----------
  // The base line already carries the current status colour; this glow just
  // adds emphasis, so a canal in flood stays visible among the thinner lines
  // (most canals carry no curated history).
  const haloPane = map.createPane('liveHalo');
  haloPane.style.zIndex = 390; // under the canal lines (overlayPane = 400)
  const liveHalo = L.layerGroup();
  const haloWeight = p => Math.min(6, 1.8 + Math.sqrt(p.length_km) * 0.8) + 7;
  for (const f of canals) {
    const p = f.properties;
    const lv = liveByCanal[p.key || p.name];
    if (!lv || lv.status === 'normal' || lv.status === 'dry' || lv.status === 'faulty') continue;
    // multi-gauge canals glow only around the reaches that are actually bad
    const secs = sectionsByCanal.get(p.key || p.name);
    const rings = secs
      ? secs.list.filter(sec => sec.status === 'warning' || sec.status === 'critical')
          .map(sec => ({ line: sec.line, status: sec.status }))
      : [{ line: null, status: lv.status }];
    for (const ring of rings) {
      for (const line of (ring.line ? [ring.line] : f.geometry.coordinates))
        L.polyline(toLatLngs([line])[0], {
          color: LIVE_COLOR[ring.status], weight: haloWeight(p),
          opacity: ring.status === 'critical' ? 0.42 : 0.28,
          interactive: false, pane: 'liveHalo',
        }).addTo(liveHalo);
    }
  }
  liveHalo.addTo(map);

  // ---------- structures ----------
  const structLayer = L.layerGroup();
  const structMarkers = [];
  function structHtml(s) {
    const kind = s.kind === 'gate' ? t('kind_gate') : s.kind === 'pump' ? t('kind_pump') : t('kind_weir');
    const acc = s.accuracy === 'exact (OSM)' ? t('acc_exact')
      : s.accuracy === 'approximate' ? t('acc_approx')
      : s.accuracy === 'from OSM' ? t('acc_osm') : s.accuracy;
    const note = lang === 'th' ? (s.note_th || s.note) : s.note;
    const secondary = subName(s);
    return `<div class="pop-title">${displayName(s)}</div>` +
      (secondary ? `<div class="pop-thai">${secondary}</div>` : '') +
      `<div class="pop-badges"><span class="badge type">${kind}</span></div>` +
      (note ? `<div class="pop-note">${note}</div><div class="pop-meta">${t('loc')}: ${acc}</div>` :
        `<div class="pop-note">${t('struct_note')}</div>`);
  }
  for (const s of window.STRUCTURES_DATA) {
    const icon = L.divIcon({
      className: '',
      html: `<div class="struct-marker ${s.kind}" style="width:20px;height:20px">${s.kind === 'gate' ? 'G' : 'P'}</div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    const m = L.marker([s.lat, s.lon], { icon });
    m.bindTooltip(displayName(s), { className: 'canal-tip', direction: 'top' });
    m.on('click', () => showDetail(structHtml(s), () => structHtml(s)));
    m.addTo(structLayer);
    structMarkers.push({ s, m });
  }
  structLayer.addTo(map);

  // ---------- selection / trace control ----------
  const chip = document.getElementById('trace-chip');
  const chipLoc = document.getElementById('chip-loc');
  const chipSelAll = document.getElementById('chip-select-all');
  const chipSelAllBox = document.getElementById('chip-select-all-box');
  let chipMsg = null; // transient chip message (locating… / geolocation error)

  // the floating control bar over the map: contextual message, the radius
  // select-all toggle and the "my location" shortcut — always on screen
  function updateChip() {
    chip.classList.remove('hidden');
    const msg = chipMsg || (loc && !selected.length ? t('loc_chip') : null);
    chipLoc.classList.toggle('hidden', !msg);
    if (msg) chipLoc.textContent = msg;
    const canSelectAll = !!loc && loc.items.length > 0;
    chipSelAll.classList.toggle('hidden', !canSelectAll);
    if (canSelectAll) {
      chipSelAllBox.checked = loc.items.every(it => selected.includes(it.f.properties.key || it.f.properties.name));
    }
    // nothing but the "my location" button → drop the pill chrome around it
    chip.classList.toggle('bare', chipLoc.classList.contains('hidden') && !canSelectAll);
  }
  const panel = document.getElementById('detail-panel');
  const panelBody = document.getElementById('detail-body');
  const resizeAfterPanel = () => setTimeout(() => map.invalidateSize(), 280); // panel slides in 250ms

  let currentDetailRender = null; // re-invoked when the language changes while the panel is open
  function showDetail(html, render) {
    currentDetailRender = render || null;
    panelBody.innerHTML = html;
    updatePanelTitle();
    setSheetCollapsed(false); // a fresh result always opens expanded
    panel.classList.add('open');
    document.body.classList.add('detail-open'); // shrink the map to make room
    resizeAfterPanel();
  }
  function hideDetail() {
    if (!panel.classList.contains('open')) return;
    panel.classList.remove('open');
    setSheetCollapsed(false);
    document.body.classList.remove('detail-open');
    currentDetailRender = null;
    resizeAfterPanel();
  }

  // ---------- bottom-sheet collapse (tablet/phone) ----------
  // The sheet folds down to a slim title bar so the map and the route lines
  // stay visible: drag the header, tap it, or use the chevron button.
  const isSheet = () => window.matchMedia('(max-width: 1023px)').matches;
  const panelHead = panel.querySelector('header');
  const panelTitle = document.getElementById('detail-title');
  const collapseBtn = document.getElementById('detail-collapse');
  function updatePanelTitle() {
    const title = panelBody.querySelector('.pop-title');
    panelTitle.innerHTML = title ? title.innerHTML : t('details');
  }
  function setSheetCollapsed(collapsed) {
    panel.classList.toggle('collapsed', collapsed);
    panelBody.setAttribute('aria-hidden', String(collapsed));
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.title = collapsed ? t('detail_expand') : t('detail_collapse');
  }
  function syncSheetPeek() { // keep the CSS snap point at the real header height
    if (isSheet()) panel.style.setProperty('--sheet-peek', panelHead.offsetHeight + 'px');
  }
  syncSheetPeek();
  collapseBtn.addEventListener('click', () => setSheetCollapsed(!panel.classList.contains('collapsed')));

  let sheetDrag = null, sheetClickSuppress = false;
  panelHead.addEventListener('pointerdown', e => {
    if (!isSheet() || !panel.classList.contains('open')) return;
    if (e.target.closest('button')) return; // the buttons keep their own clicks
    sheetClickSuppress = false;
    sheetDrag = {
      startY: e.clientY,
      base: panel.classList.contains('collapsed') ? panel.offsetHeight - panelHead.offsetHeight : 0,
      moved: false, lastY: e.clientY, lastT: e.timeStamp, v: 0,
    };
    panel.classList.add('dragging');
    panelHead.setPointerCapture(e.pointerId);
  });
  panelHead.addEventListener('pointermove', e => {
    if (!sheetDrag) return;
    const dy = e.clientY - sheetDrag.startY;
    if (Math.abs(dy) > 5) sheetDrag.moved = true;
    const dt = e.timeStamp - sheetDrag.lastT;
    if (dt > 0) sheetDrag.v = sheetDrag.v * 0.8 + ((e.clientY - sheetDrag.lastY) / dt) * 0.2;
    sheetDrag.lastY = e.clientY; sheetDrag.lastT = e.timeStamp;
    const max = panel.offsetHeight - panelHead.offsetHeight;
    const off = Math.max(0, Math.min(max, sheetDrag.base + dy));
    panel.style.transform = `translateY(${off}px)`;
  });
  panelHead.addEventListener('pointerup', e => {
    if (!sheetDrag) return;
    const d = sheetDrag;
    sheetDrag = null;
    panel.classList.remove('dragging');
    if (!d.moved) { panel.style.transform = ''; return; } // a tap — the click handler toggles
    const max = panel.offsetHeight - panelHead.offsetHeight;
    const off = Math.max(0, Math.min(max, d.base + (e.clientY - d.startY)));
    const collapsed = d.v > 0.45 ? true : d.v < -0.45 ? false : off > max / 2; // flick wins over position
    sheetClickSuppress = true; // the release must not also register as a tap
    panel.style.transform = '';
    setSheetCollapsed(collapsed);
  });
  panelHead.addEventListener('pointercancel', () => {
    if (!sheetDrag) return;
    sheetDrag = null;
    panel.classList.remove('dragging');
    panel.style.transform = '';
  });
  panelHead.addEventListener('click', e => {
    if (sheetClickSuppress) { sheetClickSuppress = false; return; }
    if (!isSheet() || !panel.classList.contains('open')) return;
    if (e.target.closest('button')) return;
    setSheetCollapsed(!panel.classList.contains('collapsed'));
  });

  function selectCanal(key) {
    const pos = selected.indexOf(key);
    if (pos >= 0) { // clicking a selected canal takes it out of the selection
      selected.splice(pos, 1);
      traceCache.delete(key);
    } else {
      // the dropped pin stays on the map — the trace just takes over highlighting
      selected.push(key);
      traceCache.set(key, { startKey: key, ...computeTrace(key) });
    }
    refreshCanalStyles();
    if (!selected.length) { clearSelection(); return; }
    drawTrace();
    updateChip();
    showDetail(selectionHtml(), () => selectionHtml());
  }
  function clearSelection() {
    setPickMode(false);
    selected = [];
    traceCache.clear();
    traceLayer.clearLayers();
    loc = null;
    locLayer.clearLayers();
    refreshCanalStyles();
    chipMsg = null;
    updateChip();
    hideDetail();
  }
  // ---------- help popover ----------
  const helpToggle = document.getElementById('help-toggle');
  const helpPanel = document.getElementById('help-panel');
  function setHelpOpen(open) {
    helpPanel.classList.toggle('hidden', !open);
    helpToggle.classList.toggle('active', open);
    helpToggle.setAttribute('aria-expanded', String(open));
  }
  helpToggle.addEventListener('click', () => setHelpOpen(helpPanel.classList.contains('hidden')));
  document.getElementById('help-close').addEventListener('click', () => setHelpOpen(false));
  document.addEventListener('click', e => { // any click outside the popover dismisses it
    if (!helpPanel.classList.contains('hidden') &&
        !helpPanel.contains(e.target) && !helpToggle.contains(e.target)) setHelpOpen(false);
  });

  map.on('click', e => {
    if (pickMode) { setPickMode(false); searchLocation(e.latlng); return; }
    clearSelection();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!helpPanel.classList.contains('hidden')) { setHelpOpen(false); return; }
    clearSelection();
  });
  document.getElementById('detail-close').addEventListener('click', clearSelection);

  // ---------- location lookup UI ----------
  let pickMode = false;
  const pickBtn = document.getElementById('loc-pick');
  const locMsgEl = document.getElementById('loc-msg');
  function setPickMode(on) {
    pickMode = on;
    pickBtn.classList.toggle('active', on);
    document.body.classList.toggle('pick-mode', on);
  }
  const locMsg = s => { locMsgEl.textContent = s || ''; };
  function doLocSearch() {
    const ll = parseCoords(document.getElementById('loc-input').value);
    if (!ll) { locMsg(t('loc_invalid')); return; }
    locMsg('');
    setPickMode(false);
    searchLocation(L.latLng(ll[0], ll[1]));
  }
  document.getElementById('loc-go').addEventListener('click', doLocSearch);
  document.getElementById('loc-input').addEventListener('keydown', e => { if (e.key === 'Enter') doLocSearch(); });
  pickBtn.addEventListener('click', () => setPickMode(!pickMode));
  document.getElementById('chip-here').addEventListener('click', () => {
    if (!navigator.geolocation) { chipMsg = t('loc_geo_err'); updateChip(); return; }
    chipMsg = t('loc_locating');
    updateChip();
    navigator.geolocation.getCurrentPosition(
      pos => { searchLocation(L.latLng(pos.coords.latitude, pos.coords.longitude)); },
      () => { chipMsg = t('loc_geo_err'); updateChip(); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  // ---------- search-radius select ----------
  const radiusSel = document.getElementById('loc-radius');
  function renderRadiusOptions() {
    radiusSel.innerHTML = LOC_RADII.map(r => `<option value="${r}">${fmtRadius(r)}</option>`).join('');
    radiusSel.value = String(LOC_RADIUS_M);
  }
  try { // restore the last chosen radius
    const saved = +localStorage.getItem('klong_radius');
    if (LOC_RADII.includes(saved)) LOC_RADIUS_M = saved;
  } catch (e) { /* storage unavailable */ }
  radiusSel.addEventListener('change', () => {
    LOC_RADIUS_M = +radiusSel.value;
    try { localStorage.setItem('klong_radius', String(LOC_RADIUS_M)); } catch (e) { /* storage unavailable */ }
    if (!loc) return;
    if (document.querySelector('#detail-body .loc-list')) { // loc results open: refresh them
      searchLocation(L.latLng(loc.latlng[0], loc.latlng[1]));
    } else { // a trace is on screen: just resize the radius circle around the pin
      drawLoc();
    }
  });

  // panel clicks: canal rows / connection chips / nearby structures / sections
  panelBody.addEventListener('click', e => {
    const conn = e.target.closest('.conn-link');
    if (conn) {
      const f = keyToFeature.get(conn.dataset.key);
      if (f) focusCanal(f);
      return;
    }
    const secRow = e.target.closest('.sec-row');
    if (secRow && secRow.dataset.key) {
      focusSection(secRow.dataset.key, +secRow.dataset.sec);
      return;
    }
    const st = e.target.closest('.loc-struct');
    if (st) {
      const s = window.STRUCTURES_DATA[+st.dataset.idx];
      if (s) showDetail(structHtml(s), () => structHtml(s));
      return;
    }
    const row = e.target.closest('.loc-item');
    if (row) {
      const f = keyToFeature.get(row.dataset.key);
      if (f) focusCanal(f);
    }
  });

  // the map-chip "select all" toggle: put every canal the search found inside
  // the radius into the multi-selection (each with its own drainage trace), or
  // take them all back out. The panel stays on the loc results; traces map to
  // the usual stacked rendering. Unchecking the last canal returns the panel
  // to the radius results.
  function setRadiusSelection(on) {
    if (!loc) return;
    for (const it of loc.items) {
      const key = it.f.properties.key || it.f.properties.name;
      const pos = selected.indexOf(key);
      if (on && pos < 0) {
        selected.push(key);
        traceCache.set(key, { startKey: key, ...computeTrace(key) });
      } else if (!on && pos >= 0) {
        selected.splice(pos, 1);
        traceCache.delete(key);
      }
    }
    refreshCanalStyles();
    if (selected.length) drawTrace();
    else traceLayer.clearLayers();
    updateChip();
    if (!selected.length && !document.querySelector('#detail-body .loc-list')) {
      showDetail(locHtml(), () => locHtml());
    }
  }
  chipSelAllBox.addEventListener('change', () => setRadiusSelection(chipSelAllBox.checked));

  // ---------- stats ----------
  const totalKm = canals.reduce((a, f) => a + f.properties.length_km, 0);
  // multi-gauge canals count only the reaches that are actually critical
  const critKm = canals.reduce((a, f) => {
    const key = f.properties.key || f.properties.name;
    const secs = sectionsByCanal.get(key);
    if (secs) return a + secs.list
      .filter(s => s.status === 'critical')
      .reduce((x, s) => x + (s.toKm - s.fromKm), 0);
    return liveByCanal[key]?.status === 'critical' ? a + f.properties.length_km : a;
  }, 0);
  function renderStats() {
    document.getElementById('stats').innerHTML =
      `<div class="stat"><b>${canals.length}</b><span>${t('stats_canals')}</span></div>` +
      `<div class="stat"><b>${Math.round(totalKm).toLocaleString()}</b><span>${t('stats_km')}</span></div>` +
      `<div class="stat"><b>${Math.round(critKm).toLocaleString()}</b><span>${t('stats_km_crit')}</span></div>` +
      `<div class="stat"><b>${window.STRUCTURES_DATA.length}</b><span>${t('stats_structs')}</span></div>`;
  }

  // ---------- live status panel ----------
  function tideHtml() {
    if (!TIDE || !TIDE.tide) return '';
    // highlight the next tide still to come — high tide is when canals drain worst
    const nextAt = TIDE.tide.events.find(e => e.at > Date.now())?.at ?? null;
    const rows = TIDE.tide.events.map(e =>
      `<div class="tide-row${e.at === nextAt ? ' next' : ''}">` +
      `<span class="tide-time">${fmtClock(e.at)}</span>` +
      `<span class="tide-chip ${e.type}">${t(e.type === 'high' ? 'tide_high' : 'tide_low')}</span>` +
      `<span class="tide-level"><b>${e.level.toFixed(2)}</b> ${t('tide_unit')}</span></div>`).join('');
    return `<div class="tide-block"><div class="tide-head">${t('tide_h')}</div>${rows}` +
      `<div class="live-src">${t('tide_src')}</div></div>`;
  }

  function renderLive() {
    const el = document.getElementById('live-panel');
    if (!LIVE) { el.classList.add('hidden'); return; }
    const c = LIVE.counts || {};
    const chips = [['critical', c.critical, t('live_cri')], ['warning', c.warning, t('live_war')],
      ['normal', c.normal, t('live_nor')], ['dry', c.dry, t('live_dry')], ['faulty', c.faulty, t('live_fau')]];
    el.innerHTML =
      `<h2><span class="live-pulse"></span>${t('live_h')}</h2>` +
      `<div class="live-updated"><span class="lbl">${t('live_reading')}:</span> <b>${fmtBangkok(LIVE.latest_reading)}</b><br>` +
      `<span class="lbl">${t('live_fetched')}:</span> ${fmtBangkok(LIVE.fetched_at)}</div>` +
      `<div class="live-counts">${chips.map(([k, n, lbl]) =>
        `<span class="live-count" title="${t('live_st_' + k)}"><i style="background:${LIVE_COLOR[k]}"></i>${lbl} ${n ?? 0}</span>`).join('')}</div>` +
      tideHtml() +
      `<div class="live-src">${t('live_src')}</div>`;
  }

  // ---------- filters ----------
  function applyFilters() {
    for (const s of STATUS_KEYS) {
      if (document.getElementById('f-' + s).checked) map.addLayer(statusLayers[s]);
      else map.removeLayer(statusLayers[s]);
    }
    if (document.getElementById('f-struct').checked) map.addLayer(structLayer);
    else map.removeLayer(structLayer);
    if (document.getElementById('f-live').checked) map.addLayer(liveHalo);
    else map.removeLayer(liveHalo);
  }
  STATUS_KEYS.map(s => 'f-' + s).concat(['f-struct', 'f-live']).forEach(id =>
    document.getElementById(id).addEventListener('change', applyFilters));

  // ---------- canal list & search ----------
  const listEl = document.getElementById('canal-list');
  const byLength = [...canals].sort((a, b) => b.properties.length_km - a.properties.length_km);

  // same-named canals in different places (คลองด่าน exists twice, คลองหนึ่ง seven
  // times…) — annotate list rows with the district of the canal's own gauges,
  // the district of the nearest gauge, or "outside Bangkok"
  const dupHint = new Map(); // key -> '' (unique name) | { district } | { far: true }
  function areaHint(p) {
    const key = p.key || p.name;
    if (dupHint.has(key)) return dupHint.get(key);
    let hint = '';
    const nmTh = p.name_th || p.name, nmEn = p.name;
    if (canals.some(o => {
      const q = o.properties;
      return (q.key || q.name) !== key && ((q.name_th || q.name) === nmTh || q.name === nmEn);
    })) {
      const sts = (liveByCanal[key]?.stations || []).map(c => stationByCode.get(c)).filter(Boolean);
      if (sts.length && sts[0].district) hint = { district: sts[0].district };
      else {
        const f = keyToFeature.get(key);
        let best = Infinity, district = null;
        for (const s of LIVE ? LIVE.stations : []) {
          if (s.lat == null || s.lon == null || !s.district) continue;
          const hit = nearestOnCanal(f, s.lat, s.lon);
          if (hit.d < best) { best = hit.d; district = s.district; }
        }
        hint = district && best <= 2000 ? { district } : { far: true };
      }
    }
    dupHint.set(key, hint);
    return hint;
  }

  function focusCanal(f) {
    const key = f.properties.key || f.properties.name;
    selectCanal(key);
    closeDrawerOnMobile(); // picked from a list — show the map, not the list
    const layers = featureToLayer.get(f) || [];
    if (layers.length) {
      const bounds = layers[0].getBounds();
      for (let i = 1; i < layers.length; i++) bounds.extend(layers[i].getBounds());
      map.flyToBounds(bounds.pad(0.25), { maxZoom: 13, duration: 0.8 });
    }
  }

  let lastQuery = '';
  function renderList(filterText) {
    lastQuery = filterText || '';
    const q = lastQuery.trim().toLowerCase();
    let items = q
      ? canals.filter(f =>
          f.properties.name.toLowerCase().includes(q) ||
          (f.properties.name_th || '').includes(lastQuery.trim()))
      : byLength.slice(0, 40);
    // live-status severity first (critical → warning → dry → rest); within a tier
    // the original order (length / match sequence) is kept
    const statusRank = s => (s === 'critical' ? 0 : s === 'warning' ? 1 : s === 'dry' ? 2 : 3);
    items = items.sort((a, b) =>
      statusRank(liveByCanal[a.properties.key]?.status) -
      statusRank(liveByCanal[b.properties.key]?.status));
    if (q) items = items.slice(0, 30);
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = `<li class="none">${t('list_none')}</li>`;
      return;
    }
    for (const f of items) {
      const p = f.properties;
      const secondary = subName(p);
      const lv = liveByCanal[p.key];
      const lvTitle = lv ? ` title="${t('live_st_' + lv.status)}"` : '';
      const hint = areaHint(p);
      const hintHtml = hint ? ` <span class="dup-hint">${hint.far ? t('list_dup_far') : esc(hint.district)}</span>` : '';
      const li = document.createElement('li');
      li.innerHTML = `<span class="chip" style="background:${displayColor(p)}"${lvTitle}></span>` +
        `<span class="name">${displayName(p)}${secondary ? ` <span class="thai">${secondary}</span>` : ''}${hintHtml}</span>` +
        `<span class="km">${p.length_km} km</span>`;
      li.addEventListener('click', () => focusCanal(f));
      listEl.appendChild(li);
    }
  }
  document.getElementById('search').addEventListener('input', e => renderList(e.target.value));

  // ---------- language switch ----------
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.getElementById('sidebar-toggle').title = t('toggle_panel');
    document.getElementById('sidebar-close').title = t('sidebar_close_title');
    document.getElementById('detail-close').title = t('detail_close_title');
    document.getElementById('help-toggle').title = t('help_btn_title');
    document.getElementById('help-close').title = t('help_close_title');
    document.getElementById('lang-th').classList.toggle('active', lang === 'th');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    renderStats();
    renderLive();
    renderRadiusOptions();
    renderList(lastQuery);
    if (layerCtl) map.removeControl(layerCtl);
    layerCtl = L.control.layers({ [t('layer_osm')]: osm, [t('layer_esri')]: esriGray }, null, { position: 'bottomright' }).addTo(map);
    for (const { layer, p } of tipLayers) layer.setTooltipContent(canalTipHtml(p));
    for (const { s, m } of structMarkers) m.setTooltipContent(displayName(s));
    if (selected.length) drawTrace(); // rebuild river/sea tooltips in the new language
    updateChip();
    if (currentDetailRender) { panelBody.innerHTML = currentDetailRender(); updatePanelTitle(); }
    setSheetCollapsed(panel.classList.contains('collapsed')); // refresh the button title/aria
  }
  function setLang(l) {
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem('klong_lang', lang); } catch (e) { /* storage unavailable */ }
    applyLang();
  }
  document.getElementById('lang-th').addEventListener('click', () => setLang('th'));
  document.getElementById('lang-en').addEventListener('click', () => setLang('en'));
  applyLang();

  // ---------- sidebar / mobile drawer ----------
  const sidebarToggle = document.getElementById('sidebar-toggle');
  function setDrawerOpen(open) {
    document.body.classList.toggle('collapsed', !open);
    sidebarToggle.setAttribute('aria-expanded', String(open));
    setTimeout(() => map.invalidateSize(), 50);
  }
  // phones start on the map; the drawer opens on demand
  if (isPhoneNow) document.body.classList.add('collapsed');
  sidebarToggle.addEventListener('click', () => setDrawerOpen(true));
  document.getElementById('sidebar-close').addEventListener('click', () => setDrawerOpen(false));
  document.getElementById('backdrop').addEventListener('click', () => setDrawerOpen(false));
  function closeDrawerOnMobile() {
    if (isPhone()) setDrawerOpen(false);
  }
  window.addEventListener('resize', () => { map.invalidateSize(); syncSheetPeek(); });
})();
