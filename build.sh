#!/usr/bin/env bash
# Inline every script into one self-contained page.
#   dev.html    the shell you develop against, loading each script separately
#   index.html  the built single file, and what GitHub Pages serves
set -euo pipefail
cd "$(dirname "$0")"

SRC="dev.html"
OUT="index.html"
TMP="$(mktemp)"

# Everything up to the first <script src=...> line
sed '/<script src=/,$d' "$SRC" > "$TMP"

{
  for f in vendor/three.min.js vendor/OrbitControls.js data/catalogue.js \
           src/models.js src/engine.js src/app.js; do
    echo "<script>"
    # guard against a stray </script> inside the source
    sed 's#</script>#<\/script>#g' "$f"
    echo ""
    echo "</script>"
  done
  echo "</body>"
  echo "</html>"
} >> "$TMP"

mv "$TMP" "$OUT"
echo "built: $OUT  ($(du -h "$OUT" | cut -f1))"
