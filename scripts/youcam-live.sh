#!/bin/zsh
# Live YouCam work with the key from the macOS keychain (stored by scripts/set-youcam-key.sh).
# The key is handed to Node through the environment only: never printed, never written to a file.
#
#   zsh scripts/youcam-live.sh check
#       FREE: unit balance and the official cost grid for Skin Analysis. Spends nothing.
#   zsh scripts/youcam-live.sh session --kind repeatability --concerns redness,pore,oiliness,moisture photos/*.jpg
#       Shows the cost, then analyses each photo ONLY with --yes (9 units per photo, SD tier, 1-4 concerns).
#       Scores (never the photos) go to src/lib/live/measured.json. --kind: repeatability | control | series.
#   zsh scripts/youcam-live.sh dev [port]
#       Runs the app locally in live mode (camera photos analysed for real, quota and unit floor on).
set -euo pipefail
cd "${0:A:h}/.."
SERVICE="${VERDICT_KEYCHAIN_SERVICE:-verdict-youcam}"
KEY=$(security find-generic-password -s "$SERVICE" -a youcam -w 2>/dev/null) || {
  echo "Aucune clé YouCam dans le trousseau. Lancez d'abord : zsh scripts/set-youcam-key.sh"; exit 1; }

case "${1:-}" in
  check|session)
    YOUCAM_API_KEY="$KEY" exec node scripts/live.mjs "$@"
    ;;
  dev)
    PORT="${2:-3217}"
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "Le port $PORT est pris : choisissez-en un autre (zsh scripts/youcam-live.sh dev 3218)."; exit 1; fi
    echo "App locale en mode réel : http://localhost:$PORT  (Ctrl+C pour arrêter)"
    echo "Plancher d'unités : ${YOUCAM_UNIT_FLOOR:-100}. Plafond local : ${YOUCAM_UNIT_CAP:-120} unités pour cette session."
    YOUCAM_MODE=live YOUCAM_API_KEY="$KEY" YOUCAM_PUBLIC_LIVE=1 YOUCAM_UNIT_CAP="${YOUCAM_UNIT_CAP:-120}" \
      YOUCAM_UNIT_FLOOR="${YOUCAM_UNIT_FLOOR:-100}" exec npx next dev -p "$PORT"
    ;;
  *)
    sed -n '2,12p' "$0"; exit 2
    ;;
esac
