#!/bin/zsh
# Met la démo Verdict en ligne sur Vercel (offre Hobby gratuite, sans carte), avec toutes les variables posées
# depuis le trousseau et les fichiers de secrets locaux : aucune valeur ne s'affiche, aucune n'est écrite dans le projet.
#   zsh scripts/deploy-vercel.sh            variables + déploiement de production
#   zsh scripts/deploy-vercel.sh --env      variables seulement
#   LIVE_PUBLIC=0 zsh scripts/deploy-vercel.sh   coupe l'analyse réelle pour les visiteurs (démo seulement)
# Prérequis (propriétaire, une fois) : npx --yes vercel@62.0.0 login
# Exemple : VERDICT_R2_FILE=~/chemin/vers/r2.json zsh scripts/deploy-vercel.sh
set -euo pipefail
cd "${0:A:h}/.."
PROJECT="${VERDICT_VERCEL_PROJECT:-verdict-youcam}"
VC=(npx --yes vercel@62.0.0)
export VERCEL_TELEMETRY_DISABLED=1
# Fichier JSON local des identifiants R2 (champs account_id, access_key_id, secret_access_key, bucket), hors du dépôt.
R2="${VERDICT_R2_FILE:-}"

"${VC[@]}" whoami >/dev/null 2>&1 || { echo "Vercel n'est pas connecté. Lancez d'abord : npx --yes vercel@62.0.0 login"; exit 1; }
KEY=$(security find-generic-password -s verdict-youcam -a youcam -w 2>/dev/null) || { echo "Clé YouCam absente : zsh scripts/set-youcam-key.sh"; exit 1; }
TOK=$(security find-generic-password -s verdict-visits -a verdict -w 2>/dev/null) || { echo "Jeton des visites absent : zsh scripts/visits-token.sh"; exit 1; }
[ -n "$R2" ] && [ -f "$R2" ] || { echo "Donnez le fichier des identifiants R2 : VERDICT_R2_FILE=/chemin/r2.json zsh scripts/deploy-vercel.sh (sinon les visites ne seraient pas gardées)."; exit 1; }
r2() { node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]]||""))' "$R2" "$1"; }

[ -f .vercel/project.json ] || "${VC[@]}" link --yes --project "$PROJECT" >/dev/null
echo "Projet Vercel lié : $PROJECT"

# Une variable : valeur passée par l'entrée standard, jamais sur la ligne de commande.
put() { # put NOM secret|config  (valeur sur stdin)
  local flag=--no-sensitive; [ "$2" = secret ] && flag=--sensitive
  "${VC[@]}" env add "$1" production --force "$flag" >/dev/null 2>&1 && echo "  $1 posé" || { echo "  échec pour $1"; return 1; }
}
echo "Variables de production :"
print -rn -- live | put YOUCAM_MODE config
print -rn -- "$KEY" | put YOUCAM_API_KEY secret
print -rn -- "${LIVE_PUBLIC:-1}" | put YOUCAM_PUBLIC_LIVE config
print -rn -- "${UNIT_FLOOR:-100}" | put YOUCAM_UNIT_FLOOR config
print -rn -- "${UNIT_CAP:-800}" | put YOUCAM_UNIT_CAP config
print -rn -- "$TOK" | put VERDICT_VISITS_TOKEN secret
GEM=$(security find-generic-password -s verdict-gemini -a gemini -w 2>/dev/null || true)
if [ -n "$GEM" ]; then
  print -rn -- "$GEM" | put GEMINI_API_KEY secret
  print -rn -- "${GEMINI_MODEL:-gemini-2.5-flash}" | put GEMINI_MODEL config
else
  echo "  (pas de clé Gemini : le scan produit proposera la saisie. zsh scripts/set-gemini-key.sh)"
fi
r2 account_id | put VERDICT_R2_ACCOUNT_ID secret
r2 access_key_id | put VERDICT_R2_ACCESS_KEY_ID secret
r2 secret_access_key | put VERDICT_R2_SECRET_ACCESS_KEY secret
r2 bucket | put VERDICT_R2_BUCKET config
print -rn -- verdict/visits | put VERDICT_R2_PREFIX config
unset KEY TOK

[ "${1:-}" = --env ] && { echo "Variables posées. Déploiement non lancé (--env)."; exit 0; }
echo "Déploiement de production…"
URL=$("${VC[@]}" deploy --prod --yes 2>/dev/null | tail -1)
echo "En ligne : $URL"
echo "Vérification :"
for p in / /measured /privacy /api/youcam/status; do echo "  $p $(curl -s -o /dev/null -w '%{http_code}' -H 'x-verdict-internal: 1' "$URL$p")"; done
echo "Ensuite : node scripts/visits-report.mjs --url <adresse publique> --lien-interne   (à ouvrir une fois sur vos appareils)"
