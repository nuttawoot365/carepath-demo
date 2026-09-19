#!/usr/bin/env sh
# เปิดดูหน้าจอบนเครื่องตัวเองและบนมือถือในวงแลนเดียวกัน โดยไม่ต้องติดตั้งอะไรเพิ่ม
#   ./serve.sh                     → mockups ที่พอร์ต 5173
#   ./serve.sh prototype 5174      → ต้นแบบที่กดได้ ที่พอร์ต 5174
#   HOST=127.0.0.1 ./serve.sh      → จำกัดให้เปิดได้เฉพาะเครื่องนี้
set -eu

dir="${1:-mockups}"
port="${2:-5173}"
host="${HOST:-0.0.0.0}"

lan=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo '')

echo "CarePath · เสิร์ฟ $dir"
echo "  เครื่องนี้   http://localhost:$port"
[ -n "$lan" ] && [ "$host" = "0.0.0.0" ] && echo "  มือถือ      http://$lan:$port   (ต้องอยู่ไวไฟวงเดียวกัน)"
echo "  Ctrl+C เพื่อหยุด"
echo

exec python3 -m http.server "$port" --directory "$dir" --bind "$host"
