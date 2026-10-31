#!/bin/zsh
# Stores the Gemini API key (product scan) in the macOS keychain, never printed, never written to the project.
# The owner pastes it himself (hidden input). Checked with a FREE call (model list).
# Usage: zsh scripts/set-gemini-key.sh
set -euo pipefail
SERVICE="verdict-gemini"
ACCOUNT="gemini"

echo "Clé API Gemini (Google AI Studio > Get API key, ou la variable GEMINI de Tourbook sur Render)."
printf "Collez la clé puis Entrée (rien ne s'affiche) : "; read -rs KEY; echo
KEY="${KEY#GEMINI_API_KEY=}"; KEY="${KEY//\"/}"; KEY="${KEY//\'/}"; KEY="${KEY// /}"
[ -n "$KEY" ] || { echo "Valeur vide : rien n'a changé."; exit 1; }
echo "Clé reçue : ${#KEY} caractères (non affichée)."

RESP=$(mktemp); trap 'rm -f "$RESP"' EXIT
CODE=$(printf 'header = "x-goog-api-key: %s"\n' "$KEY" | curl -s -K - -o "$RESP" -w "%{http_code}" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200")
if [ "$CODE" != 200 ]; then
  echo "Google refuse cette clé (HTTP $CODE). Rien n'a changé."; exit 1
fi
MODEL=$(node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const n=(j.models||[]).map(m=>m.name.replace("models/","")).filter(n=>/flash/.test(n)&&!/(image|tts|audio|live|embed|lite)/.test(n));n.sort();console.log(n.at(-1)||"")' "$RESP")
print -r -- "add-generic-password -U -s $SERVICE -a $ACCOUNT -l \"Verdict Gemini API key\" -w $KEY" | security -i >/dev/null
echo "Clé acceptée par Google et rangée dans le trousseau (« $SERVICE »). Modèle Flash le plus récent : ${MODEL:-inconnu}."
