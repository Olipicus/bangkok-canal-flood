#!/usr/bin/env bash
# update_data.sh — อัปเดตข้อมูลของแผนที่ในคำสั่งเดียว
#
#   ./update_data.sh              อัปเดตทุกอย่าง: เรขาคณิตคลองจาก OSM + ระดับน้ำสดจาก กทม.
#                                 + พยากรณ์น้ำขึ้น-น้ำลงเจ้าพระยาจาก flood69
#   ./update_data.sh --live-only  ดึงเฉพาะข้อมูลสดทั้งสองส่วน (เร็ว — ใช้บ่อยที่สุด)
#   ./update_data.sh --help       ดูวิธีใช้
#
# เว็บอ่านไฟล์ data/live_status.js และ data/flood69.js ตอนโหลดหน้า — หลังรัน
# สคริปต์แล้ว แค่ reload หน้าเว็บก็จะเห็นสถานะและเวลา "อ่านค่าล่าสุด / ดึงข้อมูลเมื่อ" ใหม่
set -euo pipefail
cd "$(dirname "$0")"

HELP='ตัวเลือก:
  (ไม่มี)            อัปเดตทุกอย่าง — rebuild เรขาคณิตคลองจาก OSM (build_data.mjs)
                     ดึงระดับน้ำสดจากสถานีตรวจวัดของ กทม. (fetch_live.mjs)
                     และพยากรณ์น้ำขึ้น-น้ำลงจาก flood69 (fetch_flood69.mjs)
  --live-only        ดึงเฉพาะข้อมูลสดทั้งสองส่วน — เร็ว ใช้เมื่อเรขาคณิตยังไม่ต้องเปลี่ยน
  -h, --help         แสดงวิธีใช้นี้'

LIVE_ONLY=0
case "${1:-}" in
  '')            LIVE_ONLY=0 ;;
  --live-only)   LIVE_ONLY=1 ;;
  -h|--help)     echo "ใช้: $0 [--live-only]"; echo "$HELP"; exit 0 ;;
  *)             echo "ไม่รู้จักตัวเลือก: $1 (ลอง --help)" >&2; exit 1 ;;
esac

command -v node >/dev/null || { echo "ต้องมี node ในเครื่อง (https://nodejs.org)" >&2; exit 1; }

trap 'echo "⚠️  อัปเดตไม่สำเร็จ — หน้าเว็บยังใช้ snapshot เดิมได้ตามปกติ (ดูป้าย \"ดึงข้อมูลเมื่อ\" บนหน้าเว็บเพื่อเช็คอายุข้อมูล)" >&2' ERR

if [ "$LIVE_ONLY" -eq 0 ]; then
  echo "── 1/2 · rebuild เรขาคณิตคลอง + ความเสี่ยง (build_data.mjs) ──"
  node build_data.mjs
  echo
fi

echo "── · ดึงระดับน้ำปัจจุบันจาก กทม. (fetch_live.mjs) ──"
node fetch_live.mjs
echo

# flood69 เป็นส่วนเสริม — ถ้าล้มเหลวไม่ต้องทำให้ทั้งรันล้ม (ข้อมูลหลักคือ live_status.js)
echo "── · ดึงพยากรณ์น้ำขึ้น-น้ำลงเจ้าพระยาจาก flood69 (fetch_flood69.mjs) ──"
if ! node fetch_flood69.mjs; then
  echo "⚠️  ส่วนน้ำขึ้น-น้ำลงอัปเดตไม่สำเร็จ — เว็บยังแสดง snapshot เดิมของ flood69 ได้ตามปกติ" >&2
fi
echo

echo "── สรุปข้อมูลที่เว็บจะแสดง ──"
node -e '
const m = require("fs").readFileSync("data/live_status.js", "utf8").match(/window\.LIVE_STATUS = (\{.*\});/s);
if (!m) { console.error("data/live_status.js อ่านไม่ได้"); process.exit(1); }
const d = JSON.parse(m[1]);
const fmt = ms => new Date(ms).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
console.log("สถานีตรวจวัด  : " + d.stations_total + " จุด (มีข้อมูลสดบน " + Object.keys(d.canals).length + " คลอง)");
console.log("สถานะ        : วิกฤต " + d.counts.critical + " · เตือนภัย " + d.counts.warning + " · ปกติ " + d.counts.normal + " · น้ำต่ำ " + (d.counts.dry || 0) + " · ขัดข้อง " + d.counts.faulty);
console.log("อ่านค่าล่าสุด : " + fmt(d.latest_reading));
console.log("ดึงข้อมูลเมื่อ : " + fmt(d.fetched_at));
'
node -e '
const fs = require("fs");
try {
  const m = fs.readFileSync("data/flood69.js", "utf8").match(/window\.FLOOD69_STATUS = (\{.*\});/s);
  if (!m) throw new Error("readable");
  const d = JSON.parse(m[1]);
  const hm = ms => new Date(ms).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  if (d.tide) {
    const row = e => (e.type === "high" ? "ขึ้น " : "ลง ") + hm(e.at) + " (" + e.level.toFixed(2) + " ม.รทก.)";
    console.log("น้ำขึ้น-ลงวันนี้: " + d.tide.events.map(row).join(" · "));
  } else {
    console.log("น้ำขึ้น-ลงวันนี้: ไม่มีข้อมูล");
  }
  console.log("flood69       : สถานีรายงานผล " + d.stations_reporting + "/" + d.stations_total + " จุด (" + (d.live_proxy ? "ตัวกลาง live" : "snapshot สำรอง") + ")");
} catch (e) {
  console.log("flood69       : ไม่มีข้อมูล");
}
'
echo
echo "เสร็จ — reload หน้าเว็บ (http://localhost:8420) เพื่อดูข้อมูลใหม่"
