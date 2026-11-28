#!/bin/bash
# Re-generate public/media/notion from originals in <dir>/src (download from the Siin-Notion repo).
# GIF -> MP4 (H.264, <=800px, CRF 27) + WebP poster (first frame). PNG -> WebP q80 (<=1200px, panoramas <=1600px).
# Then update lib/notion/optimized-media.json (width/height = ORIGINAL size).
set -e
cd "${1:-.}"
for f in src/*; do
  b=$(basename "$f"); stem="${b%.*}"; safe=$(echo "$stem" | tr ' ' '-' )
  case "$b" in
   *.gif)
     w=$(python3 -c "from PIL import Image;print(min(800,Image.open('$f').size[0]))")
     ffmpeg -loglevel error -y -i "$f" -vf "scale=${w}:-2:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 27 -movflags +faststart -an "out/$safe.mp4"
     ffmpeg -loglevel error -y -i "$f" -vf "scale=${w}:-2:flags=lanczos" -frames:v 1 -c:v libwebp -q:v 70 "out/$safe.webp"
     ;;
   *.png)
     python3 - "$f" "out/$safe.webp" <<'PY'
import sys
from PIL import Image
im=Image.open(sys.argv[1]); im.load()
mw=1600 if im.size[0]>im.size[1]*3 else 1200
if im.size[0]>mw: im=im.resize((mw,round(im.size[1]*mw/im.size[0])),Image.LANCZOS)
if im.mode not in ('RGB','RGBA'): im=im.convert('RGBA')
im.save(sys.argv[2],'WEBP',quality=80,method=6)
PY
     ;;
  esac
done
