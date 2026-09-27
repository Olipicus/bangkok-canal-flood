#!/usr/bin/env bash
# update_data.sh — อัปเดตข้อมูลของแผนที่ในคำสั่งเดียว
#
#   ./update_data.sh              อัปเดตทุกอย่าง: เรขาคณิตคลองจาก OSM + ระดับน้ำสดจาก กทม.
#   ./update_data.sh --live-only  ดึงเฉพาะระดับน้ำปัจจุบัน (เร็ว — ใช้บ่อยที่สุด)
#   ./update_data.sh --help       ดูวิธีใช้
#
# เว็บอ่านไฟล์ data/live_status.js ตอนโหลดหน้า — หลังรันสคริปต์แล้ว แค่ reload หน้าเว็บ
# ก็จะเห็นสถานะและเวลา "อ่านค่าล่าสุด / ดึงข้อมูลเมื่อ" ใหม่
set -euo pipefail
cd "$(dirname "$0")"

HELP='ตัวเลือก:
  (ไม่มี)            อัปเดตทุกอย่าง — rebuild เรขาคณิตคลองจาก OSM (build_data.mjs)
                     แล้วดึงระดับน้ำสดจากสถานีตรวจวัดของ กทม. (fetch_live.mjs)
  --live-only        ดึงเฉพาะระดับน้ำปัจจุบัน — เร็ว ใช้เมื่อเรขาคณิตยังไม่ต้องเปลี่ยน
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

echo "── สรุปข้อมูลที่เว็บจะแสดง ──"
node -e '
const m = require("fs").readFileSync("data/live_status.js", "utf8").match(/window\.LIVE_STATUS = (\{.*\});/s);
if (!m) { console.error("data/live_status.js อ่านไม่ได้"); process.exit(1); }
const d = JSON.parse(m[1]);
const fmt = ms => new Date(ms).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });
console.log("สถานีตรวจวัด  : " + d.stations_total + " จุด (มีข้อมูลสดบน " + Object.keys(d.canals).length + " คลอง)");
console.log("สถานะ        : วิกฤต " + d.counts.critical + " · เตือนภัย " + d.counts.warning + " · ปกติ " + d.counts.normal + " · ขัดข้อง " + d.counts.faulty);
console.log("อ่านค่าล่าสุด : " + fmt(d.latest_reading));
console.log("ดึงข้อมูลเมื่อ : " + fmt(d.fetched_at));
'
echo
echo "เสร็จ — reload หน้าเว็บ (http://localhost:8420) เพื่อดูข้อมูลใหม่"
