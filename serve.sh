#!/usr/bin/env sh
# เปิดดูแบบหน้าจอบนเครื่องตัวเอง โดยไม่ต้องติดตั้งอะไรเพิ่ม
#   ./serve.sh            → http://localhost:5173  (mockups)
#   ./serve.sh frontend/public 8080
set -eu

dir="${1:-mockups}"
port="${2:-5173}"

echo "CarePath · เสิร์ฟ $dir ที่ http://localhost:$port  (Ctrl+C เพื่อหยุด)"
exec python3 -m http.server "$port" --directory "$dir" --bind 127.0.0.1
