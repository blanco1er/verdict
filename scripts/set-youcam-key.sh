#!/bin/zsh
# Stores the YouCam API key in the macOS keychain, without ever printing it or writing it to a file.
# The owner pastes the key himself (hidden input). Model: amazon/mandat-alexa/scripts/set-channel3.sh.
# The key is checked with a FREE call (unit balance): no unit is spent.
# Usage: zsh scripts/set-youcam-key.sh
set -euo pipefail
SERVICE="${VERDICT_KEYCHAIN_SERVICE:-verdict-youcam}"
ACCOUNT="youcam"
API="${YOUCAM_API_BASE:-https://yce-api-01.makeupar.com}"

echo "Clé API YouCam (yce.makeupar.com > API Console > API Keys > Create ; elle ne s'affiche qu'une fois)."
printf "Collez la clé puis Entrée (rien ne s'affiche) : "; read -rs KEY; echo
# Forgive common copy slips: "YOUCAM_API_KEY=" prefix, "Bearer ", quotes, spaces.
KEY="${KEY#YOUCAM_API_KEY=}"; KEY="${KEY#Bearer }"; KEY="${KEY//\"/}"; KEY="${KEY//\'/}"; KEY="${KEY// /}"
[ -n "$KEY" ] || { echo "Valeur vide : rien n'a changé."; exit 1; }
[[ "$KEY" =~ ^[A-Za-z0-9._~+/=-]+$ ]] || { echo "Caractères inattendus dans la clé : rien n'a changé."; exit 1; }
echo "Clé reçue : ${#KEY} caractères (non affichée)."

# Free check: the unit balance. The header goes to curl through its standard input, never on the command line.
RESP=$(mktemp); trap 'rm -f "$RESP"' EXIT
CODE=$(printf 'header = "Authorization: Bearer %s"\n' "$KEY" | curl -s -K - -o "$RESP" -w "%{http_code}" "$API/s2s/v1.0/client/credit")
if [ "$CODE" != 200 ]; then
  echo "YouCam refuse cette clé (HTTP $CODE). Réponse de YouCam : $(head -c 300 "$RESP" | tr -d '\n')"
  echo "Rien n'a changé."; exit 1
fi
BAL=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const a=(r.results||[]);const s=a.reduce((t,x)=>t+(x.amount_dec??x.amount??0),0);const e=a.map(x=>x.expiry).filter(Boolean).sort()[0];console.log(s+" unités"+(e?", première expiration le "+new Date(e).toISOString().slice(0,10):""))' "$RESP")
echo "Clé acceptée par YouCam. Solde : $BAL (appel gratuit)."

# Into the keychain through security's standard input: never visible in the process list.
print -r -- "add-generic-password -U -s $SERVICE -a $ACCOUNT -l \"Verdict YouCam API key\" -w $KEY" | security -i >/dev/null
unset KEY
echo "Rangée dans le trousseau (service « $SERVICE »). Rien n'est écrit dans le projet."
echo "Ensuite : zsh scripts/youcam-live.sh check (gratuit), puis zsh scripts/youcam-live.sh dev (app locale en mode réel)."
